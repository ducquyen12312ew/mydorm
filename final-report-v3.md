# eDorm — Final Simulation Report v3
> **Tạo lúc:** 01:26:04 15/6/2026  
> **Branch:** demo1 | **Năm học mô phỏng:** 2026-2027  
> **Tài khoản test:** admintest

---

## 1. Trạng thái DB Production (Trước Simulation)

### 1.1 Sinh viên theo Khóa

| Khóa | Tổng | Đang ở KTX | Chưa có phòng | % Có phòng |
| ---- | ---- | ---------- | ------------- | ---------- |
| 2022xxx (Năm 5 → rời KTX) | 180 | 120 | 60 | 67% |
| 2023xxx (Năm 4+) | 470 | 290 | 180 | 62% |
| 2024xxx (Năm 3) | 570 | 370 | 200 | 65% |
| 2025xxx (Năm 2) | 690 | 410 | 280 | 59% |

| **TỔNG (1,550 SV thường)** | **1910** | **1190** | **720** | **62%** |
| 99999999 (Test account) | 1 | 1 | 0 | 100% |

### 1.2 Tổng quan KTX

| Chỉ số | Giá trị |
| ------ | ------- |
| Tổng giường | 1,742 |
| Đang có người | 1,191 |
| Giường trống | 551 |
| Occupancy | 68.4% |

### 1.3 Chính sách đang áp dụng

| Năm học | Active | Quota Năm 1 | Quota Năm 2 | Quota Năm 3 | Quota Năm 4+ | Allow Overflow |
| ------- | ------ | ----------- | ----------- | ----------- | ------------ | -------------- |
| 2026-2027 | ✅ | 50% | 30% | 15% | 5% | Không |

### 1.4 Chu kỳ phân bổ

| Năm học | Tên | Status | Ngày phân bổ |
| ------- | --- | ------ | ------------ |
| 2026-2027 | Manual Allocation | PENDING | — |
| 2026-2027 | Main Registration | PENDING | 27/7/2026 |
| 2025-2026 | Main Registration | COMPLETED | 1/9/2025 |

---

## 2. Khởi tạo Workspace Mô phỏng

| Chỉ số | Giá trị |
| ------ | ------- |
| Workspace ID | 6a2ef23e052236b9091cdf9f |
| Sinh viên clone | 1,911 |
| KTX clone | 7 |
| Phòng clone | 265 |
| Policies clone | 1 |
| Chu kỳ clone | 3 |

---

## 3. Cohort Shift (Chuyển năm học)

Năm học mô phỏng: **2026-2027**  
MSSV prefix → năm trong trường theo công thức: `yearInSchool = (${simYear} − prefix) + 1`

### 3.1 Phân bổ nhóm năm sau khi shift

| Nhóm | Prefix | Mô tả | Số lượng |
| ---- | ------ | ----- | -------- |
| year5plus | 2022xxx | Năm 5 → **Phải rời KTX** | 180 |
| year4_plus | 2023xxx | Năm 4+ | 470 |
| year3 | 2024xxx | Năm 3 | 570 |
| year2 | 2025xxx | Năm 2 | 690 |
| year1 | 99999999 | Test account — không shift | 1 |

### 3.2 Sinh viên rời KTX (mustLeave) — 180 người

> Đây là toàn bộ sinh viên prefix **2022xxx** (năm 5) bị thu hồi phòng để nhường cho khóa mới.

| # | MSSV | Họ tên | Nhóm | Năm |
| --- | ---- | ------ | ---- | --- |
| 1 | 2022_0001 | Nguyễn Văn Minh | Năm 5+ (Ra KTX) | 5 |
| 2 | 2022_0002 | Vương Đức Tú | Năm 5+ (Ra KTX) | 5 |
| 3 | 2022_0003 | Cao Trung Trọng | Năm 5+ (Ra KTX) | 5 |
| 4 | 2022_0004 | Tống Bảo Hải | Năm 5+ (Ra KTX) | 5 |
| 5 | 2022_0005 | Mạc Xuân Công | Năm 5+ (Ra KTX) | 5 |
| 6 | 2022_0006 | Thái Tuấn Khánh | Năm 5+ (Ra KTX) | 5 |
| 7 | 2022_0007 | Tạ Đức Đạt | Năm 5+ (Ra KTX) | 5 |
| 8 | 2022_0008 | Hà Trung Đức | Năm 5+ (Ra KTX) | 5 |
| 9 | 2022_0009 | Lưu Bảo Trung | Năm 5+ (Ra KTX) | 5 |
| 10 | 2022_0010 | Tô Xuân Tiến | Năm 5+ (Ra KTX) | 5 |
| 11 | 2022_0011 | Trương Tuấn Quân | Năm 5+ (Ra KTX) | 5 |
| 12 | 2022_0012 | Mai Đức Văn | Năm 5+ (Ra KTX) | 5 |
| 13 | 2022_0013 | Đào Trung Long | Năm 5+ (Ra KTX) | 5 |
| 14 | 2022_0014 | Trịnh Bảo Bảo | Năm 5+ (Ra KTX) | 5 |
| 15 | 2022_0015 | Đinh Xuân Nam | Năm 5+ (Ra KTX) | 5 |
| 16 | 2022_0016 | Lý Tuấn Vinh | Năm 5+ (Ra KTX) | 5 |
| 17 | 2022_0017 | Dương Đức Tuấn | Năm 5+ (Ra KTX) | 5 |
| 18 | 2022_0018 | Ngô Trung Mạnh | Năm 5+ (Ra KTX) | 5 |
| 19 | 2022_0019 | Hồ Bảo Anh | Năm 5+ (Ra KTX) | 5 |
| 20 | 2022_0020 | Đỗ Xuân Dũng | Năm 5+ (Ra KTX) | 5 |
| 21 | 2022_0021 | Bùi Tuấn Hữu | Năm 5+ (Ra KTX) | 5 |
| 22 | 2022_0022 | Đặng Đức Thành | Năm 5+ (Ra KTX) | 5 |
| 23 | 2022_0023 | Võ Trung Nhân | Năm 5+ (Ra KTX) | 5 |
| 24 | 2022_0024 | Vũ Bảo Hùng | Năm 5+ (Ra KTX) | 5 |
| 25 | 2022_0025 | Phan Xuân Khải | Năm 5+ (Ra KTX) | 5 |
| 26 | 2022_0026 | Huỳnh Tuấn Kiên | Năm 5+ (Ra KTX) | 5 |
| 27 | 2022_0027 | Hoàng Đức Tú | Năm 5+ (Ra KTX) | 5 |
| 28 | 2022_0028 | Phạm Trung Trọng | Năm 5+ (Ra KTX) | 5 |
| 29 | 2022_0029 | Lê Bảo Hải | Năm 5+ (Ra KTX) | 5 |
| 30 | 2022_0030 | Trần Xuân Công | Năm 5+ (Ra KTX) | 5 |
_... và 150 sinh viên khác (tổng 180 người)_

