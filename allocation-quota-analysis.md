# Báo Cáo Phân Tích Hệ Thống Allocation / Quota / Simulation

> **Ngày:** 2026-06-11  
> **Phạm vi:** Toàn bộ code liên quan đến Quota, Cohort Shift, Simulation, Allocation  
> **Cơ sở:** Đọc trực tiếp từ source code, không suy đoán

---

## Câu Hỏi 1 — "Actual %" trong màn hình Quota vs Actual đang được tính như thế nào?

### Nguồn dữ liệu chính xác

[CODE VERIFIED]  
Actual được tính bởi hàm `aggregateStudentsByYearGroup()` trong file `src/services/quotaComparisonService.js` (line 86–229).

Hàm này truy vấn **collection `students`** (StudentCollection), không phải:
- AllocationRegistration
- RoomAllocation
- CohortShift snapshot
- bất kỳ bảng nào khác

**MongoDB aggregation pipeline:**
1. `$match`: lọc `role: { $ne: 'admin' }` — tức là **tất cả sinh viên trong DB trừ admin**
2. Tính `normalizedEnrollmentYear` từ field `enrollmentYear` (ưu tiên) hoặc `academicYear` (fallback)
3. Tính `yearInSchool = academicYearStart - normalizedEnrollmentYear + 1`
4. Map sang year group:
   - `yearInSchool ≤ 1` → `year1`
   - `yearInSchool = 2` → `year2`
   - `yearInSchool = 3` → `year3`
   - `yearInSchool ≥ 4` → `year4_plus`
5. `$group` đếm số lượng từng nhóm

**Kết quả:**

```
actualCounts = { year1: N1, year2: N2, year3: N3, year4_plus: N4 }


Sau đó trong `buildDashboardRows()` (`quota-admin-controller.js`, line 512–547):

```javascript
const actualTotal = YEAR_GROUPS.reduce((sum, group) => 
    sum + (Number(comparison[group]?.actual) || 0), 0);

const actualPercentage = actualTotal > 0
    ? Number(((actual / actualTotal) * 100).toFixed(2))
    : 0;
```

### Trả lời câu hỏi của bạn

[CODE VERIFIED]  
Với ví dụ:
- Năm 1: 300 sinh viên trong DB có `enrollmentYear = academicYearStart`
- Năm 2: 250 sinh viên có `enrollmentYear = academicYearStart - 1`
- Năm 3: 200 sinh viên có `enrollmentYear = academicYearStart - 2`
- Năm 4+: 250 sinh viên có `enrollmentYear ≤ academicYearStart - 3`

Thì:
```
Actual Year 1 = 300/1000 = 30%
Actual Year 2 = 250/1000 = 25%
Actual Year 3 = 200/1000 = 20%
Actual Year 4+ = 250/1000 = 25%
```

**Đây là tỷ lệ sinh viên theo năm học trên TOÀN BỘ student database — không phân biệt sinh viên có đang ở KTX hay không.**

### Cảnh báo nghiệp vụ quan trọng

[DEDUCE]  
Admin nhìn vào số liệu "Actual" có thể hiểu nhầm đây là:
- Số sinh viên đang thực tế ở KTX theo từng năm

Nhưng thực tế đây là:
- Số sinh viên được ghi nhận trong hệ thống theo năm học, **không liên quan đến việc họ có đang ở KTX hay không**

---

## Câu Hỏi 2 — Simulation đang mô phỏng cái gì?

### Input của Simulation

[CODE VERIFIED]  
File: `src/services/simulationService.js`, `runSimulation()` (line 20–76).

Input bắt buộc:
1. `cycleId` — ID của một `AllocationCycle` đã tồn tại
2. `policyId` hoặc `policy` object — một `AllocationPolicy` document

Dữ liệu simulation lấy từ:
- **Collection `AllocationRegistration`**: lọc `{ allocationCycleId: cycleId, status: 'PENDING' }` — đây là danh sách sinh viên đã nộp đơn đăng ký KTX cho chu kỳ này
- **Collection `dormitories`**: đếm `availableBeds` thực tế từ `room.occupants.filter(o => o.active).length`

### Simulation đang làm gì

[CODE VERIFIED]  
`simulate()` (line 82–174):

```
1. Lấy tất cả registration PENDING trong cycle
2. Tính điểm cho từng registration:
   - distance: 35%
   - financial difficulty: 35%
   - priority level: 30%
