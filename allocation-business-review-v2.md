# Allocation Business Review — Vòng 2
## Góc Nhìn BA / Product Owner / Solution Architect

> **Ngày:** 2026-06-11  
> **Dựa trên:** Toàn bộ source code đã đọc + phân tích nghiệp vụ  
> **Lưu ý:** Tài liệu này kết hợp CODE VERIFIED và BUSINESS ANALYSIS. Hai loại được đánh dấu rõ ràng.

---

## What The System Claims To Do

Giao diện Admin cho Admin thấy:

- **Quota**: "Tôi đang thiết lập kế hoạch phân bổ giường theo năm học"
- **Quota vs Actual**: "Tôi đang so sánh kế hoạch với thực tế"
- **Simulation**: "Tôi đang mô phỏng kết quả phân bổ trước khi chạy thật"
- **Cohort Shift**: "Tôi đang theo dõi sự dịch chuyển sinh viên qua các năm"

Tổng hợp lại, hệ thống tuyên bố: **"Phân bổ KTX có kiểm soát theo năm học với công cụ lập kế hoạch, dự báo và giám sát."**

---

## What The System Actually Does

[CODE VERIFIED]

Hệ thống thực sự làm hai việc độc lập:

### Việc 1 — Allocation Engine (hoạt động thật)
Khi Admin chạy một chu kỳ phân phòng:
1. Lấy toàn bộ `AllocationRegistration` có `status=PENDING` trong cycle
2. Tính điểm từng người: `distance×0.35 + financial×0.35 + priority×0.30`
3. Xếp hạng giảm dần
4. Lần lượt gán bed cho đến hết `availableBeds` (đếm từ `dormitories.floors.rooms.occupants.active`)
5. Phần còn lại → waitlisted

Đây là một **pure ranking engine**. Không có bất kỳ tham chiếu nào đến quota.

### Việc 2 — Quota Module (analytics độc lập)
Khi Admin tạo và xem quota:
1. Admin nhập `year1=40%, year2=30%...` và `totalCapacity`
2. Hệ thống tính `slot = totalCapacity × percentage`
3. Hệ thống query `students` collection → đếm sinh viên theo year group → hiển thị "Actual"
4. Hiển thị bảng so sánh Quota vs Actual

Hai module này **không giao tiếp với nhau** trong luồng phân phòng thực tế.

---

## Câu Hỏi 8 — Nếu Xóa Toàn Bộ Module Quota, Cái Gì Hỏng?

### Không hỏng

[CODE VERIFIED]

| Chức năng | Trạng thái sau khi xóa quota |
|-----------|-------------------------------|
| `AllocationService.executeAllocation()` | ✅ Chạy bình thường |
| `AllocationService.executeAutoAssignment()` | ✅ Chạy bình thường |
| `SimulationService.runSimulation()` | ✅ Chạy bình thường |
| `AllocationService.calculateSmartRankingScore()` | ✅ Chạy bình thường |
| Student đăng ký KTX | ✅ Chạy bình thường |
| Room assignment | ✅ Chạy bình thường |
| Cohort shift snapshot | ✅ Chạy bình thường |
| Rebalancing service | ✅ Chạy bình thường |

### Hỏng

[CODE VERIFIED]

| Chức năng | Lý do hỏng |
|-----------|-----------|
| `previewEvictionPlan()` | Dùng `quotaConfig.quotas` để tính overflow per year group |
| `planEviction()` | Gọi `calculateEvictionPlan()` — cần quota slots |
| `calculateEvictionPlan()` | Tính `overflow = actual - quotaSlot` — cần quota |
| `finalizeQuota()` | Toàn bộ hàm dựa vào quotaConfig |
| `publishQuotaAndCreatePolicy()` | Tạo AllocationPolicy từ quota — mất pipeline này |
| Quota dashboard UI | Xóa module = mất toàn bộ màn hình |
| Leadership dashboard | `buildMultiYearQuotaTrend()` cần QuotaConfig |

### Kết luận cho Q8

[BUSINESS ANALYSIS]