---

## 4. Seed Sinh viên Năm 1 (2026xxx)

| Chỉ số | Giá trị |
| ------ | ------- |
| Tổng seeded | 333 |
| Quota Năm 1 | 326 |
| REJECT_TARGET (Group D cố định) | 7 |
| Công thức | 326 + 7 = 333 |
| Nhóm A — ở xa, nghèo, DTTS (điểm cao) | 91 |
| Nhóm B — khoảng cách trung bình (điểm TB) | 136 |
| Nhóm C — ở gần, khá giả (điểm thấp) | 99 |
| Nhóm D — ở gần, khá giả, vi phạm (điểm rất thấp) — CỐ ĐỊNH 7 | 7 |

### 4.1 Mẫu 20 sinh viên năm 1 được seed (12 khoa khác nhau)

| # | MSSV | Họ tên | Giới tính | Khoa | Tỉnh | Khoảng cách | Gia cảnh | Vi phạm |
| --- | ---- | ------ | --------- | ---- | ---- | ----------- | -------- | ------- |
| 1 | 2026_0056 | Huỳnh Khánh Yến | Nữ | Công nghệ Sinh học | Đà Nẵng | 758km | Nghèo | ✅ |
| 2 | 2026_0024 | Trịnh Bảo Quốc | Nam | Công nghệ Thông tin | Gia Lai | 1205km | Nghèo | ✅ |
| 3 | 2026_0088 | Hà Lan Hoa | Nữ | Công nghệ Thông tin | Quảng Trị | 504km | TB | ✅ |
| 4 | 2026_0174 | Đào Thu Thảo | Nữ | Công nghệ Thông tin | Thái Bình | 106km | TB | ✅ |
| 5 | 2026_0248 | Vương Sơn Long | Nam | Công nghệ Thông tin | Hưng Yên | 67km | Khá giả | ✅ |
| 6 | 2026_0010 | Tạ Bích Thanh | Nữ | Cơ khí | Kiên Giang | 1896km | Nghèo | ✅ |
| 7 | 2026_0176 | Đào Quốc Trung | Nam | Cơ khí | Bắc Giang | 54km | TB | ✅ |
| 8 | 2026_0293 | Vương Khánh Hằng | Nữ | Cơ khí | Hà Nội | 9km | Khá giả | ✅ |
| 9 | 2026_0182 | Ngô Quốc Cường | Nam | Hàng không Vũ trụ | Hà Tĩnh | 341km | TB | ✅ |
| 10 | 2026_0129 | Lý Hải Việt | Nam | Kinh tế Kỹ thuật | Thanh Hóa | 151km | TB | ✅ |
| 11 | 2026_0164 | Tạ Văn Hùng | Nam | Kỹ thuật Hóa học | Ninh Bình | 83km | TB | ✅ |
| 12 | 2026_0251 | Tạ Thị Hiền | Nữ | Kỹ thuật Máy tính | Vĩnh Phúc | 59km | Khá giả | ✅ |
| 13 | 2026_0065 | Tạ Công Tiến | Nam | Kỹ thuật Điện | Đắk Lắk | 1398km | Nghèo | ✅ |
| 14 | 2026_0249 | Cao Công Trung | Nam | Kỹ thuật Điện | Hà Tây cũ | 21km | Khá giả | ✅ |
| 15 | 2026_0084 | Tạ Thanh Tuyết | Nữ | Quản lý Công nghiệp | Quảng Bình | 452km | TB | ✅ |
| 16 | 2026_0210 | Đỗ Tuyết Thư | Nữ | Quản lý Công nghiệp | Lào Cai | 288km | TB | ✅ |
| 17 | 2026_0110 | Dương Thanh Hiền | Nữ | Toán Tin ứng dụng | Ninh Bình | 93km | TB | ✅ |
| 18 | 2026_0265 | Tô Thanh Tuấn | Nam | Toán Tin ứng dụng | Bắc Giang | 51km | Khá giả | ✅ |
| 19 | 2026_0281 | Trịnh Hoàng Quốc | Nam | Vật lý Kỹ thuật | Hà Tây cũ | 25km | Khá giả | ✅ |
| 20 | 2026_0093 | Võ Hoàng Trung | Nam | Điện tử Viễn thông | Thái Bình | 111km | TB | ✅ |

---

## 5. Phân bổ Phòng (Allocation Preview)

### 5.1 Queue thực tế (sinh viên được engine xử lý)

> **Trong queue** = sinh viên **chưa có phòng** — chỉ những người này được đưa vào engine phân bổ.  
> **Tổng cohort** = toàn bộ sinh viên nhóm năm trong sandbox.  
> **Đang có phòng** = đã ở KTX từ trước, không tham gia phân bổ.

| Nhóm năm | Trong queue | Tổng cohort | Đang có phòng | Ghi chú |
| -------- | ----------- | ----------- | ------------- | ------- |
| Năm 1 (2026xxx) | 333 | 334 | 1 | Synthetic — không apply thực; 1 SV thực (99999999) đang có phòng, không vào queue |
| Năm 2 (2025xxx) | 280 | 690 | 410 | Sinh viên thực |
| Năm 3 (2024xxx) | 200 | 570 | 370 | Sinh viên thực |
| Năm 4+ (2023xxx) | 180 | 470 | 290 | Sinh viên thực, ưu tiên thấp |
| Năm 5+ (2022xxx) | 0 | 180 | 180 | Phải rời KTX — không xét |

### 5.2 Kết quả phân bổ tổng quan

| Chỉ số | Giá trị |
| ------ | ------- |
| Giường trống ban đầu | 671 |
| Tổng giường | 1742 |
| Sinh viên trong Queue | 993 |
| **Được nhận** | **650** |
| Danh sách chờ | 343 |
| Fill Rate | 96.9% |
| Occupancy trước (sau cohort shift) | 61.5% |
| Occupancy sau | 98.8% |

> **Ghi chú occupancy:** "Trước" = trạng thái **sau cohort shift** — 180 sinh viên Năm 5+ (2022xxx) đã rời KTX, giải phóng **120** giường. Occupancy trước cohort shift là **68.4%**.

### 5.3 Kết quả theo nhóm năm

