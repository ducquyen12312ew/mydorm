# PHASE 2 WORK LOG
**Bắt đầu:** 2026-06-05, ~09:00 (phiên làm việc thứ 2)
**Kết thúc:** 2026-06-05, ~11:30
**Engineer:** Claude Sonnet 4.6 (AI)

---

## TÓM TẮT PHASE 1 (phiên trước)

Phiên trước đã hoàn thành:
- Đọc toàn bộ codebase (schemas, routes, views, seed scripts)
- Tạo `scripts/seed-production.js` — Single Source of Truth
- 7 KTX (A1, B2, C3, D4, E5, F6, G7), 265 phòng, 1742 chỗ
- 1308 sinh viên Việt Nam tên thật, MSSV kiểu HUST
- Two-way sync: room.occupants ↔ student.dormitoryId/roomNumber — 0 mismatch
- Cloudinary integration: `src/middleware/upload.js`, upload endpoint `/api/upload/dormitory-image`
- Admin UI redesign: Enterprise/Stripe style, màu #C8102E
- admin-dormitories.ejs, admin-dormitory-view.ejs, admin.css, master-dashboard.ejs
- Commit: b259ed8 → 712ea2c

---

## PHASE 2 — CÔNG VIỆC ĐÃ LÀM

### BƯỚC 1: DATABASE AUDIT ✅
**Thực hiện:** Query trực tiếp MongoDB, không dùng số hardcode

Kết quả verified:
| Metric | Giá trị | Trạng thái |
|--------|---------|------------|
| Tổng KTX | 7 | ✅ Đúng |
| Tổng phòng | 265 | ✅ Đúng |
| Tổng chỗ (maxCapacity) | 1,742 | ✅ Đúng |
| Sinh viên (role=user) | 1,308 | ✅ Đúng |
| Occupancy rate | 75.09% | ✅ Đúng |

KTX breakdown:
- KTX A1: 3 tầng, 9 phòng, 58 chỗ, 45 sv (77.6%)
- KTX B2: 2 tầng, 5 phòng, 28 chỗ, 21 sv (75.0%)
- KTX C3: 5 tầng, 40 phòng, 260 chỗ, 195 sv (75.0%)
- KTX D4: 6 tầng, 48 phòng, 312 chỗ, 234 sv (75.0%)
- KTX E5: 8 tầng, 72 phòng, 480 chỗ, 360 sv (75.0%)
- KTX F6: 7 tầng, 56 phòng, 364 chỗ, 273 sv (75.0%)
- KTX G7: 5 tầng, 35 phòng, 240 chỗ, 180 sv (75.0%)

**Phát hiện:** Collection là `students` (không phải `users`), field là `maxCapacity` (không phải `capacity`)

---

### BƯỚC 2: ROOM ↔ STUDENT CONSISTENCY ✅
**Thực hiện:** Duyệt toàn bộ 7 KTX × tầng × phòng × occupant, cross-check với students collection

Kết quả:
- Orphan occupants (in room, no student): **0**
- Wrong roomNumber: **0**
- Wrong dormitoryId: **0**
- Orphan students (has dormId but not in room): **0**
- **Total mismatches: 0 — PERFECT CONSISTENCY**

---

### BƯỚC 3: TRANG CHI TIẾT KTX ✅
**Kiểm tra:** `views/admin/dormitory/admin-dormitory-view.ejs`

Template dùng `<%= o.name %>`, `<%= o.studentId %>` từ `room.occupants` array trong DB.
- Không có "Sinh viên 01", "Student 01" nào
- Tất cả tên lấy từ DB thật
- Link `/admin/students/<%= o.userId %>` đã có sẵn cho mỗi occupant

---

### BƯỚC 4: RESIDENT PROFILE ✅
**Tạo mới:**

1. **Route** `GET /admin/students/:id` trong `src/routes/admin/admin-page-routes.js`:
   - Query StudentCollection.findById()
   - Find dormitory + room info từ DormitoryCollection
   - Render template với student, dormitory, roomInfo

2. **View** `views/admin/student/admin-student-profile.ejs` (mới tạo):
   - Avatar với initials
   - Tags: khoa/viện, giới tính, trạng thái KTX, khóa học
   - Card thông tin cá nhân: họ tên, MSSV, giới tính, khóa, khoa
   - Card liên hệ: email, SĐT, username, quốc tịch, điểm ưu tiên
   - Card phòng ở: KTX, tầng, phòng, loại phòng, sức chứa, giá/tháng
   - Link back đến trang KTX chi tiết