**Allocation vẫn chạy 100% nếu xóa quota.** Phần thực sự quan trọng với nghiệp vụ KTX là eviction planning — cần quota để xác định "nhóm năm nào đang thừa slot, cần di dời ai". Đây là điểm kết nối duy nhất có giá trị nghiệp vụ thật.

---

## Câu Hỏi 9 — Ý Tưởng Ban Đầu Của Người Thiết Kế

[BUSINESS ANALYSIS + CODE VERIFIED]

### Đánh giá từng khả năng

**Khả năng A — Quota là giới hạn cứng (Hard Constraint)**

Không phải. Evidence:
- `executeAllocation()` không check quota limits
- `simulate()` không check quota limits
- Không có code nào dừng việc gán bed khi year1 đạt 400 slots

**Verdict A: SAI**

---

**Khả năng B — Quota chỉ là KPI quản lý (Reporting Dashboard)**

Gần đúng nhất với code hiện tại, nhưng chưa hoàn toàn. Evidence:
- Quota không tham gia allocation ✅ (phù hợp KPI)
- Quota có dashboard so sánh ✅ (phù hợp KPI)
- Nhưng quota CÓ tham gia eviction planning ← điều này vượt qua KPI thuần túy

**Verdict B: PHẦN LỚN ĐÚNG, nhưng không phải 100%**

---

**Khả năng C — Quota là công cụ planning cho tương lai**

Một phần đúng. Evidence:
- `effectiveFrom` / `effectiveTo` fields trong QuotaConfig → quota có thời hạn hiệu lực
- `analyticsOptions.recommendationWindowYears = 3` → hệ thống có ý định dùng historical data để recommend quota tương lai
- `recommendQuotaFromTrends()` → tự động đề xuất quota dựa trên xu hướng nhiều năm

**Verdict C: ĐÚY ĐÍCH THIẾT KẾ BAN ĐẦU, nhưng chưa hoàn thiện**

---

### Nhận định tổng hợp

[BUSINESS ANALYSIS]

Hệ thống được thiết kế theo intent sau:

> **Quota = Planning Tool → triggers Policy → Policy drives Allocation**

Pipeline dự định:
```
Admin sets Quota (year percentages)
        ↓
Quota published → auto-creates AllocationPolicy
        ↓
AllocationPolicy drives allocation engine
        ↓
Quota dashboard compares plan vs reality
        ↓
Eviction planning enforces quota limits for existing residents
```

Vấn đề là **pipeline này bị đứt gãy ở bước 3**: AllocationPolicy được tạo từ quota publish, nhưng policy chỉ chứa scoring weights (distance, financial, priority) — không chứa year-group slot limits. Quota percentages không được truyền vào policy rules. Vì vậy allocation engine không biết gì về year1=40%.

**Kết luận**: Người thiết kế có ý định tạo một pipeline hoàn chỉnh. Pipeline được implement đến 70% nhưng bước quan trọng nhất — truyền quota constraints vào allocation logic — bị bỏ qua.

---

## Câu Hỏi 10 — Mô Phỏng Thực Tế: 1000 Giường, 2000 Sinh Viên Đăng Ký

[BUSINESS ANALYSIS dựa trên CODE VERIFIED behavior]

### Input
- 1000 giường vật lý, hiện tại đang có 0 người ở (giả định đầu năm học)
- 2000 sinh viên đăng ký, phân bố đều: 500 year1, 500 year2, 500 year3, 500 year4+
- Điểm ưu tiên phân bố ngẫu nhiên (uniform distribution)
- Quota Admin đã set: year1=40% (400 beds), year2=30% (300), year3=20% (200), year4+=10% (100)

### Điều Hệ Thống Thực Tế Làm

```
1. AllocationService nhận 2000 registrations
2. Tính smartScore cho từng người (random distribution → điểm phân tán)
3. Xếp hạng 1→2000 theo điểm
4. Gán bed cho top 1000
```

Vì điểm phân bố ngẫu nhiên đều, top 1000 sẽ phân bố:
```
year1:    ≈ 250 (25%)
year2:    ≈ 250 (25%)
year3:    ≈ 250 (25%)
year4+:   ≈ 250 (25%)
```

### So Sánh Với Quota