| Nhóm | Quota | Đăng ký (queue) | Được nhận | Fill quota | Waitlist | Lý do waitlist |
| ---- | ----- | --------------- | --------- | ---------- | -------- | -------------- |
| Năm 1 | 326 | 333 | 326 | 100% | 7 | Vượt quota / điểm thấp |
| Năm 2 | 195 | 280 | 195 | 100% | 85 | Vượt quota Năm 2 |
| Năm 3 | 97 | 200 | 97 | 100% | 103 | Vượt quota Năm 3 |
| Năm 4+ | 32 | 180 | 32 | 100% | 148 | Vượt quota Năm 4+ |

### 5.4 Sinh viên ĐƯỢC NHẬN — Real students (không tính 2026xxx synthetic)

> Tổng: **324** sinh viên thực được phân phòng.  
> + 326 sinh viên Năm 1 synthetic (2026xxx) được nhận trong sim (bị bỏ qua khi Apply).

#### Năm 2 — 195 người

> Điểm: **79–100** | 7 mức điểm khác nhau. Mẫu lấy trải đều theo điểm (cao → thấp) để thể hiện sự đa dạng.

| # | MSSV | Họ tên | Điểm | KTX | Phòng |
| --- | ---- | ------ | ---- | --- | ----- |
| 1 | 2025_0227 | Trần Hoàng Trung | 100 | F6 - Bách Khoa | 508 |
| 2 | 2025_0239 | Mai Ngọc Hữu | 100 | F6 - Bách Khoa | 601 |
| 3 | 2025_0263 | Thái Minh Dũng | 100 | F6 - Bách Khoa | 602 |
| 4 | 2025_0273 | Lý Minh Công | 100 | F6 - Bách Khoa | 603 |
| 5 | 2025_0278 | Bùi Minh Tiến | 100 | F6 - Bách Khoa | 604 |
| 6 | 2025_0292 | Mạc Đức Hùng | 100 | F6 - Bách Khoa | 605 |
| 7 | 2025_0307 | Đỗ Đức Bảo | 100 | F6 - Bách Khoa | 605 |
| 8 | 2025_0321 | Tống Sơn Văn | 100 | F6 - Bách Khoa | 606 |
| 9 | 2025_0327 | Tô Công Trung | 100 | F6 - Bách Khoa | 606 |
| 10 | 2025_0355 | Hà Ngọc Quốc | 100 | F6 - Bách Khoa | 607 |
| 11 | 2025_0367 | Đỗ Hữu Hùng | 100 | F6 - Bách Khoa | 607 |
| 12 | 2025_0377 | Trần Hữu Trung | 100 | F6 - Bách Khoa | 607 |
| 13 | 2025_0571 | Ngô Bích Ngọc | 100 | F6 - Bách Khoa | 608 |
| 14 | 2025_0579 | Huỳnh Mai Bích | 100 | F6 - Bách Khoa | 608 |
| 15 | 2025_0590 | Tạ Gia Xuân | 100 | F6 - Bách Khoa | 701 |
| 16 | 2025_0611 | Phạm Thanh Hà | 100 | F6 - Bách Khoa | 702 |
| 17 | 2025_0631 | Ngô Ngọc Phương | 100 | F6 - Bách Khoa | 703 |
| 18 | 2025_0655 | Mai Hà Thu | 100 | F6 - Bách Khoa | 704 |
| 19 | 2025_0666 | Võ Thị Hoa | 100 | F6 - Bách Khoa | 704 |
| 20 | 2025_0671 | Phạm Thị Ngọc | 100 | F6 - Bách Khoa | 705 |
| 21 | 2025_0686 | Đào Khánh Mỹ | 100 | F6 - Bách Khoa | 705 |
| 22 | 2025_0247 | Đỗ Gia Hải | 99 | F6 - Bách Khoa | 706 |
| 23 | 2025_0299 | Mai Bảo Khánh | 99 | F6 - Bách Khoa | 706 |
| 24 | 2025_0360 | Đào Ngọc Minh | 99 | F6 - Bách Khoa | 707 |
| 25 | 2025_0589 | Thái Xuân Hương | 99 | F6 - Bách Khoa | 707 |
| 26 | 2025_0634 | Bùi Tuyết Thúy | 99 | F6 - Bách Khoa | 708 |
| 27 | 2025_0233 | Thái Phước Nam | 89 | F6 - Bách Khoa | 708 |
| 28 | 2025_0243 | Lý Phước Khải | 89 | G7 - Bách Khoa | 101 |
| 29 | 2025_0252 | Phan Gia Trung | 89 | G7 - Bách Khoa | 101 |
| 30 | 2025_0261 | Tống Văn Mạnh | 89 | G7 - Bách Khoa | 102 |
| 31 | 2025_0276 | Hồ Văn Đức | 89 | G7 - Bách Khoa | 102 |
| 32 | 2025_0284 | Hoàng Duy Vinh | 89 | G7 - Bách Khoa | 102 |
| 33 | 2025_0291 | Tống Tuấn Đạt | 89 | G7 - Bách Khoa | 103 |
| 34 | 2025_0304 | Dương Bảo Quân | 89 | G7 - Bách Khoa | 103 |
| 35 | 2025_0317 | Trần Đức Hùng | 89 | G7 - Bách Khoa | 104 |
| 36 | 2025_0332 | Đinh Công Bảo | 89 | G7 - Bách Khoa | 105 |
| 37 | 2025_0342 | Phan Công Hùng | 89 | G7 - Bách Khoa | 106 |
| 38 | 2025_0353 | Thái Gia Tiến | 89 | G7 - Bách Khoa | 107 |
| 39 | 2025_0565 | Mai Khánh Xuân | 89 | G7 - Bách Khoa | 107 |
| 40 | 2025_0572 | Hồ Mỹ Thanh | 89 | G7 - Bách Khoa | 107 |
| 41 | 2025_0588 | Mạc Phương Kim | 89 | G7 - Bách Khoa | 201 |
| 42 | 2025_0613 | Trần Phương Kim | 89 | G7 - Bách Khoa | 201 |
| 43 | 2025_0633 | Đỗ Hoàng Trang | 89 | G7 - Bách Khoa | 202 |
| 44 | 2025_0646 | Cao Thị Ngọc | 89 | G7 - Bách Khoa | 202 |
| 45 | 2025_0656 | Đào Thị Phương | 89 | G7 - Bách Khoa | 203 |
| 46 | 2025_0682 | Lưu Bích Mai | 89 | G7 - Bách Khoa | 203 |
| 47 | 2025_0351 | Tống Hải Tuấn | 84 | G7 - Bách Khoa | 204 |
| 48 | 2025_0228 | Nguyễn Thanh Tiến | 79 | G7 - Bách Khoa | 205 |
| 49 | 2025_0344 | Hoàng Thanh Kiên | 79 | G7 - Bách Khoa | 206 |
| 50 | 2025_0375 | Phạm Ngọc Tùng | 79 | G7 - Bách Khoa | 207 |
_... (hiển thị 50/195 mẫu trải đều theo điểm)_

