# eDorm — Final Simulation Report
> **Tạo lúc:** 01:56:08 14/6/2026  
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
| 2026-2027 | Main Registration | PENDING | 26/7/2026 |
| 2025-2026 | Main Registration | COMPLETED | 1/9/2025 |

---

## 2. Khởi tạo Workspace Mô phỏng

| Chỉ số | Giá trị |
| ------ | ------- |
| Workspace ID | 6a2da7cae2226db846cf98a2 |
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
| 1 | 2022_0001 | Tô Phước Hùng | Năm 5+ (Ra KTX) | 5 |
| 2 | 2022_0002 | Lưu Văn Nam | Năm 5+ (Ra KTX) | 5 |
| 3 | 2022_0003 | Hà Hữu Khánh | Năm 5+ (Ra KTX) | 5 |
| 4 | 2022_0004 | Tạ Trung Phúc | Năm 5+ (Ra KTX) | 5 |
| 5 | 2022_0005 | Thái Công Thành | Năm 5+ (Ra KTX) | 5 |
| 6 | 2022_0006 | Mạc Quốc Long | Năm 5+ (Ra KTX) | 5 |
| 7 | 2022_0007 | Tống Đức Hải | Năm 5+ (Ra KTX) | 5 |
| 8 | 2022_0008 | Cao Minh Dũng | Năm 5+ (Ra KTX) | 5 |
| 9 | 2022_0009 | Vương Gia Quân | Năm 5+ (Ra KTX) | 5 |
| 10 | 2022_0010 | Nguyễn Hoàng Bình | Năm 5+ (Ra KTX) | 5 |
| 11 | 2022_0011 | Trần Phước Tú | Năm 5+ (Ra KTX) | 5 |
| 12 | 2022_0012 | Lê Văn Mạnh | Năm 5+ (Ra KTX) | 5 |
| 13 | 2022_0013 | Phạm Hữu Trung | Năm 5+ (Ra KTX) | 5 |
| 14 | 2022_0014 | Hoàng Trung Khải | Năm 5+ (Ra KTX) | 5 |
| 15 | 2022_0015 | Huỳnh Công Vinh | Năm 5+ (Ra KTX) | 5 |
| 16 | 2022_0016 | Phan Quốc Tùng | Năm 5+ (Ra KTX) | 5 |
| 17 | 2022_0017 | Vũ Đức Đạt | Năm 5+ (Ra KTX) | 5 |
| 18 | 2022_0018 | Võ Minh Nhân | Năm 5+ (Ra KTX) | 5 |
| 19 | 2022_0019 | Đặng Gia Bảo | Năm 5+ (Ra KTX) | 5 |
| 20 | 2022_0020 | Bùi Hoàng Công | Năm 5+ (Ra KTX) | 5 |
| 21 | 2022_0021 | Đỗ Phước Hữu | Năm 5+ (Ra KTX) | 5 |
| 22 | 2022_0022 | Hồ Văn Quốc | Năm 5+ (Ra KTX) | 5 |
| 23 | 2022_0023 | Ngô Hữu Văn | Năm 5+ (Ra KTX) | 5 |
| 24 | 2022_0024 | Dương Trung Trọng | Năm 5+ (Ra KTX) | 5 |
| 25 | 2022_0025 | Lý Công Anh | Năm 5+ (Ra KTX) | 5 |
| 26 | 2022_0026 | Đinh Quốc Tiến | Năm 5+ (Ra KTX) | 5 |
| 27 | 2022_0027 | Trịnh Đức Kiên | Năm 5+ (Ra KTX) | 5 |
| 28 | 2022_0028 | Đào Minh Minh | Năm 5+ (Ra KTX) | 5 |
| 29 | 2022_0029 | Mai Gia Tuấn | Năm 5+ (Ra KTX) | 5 |
| 30 | 2022_0030 | Trương Hoàng Đức | Năm 5+ (Ra KTX) | 5 |
_... và 150 sinh viên khác (tổng 180 người)_

---

## 4. Seed Sinh viên Năm 1 (2026xxx)

| Chỉ số | Giá trị |
| ------ | ------- |
| Tổng seeded | 343 |
| Nhóm A — ở xa, nghèo, DTTS (điểm cao) | 78 |
| Nhóm B — khoảng cách trung bình (điểm TB) | 127 |
| Nhóm C — ở gần, khá giả (điểm thấp) | 102 |
| Nhóm D — ở gần, khá giả, vi phạm (điểm rất thấp) | 36 |

### 4.1 Mẫu 20 sinh viên năm 1 được seed