3. Sort theo điểm giảm dần (tie-break: ngày đăng ký sớm hơn)
4. Gán bed lần lượt từ trên xuống cho đến khi hết availableBeds
5. Số còn lại → waitlisted
6. Tính fairness deviation
7. Tạo warnings
```

### Điều Simulation KHÔNG làm

[CODE VERIFIED]  
Simulation **hoàn toàn không sử dụng** các trường quota (year1=40%, year2=30%, v.v.).

Quota percentage và slot **không tham gia bất kỳ phép tính nào** trong `simulate()`. Simulation chỉ quan tâm đến:
- Số beds vật lý còn trống (`availableBeds`)
- Điểm ranking của từng sinh viên đã đăng ký

### Simulation đang so sánh cái gì

[CODE VERIFIED]  
Khi `compareSimulations(cycleId, policyId1, policyId2)`:

So sánh **hai policy scoring khác nhau** áp dụng lên **cùng một tập registrations**:
- Policy 1 cho bao nhiêu người được bed
- Policy 2 cho bao nhiêu người được bed
- Fairness deviation của từng policy

Không so sánh quota vs actual, không so sánh năm học với nhau.

### Simulation đang giả định điều gì

[CODE VERIFIED + DEDUCE]  
- Giả định `availableBeds` là số giường còn trống TẠI THỜI ĐIỂM CHẠY SIMULATION (live data từ DB)
- Không dự báo tương lai
- Không mô phỏng sinh viên năm 1 chưa tồn tại
- Không sử dụng historical data
- Không dùng cohort shift

**Kết luận**: Simulation là công cụ kiểm tra xem "nếu tôi dùng policy A thay vì policy B, thì với tập đơn đăng ký hiện tại, ai sẽ được phòng, ai vào danh sách chờ?"

---

## Câu Hỏi 3 — Hệ thống có thực hiện việc dịch chuyển cohort khi chuyển năm học không?

### Trả lời ngắn

[CODE VERIFIED]  
**Có** — nhưng không phải bằng cách ghi đè dữ liệu gốc. Cohort shift xảy ra **tự động tại thời điểm đọc dữ liệu** thông qua phép tính toán học.

### Cơ chế hoạt động

[CODE VERIFIED]  
File: `src/services/quotaComparisonService.js`, `src/services/cohortShiftService.js`

```javascript
// Công thức core — tính tại runtime, không lưu vào DB
yearInSchool = academicYearStart - enrollmentYear + 1
```

Ví dụ:
- Sinh viên có `enrollmentYear = 2024` (K70)
- Khi query với `academicYear = "2025-2026"` → `yearInSchool = 2025 - 2024 + 1 = 2` → `year2`
- Khi query với `academicYear = "2026-2027"` → `yearInSchool = 2026 - 2024 + 1 = 3` → `year3`

**Không cần cron job, không cần migration** — năm học thay đổi trong query thì năm của sinh viên tự thay đổi.

### CohortShiftService làm gì

[CODE VERIFIED]  
File: `src/services/cohortShiftService.js`, `generateShiftSnapshot()` (line 198–257)

Đây là **analytics/reporting service**, không phải mutation service:
- Đọc từ `StudentCollection` và `RoomAllocation`
- Tính phân bố cohort cho một `academicYear`
- Lưu snapshot vào collection `CohortShift` (upsert per academicYear)
- Mục đích: lưu lịch sử phân bố để xem trend, timeline, transition

### academicYearTransitionService.executeShiftToAllStudents

[CODE VERIFIED]  
File: `src/services/academicYearTransitionService.js`, line 126–163

Hàm này CÓ ghi vào DB nhưng **chỉ ghi vào field phụ**:
```javascript
$set: {
    'priorityDetails.shiftedYearGroup': shiftYearGroup(student, academicYear),
    'priorityDetails.lastShiftAcademicYear': academicYear,
    updatedAt: new Date()
}
```

Không thay đổi `enrollmentYear`, không thay đổi `academicYear` gốc của sinh viên. Đây là field phụ cho reporting, không ảnh hưởng đến logic tính năm học.

### Cron / Scheduler

[CODE VERIFIED]  
Không có cron job tự động chạy cohort shift. `generateShiftSnapshot` được gọi khi Admin bấm "Run Shift" trên UI (`POST /api/cohort-shift/run`).

**Kết luận**: Cohort shift xảy ra tự động trong mọi phép tính qua công thức `yearInSchool = academicYearStart - enrollmentYear + 1`. Không cần trigger thủ công cho logic nghiệp vụ, chỉ cần trigger để tạo snapshot analytics.

---

## Câu Hỏi 4 — "Năm 1 = 40%" đại diện cho điều gì?

### Ý nghĩa trong code

[CODE VERIFIED]  
File: `src/schemas/QuotaConfigSchema.js` và `src/controllers/admin/quota-admin-controller.js`

```javascript
// extractQuotaPayload():
const slot = Math.round((totalCapacity * percentage) / 100);
// totalCapacity là số giường vật lý Admin nhập vào
```

Khi Admin nhập `year1 = 40%`, `totalCapacity = 1000`:
```
slot = round(1000 * 40 / 100) = 400 giường
```

### Điều này có nghĩa là gì về mặt nghiệp vụ

[DEDUCE]  
Quota `year1 = 40%` = **kế hoạch phân bổ**: Admin muốn dành 400 trong 1000 giường cho sinh viên năm 1.

Nó không đại diện cho:
- A. Số sinh viên năm 1 đang tồn tại trong DB ❌
- B. Số tân sinh viên dự kiến đăng ký KTX ❌
- C. Năng lực KTX cho năm 1 ✅ (đây là ý nghĩa thực)

Nhưng khái niệm nghiệp vụ có vấn đề:

[DEDUCE]  
Trong KTX đại học thực tế, quota theo năm học thường có nghĩa là:
- "Tân sinh viên (năm 1) được **ưu tiên** N giường"
- "Sinh viên năm 2-3 được phép ở tiếp trong giới hạn M giường"
- "Sinh viên năm 4+ nếu vẫn muốn ở thì cạnh tranh P giường còn lại"

Hệ thống này ghi nhận con số nhưng **không enforce** quota khi thực sự phân phòng (simulation không dùng quota, allocation không check quota theo year group).

---

## Câu Hỏi 5 — Timeline 2025-2026 → 2026-2027 với ví dụ số liệu

### Trạng thái 2025-2026

Giả sử:
- 1000 giường tổng
- KTX hiện tại đang có 800 người ở

| Cohort | enrollmentYear | yearInSchool (2025) | yearGroup |
|--------|---------------|---------------------|-----------|
| K71    | 2025          | 1                   | year1     |
| K70    | 2024          | 2                   | year2     |
| K69    | 2023          | 3                   | year3     |
| K68    | 2022          | 4                   | year4_plus|
| K67    | 2021          | 5                   | year4_plus|

[CODE VERIFIED]  
**Actual** (từ `aggregateStudentsByYearGroup` với `academicYear = "2025-2026"`):
```
Actual = đếm TẤT CẢ sinh viên trong students collection theo nhóm trên
Ví dụ: year1=350, year2=280, year3=250, year4_plus=420 sinh viên
Actual% = tỷ lệ trên tổng 1300 sinh viên trong DB
```

[CODE VERIFIED]  
**Snapshot** (`CohortShift` document):  
Khi Admin bấm "Run Shift" cho "2025-2026":
```javascript
// cohortShiftService.generateShiftSnapshot("2025-2026")
summary.year1 = { cohorts: ['K71'], studentCount: 350, allocated: 200 }
summary.year2 = { cohorts: ['K70'], studentCount: 280, allocated: 210 }
// ...
```
`allocated` lấy từ `RoomAllocation.find({ allocationCycleId: { $in: cycleIds }, status: 'ACTIVE' })`.

[CODE VERIFIED]  
**Quota** (admin nhập):
```
year1: 40% = 400 slots
year2: 30% = 300 slots
year3: 20% = 200 slots
year4_plus: 10% = 100 slots
```

[DEDUCE]  
**Cohort Shift**: chuyển tiếp tự động qua công thức. Không có dữ liệu nào bị ghi đè.

[CODE VERIFIED]  
**Simulation**: lấy danh sách `AllocationRegistration.PENDING` trong cycle, xếp hạng theo score, điền vào bed cho đến hết `availableBeds`. Không liên quan đến 4 số % quota trên.

### Chuyển sang 2026-2027

[CODE VERIFIED]  
Hệ thống chỉ cần đổi `academicYear = "2026-2027"` trong query:

| Cohort | enrollmentYear | yearInSchool (2026) | yearGroup cũ | yearGroup mới |
|--------|---------------|---------------------|--------------|---------------|
| K72    | 2026          | 1                   | (chưa có)    | year1         |
| K71    | 2025          | 2                   | year1        | year2         |
| K70    | 2024          | 3                   | year2        | year3         |
| K69    | 2023          | 4                   | year3        | year4_plus    |
| K68    | 2022          | 5                   | year4_plus   | year4_plus    |

**K72 không tồn tại trong DB** cho đến khi tân sinh viên nhập học → `year1 count = 0`.

Actual 2026-2027 tại thời điểm đầu năm:
```
year1: 0 (K72 chưa có)
year2: 350 (K71 chuyển lên)
year3: 280 (K70 chuyển lên)
year4_plus: 670 (K69 + K68 + K67 gộp lại)
```

---

## Câu Hỏi 6 — Đánh giá nghiệp vụ

### Logic đúng hay không

[CODE VERIFIED]  
Hệ thống có một số phần đúng:
- Công thức tính năm học từ `enrollmentYear` là chuẩn và nhất quán trong `quotaComparisonService.js`, `cohortShiftService.js`, `academicYearTransitionService.js`
- Audit trail đầy đủ (QuotaAuditLog)
- Draft/publish workflow hợp lý

### Lỗ hổng tư duy số 1: "Actual" là gì

[CODE VERIFIED]  
"Actual" trong màn hình Quota vs Actual = **số sinh viên trong DB theo year group**.

Đây là một khái niệm mơ hồ vì:
- Không phải số sinh viên đang ở KTX
- Không phải số sinh viên đã đăng ký
- Là tổng số sinh viên được tuyển vào trường theo từng năm

Trong nghiệp vụ KTX thực tế, "Actual" nên là:
- **Số giường đang được chiếm bởi sinh viên thuộc mỗi year group**

Hiện tại muốn biết số đó phải nhìn vào `CohortShift.summary[yearGroup].allocated` hoặc `RoomAllocation`.

### Lỗ hổng tư duy số 2: Mâu thuẫn số nhóm năm

[CODE VERIFIED]  

| File | Số nhóm | Các nhóm |
|------|---------|----------|
| `QuotaConfigSchema.js` | 4 | year1, year2, year3, year4_plus |
| `quotaComparisonService.js` | 4 | year1, year2, year3, year4_plus |
| `cohortShiftService.js` | 4 | year1, year2, year3, year4_plus |
| `academicYearTransitionService.js` | 4 | year1, year2, year3, year4_plus |
| **`allocationService.js` (executeAllocation)** | **3** | **year1, year2_3, year4_plus** |
| **`allocationService.js` (getCycleAllocationStatus)** | **3** | **year1, year2_3, year4_plus** |
| **`allocationService.js` (computeFairnessSummary)** | **3** | **year1, year2_3, year4_plus** |

**Quota dashboard dùng 4 nhóm. Allocation engine dùng 3 nhóm.**

Khi Admin xem "Quota vs Actual" thấy 4 dòng (year1, year2, year3, year4_plus).  
Khi system thực sự phân phòng, nó dùng 3 nhóm (year1, year2_3, year4_plus).

Dữ liệu trong `RoomAllocation.studentYearGroup` sẽ chứa `'year2_3'` — nhưng quota dashboard không có dòng `year2_3` để so sánh.

### Lỗ hổng tư duy số 3: Simulation không dùng quota

[CODE VERIFIED]  
Admin tạo quota, nhưng simulation không dùng quota để giới hạn phân bổ theo year group. Simulation chỉ là "ai điểm cao nhất thì được giường", không quan tâm đến việc year1 đã dùng hết 400 slot hay chưa.

### Giả định không thực tế

[CODE VERIFIED + DEDUCE]  
`previewNextYear()` trong `cohortShiftService.js` (line 494–538):
```javascript
const isNew = ey === currentEnd + 1;
return {
    ...
    studentCount: isNew ? 0 : (studentCounts[ey] || 0),
    // Năm 1 mới được hardcode = 0
};
```

Hệ thống thừa nhận năm 1 sẽ là 0 trong dự báo. Không có mechanism nào để admin nhập dự báo số tân sinh viên.

### Đề xuất đổi tên / UI

| Hiện tại | Nên đổi thành | Lý do |
|----------|---------------|-------|
| "Actual" | "Sinh viên trong hệ thống" | Tránh nhầm với "đang ở KTX" |
| "Simulation" | "Mô phỏng xếp hạng" | Simulation không mô phỏng tương lai, chỉ test policy trên đơn hiện tại |
| "Quota vs Actual" | "Quota phân bổ vs Phân bổ sinh viên DB" | Rõ nguồn dữ liệu |
| Dashboard so sánh | Thêm cột "Đang ở KTX" lấy từ RoomAllocation | Hiện tại thiếu cột này |

---

## Câu Hỏi 7 — Điểm mâu thuẫn nhất: Actual của năm 1 khi đầu năm học mới

### Actual năm 1 có phải 0% không

[CODE VERIFIED]  
**Có.** Nếu chưa có sinh viên nào với `enrollmentYear = 2026` trong DB thì:

```javascript
// aggregateStudentsByYearGroup với academicYear="2026-2027"
// yearInSchool = 2026 - enrollmentYear + 1
// Chỉ sinh viên có enrollmentYear=2026 thì yearInSchool=1 → year1
// Nếu không có ai → counts.year1 = 0
```

Dashboard sẽ hiển thị:
```
Year 1: Quota = 400 | Actual = 0 | Actual% = 0% | Status: under_quota
```

### Simulation xử lý trường hợp này như thế nào

[CODE VERIFIED]  
Kịch bản Admin vừa tạo quota cho 2026-2027:
```
Quota: year1=40%, year2=30%, year3=20%, year4_plus=10%
Actual: year1=0%, year2=30%, year3=25%, year4_plus=45%
```

Khi chạy simulation:

**Bước 1**: `AllocationRegistration.find({ allocationCycleId: cycleId, status: 'PENDING' })`

Nếu cycle vừa được tạo và chưa có ai đăng ký → `registrations = []`  
Simulation kết thúc ngay: `totalRegistrations = 0, totalAllocated = 0, totalWaitlisted = 0`

**Bước 2**: Nếu có registrations (vd: sinh viên năm 2-4 tái đăng ký):

```javascript
// simulate() - line 119-141:
for (const candidate of ranked) {
    if (availableBeds <= 0) {
        results.waitlisted.push(candidate);
    } else {
        results.allocated.push(candidate);
        availableBeds -= 1;
    }
    // Không có check nào: "year1 đã dùng 400 slot chưa?"
    // Không có enforcement quota by yearGroup
}
```

[CODE VERIFIED]  
Simulation **không tạo giả sinh viên năm 1**, **không dự báo sinh viên năm 1**, **không dùng historical data cho năm 1**, **không dùng cohort shift cho năm 1**, **không nhân phần trăm với số giường**.

Simulation chỉ xử lý những gì đang có trong `AllocationRegistration` của cycle đó.

### Kết luận cho câu 7

[CODE VERIFIED]  
Tại thời điểm đầu năm học mới:
1. Actual year1 = 0% → đúng về mặt kỹ thuật, vì chưa có sinh viên K72 trong DB
2. Simulation = 0 nếu chưa có đơn đăng ký → không có gì để mô phỏng
3. Quota year1 = 40% = kế hoạch dành sẵn — nhưng không có mechanism nào "dự trữ" 400 giường đó

Không có gì ngăn sinh viên năm 4+ đăng ký sớm và chiếm hết giường trước khi sinh viên năm 1 vào trường.

---

## Final Verdict

### Hệ thống hiện tại đang mô hình hóa điều gì

[CODE VERIFIED]  
Hệ thống mô hình hóa **quy trình phân phòng KTX dựa trên điểm ưu tiên cá nhân** (khoảng cách, khó khăn tài chính, mức độ ưu tiên). Nó có các công cụ analytics (quota, cohort shift, simulation) nhưng các công cụ này **độc lập với nhau** và không kết nối thành một workflow thống nhất.

### Actual có đang bị hiểu sai không

[CODE VERIFIED]  
**Có.** "Actual" = tổng sinh viên trong DB theo year group, không phải sinh viên đang ở KTX. Admin nhìn vào dashboard "Quota vs Actual" sẽ nghĩ đây là so sánh kế hoạch phân phòng vs thực tế sử dụng phòng — nhưng đó không phải dữ liệu thực sự được hiển thị.

### Simulation có đang so sánh hai thời điểm khác nhau không

[CODE VERIFIED]  
**Không.** Simulation luôn chạy trên dữ liệu PENDING tại một thời điểm duy nhất. Nó không so sánh năm nay vs năm ngoái. Nó chỉ test xem "policy A" vs "policy B" xử lý cùng một tập đơn như thế nào.

### Quota có đang đại diện cho nhu cầu tương lai không

[CODE VERIFIED + DEDUCE]  
**Không trực tiếp.** Quota đại diện cho **kế hoạch phân bổ giường** (bao nhiêu giường cho mỗi nhóm). Nó không liên kết với dự báo nhu cầu thực tế của tân sinh viên, và không được enforce trong quá trình allocation.

### Có bug nghiệp vụ không

[CODE VERIFIED]  

**Bug 1 — Mâu thuẫn year group schema (nghiêm trọng):**
- QuotaConfig, quotaComparisonService, cohortShiftService dùng **4 nhóm** (year1, year2, year3, year4_plus)
- AllocationService, AllocationRegistration, RoomAllocation dùng **3 nhóm** (year1, year2_3, year4_plus)
- `year2` và `year3` trong quota không có dữ liệu tương ứng trong allocation results
- Quota vs Actual dashboard không thể so sánh chính xác với dữ liệu allocation thực tế

**Bug 2 — Quota không được enforce trong allocation:**
- Admin set year1=40%, year4_plus=10%
- Allocation engine phân phòng theo điểm ranking, bỏ qua quota hoàn toàn
- Có thể xảy ra: year4_plus chiếm 60% số giường dù quota chỉ là 10%

**Bug 3 — registration-routes.js dùng threshold sai:**
- `AllocationService.calculateYearGroup`: yearsEnrolled=1 → `year2_3` ✅
- `registration-routes.js`: năm học offset=1 → `year1` ❌ (vẫn tính là năm 1)
- Sinh viên K71 đang năm 2 có thể bị phân loại sai năm khi đăng ký

### Có bug UX không

[CODE VERIFIED + DEDUCE]  

**UX Bug 1**: Tên "Actual" gây nhầm lẫn — không nói rõ đây là "sinh viên trong DB" hay "sinh viên đang ở KTX"

**UX Bug 2**: Màn hình Simulation hiển thị nút "Apply simulation results" nhưng simulation không lưu bất kỳ thứ gì — áp dụng nghĩa là gì không rõ ràng

**UX Bug 3**: Cohort Shift timeline hiển thị "Quota vs Actual" bar chart nhưng "Actual" ở đây lấy từ `CohortShift.summary[yearGroup].allocated` (số người thực sự ở KTX theo cycle), khác với "Actual" trong quota dashboard (tổng sinh viên trong DB) — hai màn hình dùng cùng từ "Actual" nhưng ý nghĩa khác nhau

**UX Bug 4**: Admin tạo quota mà không thấy rõ "Đây là kế hoạch, nhưng hệ thống sẽ không tự giới hạn theo kế hoạch này khi chạy allocation"

### Nếu triển khai thực tế cho KTX đại học thì có chấp nhận được không

[DEDUCE]  
**Cần thiết kế lại các điểm sau trước khi đưa vào sử dụng:**

1. **Enforce quota trong allocation**: Khi phân phòng, system cần check "year group X đã dùng hết slot chưa" trước khi assign — hiện tại hoàn toàn bỏ qua
2. **Thống nhất year group schema**: Chọn 4 nhóm hoặc 3 nhóm, áp dụng nhất quán toàn bộ codebase
3. **Tách biệt "Actual (trong DB)" và "Actual (đang ở KTX)"**: Dashboard cần 2 cột riêng biệt
4. **Thêm cơ chế dự báo sinh viên năm 1**: Admin cần input "dự kiến N tân sinh viên năm nay" để simulation có ý nghĩa với year1
5. **Làm rõ Simulation scope**: UI cần giải thích rõ simulation chỉ test trên đơn PENDING hiện tại, không phải dự báo tương lai

**Những gì đang hoạt động tốt và có thể giữ nguyên:**
- Smart ranking score (distance + financial + priority) — cơ chế phân công công bằng tốt
- Audit trail đầy đủ
- Draft/publish quota workflow
- Cohort shift analytics (tính năm học từ enrollmentYear — chính xác)
- Rebalancing service logic
- Socket.IO realtime notification khi kết quả có