3. **Route bổ sung** `GET /admin/students` — list trang sinh viên

---

### BƯỚC 5: NAVBAR REDESIGN ✅
**File sửa:** `views/admin/navbar.ejs`

Thay đổi:
- **Trước:** `KTX<span>HUST</span>` (1 dòng, 15px)
- **Sau:** 2 dòng stacked:
  - Line 1: "**Ký túc xá**" — font-weight: 800, 13px, #C8102E, uppercase, letter-spacing: 0.06em
  - Line 2: "**Đại học Bách Khoa Hà Nội**" — 10px, #6B7280, uppercase, letter-spacing: 0.04em

---

### BƯỚC 6: COLOR CLEANUP ✅
**Files sửa:** `views/admin/master-dashboard.ejs`, `public/css/admin.css`, `views/admin/dashboard.ejs`

**master-dashboard.ejs:**
| Class | Trước | Sau |
|-------|-------|-----|
| `.heat-zero` | `#f5f9fc` | `#F7F7F7` |
| `.heat-low` | `#d8f4ef` (teal) | `#F0FDF4` (green) |
| `.heat-medium` | `#b9ece2` (teal) | `#DCFCE7` |
| `.item:hover` | `#f4fffd` (teal) | `#FFF0F2` (red-light) |
| `.bed.occupied` | `#9ec5fe / #f1f7ff` (blue) | `#D1D5DB / #F9FAFB` (neutral) |
| `.block` gradient | `#dce7f3` (blue) | `#F3F4F6` (neutral) |
| `.three-d-zone` bg | `#fcfefe` | `#FAFAFA` |
| `.empty` bg | `#fafcfd` | `#FAFAFA` |

**admin.css:**
| Selector | Trước | Sau |
|----------|-------|-----|
| `.stat-card.blue` border | `#3b82f6` (blue) | `#C8102E` (HUST red) |
| `.stat-card.blue` icon | `#eff6ff / #3b82f6` | `#FFF0F2 / #C8102E` |
| `.stat-card.purple` border | `#8b5cf6` (purple) | `#C8102E` |
| `.btn-info` bg | `#0ea5e9` (blue) | `#6B7280` (gray) |
| `.status-waitlist` | blue | amber |

**dashboard.ejs chart:**
| Năm | Trước | Sau |
|-----|-------|-----|
| Năm 1 | `#FF6B6B` | `#C8102E` |
| Năm 5 | `#9C27B0` (purple) | `#6B7280` |
| Sau đại học | `#2196F3` (blue) | `#A20D25` |

**Bản dịch tiếng Việt:**
- Table headers: Name/Code/Cohort/Building/Floor/Room/Bed → Họ tên/MSSV/Khóa/KTX/Tầng/Phòng/Giường
- Search placeholder → Tiếng Việt
- Detail title: "Building Overview" → "Tổng quan hệ thống"
- Button: "Dormitories" → "Ký túc xá"
- 3D toggle → Tiếng Việt

---

### BƯỚC 7: FACULTY NAMES ✅
**Script:** `scripts/migrate-faculty-and-data.js`
**Thực thi:** `node scripts/migrate-faculty-and-data.js`

Đổi tên 915 record:
| Tên cũ | Tên mới | Số SV |
|--------|---------|-------|
| Điện - Điện tử | Điện tử Viễn thông | 131 |
| Hóa học | Kỹ thuật Máy tính | 131 |
| Vật lý kỹ thuật | Cơ điện tử | 131 |
| Toán - Tin học ứng dụng | Toán Tin | 131 |
| Cơ kỹ thuật | Cơ điện tử | 131 |
| Kỹ thuật Hàng không | Kỹ thuật Máy tính | 130 |
| Kinh tế & Quản lý | Kinh tế | 130 |

Phân bổ mới:
- Công nghệ Thông tin: 132 sv
- Điện tử Viễn thông: 131 sv
- Cơ khí: 131 sv
- Kỹ thuật Máy tính: 261 sv
- Cơ điện tử: 262 sv
- Toán Tin: 131 sv
- Kinh tế: 130 sv
- Khoa học Máy tính: 130 sv