#### Năm 3 — 97 người

> Điểm: **79–100** | 7 mức điểm khác nhau. Mẫu lấy trải đều theo điểm (cao → thấp) để thể hiện sự đa dạng.

| # | MSSV | Họ tên | Điểm | KTX | Phòng |
| --- | ---- | ------ | ---- | --- | ----- |
| 1 | 2024_0217 | Thái Văn Kiên | 100 | G7 - Bách Khoa | 207 |
| 2 | 2024_0221 | Tô Tiến Bảo | 100 | G7 - Bách Khoa | 207 |
| 3 | 2024_0227 | Lý Văn Quân | 100 | G7 - Bách Khoa | 207 |
| 4 | 2024_0233 | Đặng Quốc Minh | 100 | G7 - Bách Khoa | 207 |
| 5 | 2024_0246 | Mạc Xuân Bảo | 100 | G7 - Bách Khoa | 301 |
| 6 | 2024_0251 | Tô Xuân Anh | 100 | G7 - Bách Khoa | 301 |
| 7 | 2024_0254 | Đào Trung Thành | 100 | G7 - Bách Khoa | 301 |
| 8 | 2024_0271 | Trần Xuân Bảo | 100 | G7 - Bách Khoa | 301 |
| 9 | 2024_0277 | Thái Sơn Dũng | 100 | G7 - Bách Khoa | 302 |
| 10 | 2024_0298 | Hoàng Công Tùng | 100 | G7 - Bách Khoa | 302 |
| 11 | 2024_0313 | Mai Hữu Phúc | 100 | G7 - Bách Khoa | 302 |
| 12 | 2024_0482 | Lưu Hà Loan | 100 | G7 - Bách Khoa | 302 |
| 13 | 2024_0487 | Trịnh Hà Thanh | 100 | G7 - Bách Khoa | 303 |
| 14 | 2024_0491 | Ngô Linh Hằng | 100 | G7 - Bách Khoa | 303 |
| 15 | 2024_0512 | Lưu Mai Thanh | 100 | G7 - Bách Khoa | 303 |
| 16 | 2024_0539 | Thái Thanh Xuân | 100 | G7 - Bách Khoa | 303 |
| 17 | 2024_0551 | Ngô Phương Hà | 100 | G7 - Bách Khoa | 304 |
| 18 | 2024_0553 | Đỗ Gia Kim | 100 | G7 - Bách Khoa | 304 |
| 19 | 2024_0555 | Đặng Lan Yến | 100 | G7 - Bách Khoa | 304 |
| 20 | 2024_0564 | Nguyễn Thanh Xuân | 100 | G7 - Bách Khoa | 305 |
| 21 | 2024_0566 | Cao Hoàng Hằng | 100 | G7 - Bách Khoa | 305 |
| 22 | 2024_0569 | Thái Ngọc Nhài | 100 | G7 - Bách Khoa | 306 |
| 23 | 2024_0501 | Phạm Linh Hà | 98 | G7 - Bách Khoa | 306 |
| 24 | 2024_0228 | Dương Quốc Quốc | 91 | G7 - Bách Khoa | 307 |
| 25 | 2024_0278 | Tạ Công Quốc | 91 | G7 - Bách Khoa | 307 |
| 26 | 2024_0311 | Tô Ngọc Hải | 91 | G7 - Bách Khoa | 307 |
| 27 | 2024_0523 | Đỗ Khánh Trang | 91 | G7 - Bách Khoa | 307 |
| 28 | 2024_0543 | Tô Gia Nhung | 91 | G7 - Bách Khoa | 307 |
| 29 | 2024_0211 | Trần Hải Hải | 89 | G7 - Bách Khoa | 401 |
| 30 | 2024_0237 | Huỳnh Văn Hữu | 89 | G7 - Bách Khoa | 401 |
| 31 | 2024_0302 | Nguyễn Sơn Dũng | 89 | G7 - Bách Khoa | 401 |
| 32 | 2024_0310 | Lưu Phước Trọng | 89 | G7 - Bách Khoa | 401 |
| 33 | 2024_0534 | Nguyễn Bích Chi | 89 | G7 - Bách Khoa | 402 |
| 34 | 2024_0560 | Hoàng Lan Mỹ | 89 | G7 - Bách Khoa | 402 |
| 35 | 2024_0207 | Huỳnh Hữu Vinh | 86 | G7 - Bách Khoa | 402 |
| 36 | 2024_0483 | Tô Thị Thúy | 86 | G7 - Bách Khoa | 402 |
| 37 | 2024_0292 | Bùi Sơn Tiến | 84 | G7 - Bách Khoa | 402 |
| 38 | 2024_0206 | Phan Hải Hùng | 79 | G7 - Bách Khoa | 403 |
| 39 | 2024_0214 | Cao Minh Đạt | 79 | G7 - Bách Khoa | 403 |
| 40 | 2024_0223 | Mai Quốc Tùng | 79 | G7 - Bách Khoa | 403 |
| 41 | 2024_0229 | Ngô Minh Thành | 79 | G7 - Bách Khoa | 403 |
| 42 | 2024_0232 | Bùi Văn Vinh | 79 | G7 - Bách Khoa | 404 |
| 43 | 2024_0238 | Hoàng Quốc Phúc | 79 | G7 - Bách Khoa | 404 |
| 44 | 2024_0244 | Cao Trung Văn | 79 | G7 - Bách Khoa | 405 |
| 45 | 2024_0255 | Trịnh Bảo Nhân | 79 | G7 - Bách Khoa | 405 |
| 46 | 2024_0257 | Lý Tuấn Khải | 79 | G7 - Bách Khoa | 405 |
| 47 | 2024_0273 | Vương Công Tùng | 79 | G7 - Bách Khoa | 406 |
| 48 | 2024_0276 | Mạc Đình Anh | 79 | G7 - Bách Khoa | 406 |
| 49 | 2024_0288 | Dương Công Phúc | 79 | G7 - Bách Khoa | 407 |
| 50 | 2024_0296 | Phan Đình Bảo | 79 | G7 - Bách Khoa | 407 |
_... (hiển thị 50/97 mẫu trải đều theo điểm)_