| # | MSSV | Họ tên | Giới tính | Khoa | Tỉnh | Khoảng cách | Gia cảnh | Vi phạm |
| --- | ---- | ------ | --------- | ---- | ---- | ----------- | -------- | ------- |
| 1 | 2026_0034 | Lý Thùy Linh | Nữ | học | Kon Tum | 1335km | Nghèo | ✅ |
| 2 | 2026_0053 | Phan Thùy Uyên | Nữ | học | Cần Thơ | 1877km | Nghèo | ✅ |
| 3 | 2026_0054 | Dương Thị Thảo | Nữ | học | Đắk Lắk | 1396km | Nghèo | ✅ |
| 4 | 2026_0077 | Tô Bảo Hoàng | Nam | học | Nam Định | 92km | TB | ✅ |
| 5 | 2026_0087 | Lâm Gia Thắng | Nam | học | Sơn La | 314km | TB | ✅ |
| 6 | 2026_0160 | Đinh Thu Loan | Nữ | học | Sơn La | 329km | TB | ✅ |
| 7 | 2026_0162 | Tô Hữu Dũng | Nam | học | Ninh Bình | 95km | TB | ✅ |
| 8 | 2026_0239 | Đào Bảo Hải | Nam | học | Hưng Yên | 69km | Khá giả | ✅ |
| 9 | 2026_0307 | Vũ Minh Vy | Nam | học | Thái Nguyên | 75km | Khá giả | ✅ |
| 10 | 2026_0308 | Lý Hồng Tiến | Nam | học | Hà Tây cũ | 29km | Khá giả | ⚠️ Nhẹ |
| 11 | 2026_0319 | Trần Văn Phúc | Nam | học | Hưng Yên | 59km | Khá giả | ❌ Nặng |
| 12 | 2026_0330 | Ngô Hữu Nam | Nam | học | Vĩnh Phúc | 61km | Khá giả | ⚠️ Nhẹ |
| 13 | 2026_0337 | Vũ Thu Trinh | Nữ | học | Hưng Yên | 64km | Khá giả | ⚠️ Nhẹ |
| 14 | 2026_0340 | Bùi Ngọc Xuân | Nam | học | Hà Nam | 56km | Khá giả | ⚠️ Nhẹ |
| 15 | 2026_0001 | Đinh Diễm Hương | Nữ | tin | Kon Tum | 1334km | Nghèo | ✅ |
| 16 | 2026_0010 | Đinh Thanh Thảo | Nữ | tin | Khánh Hòa | 1277km | Nghèo | ✅ |
| 17 | 2026_0021 | Đặng Bích Thư | Nữ | tin | Kon Tum | 1329km | Nghèo | ✅ |
| 18 | 2026_0030 | Tạ Thu My | Nữ | tin | Khánh Hòa | 1279km | Nghèo | ✅ |
| 19 | 2026_0031 | Dương Thanh Ngọc | Nữ | tin | Khánh Hòa | 1283km | Nghèo | ✅ |
| 20 | 2026_0032 | Đỗ Minh Hải | Nam | tin | Gia Lai | 1197km | Nghèo | ✅ |

---

## 5. Phân bổ Phòng (Allocation Preview)

### 5.1 Số lượng đăng ký theo nhóm (trước phân bổ)

| Nhóm năm | Số lượng | Prefix gốc | Ghi chú |
| -------- | -------- | ---------- | ------- |
| Năm 1 (2026xxx) | 344 | 2026xxx | Synthetic — không apply thực |
| Năm 2 (2025xxx) | 690 | 2025xxx | Sinh viên thực |
| Năm 3 (2024xxx) | 570 | 2024xxx | Sinh viên thực |
| Năm 4+ (2023xxx) | 470 | 2023xxx | Sinh viên thực, ưu tiên thấp |
| Năm 5+ (2022xxx) | 180 | 2022xxx | Phải rời — không xét |

### 5.2 Kết quả phân bổ tổng quan

| Chỉ số | Giá trị |
| ------ | ------- |
| Giường trống ban đầu | 671 |
| Tổng giường | 1742 |
| Sinh viên trong Queue | 1003 |
| **Được nhận** | **650** |
| Danh sách chờ | 353 |
| Fill Rate | 96.9% |
| Occupancy trước | 61.5% |
| Occupancy sau | 98.8% |

### 5.3 Kết quả theo nhóm năm

| Nhóm | Quota | Đăng ký | Được nhận | Fill quota | Waitlist | Lý do waitlist |
| ---- | ----- | ------- | --------- | ---------- | -------- | -------------- |
| Năm 1 | 326 | 344 | 326 | 100% | 17 | Vượt quota / điểm thấp |
| Năm 2 | 195 | 690 | 195 | 100% | 85 | Vượt quota Năm 2 |
| Năm 3 | 97 | 570 | 97 | 100% | 103 | Vượt quota Năm 3 |
| Năm 4+ | 32 | 470 | 32 | 100% | 148 | Vượt quota Năm 4+ |

### 5.4 Sinh viên ĐƯỢC NHẬN — Real students (không tính 2026xxx synthetic)

> Tổng: **324** sinh viên thực được phân phòng.  
> + 326 sinh viên Năm 1 synthetic (2026xxx) được nhận trong sim (bị bỏ qua khi Apply).

#### Năm 2 — 195 người