| Year Group | Quota Admin đặt | Thực tế allocation | Chênh lệch |
|------------|-----------------|---------------------|------------|
| Year 1     | 400 beds (40%)  | ≈ 250 beds (25%)    | **-150**   |
| Year 2     | 300 beds (30%)  | ≈ 250 beds (25%)    | **-50**    |
| Year 3     | 200 beds (20%)  | ≈ 250 beds (25%)    | **+50**    |
| Year 4+    | 100 beds (10%)  | ≈ 250 beds (25%)    | **+150**   |

### Kết Quả

[BUSINESS ANALYSIS]

1. **Tân sinh viên (year1) chỉ nhận được 250 beds thay vì 400** — họ chưa có lịch sử khó khăn tài chính, chưa có hồ sơ xa nhà dài, điểm có thể thấp hơn
2. **Sinh viên year4+ nhận được 250 beds thay vì 100** — họ đã ở KTX nhiều năm, có hồ sơ tài chính mạnh, điểm cao
3. **Quota = 0 ý nghĩa**. Admin set 40% cho year1 nhưng năm 1 thực tế chỉ được 25%
4. Admin nhìn vào dashboard "Quota vs Actual" và thấy "under_quota" cho year1 nhưng không có cơ chế nào tự động điều chỉnh

### Hậu Quả Thực Tế

Đây là scenario thường xảy ra ở KTX đại học Việt Nam: sinh viên năm 4+ "chiếm" phòng vì họ biết hệ thống, biết cách tối ưu hồ sơ. Tân sinh viên năm 1 không biết gì, điểm thấp, không được phòng. Đây là **ngược với mục tiêu ưu tiên tân sinh viên** mà KTX thường đặt ra.

---

## Câu Hỏi 11 — Có Phải Đang Tồn Tại Một "Illusion" Không?

[BUSINESS ANALYSIS]

**Có. Đây là Management Illusion.**

### Định nghĩa Management Illusion trong context này

Admin được cung cấp giao diện tạo ra cảm giác kiểm soát:
- Nhập percentages → cảm giác "tôi đang quyết định ai được ưu tiên"
- Xem Quota vs Actual → cảm giác "tôi đang giám sát kết quả"
- Chạy Simulation → cảm giác "tôi đang kiểm tra trước khi quyết định"

Nhưng thực tế:
- Percentages không ảnh hưởng allocation → **quyết định không có hiệu lực**
- Actual là dữ liệu sai (tổng sinh viên DB ≠ người ở KTX) → **giám sát dựa trên số liệu sai**
- Simulation chỉ test scoring policy, không test quota → **kiểm tra sai đối tượng**

### Mức Độ Nghiêm Trọng

[BUSINESS ANALYSIS]

Đây không chỉ là UX issue. Đây là **process failure**:

- Nếu Hiệu trưởng/Ban Giám hiệu yêu cầu báo cáo "KTX đang ưu tiên tân sinh viên như thế nào?", Admin sẽ trả lời "Quota year1=40%, Actual=30%, đang under-quota" → nhưng số 30% không phải từ người ở KTX, và 40% chưa bao giờ được enforce
- Quyết định dựa trên dữ liệu này sẽ sai
- Chính sách KTX sẽ không đạt được mục tiêu dù trên báo cáo có vẻ ổn

---

## Câu Hỏi 12 — Thiết Kế Lại Luồng Nghiệp Vụ Chuẩn

### Version 1 — Quota Chỉ Là Dashboard (Reporting Only)

**Mô tả**: Allocation chạy hoàn toàn theo score. Quota chỉ là target mà Admin muốn hướng tới, không có enforcement. Dashboard hiển thị "mục tiêu vs thực tế đã xảy ra".

**Thay đổi cần làm**:
- Sửa tên "Actual" → "Kết quả phân bổ thực tế" (lấy từ RoomAllocation, không phải students DB)
- Làm rõ trong UI: "Đây là mục tiêu, không phải giới hạn"
- Simulation vẫn giữ nguyên

**Ưu điểm**: Đơn giản. Không thay đổi logic. Tân sinh viên nhận phòng dựa trên merit, không bị giới hạn cứng.  
**Nhược điểm**: Quota không có tác dụng thực sự. Năm4+ có thể chiếm phần lớn giường.  
**Độ phức tạp**: Thấp — chủ yếu là UX fix.  
**Phù hợp KTX đại học**: Thấp — không đảm bảo tân sinh viên có chỗ ở.