#### Năm 4+ — 32 người

> Điểm: **88–100** | 4 mức điểm khác nhau. Mẫu lấy trải đều theo điểm (cao → thấp) để thể hiện sự đa dạng.

| # | MSSV | Họ tên | Điểm | KTX | Phòng |
| --- | ---- | ------ | ---- | --- | ----- |
| 1 | 2023_0161 | Bùi Bảo Quân | 100 | G7 - Bách Khoa | 407 |
| 2 | 2023_0166 | Huỳnh Bảo Vinh | 100 | G7 - Bách Khoa | 407 |
| 3 | 2023_0169 | Lê Đức Anh | 100 | G7 - Bách Khoa | 407 |
| 4 | 2023_0178 | Hà Sơn Văn | 100 | G7 - Bách Khoa | 407 |
| 5 | 2023_0188 | Ngô Sơn Thành | 100 | G7 - Bách Khoa | 407 |
| 6 | 2023_0207 | Tạ Ngọc Tùng | 100 | G7 - Bách Khoa | 501 |
| 7 | 2023_0210 | Tô Gia Tiến | 100 | G7 - Bách Khoa | 501 |
| 8 | 2023_0215 | Đinh Gia Nam | 100 | G7 - Bách Khoa | 501 |
| 9 | 2023_0222 | Đặng Ngọc Phúc | 100 | G7 - Bách Khoa | 501 |
| 10 | 2023_0236 | Thái Minh Quân | 100 | G7 - Bách Khoa | 501 |
| 11 | 2023_0237 | Tạ Duy Quốc | 100 | G7 - Bách Khoa | 501 |
| 12 | 2023_0239 | Lưu Văn Bảo | 100 | G7 - Bách Khoa | 501 |
| 13 | 2023_0241 | Trương Minh Vinh | 100 | G7 - Bách Khoa | 501 |
| 14 | 2023_0249 | Hồ Văn Hùng | 100 | G7 - Bách Khoa | 502 |
| 15 | 2023_0252 | Đặng Duy Bình | 100 | G7 - Bách Khoa | 502 |
| 16 | 2023_0390 | Nguyễn Tuyết Chi | 100 | G7 - Bách Khoa | 502 |
| 17 | 2023_0406 | Dương Hà Diệp | 100 | G7 - Bách Khoa | 502 |
| 18 | 2023_0409 | Đỗ Diễm Bích | 100 | G7 - Bách Khoa | 502 |
| 19 | 2023_0419 | Trần Diễm Hương | 100 | G7 - Bách Khoa | 502 |
| 20 | 2023_0444 | Phan Mỹ Hương | 100 | G7 - Bách Khoa | 502 |
| 21 | 2023_0445 | Huỳnh Hương Xuân | 100 | G7 - Bách Khoa | 502 |
| 22 | 2023_0448 | Lê Bích Lụa | 100 | G7 - Bách Khoa | 503 |
| 23 | 2023_0451 | Vương Xuân Tuyết | 100 | G7 - Bách Khoa | 503 |
| 24 | 2023_0452 | Cao Gia Phương | 100 | G7 - Bách Khoa | 503 |
| 25 | 2023_0468 | Hồ Thanh Kim | 100 | G7 - Bách Khoa | 503 |
| 26 | 2023_0219 | Hồ Hữu Anh | 93 | G7 - Bách Khoa | 503 |
| 27 | 2023_0223 | Võ Hải Đạt | 93 | G7 - Bách Khoa | 503 |
| 28 | 2023_0417 | Phạm Thị Thảo | 93 | G7 - Bách Khoa | 503 |
| 29 | 2023_0172 | Vương Đình Phúc | 91 | G7 - Bách Khoa | 503 |
| 30 | 2023_0413 | Vũ Kim Trang | 91 | G7 - Bách Khoa | 504 |
| 31 | 2023_0415 | Huỳnh Linh Chi | 91 | G7 - Bách Khoa | 504 |
| 32 | 2023_0234 | Tống Văn Trung | 88 | G7 - Bách Khoa | 504 |

#### Năm 1 Synthetic (2026xxx) — 20 mẫu (sẽ bị bỏ qua khi Apply)

| # | MSSV | Họ tên | Điểm | KTX | Phòng |
| --- | ---- | ------ | ---- | --- | ----- |
| 1 | 2026_0001 | Nguyễn Văn An | 100 | A1 - Bách Khoa | 101 |
| 2 | 2026_0002 | Vương Đức Mạnh | 100 | A1 - Bách Khoa | 101 |
| 3 | 2026_0003 | Nguyễn Thị Anh | 100 | A1 - Bách Khoa | 101 |
| 4 | 2026_0004 | Vương Bích Mai | 100 | A1 - Bách Khoa | 101 |
| 5 | 2026_0005 | Cao Trung Trung | 100 | A1 - Bách Khoa | 101 |
| 6 | 2026_0006 | Cao Mỹ Uyên | 100 | A1 - Bách Khoa | 101 |
| 7 | 2026_0007 | Tống Hương Hương | 100 | A1 - Bách Khoa | 101 |
| 8 | 2026_0008 | Mạc Mai Thư | 100 | A1 - Bách Khoa | 101 |
| 9 | 2026_0009 | Thái Khánh Hà | 100 | A1 - Bách Khoa | 102 |
| 10 | 2026_0010 | Tạ Bích Thanh | 100 | A1 - Bách Khoa | 102 |
| 11 | 2026_0011 | Hà Mỹ Chi | 100 | A1 - Bách Khoa | 102 |
| 12 | 2026_0012 | Tống Bảo Khoa | 100 | A1 - Bách Khoa | 102 |
| 13 | 2026_0013 | Mạc Xuân Sơn | 100 | A1 - Bách Khoa | 102 |
| 14 | 2026_0014 | Thái Tuấn Đức | 100 | A1 - Bách Khoa | 102 |
| 15 | 2026_0015 | Lưu Hương Nhi | 100 | A1 - Bách Khoa | 102 |
| 16 | 2026_0016 | Tạ Đức Quân | 100 | A1 - Bách Khoa | 102 |
| 17 | 2026_0017 | Hà Trung Cường | 100 | A1 - Bách Khoa | 103 |
| 18 | 2026_0018 | Tô Mai Xuân | 100 | A1 - Bách Khoa | 103 |
| 19 | 2026_0019 | Lưu Bảo Nam | 100 | A1 - Bách Khoa | 103 |
| 20 | 2026_0020 | Tô Xuân Tuấn | 100 | A1 - Bách Khoa | 103 |
_... và 306 sinh viên Năm 1 synthetic khác_

