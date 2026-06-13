# PHASE 3 — WORK LOG

**Ngày thực hiện:** 2026-06-05  
**Mục tiêu:** Enterprise admin panel redesign — remove all branding, sidebar rebuild, UI polish.

---

## 1. Branding Removal

### Admin views updated
| File | Thay đổi |
|---|---|
| `views/admin/navbar.ejs` | REWRITE hoàn toàn — xóa logo, tên hệ thống, HUST, EDORM |
| `views/admin/application/app-detail.ejs` | Title: "KTX HUST" → "Admin" |
| `views/admin/cohort-shift/index.ejs` | Title: "KTX HUST Admin" → "Admin" |
| `views/admin/dormitory/admin-dormitories.ejs` | Title: "KTX HUST Admin" → "Admin" |
| `views/admin/dormitory/admin-dormitory-view.ejs` | Title: "KTX HUST Admin" → "Admin" |
| `views/admin/master-dashboard.ejs` | Title: "KTX HUST Admin" → "Admin" |
| `views/admin/dashboard.ejs` | Title: "Admin KTX" → "Admin" |

**Kết quả:** Playwright xác nhận tất cả 10 trang admin — sidebar clean, không có branding strings.

---

## 2. Sidebar Redesign (`views/admin/navbar.ejs`)

### Kiến trúc mới
- **Không có logo, không có tên hệ thống, không có HUST/EDORM**
- Fixed sidebar `220px` với toggle thu gọn → `56px`
- Fixed topbar `56px` cao — hiển thị tên trang (trái) + search + bell (phải)
- `body { padding-left: 220px; padding-top: 56px }` — không cần wrapper div

### Nhóm menu sidebar
| Nhóm | Mục |
|---|---|
| Tổng quan | Dashboard, Analytics |
| Quản lý KTX | Ký túc xá, Sinh viên |
| Vận hành | Hồ sơ, Bảo trì, Vi phạm, Phân bổ |
| Hệ thống | Quota, Học vụ, Nhật ký |

### Tính năng
- Active state: viền đỏ `#C8102E` bên trái + nền `#FFF0F2`
- Tooltip khi thu gọn: `content:attr(data-tip)` 
- localStorage persistence: `sbCollapsed`
- User menu dropdown tại footer sidebar (avatar + tên + logout)
- Notification badge fetch từ `/admin/applications/stats`

---

## 3. Student Directory (`views/admin/student/admin-student-list.ejs`)

- Tìm kiếm realtime: tên, MSSV, email
- Bộ lọc: Khoa, Giới tính, KTX
- Pagination client-side (50 SV/trang)
- Tags màu: khoa (đỏ), nam (xanh dương), nữ (hồng)
- Màu điểm ưu tiên: xanh lá (≥70), vàng (≥40), xám (<40)
- Link đến hồ sơ sinh viên

### Route fix
- `GET /admin/students`: bỏ `.limit(200)` → trả về toàn bộ 1308 SV

---

## 4. Bug Fixes

### Logs page overflow
- `.filter-controls`: `grid` → `flex-wrap` — khắc phục horizontal overflow khi sidebar chiếm `220px`

---

## 5. Scripts & Tools

| Script | Mục đích |
|---|---|
| `scripts/qa-phase3.js` | Playwright QA: login + capture 11 screenshots + kiểm tra branding |
| `npm run screenshots` | Chạy qa-phase3.js |
| `npm run screenshots:thesis` | Alias cho screenshots |

Screenshots lưu tại: `evidence/phase3-screenshots/`

---

## 6. Playwright Validation Results

```
✓ Logged in
✓ 01-dashboard: sidebar clean       📸 01-dashboard.png
✓ 02-dormitories: sidebar clean     📸 02-dormitories.png
✓ 03-students: sidebar clean        📸 03-students.png
✓ 04-applications: sidebar clean    📸 04-applications.png
✓ 05-violations: sidebar clean      📸 05-violations.png
✓ 06-maintenance: sidebar clean     📸 06-maintenance.png
✓ 07-allocation: sidebar clean      📸 07-allocation.png
✓ 08-master-dashboard: sidebar clean 📸 08-master-dashboard.png
✓ 09-logs: sidebar clean            📸 09-logs.png (overflow fixed)
✓ 10-quotas: sidebar clean          📸 10-quotas.png
                                    📸 11-student-profile.png
```

**Xác nhận:** Admin panel không còn logo hoặc tên hệ thống ở navbar/sidebar.

---

## 7. Màu sắc

Toàn bộ admin panel tuân thủ palette:
- `#C8102E` — primary (HUST red)
- `#A20D25` — dark red
- `#111827` — text chính
- `#6B7280` — muted
- `#F7F7F7` — background
- `#FFFFFF` — surface
- Không có: teal, blue gradient, purple