---

### Version 2 — Quota Là Soft Target (Preferred Distribution)

**Mô tả**: Allocation vẫn dựa trên score, nhưng khi gán bed, hệ thống cố gắng đạt year-group target trước. Nếu một year group đã đạt target, ưu tiên bị giảm nhưng không bị chặn hoàn toàn.

**Cơ chế**:
```
Mỗi candidate có:
  adjustedScore = smartScore × yearGroupMultiplier

yearGroupMultiplier:
  - Nếu yearGroup chưa đạt quota: 1.2 (boost 20%)
  - Nếu yearGroup đã đạt quota: 0.8 (penalty 20%)
  - Nếu yearGroup vượt 120% quota: 0.5 (penalty lớn)
```

**Thay đổi**:
- `executeAllocation()` nhận thêm `quotaConfig` parameter
- Tính `yearGroupMultiplier` realtime khi phân phòng
- Simulation cần update để reflect multiplier

**Ưu điểm**: Linh hoạt. Vẫn fair với individual merit. Hướng về target mà không cứng nhắc.  
**Nhược điểm**: Vẫn không đảm bảo đúng tỷ lệ. Có thể bị game (admin điều chỉnh multiplier).  
**Độ phức tạp**: Trung bình — cần sửa allocation engine + simulation.  
**Phù hợp KTX đại học**: Tốt — cân bằng giữa fair và có định hướng.

---

### Version 3 — Quota Là Hard Constraint (Strict Pool)

**Mô tả**: Mỗi year group có pool giường riêng. Khi pool của year group X đầy, không year group nào có thể lấy từ pool đó. Giống như "hạn ngạch visa".

**Cơ chế**:
```
Pool setup:
  year1_pool = 400 beds
  year2_pool = 300 beds
  year3_pool = 200 beds
  year4_plus_pool = 100 beds

Allocation:
  for each candidate (sorted by score):
    if year1_pool > 0 and candidate.yearGroup == 'year1':
      assign bed, year1_pool -= 1
    elif year2_pool > 0 and candidate.yearGroup == 'year2':
      assign bed, year2_pool -= 1
    ...
    else:
      waitlist
```

**Thay đổi**:
- Toàn bộ `executeAllocation()` phải refactor
- Cần xử lý trường hợp pool còn thừa (vd year4+ pool chỉ có 50 đăng ký nhưng pool = 100 → 50 beds bỏ trống)
- Cần "overflow policy": beds thừa từ year4+ có chuyển sang year1 không?

**Ưu điểm**: Đảm bảo tân sinh viên luôn có đủ chỗ. Predictable. Dễ báo cáo với BGH.  
**Nhược điểm**: Có thể tạo bất công (year4+ sinh viên khó khăn nghiêm trọng bị từ chối vì hết pool). Lãng phí nếu pool không dùng hết. Phức tạp khi xử lý overflow.  
**Độ phức tạp**: Cao — cần refactor allocation, simulation, và policy model.  
**Phù hợp KTX đại học**: Tốt nếu ưu tiên minh bạch và đảm bảo tân sinh viên. Nhưng cần cân nhắc kỹ overflow policy.

---

### Khuyến Nghị

[BUSINESS ANALYSIS]

Với context KTX đại học Việt Nam, **Version 2 (Soft Target)** là lựa chọn tốt nhất vì:
1. Không bỏ lãng phí beds
2. Vẫn ưu tiên tân sinh viên (multiplier 1.2)
3. Không tạo bất công cứng nhắc
4. Dễ explain cho sinh viên: "Điểm của bạn + mức độ cần thiết của nhóm năm"
5. Dễ implement hơn Version 3

---

## Câu Hỏi 13 — Mismatch Thời Gian: Quota Là Tương Lai, Actual Là Hiện Tại

### Xác nhận từ code

[CODE VERIFIED]

**Khi nào quota được tạo?**

Quota cho `academicYear = "2026-2027"` được tạo TRƯỚC khi năm học bắt đầu. Thông thường tháng 5-6/2026 (trước kỳ tuyển sinh tháng 9).