---

## 6. Danh sách KHÔNG ĐƯỢC NHẬN (Waitlist / Bị loại)

> Tổng: **343** sinh viên không được phân phòng, sắp xếp theo điểm ưu tiên **tăng dần** (điểm thấp nhất lên đầu).

### 6.1 Năm 4+ — 148 người bị loại (quota: 32)

> Điểm thấp nhất: **15** | Điểm cao nhất: **88**

| # | MSSV | Họ tên | Điểm ưu tiên | Lý do |
| --- | ---- | ------ | ------------ | ----- |
| 1 | 2023_0240 | Tô Quốc Nam | 15 | Vượt quota Năm 4+ (32 suất) |
| 2 | 2023_0416 | Hoàng Hà Mỹ | 15 | Vượt quota Năm 4+ (32 suất) |
| 3 | 2023_0428 | Lưu Bích Linh | 15 | Vượt quota Năm 4+ (32 suất) |
| 4 | 2023_0438 | Hồ Bích Trang | 15 | Vượt quota Năm 4+ (32 suất) |
| 5 | 2023_0458 | Lưu Thanh Nhung | 15 | Vượt quota Năm 4+ (32 suất) |
| 6 | 2023_0189 | Hồ Công Bảo | 20 | Vượt quota Năm 4+ (32 suất) |
| 7 | 2023_0422 | Cao Khánh Hằng | 20 | Vượt quota Năm 4+ (32 suất) |
| 8 | 2023_0435 | Lý Hương Thu | 20 | Vượt quota Năm 4+ (32 suất) |
| 9 | 2023_0442 | Võ Khánh Ngọc | 20 | Vượt quota Năm 4+ (32 suất) |
| 10 | 2023_0187 | Dương Đình Quốc | 30 | Vượt quota Năm 4+ (32 suất) |
| 11 | 2023_0195 | Phan Hoàng Dũng | 30 | Vượt quota Năm 4+ (32 suất) |
| 12 | 2023_0225 | Phan Gia Khải | 30 | Vượt quota Năm 4+ (32 suất) |
| 13 | 2023_0235 | Mạc Quốc Tiến | 30 | Vượt quota Năm 4+ (32 suất) |
| 14 | 2023_0256 | Huỳnh Minh Khánh | 30 | Vượt quota Năm 4+ (32 suất) |
| 15 | 2023_0430 | Trương Hương Hiền | 30 | Vượt quota Năm 4+ (32 suất) |
| 16 | 2023_0470 | Bùi Phương Xuân | 30 | Vượt quota Năm 4+ (32 suất) |
| 17 | 2023_0180 | Tô Hoàng Công | 35 | Vượt quota Năm 4+ (32 suất) |
| 18 | 2023_0194 | Vũ Công Anh | 35 | Vượt quota Năm 4+ (32 suất) |
| 19 | 2023_0213 | Đào Hải Thành | 35 | Vượt quota Năm 4+ (32 suất) |
| 20 | 2023_0218 | Ngô Hải Tú | 35 | Vượt quota Năm 4+ (32 suất) |
| 21 | 2023_0229 | Lê Hữu Hải | 35 | Vượt quota Năm 4+ (32 suất) |
| 22 | 2023_0230 | Trần Gia Công | 35 | Vượt quota Năm 4+ (32 suất) |
| 23 | 2023_0243 | Đào Tiến Tú | 35 | Vượt quota Năm 4+ (32 suất) |
| 24 | 2023_0397 | Hà Thị Loan | 35 | Vượt quota Năm 4+ (32 suất) |
| 25 | 2023_0453 | Tống Thanh Linh | 35 | Vượt quota Năm 4+ (32 suất) |
| 26 | 2023_0455 | Thái Phương Hiền | 35 | Vượt quota Năm 4+ (32 suất) |
| 27 | 2023_0168 | Phạm Tuấn Tú | 39 | Vượt quota Năm 4+ (32 suất) |
| 28 | 2023_0179 | Lưu Công Hải | 39 | Vượt quota Năm 4+ (32 suất) |
| 29 | 2023_0204 | Tống Hữu Hải | 39 | Vượt quota Năm 4+ (32 suất) |
| 30 | 2023_0205 | Mạc Gia Công | 39 | Vượt quota Năm 4+ (32 suất) |
_... và 118 sinh viên khác_

### 6.2 Năm 3 — 103 người bị loại (quota: 97)

> Điểm thấp nhất: **25** | Điểm cao nhất: **79**

| # | MSSV | Họ tên | Điểm ưu tiên | Lý do |
| --- | ---- | ------ | ------------ | ----- |
| 1 | 2024_0267 | Huỳnh Tuấn Tiến | 25 | Vượt quota Năm 3 (97 suất) |
| 2 | 2024_0291 | Đỗ Đình Trung | 30 | Vượt quota Năm 3 (97 suất) |
| 3 | 2024_0304 | Cao Gia Thành | 30 | Vượt quota Năm 3 (97 suất) |
| 4 | 2024_0529 | Huỳnh Bích Thu | 30 | Vượt quota Năm 3 (97 suất) |
| 5 | 2024_0549 | Lý Thanh Hiền | 30 | Vượt quota Năm 3 (97 suất) |
| 6 | 2024_0567 | Tống Tuyết Vân | 30 | Vượt quota Năm 3 (97 suất) |
| 7 | 2024_0518 | Đinh Khánh Nhung | 40 | Vượt quota Năm 3 (97 suất) |
| 8 | 2024_0546 | Đào Phương Phương | 40 | Vượt quota Năm 3 (97 suất) |
| 9 | 2024_0562 | Lê Xuân Thanh | 40 | Vượt quota Năm 3 (97 suất) |
| 10 | 2024_0209 | Phạm Phước Tú | 45 | Vượt quota Năm 3 (97 suất) |
| 11 | 2024_0235 | Vũ Duy Trọng | 45 | Vượt quota Năm 3 (97 suất) |
| 12 | 2024_0241 | Trần Tiến Trung | 45 | Vượt quota Năm 3 (97 suất) |
| 13 | 2024_0247 | Thái Tuấn Nam | 45 | Vượt quota Năm 3 (97 suất) |
| 14 | 2024_0263 | Đặng Đức Phúc | 45 | Vượt quota Năm 3 (97 suất) |
| 15 | 2024_0264 | Võ Trung Đạt | 45 | Vượt quota Năm 3 (97 suất) |
| 16 | 2024_0493 | Đỗ Thị Uyên | 45 | Vượt quota Năm 3 (97 suất) |
| 17 | 2024_0498 | Phan Thị Nhi | 45 | Vượt quota Năm 3 (97 suất) |
| 18 | 2024_0540 | Tạ Lan Lan | 45 | Vượt quota Năm 3 (97 suất) |
| 19 | 2024_0544 | Trương Thanh Nhài | 45 | Vượt quota Năm 3 (97 suất) |
| 20 | 2024_0210 | Lê Ngọc Trọng | 49 | Vượt quota Năm 3 (97 suất) |
| 21 | 2024_0242 | Nguyễn Văn Kiên | 49 | Vượt quota Năm 3 (97 suất) |
| 22 | 2024_0269 | Phạm Trung Văn | 49 | Vượt quota Năm 3 (97 suất) |
| 23 | 2024_0289 | Ngô Hoàng Đạt | 49 | Vượt quota Năm 3 (97 suất) |
| 24 | 2024_0295 | Vũ Thanh Long | 49 | Vượt quota Năm 3 (97 suất) |
| 25 | 2024_0550 | Dương Lan Diệp | 49 | Vượt quota Năm 3 (97 suất) |
| 26 | 2024_0563 | Trần Gia Linh | 49 | Vượt quota Năm 3 (97 suất) |
| 27 | 2024_0248 | Tạ Đức Tùng | 50 | Vượt quota Năm 3 (97 suất) |
| 28 | 2024_0530 | Hoàng Mỹ Yến | 50 | Vượt quota Năm 3 (97 suất) |
| 29 | 2024_0280 | Lưu Thanh Nhân | 54 | Vượt quota Năm 3 (97 suất) |
| 30 | 2024_0297 | Huỳnh Sơn Nam | 54 | Vượt quota Năm 3 (97 suất) |
_... và 73 sinh viên khác_