| # | MSSV | Họ tên | Điểm | KTX | Phòng |
| --- | ---- | ------ | ---- | --- | ----- |
| 1 | 2025_0230 | Nguyễn Hoàng Bình | 100 | F6 - Bách Khoa | 508 |
| 2 | 2025_0231 | Trần Phước Tú | 100 | F6 - Bách Khoa | 601 |
| 3 | 2025_0232 | Lê Văn Mạnh | 100 | F6 - Bách Khoa | 601 |
| 4 | 2025_0233 | Phạm Hữu Trung | 100 | F6 - Bách Khoa | 601 |
| 5 | 2025_0234 | Hoàng Trung Khải | 100 | F6 - Bách Khoa | 601 |
| 6 | 2025_0235 | Huỳnh Công Vinh | 100 | F6 - Bách Khoa | 602 |
| 7 | 2025_0236 | Phan Quốc Tùng | 100 | F6 - Bách Khoa | 602 |
| 8 | 2025_0237 | Vũ Đức Đạt | 100 | F6 - Bách Khoa | 602 |
| 9 | 2025_0238 | Võ Minh Nhân | 100 | F6 - Bách Khoa | 602 |
| 10 | 2025_0239 | Đặng Gia Bảo | 100 | F6 - Bách Khoa | 603 |
| 11 | 2025_0240 | Bùi Hoàng Công | 100 | F6 - Bách Khoa | 603 |
| 12 | 2025_0241 | Đỗ Phước Hữu | 100 | F6 - Bách Khoa | 603 |
| 13 | 2025_0266 | Phan Quốc Tùng | 100 | F6 - Bách Khoa | 603 |
| 14 | 2025_0267 | Vũ Đức Đạt | 100 | F6 - Bách Khoa | 603 |
| 15 | 2025_0268 | Võ Minh Nhân | 100 | F6 - Bách Khoa | 604 |
| 16 | 2025_0269 | Đặng Gia Bảo | 100 | F6 - Bách Khoa | 604 |
| 17 | 2025_0271 | Đỗ Phước Hữu | 100 | F6 - Bách Khoa | 604 |
| 18 | 2025_0272 | Hồ Văn Quốc | 100 | F6 - Bách Khoa | 604 |
| 19 | 2025_0273 | Ngô Hữu Văn | 100 | F6 - Bách Khoa | 604 |
| 20 | 2025_0274 | Dương Trung Trọng | 100 | F6 - Bách Khoa | 605 |
| 21 | 2025_0288 | Cao Minh Dũng | 100 | F6 - Bách Khoa | 605 |
| 22 | 2025_0289 | Vương Gia Quân | 100 | F6 - Bách Khoa | 605 |
| 23 | 2025_0290 | Nguyễn Hoàng Bình | 100 | F6 - Bách Khoa | 605 |
| 24 | 2025_0291 | Trần Phước Tú | 100 | F6 - Bách Khoa | 605 |
| 25 | 2025_0292 | Lê Văn Mạnh | 100 | F6 - Bách Khoa | 605 |
| 26 | 2025_0293 | Phạm Hữu Trung | 100 | F6 - Bách Khoa | 605 |
| 27 | 2025_0294 | Hoàng Trung Khải | 100 | F6 - Bách Khoa | 605 |
| 28 | 2025_0295 | Huỳnh Công Vinh | 100 | F6 - Bách Khoa | 606 |
| 29 | 2025_0296 | Phan Quốc Tùng | 100 | F6 - Bách Khoa | 606 |
| 30 | 2025_0297 | Vũ Đức Đạt | 100 | F6 - Bách Khoa | 606 |
| 31 | 2025_0298 | Võ Minh Nhân | 100 | F6 - Bách Khoa | 606 |
| 32 | 2025_0299 | Đặng Gia Bảo | 100 | F6 - Bách Khoa | 606 |
| 33 | 2025_0300 | Bùi Hoàng Công | 100 | F6 - Bách Khoa | 606 |
| 34 | 2025_0301 | Đỗ Phước Hữu | 100 | F6 - Bách Khoa | 606 |
| 35 | 2025_0302 | Hồ Văn Quốc | 100 | F6 - Bách Khoa | 606 |
| 36 | 2025_0303 | Ngô Hữu Văn | 100 | F6 - Bách Khoa | 607 |
| 37 | 2025_0304 | Dương Trung Trọng | 100 | F6 - Bách Khoa | 607 |
| 38 | 2025_0305 | Lý Công Anh | 100 | F6 - Bách Khoa | 607 |
| 39 | 2025_0308 | Đào Minh Minh | 100 | F6 - Bách Khoa | 607 |
| 40 | 2025_0309 | Mai Gia Tuấn | 100 | F6 - Bách Khoa | 607 |
| 41 | 2025_0310 | Trương Hoàng Đức | 100 | F6 - Bách Khoa | 607 |
| 42 | 2025_0311 | Tô Phước Hùng | 100 | F6 - Bách Khoa | 607 |
| 43 | 2025_0330 | Bùi Hoàng Công | 100 | F6 - Bách Khoa | 607 |
| 44 | 2025_0331 | Đỗ Phước Hữu | 100 | F6 - Bách Khoa | 608 |
| 45 | 2025_0332 | Hồ Văn Quốc | 100 | F6 - Bách Khoa | 608 |
| 46 | 2025_0333 | Ngô Hữu Văn | 100 | F6 - Bách Khoa | 608 |
| 47 | 2025_0334 | Dương Trung Trọng | 100 | F6 - Bách Khoa | 608 |
| 48 | 2025_0335 | Lý Công Anh | 100 | F6 - Bách Khoa | 608 |
| 49 | 2025_0336 | Đinh Quốc Tiến | 100 | F6 - Bách Khoa | 608 |
| 50 | 2025_0337 | Trịnh Đức Kiên | 100 | F6 - Bách Khoa | 608 |
_... và 145 sinh viên khác_

#### Năm 3 — 97 người