**Actual được tính từ đâu khi đó?**

```javascript
// quotaComparisonService.js - aggregateStudentsByYearGroup()
const academicYearStart = 2026; // từ "2026-2027"

// yearInSchool = 2026 - enrollmentYear + 1
// Sinh viên year1 của 2026-2027 = enrollmentYear = 2026
// Tháng 6/2026: K72 (enrollmentYear=2026) chưa nhập học → count = 0
```

**Kết quả:**

| Thời điểm | Quota 2026-2027 | Actual year1 |
|-----------|-----------------|--------------|
| Tháng 6/2026 (tạo quota) | 40% = 400 beds | 0 sinh viên (K72 chưa vào) |
| Tháng 9/2026 (nhập học) | 40% = 400 beds | ~400 K72 vào trường |
| Tháng 10/2026 (sau đăng ký KTX) | 40% = 400 beds | 500 K72 trong DB |

### Phân Tích BI

[BUSINESS ANALYSIS]

**Đây là một lỗi BI nghiêm trọng vì ba lý do:**

**Lý do 1 — Apples vs Oranges**

```
Quota "2026-2027" = kế hoạch phân bổ cho NĂM HỌC TƯƠNG LAI
Actual "2026-2027" = đếm sinh viên trong DB NGAY BÂY GIỜ với NHÃN năm tương lai
```

Hai con số này không bao giờ có thể được compare có ý nghĩa vì chúng đo lường hai thứ ở hai thời điểm khác nhau.

**Lý do 2 — Moving Target Problem**

Actual thay đổi hàng ngày (sinh viên mới được thêm vào, sinh viên cũ tốt nghiệp). Quota là một con số cố định được đặt một lần. Dashboard "Quota vs Actual" sẽ luôn thay đổi mà không có nghĩa.

Tháng 6: year1 Actual = 0% → "under quota 40%"  
Tháng 9: year1 Actual = 35% → "under quota 5%"  
Tháng 10: year1 Actual = 38% → "nearly on target"  
Tháng 3 năm sau: year1 Actual = 38% → còn số cũ vì K72 vẫn đang học

Không có thời điểm nào mà con số này có ý nghĩa kinh doanh rõ ràng.

**Lý do 3 — Wrong Data Source Entirely**

Ngay cả khi tính đúng thời điểm, Actual = "tổng sinh viên trong DB" ≠ "số sinh viên đang ở KTX". Quota là về beds trong KTX. Actual phải lấy từ `RoomAllocation.status=ACTIVE` không phải từ `students` collection.

**Analogy để hình dung:**

Giống như một khách sạn đặt quota "40% phòng cho khách nước ngoài" nhưng đo "Actual" bằng cách đếm tổng khách Việt Nam đang đứng trên đường phố quanh khách sạn, không phải số người đang check-in. Con số không có ý nghĩa.

---

## Câu Hỏi 14 — Nhận Định Cuối Cùng

### Verdict: **B — Đúng Một Phần, nhưng phần sai là phần quan trọng nhất**

[BUSINESS ANALYSIS]

---

### Cái đúng

**Allocation engine**: Tốt. Smart ranking (distance + financial + priority) là cơ chế công bằng và defensible. Audit trail đầy đủ. Rebalancing service logic sound.

**Cohort shift analytics**: Tốt. Cơ chế tính năm học từ enrollmentYear là chính xác và không cần cron job — elegant.

**Code architecture tổng thể**: Tốt. Service separation rõ ràng. Schema design hợp lý.

---

### Cái sai (và tại sao nghiêm trọng)

**1. Quota không ảnh hưởng allocation** — Đây là vấn đề product, không phải bug code. Nếu tồn tại tính năng "Quota" mà không enforce, đó là feature không hoàn chỉnh được ship như đã hoàn chỉnh.

**2. "Actual" đo sai đối tượng** — Quota là về "giường KTX theo năm học". Actual phải là "số người đang ở KTX theo năm học" (từ RoomAllocation). Không phải "tổng sinh viên trong trường theo năm học". Đây là sai định nghĩa KPI cơ bản.