### 6.3 Năm 2 — 85 người bị loại (quota: 195)

> Điểm thấp nhất: **40** | Điểm cao nhất: **79**

| # | MSSV | Họ tên | Điểm ưu tiên | Lý do |
| --- | ---- | ------ | ------------ | ----- |
| 1 | 2025_0337 | Đỗ Công Anh | 40 | Vượt quota Năm 2 (195 suất) |
| 2 | 2025_0603 | Đỗ Phương Nhung | 40 | Vượt quota Năm 2 (195 suất) |
| 3 | 2025_0624 | Trương Tuyết Nhi | 40 | Vượt quota Năm 2 (195 suất) |
| 4 | 2025_0595 | Mai Gia Nhài | 50 | Vượt quota Năm 2 (195 suất) |
| 5 | 2025_0619 | Thái Tuyết Uyên | 50 | Vượt quota Năm 2 (195 suất) |
| 6 | 2025_0642 | Lê Thu Loan | 50 | Vượt quota Năm 2 (195 suất) |
| 7 | 2025_0230 | Cao Hải Quốc | 55 | Vượt quota Năm 2 (195 suất) |
| 8 | 2025_0241 | Trịnh Hữu Nhân | 55 | Vượt quota Năm 2 (195 suất) |
| 9 | 2025_0250 | Võ Hải Tùng | 55 | Vượt quota Năm 2 (195 suất) |
| 10 | 2025_0254 | Hoàng Ngọc Quân | 55 | Vượt quota Năm 2 (195 suất) |
| 11 | 2025_0260 | Cao Tiến Minh | 55 | Vượt quota Năm 2 (195 suất) |
| 12 | 2025_0300 | Đào Xuân Tùng | 55 | Vượt quota Năm 2 (195 suất) |
| 13 | 2025_0320 | Cao Đình Bình | 55 | Vượt quota Năm 2 (195 suất) |
| 14 | 2025_0323 | Thái Hoàng Công | 55 | Vượt quota Năm 2 (195 suất) |
| 15 | 2025_0331 | Trịnh Sơn Thành | 55 | Vượt quota Năm 2 (195 suất) |
| 16 | 2025_0354 | Tạ Phước Quân | 55 | Vượt quota Năm 2 (195 suất) |
| 17 | 2025_0359 | Mai Phước Vinh | 55 | Vượt quota Năm 2 (195 suất) |
| 18 | 2025_0368 | Bùi Gia Khải | 55 | Vượt quota Năm 2 (195 suất) |
| 19 | 2025_0369 | Đặng Phước Kiên | 55 | Vượt quota Năm 2 (195 suất) |
| 20 | 2025_0370 | Võ Ngọc Bình | 55 | Vượt quota Năm 2 (195 suất) |
| 21 | 2025_0577 | Vũ Mỹ Vân | 55 | Vượt quota Năm 2 (195 suất) |
| 22 | 2025_0586 | Cao Thanh Hà | 55 | Vượt quota Năm 2 (195 suất) |
| 23 | 2025_0594 | Trương Xuân Uyên | 55 | Vượt quota Năm 2 (195 suất) |
| 24 | 2025_0598 | Đinh Phương Linh | 55 | Vượt quota Năm 2 (195 suất) |
| 25 | 2025_0599 | Lý Xuân Nhi | 55 | Vượt quota Năm 2 (195 suất) |
| 26 | 2025_0608 | Phan Phương Trang | 55 | Vượt quota Năm 2 (195 suất) |
| 27 | 2025_0653 | Tô Diễm Nhung | 55 | Vượt quota Năm 2 (195 suất) |
| 28 | 2025_0658 | Đinh Diễm Trang | 55 | Vượt quota Năm 2 (195 suất) |
| 29 | 2025_0296 | Lưu Tuấn Văn | 59 | Vượt quota Năm 2 (195 suất) |
| 30 | 2025_0312 | Phan Đức Anh | 59 | Vượt quota Năm 2 (195 suất) |
_... và 55 sinh viên khác_

### 6.4 Năm 1 — 7 người bị loại (quota: 326)

> Điểm thấp nhất: **30** | Điểm cao nhất: **45**

| # | MSSV | Họ tên | Điểm ưu tiên | Lý do |
| --- | ---- | ------ | ------------ | ----- |
| 1 | 2026_0331 | Đỗ Hương Giang | 30 | Vượt quota Năm 1 (326 suất) |
| 2 | 2026_0332 | Mai Hải An | 30 | Vượt quota Năm 1 (326 suất) |
| 3 | 2026_0333 | Bùi Mai Ngọc | 30 | Vượt quota Năm 1 (326 suất) |
| 4 | 2026_0327 | Lý Mai Linh | 45 | Vượt quota Năm 1 (326 suất) |
| 5 | 2026_0328 | Dương Khánh Trinh | 45 | Vượt quota Năm 1 (326 suất) |
| 6 | 2026_0329 | Ngô Bích Hoa | 45 | Vượt quota Năm 1 (326 suất) |
| 7 | 2026_0330 | Hồ Mỹ Thu | 45 | Vượt quota Năm 1 (326 suất) |