**Cũng update `scripts/seed-production.js`** với KHOA list mới cho future re-runs.

---

### BƯỚC 8: DỮ LIỆU NGHIỆP VỤ ✅
**Script:** `scripts/migrate-faculty-and-data.js` (cùng file)

| Collection | Trước | Thêm | Sau |
|-----------|-------|------|-----|
| `maintenance_requests` | 3 | +50 | 53 |
| `notifications` | 5 | +8 | 13 |
| `allocationregistrations` | 0 | +40 | 40 |

**Maintenance requests** (50 mới): Các loại điện, nước, cửa, internet, vệ sinh, cơ sở vật chất; 4 mức độ ưu tiên; 5 trạng thái từ submitted → completed.

**Notifications** (8 mới): Thông báo đóng tiền, lịch vệ sinh, kiểm tra PCCC, mở đăng ký KTX, cắt điện bảo trì, quy định giờ giấc, bảo trì thang máy, chúc mừng sinh viên xuất sắc.

**Allocation registrations** (40 mới): Đơn đăng ký mới từ sinh viên đã phân phòng (simulate chu kỳ mới), các trạng thái pending/approved/rejected.

**Sự cố phát hiện & sửa:** Migration ban đầu insert vào `maintenancerequests` (không có underscore), nhưng app dùng `maintenance_requests` (có underscore). Đã migrate 50 records sang đúng collection.

---

### BƯỚC 9: PLAYWRIGHT QA ✅
**Script:** `scripts/qa-playwright.js` (mới tạo)

Kết quả:
- **0 JavaScript errors** trên tất cả trang
- **0 horizontal overflow** (layout không vỡ)
- Tổng 11 screenshots lưu tại `evidence/screenshots-phase2/`

| Trang | URL | Trạng thái |
|-------|-----|------------|
| Login | /login | ✅ |
| Admin Dashboard | /admin/dashboard | ✅ |
| Master Dashboard | /admin/master-dashboard | ✅ |
| Dormitories List | /admin/dormitories | ✅ |
| Dormitory Detail | /admin/dormitories/view/:id | ✅ |
| Student Profile | /admin/students/:id | ✅ |
| Violations | /admin/violations | ✅ |
| Maintenance | /admin/maintenance-requests | ✅ |

---

## FILES ĐÃ THAY ĐỔI

### Files sửa (8):
1. `views/admin/navbar.ejs` — Navbar brand redesign (2-line HUST branding)
2. `views/admin/master-dashboard.ejs` — Teal/blue/gradient color cleanup + Vietnamese text
3. `views/admin/dashboard.ejs` — Chart colors (remove blue/purple)
4. `public/css/admin.css` — Stat card colors (remove blue/purple)
5. `src/routes/admin/admin-page-routes.js` — Add /admin/students, /admin/students/:id routes
6. `scripts/seed-production.js` — Update KHOA list
7. `package.json` — Add `migrate:faculty` script

### Files mới tạo (4):
1. `views/admin/student/admin-student-profile.ejs` — Resident profile page
2. `scripts/migrate-faculty-and-data.js` — Faculty migration + data expansion script
3. `scripts/qa-playwright.js` — Playwright QA script
4. `PHASE2_WORK_LOG.md` — This file

### Database changes:
- 915 student records: faculty names updated to HUST standards
- 50 new maintenance requests (maintenance_requests collection)
- 8 new system notifications
- 40 new allocation registrations
- Admin password reset to: Admin@1234

---

## TRẠNG THÁI CUỐI CÙNG

| Hạng mục | Giá trị |
|----------|---------|
| KTX | 7 |
| Phòng | 265 |
| Sức chứa | 1,742 |
| Sinh viên đang ở | 1,308 |
| Occupancy | 75.09% |
| Yêu cầu bảo trì | 53 |
| Thông báo | 13 |
| Đơn đăng ký | 40 |
| Consistency errors | **0** |
| JS errors (UI) | **0** |
| Fake names | **0** |
| Teal/blue colors | **0** |
| Purple colors | **0** |

## LOGIN ACCOUNTS

| Tài khoản | Mật khẩu | Vai trò |
|-----------|---------|---------|
| admin | Admin@1234 | Admin |
| sinhvien_demo | Demo@1234 | Student (KTX A1, Phòng 202) |