| # | MSSV | Họ tên | Điểm | KTX | Phòng |
| --- | ---- | ------ | ---- | --- | ----- |
| 1 | 2024_0206 | Phan Quốc Tùng | 100 | G7 - Bách Khoa | 207 |
| 2 | 2024_0207 | Vũ Đức Đạt | 100 | G7 - Bách Khoa | 207 |
| 3 | 2024_0208 | Võ Minh Nhân | 100 | G7 - Bách Khoa | 207 |
| 4 | 2024_0209 | Đặng Gia Bảo | 100 | G7 - Bách Khoa | 207 |
| 5 | 2024_0210 | Bùi Hoàng Công | 100 | G7 - Bách Khoa | 207 |
| 6 | 2024_0211 | Đỗ Phước Hữu | 100 | G7 - Bách Khoa | 207 |
| 7 | 2024_0242 | Hồ Văn Quốc | 100 | G7 - Bách Khoa | 301 |
| 8 | 2024_0243 | Ngô Hữu Văn | 100 | G7 - Bách Khoa | 301 |
| 9 | 2024_0244 | Dương Trung Trọng | 100 | G7 - Bách Khoa | 301 |
| 10 | 2024_0258 | Cao Minh Dũng | 100 | G7 - Bách Khoa | 301 |
| 11 | 2024_0259 | Vương Gia Quân | 100 | G7 - Bách Khoa | 301 |
| 12 | 2024_0260 | Nguyễn Hoàng Bình | 100 | G7 - Bách Khoa | 301 |
| 13 | 2024_0261 | Trần Phước Tú | 100 | G7 - Bách Khoa | 301 |
| 14 | 2024_0262 | Lê Văn Mạnh | 100 | G7 - Bách Khoa | 301 |
| 15 | 2024_0263 | Phạm Hữu Trung | 100 | G7 - Bách Khoa | 302 |
| 16 | 2024_0264 | Hoàng Trung Khải | 100 | G7 - Bách Khoa | 302 |
| 17 | 2024_0265 | Huỳnh Công Vinh | 100 | G7 - Bách Khoa | 302 |
| 18 | 2024_0266 | Phan Quốc Tùng | 100 | G7 - Bách Khoa | 302 |
| 19 | 2024_0267 | Vũ Đức Đạt | 100 | G7 - Bách Khoa | 302 |
| 20 | 2024_0268 | Võ Minh Nhân | 100 | G7 - Bách Khoa | 302 |
| 21 | 2024_0269 | Đặng Gia Bảo | 100 | G7 - Bách Khoa | 302 |
| 22 | 2024_0270 | Bùi Hoàng Công | 100 | G7 - Bách Khoa | 302 |
| 23 | 2024_0271 | Đỗ Phước Hữu | 100 | G7 - Bách Khoa | 303 |
| 24 | 2024_0272 | Hồ Văn Quốc | 100 | G7 - Bách Khoa | 303 |
| 25 | 2024_0300 | Bùi Hoàng Công | 100 | G7 - Bách Khoa | 303 |
| 26 | 2024_0301 | Đỗ Phước Hữu | 100 | G7 - Bách Khoa | 303 |
| 27 | 2024_0302 | Hồ Văn Quốc | 100 | G7 - Bách Khoa | 303 |
| 28 | 2024_0303 | Ngô Hữu Văn | 100 | G7 - Bách Khoa | 303 |
| 29 | 2024_0304 | Dương Trung Trọng | 100 | G7 - Bách Khoa | 303 |
| 30 | 2024_0305 | Lý Công Anh | 100 | G7 - Bách Khoa | 303 |
| 31 | 2024_0306 | Đinh Quốc Tiến | 100 | G7 - Bách Khoa | 304 |
| 32 | 2024_0307 | Trịnh Đức Kiên | 100 | G7 - Bách Khoa | 304 |
| 33 | 2024_0308 | Đào Minh Minh | 100 | G7 - Bách Khoa | 304 |
| 34 | 2024_0309 | Mai Gia Tuấn | 100 | G7 - Bách Khoa | 304 |
| 35 | 2024_0310 | Trương Hoàng Đức | 100 | G7 - Bách Khoa | 304 |
| 36 | 2024_0311 | Tô Phước Hùng | 100 | G7 - Bách Khoa | 305 |
| 37 | 2024_0500 | Nguyễn Hoàng Diệp | 100 | G7 - Bách Khoa | 305 |
| 38 | 2024_0501 | Trần Diễm Hằng | 100 | G7 - Bách Khoa | 305 |
| 39 | 2024_0502 | Lê Thị Loan | 100 | G7 - Bách Khoa | 305 |
| 40 | 2024_0503 | Phạm Ngọc Trang | 100 | G7 - Bách Khoa | 305 |
| 41 | 2024_0506 | Phan Kim Yến | 100 | G7 - Bách Khoa | 306 |
| 42 | 2024_0507 | Vũ Lan Phương | 100 | G7 - Bách Khoa | 306 |
| 43 | 2024_0508 | Võ Thu Thanh | 100 | G7 - Bách Khoa | 306 |
| 44 | 2024_0509 | Đặng Mỹ Kim | 100 | G7 - Bách Khoa | 306 |
| 45 | 2024_0510 | Bùi Hoàng Bích | 100 | G7 - Bách Khoa | 307 |
| 46 | 2024_0511 | Đỗ Diễm Nhài | 100 | G7 - Bách Khoa | 307 |
| 47 | 2024_0542 | Hồ Thị Mỹ | 100 | G7 - Bách Khoa | 307 |
| 48 | 2024_0543 | Ngô Ngọc Hà | 100 | G7 - Bách Khoa | 307 |
| 49 | 2024_0544 | Dương Thanh Vân | 100 | G7 - Bách Khoa | 307 |
| 50 | 2024_0558 | Cao Thu Uyên | 100 | G7 - Bách Khoa | 307 |
_... và 47 sinh viên khác_

#### Năm 4+ — 32 người

