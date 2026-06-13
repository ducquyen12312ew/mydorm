# Danh sách hình ảnh cần chụp cho báo cáo — Phần 4.2 Thiết kế giao diện

Mỗi hình cần chụp ở độ phân giải 1280×800 trở lên, xuất PNG, lưu vào
`fix_report/Hinhve/` với tên file tương ứng.

---

## Hình 4.5 — Giao diện đăng nhập hệ thống
- **Tên file:** `ui_login.png`
- **Nguồn màn hình:** `views/auth/login.ejs` — truy cập route `GET /login`
- **Dùng cho mục:** 4.2.1 Thiết kế giao diện → Màn hình đăng nhập
- **Hướng dẫn chụp:** Chụp toàn trang khi chưa nhập liệu để thấy rõ layout 2 cột (brand panel + auth panel)

---

## Hình 4.6 — Trang chủ sinh viên
- **Tên file:** `ui_student_home.png`
- **Nguồn màn hình:** `views/student/home.ejs` — truy cập route `GET /student/home`
- **Dùng cho mục:** 4.2.1 Thiết kế giao diện → Trang chủ sinh viên
- **Hướng dẫn chụp:** Chụp phần hero section và đầu phần gallery, đủ thấy nút "Xem phòng 3D" và slider danh mục

---

## Hình 4.7 — Màn hình đăng ký ký túc xá
- **Tên file:** `ui_apply.png`
- **Nguồn màn hình:** `views/student/enhanced-application-form.ejs` — truy cập route `GET /student/apply`
- **Dùng cho mục:** 4.2.1 Thiết kế giao diện → Màn hình đăng ký ký túc xá
- **Hướng dẫn chụp:** Chụp phần trên của form (header gradient + các section đầu) để thấy rõ layout card trắng trên nền gradient

---

## Hình 4.8 — Màn hình khám phá phòng 360°
- **Tên file:** `ui_explore.png`
- **Nguồn màn hình:** `views/student/explore-rooms.ejs` — truy cập route `GET /student/explore-rooms`
- **Dùng cho mục:** 4.2.1 Thiết kế giao diện → Màn hình khám phá phòng
- **Hướng dẫn chụp:** Chụp toàn trang gồm thanh bộ lọc và ít nhất 3–4 card phòng trong lưới

---

## Hình 4.9 — Màn hình tra cứu kết quả phân phòng
- **Tên file:** `ui_room_status.png`
- **Nguồn màn hình:** `views/student/room-status.ejs` — truy cập route `GET /student/room-status`
- **Dùng cho mục:** 4.2.1 Thiết kế giao diện → Màn hình tra cứu kết quả
- **Hướng dẫn chụp:** Ưu tiên chụp khi sinh viên đã có kết quả phân bổ (trạng thái ALLOCATED) để thấy rõ thông tin phòng; hoặc trạng thái WAITLIST để thấy vị trí danh sách chờ

---

## Hình 4.10 — Bảng điều khiển quản trị viên
- **Tên file:** `ui_admin_dashboard.png`
- **Nguồn màn hình:** `views/admin/dashboard.ejs` — truy cập route `GET /admin/dashboard`
- **Dùng cho mục:** 4.2.1 Thiết kế giao diện → Dashboard quản trị viên
- **Hướng dẫn chụp:** Chụp toàn trang gồm lưới thẻ thống kê phía trên và khu vực biểu đồ + bảng sinh viên phía dưới

---

## Hình 4.11 — Màn hình quản lý vi phạm
- **Tên file:** `ui_violations.png`
- **Nguồn màn hình:** `views/admin/violations/admin-violations.ejs` — truy cập route `GET /admin/violations`
- **Dùng cho mục:** 4.2.1 Thiết kế giao diện → Màn hình quản lý vi phạm
- **Hướng dẫn chụp:** Chụp toàn trang gồm header với nút hành động và bảng dữ liệu với ít nhất 3–5 hàng vi phạm

---

## Hình 4.12 — Màn hình quản lý đợt phân bổ phòng
- **Tên file:** `ui_allocation.png`
- **Nguồn màn hình:** `views/admin/allocation/dashboard.ejs` — truy cập route `GET /admin/allocation`
- **Dùng cho mục:** 4.2.1 Thiết kế giao diện → Dashboard phân bổ phòng
- **Hướng dẫn chụp:** Chụp khi có ít nhất một chu kỳ đã COMPLETED để thấy rõ bảng thống kê kết quả phân bổ theo nhóm năm học

---

## Hình 4.13, 4.14, 4.15 — Biểu đồ trình tự UC-01, UC-02, UC-03
- **Tên file:** `seq_apply.png`, `seq_allocate.png`, `seq_query.png`
- **Nguồn:** Render từ mã PlantUML trong file `4_Ket_qua_thuc_nghiem.tex` (các lstlisting UC-01/02/03)
- **Dùng cho mục:** 4.2.2 Thiết kế lớp → Biểu đồ trình tự
- **Công cụ render:** PlantUML online (plantuml.com) hoặc VS Code PlantUML extension
- **Hướng dẫn:** Copy mã `@startuml...@enduml` từ listing trong file .tex, dán vào PlantUML, xuất PNG độ phân giải cao

---

*Tổng: 11 hình. Tất cả đều minh họa chức năng thực sự tồn tại trong hệ thống.*