**3. Time mismatch trong dashboard** — So sánh future plan với present snapshot tạo ra số liệu luôn misleading. Không có stakeholder nào có thể ra quyết định đúng từ dashboard này.

**4. Year group inconsistency** — Quota dùng 4 nhóm, Allocation dùng 3 nhóm. Không bao giờ có thể reconcile được.

**5. Simulation không test quota** — Tên "Simulation" tạo kỳ vọng "thử xem quota này có work không", nhưng simulation không biết quota tồn tại. Admin chạy simulation, thấy kết quả, nghĩ rằng "kết quả sẽ theo đúng quota mình đã set", nhưng thực tế không phải vậy.

---

## Recommended Architecture

### Nguyên tắc thiết kế lại

Bốn nguyên tắc để fix hệ thống mà không phá hủy những gì đang hoạt động:

**Nguyên tắc 1 — Tách Quota thành hai khái niệm rõ ràng**

```
CapacityPlan (hiện tại gọi là Quota) = "Mục tiêu phân bổ"
AllocationResult = "Thực tế đã phân bổ"
```

`AllocationResult` lấy từ `RoomAllocation.status=ACTIVE` grouped by `studentYearGroup`.

**Nguyên tắc 2 — Đồng bộ thời điểm**

Dashboard "Plan vs Reality" chỉ có ý nghĩa sau khi một cycle hoàn thành.
```
Cycle 2026-2027 COMPLETED
→ Plan: year1=400, year2=300...
→ Reality: year1=250 allocated, year2=280 allocated...
→ Gap Analysis: year1 under by 150
```

Không compare plan với DB snapshot giữa chừng.

**Nguyên tắc 3 — Thống nhất year group schema**

Chọn 4 nhóm (year1, year2, year3, year4_plus) và áp dụng toàn codebase. Sửa `allocationService.js` để dùng 4 nhóm thay vì 3.

**Nguyên tắc 4 — Kết nối quota với allocation (Version 2 Soft Target)**

```javascript
// Trong executeAllocation():
const quotaConfig = await QuotaConfig.findOne({ academicYear, isDraft: false });
const allottedCounts = { year1: 0, year2: 0, year3: 0, year4_plus: 0 };

for (const candidate of ranked) {
  const group = candidate.yearGroup;
  const quotaSlot = quotaConfig.getSlotFor(group);
  const multiplier = allottedCounts[group] < quotaSlot ? 1.2 : 0.8;
  candidate.adjustedScore = candidate.smartScore * multiplier;
}

// Re-sort by adjustedScore
// Then assign beds
```

---

## Final Business Verdict

```
┌─────────────────────────────────────────────────────────┐
│ HỆ THỐNG CÓ HAI LỚP                                     │
│                                                         │
│ LỚP 1: Allocation Engine                                │
│ → Đúng. Công bằng. Hoạt động.                           │
│ → Cần thêm: year-group awareness                        │
│                                                         │
│ LỚP 2: Quota / Analytics / Dashboard                    │
│ → Có ý tưởng đúng                                       │
│ → Implementation chưa kết nối với Lớp 1                 │
│ → Data source sai (students DB ≠ KTX residents)         │
│ → Time reference sai (future plan vs present snapshot)  │
│ → Tạo ảo giác quản lý, không tạo quản lý thực           │
│                                                         │
│ KẾT LUẬN:                                               │
│ Quota là Cosmetic, không phải Operational               │
│ Dashboard là Misleading, không phải Informative         │
│ Hệ thống cần 3 fixes để production-ready:               │
│   1. Fix data source của Actual                         │
│   2. Connect quota vào allocation (soft target)         │
│   3. Unify year group schema (4 nhóm)                   │
│                                                         │
│ Nếu không fix: hệ thống vẫn phân phòng được,            │
│ nhưng không thể đảm bảo chính sách ưu tiên tân SV,      │
│ và mọi báo cáo quản lý đều sẽ misleading.               │
└─────────────────────────────────────────────────────────┘
```

---

*Tài liệu này phản ánh trạng thái code tại 2026-06-11. Các nhận định [BUSINESS ANALYSIS] dựa trên kinh nghiệm nghiệp vụ quản lý KTX đại học, không chỉ từ code.*