| # | MSSV | Họ tên | Điểm | KTX | Phòng |
| --- | ---- | ------ | ---- | --- | ----- |
| 1 | 2023_0176 | Đinh Quốc Tiến | 100 | G7 - Bách Khoa | 407 |
| 2 | 2023_0177 | Trịnh Đức Kiên | 100 | G7 - Bách Khoa | 407 |
| 3 | 2023_0178 | Đào Minh Minh | 100 | G7 - Bách Khoa | 407 |
| 4 | 2023_0179 | Mai Gia Tuấn | 100 | G7 - Bách Khoa | 407 |
| 5 | 2023_0180 | Trương Hoàng Đức | 100 | G7 - Bách Khoa | 407 |
| 6 | 2023_0181 | Tô Phước Hùng | 100 | G7 - Bách Khoa | 501 |
| 7 | 2023_0212 | Lưu Văn Nam | 100 | G7 - Bách Khoa | 501 |
| 8 | 2023_0213 | Hà Hữu Khánh | 100 | G7 - Bách Khoa | 501 |
| 9 | 2023_0228 | Võ Minh Nhân | 100 | G7 - Bách Khoa | 501 |
| 10 | 2023_0229 | Đặng Gia Bảo | 100 | G7 - Bách Khoa | 501 |
| 11 | 2023_0230 | Bùi Hoàng Công | 100 | G7 - Bách Khoa | 501 |
| 12 | 2023_0231 | Đỗ Phước Hữu | 100 | G7 - Bách Khoa | 501 |
| 13 | 2023_0232 | Hồ Văn Quốc | 100 | G7 - Bách Khoa | 501 |
| 14 | 2023_0233 | Ngô Hữu Văn | 100 | G7 - Bách Khoa | 502 |
| 15 | 2023_0234 | Dương Trung Trọng | 100 | G7 - Bách Khoa | 502 |
| 16 | 2023_0235 | Lý Công Anh | 100 | G7 - Bách Khoa | 502 |
| 17 | 2023_0236 | Đinh Quốc Tiến | 100 | G7 - Bách Khoa | 502 |
| 18 | 2023_0237 | Trịnh Đức Kiên | 100 | G7 - Bách Khoa | 502 |
| 19 | 2023_0238 | Đào Minh Minh | 100 | G7 - Bách Khoa | 502 |
| 20 | 2023_0239 | Mai Gia Tuấn | 100 | G7 - Bách Khoa | 502 |
| 21 | 2023_0412 | Hồ Thị Mỹ | 100 | G7 - Bách Khoa | 502 |
| 22 | 2023_0413 | Ngô Ngọc Hà | 100 | G7 - Bách Khoa | 503 |
| 23 | 2023_0428 | Cao Thu Uyên | 100 | G7 - Bách Khoa | 503 |
| 24 | 2023_0429 | Vương Mỹ Chi | 100 | G7 - Bách Khoa | 503 |
| 25 | 2023_0430 | Nguyễn Hoàng Diệp | 100 | G7 - Bách Khoa | 503 |
| 26 | 2023_0431 | Trần Diễm Hằng | 100 | G7 - Bách Khoa | 503 |
| 27 | 2023_0432 | Lê Thị Loan | 100 | G7 - Bách Khoa | 503 |
| 28 | 2023_0433 | Phạm Ngọc Trang | 100 | G7 - Bách Khoa | 503 |
| 29 | 2023_0434 | Hoàng Thanh Nhi | 100 | G7 - Bách Khoa | 503 |
| 30 | 2023_0435 | Huỳnh Bích Xuân | 100 | G7 - Bách Khoa | 504 |
| 31 | 2023_0436 | Phan Kim Yến | 100 | G7 - Bách Khoa | 504 |
| 32 | 2023_0437 | Vũ Lan Phương | 100 | G7 - Bách Khoa | 504 |

#### Năm 1 Synthetic (2026xxx) — 20 mẫu (sẽ bị bỏ qua khi Apply)

| # | MSSV | Họ tên | Điểm | KTX | Phòng |
| --- | ---- | ------ | ---- | --- | ----- |
| 1 | 2026_0001 | Đinh Diễm Hương | 100 | A1 - Bách Khoa | 101 |
| 2 | 2026_0002 | Bùi Tuấn Phúc | 100 | A1 - Bách Khoa | 101 |
| 3 | 2026_0003 | Trịnh Hoàng Thảo | 100 | A1 - Bách Khoa | 101 |
| 4 | 2026_0004 | Tạ Tuyết Hương | 100 | A1 - Bách Khoa | 101 |
| 5 | 2026_0005 | Vũ Đình Tiến | 100 | A1 - Bách Khoa | 101 |
| 6 | 2026_0006 | Bùi Thái Trí | 100 | A1 - Bách Khoa | 101 |
| 7 | 2026_0007 | Huỳnh Công Tùng | 100 | A1 - Bách Khoa | 101 |
| 8 | 2026_0008 | Trương Diễm Xuân | 100 | A1 - Bách Khoa | 101 |
| 9 | 2026_0009 | Phạm Kim Trinh | 100 | A1 - Bách Khoa | 102 |
| 10 | 2026_0010 | Đinh Thanh Thảo | 100 | A1 - Bách Khoa | 102 |
| 11 | 2026_0011 | Huỳnh Minh Nam | 100 | A1 - Bách Khoa | 102 |
| 12 | 2026_0012 | Nguyễn Khánh Xuân | 100 | A1 - Bách Khoa | 102 |
| 13 | 2026_0013 | Lê Trung Xuân | 100 | A1 - Bách Khoa | 102 |
| 14 | 2026_0014 | Đỗ Xuân Dũng | 100 | A1 - Bách Khoa | 102 |
| 15 | 2026_0015 | Phạm Đức Sơn | 100 | A1 - Bách Khoa | 102 |
| 16 | 2026_0016 | Tạ Thị Quyên | 100 | A1 - Bách Khoa | 102 |
| 17 | 2026_0017 | Đinh Thanh My | 100 | A1 - Bách Khoa | 103 |
| 18 | 2026_0018 | Lý Đức Hải | 100 | A1 - Bách Khoa | 103 |
| 19 | 2026_0019 | Nguyễn Ngọc Hiền | 100 | A1 - Bách Khoa | 103 |
| 20 | 2026_0020 | Cao Duy Thắng | 100 | A1 - Bách Khoa | 103 |
_... và 306 sinh viên Năm 1 synthetic khác_