---

## 7. Apply → Undo (Vòng đời Snapshot)

### 7.1 Apply

| Chỉ số | Giá trị |
| ------ | ------- |
| Snapshot ID | SNAP-1781461643965-GWZPE |
| Status | APPLIED |
| Sinh viên thực được apply | 324 |
| Synthetic Năm 1 bỏ qua | 326 |
| Thời điểm apply | 01:27:23 15/6/2026 |

### 7.2 Undo

| Chỉ số | Giá trị |
| ------ | ------- |
| Snapshot sau Undo | UNDONE |
| Thời điểm Undo | 01:27:38 15/6/2026 |
| AllocationCycle status | PENDING |
| Kết quả | ✅ Restored về PENDING |

---

## 8. Kiểm tra Dữ liệu (verify-seed assertions)

| # | Kiểm tra | Kết quả | Actual | Expected |
| --- | -------- | ------- | ------ | -------- |
| 1 | Tổng sinh viên thường | ✅ PASS | 1910 | 1910 |
| 2 | Active RoomAllocations | ✅ PASS | 1191 | 1190-1192 |
| 3 | Sinh viên có phòng | ✅ PASS | 1190 | 1190 |
| 4 | Sinh viên chưa có phòng | ✅ PASS | 720 | 720 |
| 5 | Occupancy % | ✅ PASS | 68.4% | 65-72% |
| 6 | 2022xxx tổng | ✅ PASS | 180 | 180 |
| 7 | 2022xxx có phòng | ✅ PASS | 120 | 120 |
| 8 | 2023xxx tổng | ✅ PASS | 470 | 470 |
| 9 | 2023xxx có phòng | ✅ PASS | 290 | 290 |
| 10 | 2024xxx tổng | ✅ PASS | 570 | 570 |
| 11 | 2024xxx có phòng | ✅ PASS | 370 | 370 |
| 12 | 2025xxx tổng | ✅ PASS | 690 | 690 |
| 13 | 2025xxx có phòng | ✅ PASS | 410 | 410 |
| 14 | 99999999 isTestAccount=true | ✅ PASS | true | true |
| 15 | 99999999 có phòng | ✅ PASS | true | true |
| 16 | Không có sinh viên 2021xxx | ✅ PASS | 0 | 0 |
| 17 | quotaConfig tổng = 100% | ✅ PASS | 100 | 100 |
| 18 | Không có AllocationCycle ACTIVE | ✅ PASS | 0 | 0 |
| 19 | MSSV format XXXX_XXXX | ✅ PASS | 2022_0001 | XXXX_XXXX |
| 20 | Không có tên trùng trong cùng cohort | ✅ PASS | 0 trùng | 0 |
| 21 | Faculty diversity ≥ 8 khoa | ✅ PASS | 12 | ≥ 8 |

**21/21 assertions passed** — ✅ ALL PASSED

---

## 9. E2E Test Summary

| Bước | Mô tả | Kết quả |
| ---- | ----- | ------- |
| 1 | Init workspace (admintest) | ✅ 1911 students, 7 dorms |
| 2 | Cohort shift 2026-2027 | ✅ 180 × 2022xxx marked mustLeave |
| 3 | Seed Year-1 (2026) | ✅ 333 students (quota 326 + REJECT_TARGET 7 cố định) |
| 4 | Run allocation preview | ✅ 650 allocated / 343 waitlisted |
| 5 | Assert quota bands | ✅ year1=326 year2=195 year3=97 year4+=32 |
| 6 | Assert score distribution | ✅ min reject score = 30 |
| 7 | Apply to real DB | ✅ 324 real applied, 326 synthetic skipped |
| 8 | Undo allocation | ✅ AllocationCycle → PENDING |
| 9 | Report generation | ✅ final-report.md |

---

## 10. Những gì đã xây dựng trong session này

### Scripts

| File | Mô tả |
|------|-------|
| `scripts/reset-and-reseed-production.js` | Reset toàn bộ data cũ, seed 1,550 SV theo bảng chính xác, tạo RoomAllocation ACTIVE, policy + cycle |
| `scripts/verify-seed.js` | 17 assertions kiểm tra tính đúng đắn của seed |
| `scripts/run-simulation-e2e-test.js` | E2E test cập nhật: quota bands, reject score, sorted waitlist, report assertions |
| `scripts/generate-final-report.js` | Script này — báo cáo tổng hợp toàn diện |

### Source code

| File | Thay đổi |
|------|---------|
| `src/schemas/AllocationPolicySchema.js` | Thêm `quotaConfig` (year1/2/3/year4plus, allowOverflow) |
| `src/schemas/simulation/SimulationRunSchema.js` | Thêm `quotaBands` vào summary, `quota` vào YearGroupStat |
| `src/config/config.js` | Thêm `isTestAccount: Boolean` vào StudentSchema |
| `src/services/simulationEngineService.js` | `computeQuotaBands()` dynamic, `seedYear1Students` dùng quota + REJECT_TARGET 7 cố định (cùng buffer 3% với allocation), `runAllocationPreview` gọi computeQuotaBands |
| `src/services/simulationApplyService.js` | Sort waitlist ASC, quota column trong report, disclaimer synthetic Year 1 |
| `src/data/simulation/year1Generator.js` | 4 nhóm điểm rõ ràng (A/B/C/D), Group D có violation → điểm 30-55 |
| `src/routes/admin/admin-allocation-ui-routes.js` | POST /policies validate quotaConfig sum=100%, lưu quotaConfig |
| `views/admin/allocation/admin-allocation-policies.ejs` | Quota sliders + real-time sum validation + allowOverflow toggle |

### Seed data kết quả

| Metric | Giá trị |
|--------|---------|
| Tổng sinh viên | 1,910 (+ 99999999) |
| 2022xxx (Năm 5+, rời KTX) | 180 (120 có phòng, 60 không) |
| 2023xxx (Năm 4+) | 470 (290 có phòng, 180 không) |
| 2024xxx (Năm 3) | 570 (370 có phòng, 200 không) |
| 2025xxx (Năm 2) | 690 (410 có phòng, 280 không) |
| Occupancy hiện tại | 68.4% (1191/1742 giường) |
| Format MSSV | `2022_0001` → `2025_0690` |

---

_Báo cáo được tạo tự động bởi `scripts/generate-final-report.js` — eDorm Simulation Engine._