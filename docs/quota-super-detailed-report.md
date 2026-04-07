# Báo Cáo Siêu Chi Tiết - Hệ Thống Quota

Ngày cập nhật: 03/04/2026

## 1. Quota trong hệ thống là gì?
Quota trong hệ thống là một cơ chế giới hạn vận hành theo năm học dùng để đặt trần phân bổ chỗ ở cho từng nhóm năm học thay vì phản ánh số lượng sinh viên thực tế tại thời điểm hiện tại, tức quota là một quyết định quản trị có chủ đích để điều tiết công suất hệ thống theo mục tiêu chính sách và theo bối cảnh tuyển sinh từng chu kỳ.

## 2. Đặc điểm cốt lõi

### 2.1 [Đã tìm hiểu]
- Tổng số chỗ là hằng số: $C = totalCapacity$.
- Quota được xác định theo 4 nhóm: `year1`, `year2`, `year3`, `year4_plus`.
- Trong UI hiển thị thống nhất là: Năm 1, Năm 2, Năm 3, Năm 4 và các năm còn lại.
- Quota gồm 2 thành phần:
  - `percentage (%)`: lớp kế hoạch, dùng để định hướng phân bổ theo tỷ lệ.
  - `slot`: lớp thực thi, có thể chỉnh tay để phản ánh tình huống vận hành.
- Quota không phải số thực tế.
- Quota là giới hạn trên (upper bound) cho mỗi nhóm năm học.

### 2.2 Ý nghĩa vận hành
Việc tách quota kế hoạch (percentage) và quota thực thi (slot) cho phép hệ thống vừa giữ được logic điều hành dài hạn vừa có vùng linh hoạt ngắn hạn, qua đó giảm rủi ro lệch chính sách khi phát sinh biến động số phòng trống, số sinh viên tốt nghiệp, hoặc số đơn mới trong giai đoạn sát kỳ tiếp nhận.

## 3. Công thức và ràng buộc

### 3.1 Công thức tính slot
Mặc định khi chưa chỉnh tay:

$$
slot_i = round\left(\frac{percentage_i \times C}{100}\right)
$$

Trong đó $i \in \{year1, year2, year3, year4\_plus\}$.

### 3.2 Ràng buộc tổng phần trăm

$$
\sum percentage_i = 100
$$

Nếu tổng phần trăm khác 100 thì cấu hình được coi là không hợp lệ ở lớp kế hoạch.

### 3.3 Ràng buộc slot
- `slot_i >= 0`.
- Slot có thể chỉnh tay để bám thực tế, nhưng không được phá vỡ quy tắc quản trị chung.

### 3.4 Điều chỉnh thực tế
Khi vào pha thực thi, hệ thống cho phép vi chỉnh dựa trên dữ liệu vận hành tại chỗ để đảm bảo quyết định cuối cùng không máy móc theo tỷ lệ ban đầu mà vẫn kiểm soát được trần công suất theo chính sách toàn cục.

## 4. Chu kỳ vận hành quota

### 4.1 Chuỗi tổng quát
Định nghĩa quota -> dự trù kịch bản -> theo dõi thực tế -> phát thông báo nghiệp vụ -> tiếp nhận mới và chốt phương án vận hành.

### 4.2 Hai pha chính

#### Pha 1: Planning
- Nhập quota theo 4 nhóm năm học.
- Đặt hiệu lực thời gian.
- Dự trù theo tỷ lệ và slot.
- Kiểm tra ràng buộc hợp lệ trước publish.

#### Pha 2: Execution
Điều chỉnh theo:
- số phòng trống thực tế,
- số sinh viên tốt nghiệp,
- số đơn mới,
- và mức ưu tiên vận hành từng nhóm năm học.

## 5. Thuật toán cốt lõi

### Algorithm 1: ValidateQuotaDistribution
Mục tiêu: kiểm tra tính hợp lệ của bản quota trước khi vận hành.

```text
Algorithm ValidateQuotaDistribution(quota)
Input: quota = {totalCapacity, quotas[], effectiveFrom, effectiveTo}
Output: {valid, errors[]}

1. errors <- []
2. sumPercent <- SUM(q.percentage for q in quotas)
3. if sumPercent != 100 then add "Tong ty le khong bang 100" to errors
4. for each q in quotas:
5.     if q.slot < 0 then add "Slot am" to errors
6. if effectiveFrom > effectiveTo then add "Sai cua so hieu luc" to errors
7. return {valid: (errors is empty), errors}
```

Độ phức tạp: $O(n)$.

### Algorithm 2: CompareQuotaWithActual
Mục tiêu: so sánh quota và thực tế theo nhóm năm học.

```text
Algorithm CompareQuotaWithActual(quotaRows, actualRows)
Input: quotaRows by yearGroup, actualRows by yearGroup
Output: comparisonRows

1. result <- []
2. for each g in {year1, year2, year3, year4_plus}:
3.     quotaSlot <- quotaRows[g].slot
4.     actual <- actualRows[g].count
5.     remaining <- quotaSlot - actual
6.     if remaining < 0 then status <- "over_quota"
7.     else if remaining > 0 then status <- "under_quota"
8.     else status <- "on_target"
9.     append {g, quotaSlot, actual, remaining, status} to result
10. return result
```

Độ phức tạp: $O(n)$.

### Algorithm 3: PlanEvictionCandidates
Mục tiêu: lập kế hoạch số sinh viên cần rời theo overflow.

```text
Algorithm PlanEvictionCandidates(comparisonRows)
Input: comparisonRows
Output: evictionPlan

1. totalToRemove <- 0
2. byGroup <- {}
3. for each row in comparisonRows:
4.     overflow <- max(0, row.actual - row.quotaSlot)
5.     byGroup[row.yearGroup] <- overflow
6.     totalToRemove <- totalToRemove + overflow
7. return {totalToRemove, byGroup}
```