---

## 6. Danh sách KHÔNG ĐƯỢC NHẬN (Waitlist / Bị loại)

> Tổng: **353** sinh viên không được phân phòng, sắp xếp theo điểm ưu tiên **tăng dần** (điểm thấp nhất lên đầu).

### 6.1 Năm 1 — 17 người bị loại (quota: 326)

> Điểm thấp nhất: **35** | Điểm cao nhất: **50**

| # | MSSV | Họ tên | Điểm ưu tiên | Lý do |
| --- | ---- | ------ | ------------ | ----- |
| 1 | 2026_0310 | Mạc Xuân Việt | 35 | Vượt quota Năm 1 (326 suất) |
| 2 | 2026_0316 | Hoàng Ngọc Khánh | 35 | Vượt quota Năm 1 (326 suất) |
| 3 | 2026_0318 | Bùi Phương Hiền | 35 | Vượt quota Năm 1 (326 suất) |
| 4 | 2026_0335 | Lê Ngọc Sơn | 35 | Vượt quota Năm 1 (326 suất) |
| 5 | 2026_0343 | Trương Quang Long | 35 | Vượt quota Năm 1 (326 suất) |
| 6 | 2026_0308 | Lý Hồng Tiến | 45 | Vượt quota Năm 1 (326 suất) |
| 7 | 2026_0320 | Mạc Bảo Lam | 45 | Vượt quota Năm 1 (326 suất) |
| 8 | 2026_0321 | Huỳnh Văn Hiếu | 45 | Vượt quota Năm 1 (326 suất) |
| 9 | 2026_0329 | Kiều Ngọc Thảo | 45 | Vượt quota Năm 1 (326 suất) |
| 10 | 2026_0341 | Bùi Ngọc Khánh | 45 | Vượt quota Năm 1 (326 suất) |
| 11 | 2026_0314 | Ngô Thùy Thư | 50 | Vượt quota Năm 1 (326 suất) |
| 12 | 2026_0317 | Nguyễn Tuyết Lan | 50 | Vượt quota Năm 1 (326 suất) |
| 13 | 2026_0322 | Trịnh Khánh Lan | 50 | Vượt quota Năm 1 (326 suất) |
| 14 | 2026_0327 | Trần Khánh Phương | 50 | Vượt quota Năm 1 (326 suất) |
| 15 | 2026_0328 | Trương Minh Thành | 50 | Vượt quota Năm 1 (326 suất) |
| 16 | 2026_0331 | Mai Hoàng Hiền | 50 | Vượt quota Năm 1 (326 suất) |
| 17 | 2026_0338 | Cao Diễm Giang | 50 | Vượt quota Năm 1 (326 suất) |

### 6.2 Năm 4+ — 148 người bị loại (quota: 32)

> Điểm thấp nhất: **40** | Điểm cao nhất: **100**

| # | MSSV | Họ tên | Điểm ưu tiên | Lý do |
| --- | ---- | ------ | ------------ | ----- |
| 1 | 2023_0194 | Hoàng Trung Khải | 40 | Vượt quota Năm 4+ (32 suất) |
| 2 | 2023_0398 | Cao Thu Uyên | 40 | Vượt quota Năm 4+ (32 suất) |
| 3 | 2023_0254 | Hoàng Trung Khải | 44 | Vượt quota Năm 4+ (32 suất) |
| 4 | 2023_0255 | Huỳnh Công Vinh | 44 | Vượt quota Năm 4+ (32 suất) |
| 5 | 2023_0458 | Cao Thu Uyên | 44 | Vượt quota Năm 4+ (32 suất) |
| 6 | 2023_0459 | Vương Mỹ Chi | 44 | Vượt quota Năm 4+ (32 suất) |
| 7 | 2023_0182 | Lưu Văn Nam | 45 | Vượt quota Năm 4+ (32 suất) |
| 8 | 2023_0224 | Hoàng Trung Khải | 45 | Vượt quota Năm 4+ (32 suất) |
| 9 | 2023_0225 | Huỳnh Công Vinh | 45 | Vượt quota Năm 4+ (32 suất) |
| 10 | 2023_0226 | Phan Quốc Tùng | 45 | Vượt quota Năm 4+ (32 suất) |
| 11 | 2023_0424 | Tạ Thanh Tuyết | 45 | Vượt quota Năm 4+ (32 suất) |
| 12 | 2023_0425 | Thái Bích Ngọc | 45 | Vượt quota Năm 4+ (32 suất) |
| 13 | 2023_0426 | Mạc Kim Thảo | 45 | Vượt quota Năm 4+ (32 suất) |
| 14 | 2023_0206 | Đinh Quốc Tiến | 55 | Vượt quota Năm 4+ (32 suất) |
| 15 | 2023_0216 | Mạc Quốc Long | 55 | Vượt quota Năm 4+ (32 suất) |
| 16 | 2023_0219 | Vương Gia Quân | 55 | Vượt quota Năm 4+ (32 suất) |
| 17 | 2023_0220 | Nguyễn Hoàng Bình | 55 | Vượt quota Năm 4+ (32 suất) |
| 18 | 2023_0221 | Trần Phước Tú | 55 | Vượt quota Năm 4+ (32 suất) |
| 19 | 2023_0416 | Đinh Kim Thúy | 55 | Vượt quota Năm 4+ (32 suất) |
| 20 | 2023_0419 | Mai Mỹ Hoa | 55 | Vượt quota Năm 4+ (32 suất) |
| 21 | 2023_0420 | Trương Hoàng Mai | 55 | Vượt quota Năm 4+ (32 suất) |
| 22 | 2023_0421 | Tô Diễm Linh | 55 | Vượt quota Năm 4+ (32 suất) |
| 23 | 2023_0161 | Trần Phước Tú | 56 | Vượt quota Năm 4+ (32 suất) |
| 24 | 2023_0162 | Lê Văn Mạnh | 56 | Vượt quota Năm 4+ (32 suất) |
| 25 | 2023_0163 | Phạm Hữu Trung | 56 | Vượt quota Năm 4+ (32 suất) |
| 26 | 2023_0164 | Hoàng Trung Khải | 56 | Vượt quota Năm 4+ (32 suất) |
| 27 | 2023_0165 | Huỳnh Công Vinh | 56 | Vượt quota Năm 4+ (32 suất) |
| 28 | 2023_0166 | Phan Quốc Tùng | 56 | Vượt quota Năm 4+ (32 suất) |
| 29 | 2023_0167 | Vũ Đức Đạt | 56 | Vượt quota Năm 4+ (32 suất) |
| 30 | 2023_0168 | Võ Minh Nhân | 56 | Vượt quota Năm 4+ (32 suất) |
_... và 118 sinh viên khác_

### 6.3 Năm 3 — 103 người bị loại (quota: 97)

> Điểm thấp nhất: **54** | Điểm cao nhất: **81**

| # | MSSV | Họ tên | Điểm ưu tiên | Lý do |
| --- | ---- | ------ | ------------ | ----- |
| 1 | 2024_0492 | Lưu Thị Hương | 54 | Vượt quota Năm 3 (97 suất) |
| 2 | 2024_0493 | Hà Ngọc Thu | 54 | Vượt quota Năm 3 (97 suất) |
| 3 | 2024_0216 | Đinh Quốc Tiến | 55 | Vượt quota Năm 3 (97 suất) |
| 4 | 2024_0228 | Cao Minh Dũng | 55 | Vượt quota Năm 3 (97 suất) |
| 5 | 2024_0254 | Tạ Trung Phúc | 55 | Vượt quota Năm 3 (97 suất) |
| 6 | 2024_0255 | Thái Công Thành | 55 | Vượt quota Năm 3 (97 suất) |
| 7 | 2024_0256 | Mạc Quốc Long | 55 | Vượt quota Năm 3 (97 suất) |
| 8 | 2024_0312 | Lưu Văn Nam | 55 | Vượt quota Năm 3 (97 suất) |
| 9 | 2024_0516 | Đinh Kim Thúy | 55 | Vượt quota Năm 3 (97 suất) |
| 10 | 2024_0528 | Cao Thu Uyên | 55 | Vượt quota Năm 3 (97 suất) |
| 11 | 2024_0554 | Tạ Thanh Tuyết | 55 | Vượt quota Năm 3 (97 suất) |
| 12 | 2024_0555 | Thái Bích Ngọc | 55 | Vượt quota Năm 3 (97 suất) |
| 13 | 2024_0556 | Mạc Kim Thảo | 55 | Vượt quota Năm 3 (97 suất) |
| 14 | 2024_0246 | Đinh Quốc Tiến | 65 | Vượt quota Năm 3 (97 suất) |
| 15 | 2024_0249 | Mai Gia Tuấn | 65 | Vượt quota Năm 3 (97 suất) |
| 16 | 2024_0250 | Trương Hoàng Đức | 65 | Vượt quota Năm 3 (97 suất) |
| 17 | 2024_0251 | Tô Phước Hùng | 65 | Vượt quota Năm 3 (97 suất) |
| 18 | 2024_0546 | Đinh Kim Thúy | 65 | Vượt quota Năm 3 (97 suất) |
| 19 | 2024_0549 | Mai Mỹ Hoa | 65 | Vượt quota Năm 3 (97 suất) |
| 20 | 2024_0550 | Trương Hoàng Mai | 65 | Vượt quota Năm 3 (97 suất) |
| 21 | 2024_0551 | Tô Diễm Linh | 65 | Vượt quota Năm 3 (97 suất) |
| 22 | 2024_0291 | Trần Phước Tú | 66 | Vượt quota Năm 3 (97 suất) |
| 23 | 2024_0292 | Lê Văn Mạnh | 66 | Vượt quota Năm 3 (97 suất) |
| 24 | 2024_0293 | Phạm Hữu Trung | 66 | Vượt quota Năm 3 (97 suất) |
| 25 | 2024_0294 | Hoàng Trung Khải | 66 | Vượt quota Năm 3 (97 suất) |
| 26 | 2024_0295 | Huỳnh Công Vinh | 66 | Vượt quota Năm 3 (97 suất) |
| 27 | 2024_0296 | Phan Quốc Tùng | 66 | Vượt quota Năm 3 (97 suất) |
| 28 | 2024_0297 | Vũ Đức Đạt | 66 | Vượt quota Năm 3 (97 suất) |
| 29 | 2024_0298 | Võ Minh Nhân | 66 | Vượt quota Năm 3 (97 suất) |
| 30 | 2024_0299 | Đặng Gia Bảo | 66 | Vượt quota Năm 3 (97 suất) |
_... và 73 sinh viên khác_