Độ phức tạp: $O(n)$.

### Algorithm 4: BuildNextYearRecommendation
Mục tiêu: đề xuất quota từ xu hướng nhiều năm.

```text
Algorithm BuildNextYearRecommendation(trendData, totalCapacity)
Input: trendData over k years, totalCapacity C
Output: recommendedQuota

1. for each group g:
2.     avgShare[g] <- average(actualShare[g] across k years)
3. normalize avgShare so SUM(avgShare) = 100
4. for each group g:
5.     slot[g] <- round(avgShare[g] * C / 100)
6. adjust rounding drift to keep SUM(slot) = C
7. return {percentage: avgShare, slot}
```

Độ phức tạp: $O(k*n)$.

## 6. Các trường hợp nghiệp vụ

### Case A: Tổng % lệch 100
- Triệu chứng: bản kế hoạch không hợp lệ.
- Xử lý: chặn publish, yêu cầu chỉnh lại tỷ lệ.

### Case B: Slot nhóm năm 4 và các năm còn lại bị ép quá thấp
- Triệu chứng: overflow tăng đột ngột ở nhóm cuối.
- Xử lý: tăng slot thực thi hoặc điều chỉnh phân bổ các nhóm khác.

### Case C: Số phòng trống thực tế giảm mạnh trước kỳ mới
- Triệu chứng: kế hoạch đầu kỳ không còn phù hợp.
- Xử lý: vi chỉnh execution theo dữ liệu trống thực.

### Case D: Đơn mới tăng nhanh sát thời điểm tiếp nhận
- Triệu chứng: áp lực nhóm năm 1 vượt dự trù.
- Xử lý: cân lại quota thực thi và ưu tiên xử lý theo policy.

## 7. Ảnh chụp kết quả - chụp đoạn nào, chụp thế nào

Đây là phần quan trọng nhất để chứng minh đầu ra; mỗi ảnh nên chụp full màn hình và thêm một ảnh zoom vùng trọng tâm nếu nội dung bảng dài.

### 7.1 Danh mục ảnh bắt buộc
1. Quota list tổng quan.
2. Quota form phần Thông tin chung.
3. Quota form phần Cấu hình quota + Summary panel.
4. Quota dashboard phần KPI.
5. Quota dashboard phần bảng So sánh quota và thực tế.
6. Quota workflow timeline.
7. Quota audit history filter + before/after.
8. Navbar đồng bộ trên dashboard/application/violations/logs.

### 7.2 Chỉ dẫn chụp chi tiết theo trang

#### Ảnh 01 - Quota list
- URL: `/admin/quotas`
- Chụp đoạn: tiêu đề trang + bảng danh sách + cột Trạng thái + cột Thao tác.
- Tên file: `docs/images/quota/01-quota-list.png`

#### Ảnh 02 - Quota form (Thông tin chung)
- URL: `/admin/quotas/{id}/edit`
- Chụp đoạn: card (1) Thông tin chung gồm năm học, tổng sức chứa, hiệu lực.
- Tên file: `docs/images/quota/02-form-general.png`

#### Ảnh 03 - Quota form (Cấu hình + tổng hợp)
- URL: `/admin/quotas/{id}/edit`
- Chụp đoạn: bảng 4 nhóm năm học + stepper + panel Tổng tỷ lệ/Tổng số chỗ.
- Tên file: `docs/images/quota/03-form-quota-summary.png`

#### Ảnh 04 - Dashboard KPI
- URL: `/admin/quotas/{id}/dashboard`
- Chụp đoạn: 4 khối KPI (Tổng chỗ/Đang sử dụng/Còn trống/Dự kiến còn trống).
- Tên file: `docs/images/quota/04-dashboard-kpi.png`

#### Ảnh 05 - Dashboard bảng so sánh
- URL: `/admin/quotas/{id}/dashboard`
- Chụp đoạn: bảng So sánh quota và thực tế, đảm bảo thấy đủ 4 nhóm năm học.
- Tên file: `docs/images/quota/05-dashboard-comparison.png`

#### Ảnh 06 - Workflow
- URL: `/admin/quotas/{id}/workflow`
- Chụp đoạn: danh sách mốc timeline và trạng thái.
- Tên file: `docs/images/quota/06-workflow.png`

#### Ảnh 07 - Audit history
- URL: `/admin/quotas/audit`
- Chụp đoạn: thanh lọc + 1 dòng log có before/after mở rộng.
- Tên file: `docs/images/quota/07-audit-history.png`

#### Ảnh 08 - Navbar đồng bộ
- URL: lần lượt `/admin/dashboard`, `/admin/application`, `/admin/violations`, `/admin/logs`
- Chụp đoạn: cùng vị trí navbar để chứng minh đồng bộ.
- Tên file: `docs/images/quota/08-navbar-consistency.png`

## 8. Kết quả hiện tại
- Quota data đã clear sạch để test lại từ đầu.
- Luồng quota đã tách Planning/Execution rõ ràng.
- Báo cáo, thuật toán giả mã, và checklist ảnh đã chuẩn hóa để đưa vào tài liệu trình bày và slide.

## 9. Kế hoạch tuần tiếp theo
- Chuẩn hóa thuật ngữ "chính sách" trên toàn bộ tài liệu và slide.
- Mỗi thuật toán làm 1 slide PowerPoint riêng theo format: mục tiêu -> input/output -> giả mã -> độ phức tạp -> ví dụ minh họa.
- Chốt bộ ảnh bằng chứng theo danh mục mục 7 để hoàn thiện hồ sơ nghiệm thu.