### 6.4 Năm 2 — 85 người bị loại (quota: 195)

> Điểm thấp nhất: **65** | Điểm cao nhất: **89**

| # | MSSV | Họ tên | Điểm ưu tiên | Lý do |
| --- | ---- | ------ | ------------ | ----- |
| 1 | 2025_0246 | Đinh Quốc Tiến | 65 | Vượt quota Năm 2 (195 suất) |
| 2 | 2025_0258 | Cao Minh Dũng | 65 | Vượt quota Năm 2 (195 suất) |
| 3 | 2025_0284 | Tạ Trung Phúc | 65 | Vượt quota Năm 2 (195 suất) |
| 4 | 2025_0285 | Thái Công Thành | 65 | Vượt quota Năm 2 (195 suất) |
| 5 | 2025_0286 | Mạc Quốc Long | 65 | Vượt quota Năm 2 (195 suất) |
| 6 | 2025_0342 | Lưu Văn Nam | 65 | Vượt quota Năm 2 (195 suất) |
| 7 | 2025_0354 | Hoàng Trung Khải | 65 | Vượt quota Năm 2 (195 suất) |
| 8 | 2025_0584 | Tạ Thanh Tuyết | 65 | Vượt quota Năm 2 (195 suất) |
| 9 | 2025_0585 | Thái Bích Ngọc | 65 | Vượt quota Năm 2 (195 suất) |
| 10 | 2025_0586 | Mạc Kim Thảo | 65 | Vượt quota Năm 2 (195 suất) |
| 11 | 2025_0642 | Lưu Thị Hương | 65 | Vượt quota Năm 2 (195 suất) |
| 12 | 2025_0654 | Hoàng Thanh Nhi | 65 | Vượt quota Năm 2 (195 suất) |
| 13 | 2025_0684 | Hoàng Thanh Nhi | 65 | Vượt quota Năm 2 (195 suất) |
| 14 | 2025_0685 | Huỳnh Bích Xuân | 65 | Vượt quota Năm 2 (195 suất) |
| 15 | 2025_0686 | Phan Kim Yến | 65 | Vượt quota Năm 2 (195 suất) |
| 16 | 2025_0276 | Đinh Quốc Tiến | 75 | Vượt quota Năm 2 (195 suất) |
| 17 | 2025_0279 | Mai Gia Tuấn | 75 | Vượt quota Năm 2 (195 suất) |
| 18 | 2025_0280 | Trương Hoàng Đức | 75 | Vượt quota Năm 2 (195 suất) |
| 19 | 2025_0281 | Tô Phước Hùng | 75 | Vượt quota Năm 2 (195 suất) |
| 20 | 2025_0376 | Mạc Quốc Long | 75 | Vượt quota Năm 2 (195 suất) |
| 21 | 2025_0379 | Vương Gia Quân | 75 | Vượt quota Năm 2 (195 suất) |
| 22 | 2025_0380 | Nguyễn Hoàng Bình | 75 | Vượt quota Năm 2 (195 suất) |
| 23 | 2025_0576 | Đinh Kim Thúy | 75 | Vượt quota Năm 2 (195 suất) |
| 24 | 2025_0579 | Mai Mỹ Hoa | 75 | Vượt quota Năm 2 (195 suất) |
| 25 | 2025_0580 | Trương Hoàng Mai | 75 | Vượt quota Năm 2 (195 suất) |
| 26 | 2025_0581 | Tô Diễm Linh | 75 | Vượt quota Năm 2 (195 suất) |
| 27 | 2025_0676 | Mạc Kim Thảo | 75 | Vượt quota Năm 2 (195 suất) |
| 28 | 2025_0679 | Vương Mỹ Chi | 75 | Vượt quota Năm 2 (195 suất) |
| 29 | 2025_0680 | Nguyễn Hoàng Diệp | 75 | Vượt quota Năm 2 (195 suất) |
| 30 | 2025_0681 | Trần Diễm Hằng | 75 | Vượt quota Năm 2 (195 suất) |
_... và 55 sinh viên khác_

---

## 7. Apply → Undo (Vòng đời Snapshot)

### 7.1 Apply

| Chỉ số | Giá trị |
| ------ | ------- |
| Snapshot ID | SNAP-1781377080855-O1R8Y |
| Status | APPLIED |
| Sinh viên thực được apply | 324 |
| Synthetic Năm 1 bỏ qua | 326 |
| Thời điểm apply | 01:58:00 14/6/2026 |

### 7.2 Undo

| Chỉ số | Giá trị |
| ------ | ------- |
| Snapshot sau Undo | UNDONE |
| Thời điểm Undo | 01:58:18 14/6/2026 |
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

**19/19 assertions passed** — ✅ ALL PASSED

---

## 9. E2E Test Summary

| Bước | Mô tả | Kết quả |
| ---- | ----- | ------- |
| 1 | Init workspace (admintest) | ✅ 1911 students, 7 dorms |
| 2 | Cohort shift 2026-2027 | ✅ 180 × 2022xxx marked mustLeave |
| 3 | Seed Year-1 (2026) | ✅ 343 students (quota + 5-9 extra) |
| 4 | Run allocation preview | ✅ 650 allocated / 353 waitlisted |
| 5 | Assert quota bands | ✅ year1=326 year2=195 year3=97 year4+=32 |
| 6 | Assert score distribution | ✅ min reject score = 35 |
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
| `src/services/simulationEngineService.js` | `computeQuotaBands()` dynamic, `seedYear1Students` dùng quota+5~9, `runAllocationPreview` gọi computeQuotaBands |
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