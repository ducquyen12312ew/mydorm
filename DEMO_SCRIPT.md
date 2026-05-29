# Demo Script — HUST Dormitory Management System
## Graduation Defense · 5–7 Minutes

---

## Setup Before Demo

- [ ] Backend running: `npm start` (connected to MongoDB Atlas)
- [ ] Redis running
- [ ] Mobile app open on phone/emulator (student account logged in)
- [ ] Admin web open in browser (admin account logged in)
- [ ] Screen mirroring active

**Demo accounts** (from real Atlas data):
- Student: use a real student account from the `students` collection
- Admin: admin account in the system

---

## Scene 1 — Login (30 seconds)

**On device:** Start from the login screen

**Talking points:**
> "Sinh viên đăng nhập bằng tài khoản được cấp bởi Phòng Quản lý Ký Túc Xá. Hệ thống sử dụng JWT với access token 15 phút và refresh token 30 ngày, lưu trữ an toàn trong SecureStore của thiết bị."

**Actions:**
1. Show login screen (red KTX logo, clean form)
2. Enter student credentials
3. Login → haptic feedback on success → navigate to dashboard

**Expected result:** Dashboard loads with real student data from Atlas

---

## Scene 2 — Dashboard (60 seconds)

**On device:** Dashboard (Tổng quan) tab

**Talking points:**
> "Màn hình tổng quan hiển thị toàn bộ thông tin quan trọng của sinh viên: điểm ưu tiên, tình trạng phòng, đơn đăng ký, và chu kỳ xét duyệt hiện tại. Dữ liệu được cập nhật realtime qua Socket.IO."

**Actions:**
1. Show profile header (name, status line, avatar)
2. Point to priority score (calculated: 35% distance + 35% financial + 30% priority level)
3. Show quick stats (priority score, room number, notification count)
4. Show quick action buttons (Timeline, Resident Card, Maintenance, Notifications)
5. Scroll down to show Room Assignment card and Application card
6. Pull-to-refresh → shows RefreshControl → data reloads

**Expected result:** All cards loaded with real Atlas student data

---

## Scene 3 — Allocation Timeline (45 seconds)

**On device:** Tap "Tiến trình" quick action

**Talking points:**
> "Màn hình tiến trình cho sinh viên thấy rõ mình đang ở bước nào trong quy trình xét duyệt: nộp đơn → xét duyệt → hàng chờ → xếp phòng. Điểm ưu tiên quyết định thứ tự ưu tiên."

**Actions:**
1. Show hero card with priority score (large number) and current cycle name
2. Walk through 4 timeline steps:
   - Nộp đơn (Done/Pending)
   - Xét duyệt (Active/Done/Error)
   - Hàng chờ (Active/Done)
   - Xếp phòng (Done → shows room number)
3. If student is assigned: show green "Phòng của bạn" card at bottom

**Expected result:** Timeline reflects real application status from Atlas

---

## Scene 4 — Room Explorer (60 seconds)

**On device:** Rooms (Phòng ở) tab

**Talking points:**
> "Sinh viên có thể duyệt toàn bộ danh sách phòng từ MongoDB Atlas, lọc theo loại phòng, trạng thái còn chỗ, và tìm kiếm theo số phòng. Thanh chiếm dụng hiển thị real-time từ dữ liệu thực."

**Actions:**
1. Show room list grouped by dormitory buildings
2. Toggle "Còn chỗ" filter → rooms update
3. Tap room type chip (Đôi / Ba người) → filters apply
4. Type in search box → instant filtering by room number
5. Toggle favorite heart on a room

**Expected result:** Real dormitory data from Atlas `dormitories` collection, occupancy bars showing real numbers

---

## Scene 5 — Room Detail (30 seconds)

**On device:** Tap a room card

**Talking points:**
> "Chi tiết phòng hiển thị thanh chiếm dụng, giá thuê, tiện nghi, và thông tin khu ký túc xá. Sinh viên có thể lưu phòng vào danh sách yêu thích."

**Actions:**
1. Show hero banner (available/full status)
2. Point to price card (formatted VND)
3. Show occupancy bar with percentage
4. Scroll through room info, dorm info, amenities chips
5. Tap "Lưu vào yêu thích" → heart fills red → haptic

**Expected result:** Real room data from Atlas

---

## Scene 6 — Roommates (30 seconds)

**On device:** Profile tab → scroll to "Bạn cùng phòng" section

**Talking points:**
> "Sinh viên đã được xếp phòng có thể xem danh sách bạn cùng phòng với tên, MSSV, và nút gọi điện trực tiếp."

**Actions:**
1. Show profile screen with personal + academic info
2. Scroll to Bạn cùng phòng card
3. Show roommate entries (avatar letter, name, MSSV)
4. Show call button → taps open dial pad

**Expected result:** Real roommate data pulled from `dormitories.rooms.occupants` via Atlas

---

## Scene 7 — Notifications (30 seconds)

**On device:** Notifications (Thông báo) tab

**Talking points:**
> "Thông báo được phân loại theo danh mục: xếp phòng, đăng ký, bảo trì, hệ thống. Thông báo chưa đọc có highlight đặc biệt và badge đếm trên tab bar."

**Actions:**
1. Show notification list with real notifications
2. Show unread badge (number) on tab bar
3. Tap a category chip (Xếp phòng / Bảo trì)
4. Tap unread notification → marks as read → dot disappears
5. Tap "Mark all read" checkmark icon → all clear

**Expected result:** Real notifications from Atlas `notifications` collection

---

## Scene 8 — Maintenance Request (45 seconds)

**On device:** Profile → Yêu cầu bảo trì

**Talking points:**
> "Sinh viên báo cáo sự cố phòng ở trực tiếp từ app. Yêu cầu được lưu vào MongoDB và admin xử lý trên web. Sinh viên theo dõi tiến trình qua trạng thái."

**Actions:**
1. Show maintenance list with existing requests (status chips)
2. Filter by "Đang xử lý"
3. Tap FAB "+" → New Request form
4. Select issue type (e.g., "Điện" electricity icon)
5. Enter title + description
6. Submit → success haptic → appears in list

**Expected result:** Request saved to Atlas `MaintenanceRequest` collection, appears in list with "Đã gửi" status

---

## Scene 9 — QR Resident Card (30 seconds)

**On device:** Dashboard → Thẻ cư trú

**Talking points:**
> "Thẻ cư trú kỹ thuật số được ký bởi server với JWT, có hiệu lực 24 giờ và tự động làm mới sau 20 phút. Bảo vệ: sinh viên không thể làm giả thẻ vì token được xác thực phía server."

**Actions:**
1. Show the physical-looking card (red HUST header)
2. Point to QR code (backend-signed JWT)
3. Show student name, MSSV, faculty
4. Show Room + Dorm section ("Đang cư trú" green pill)
5. Show expiry time and security note
6. Tap "Làm mới thẻ" → QR refreshes

**Expected result:** Real student data, real signed QR token from backend

---

## Scene 10 — Admin Web (30 seconds)

**Switch to browser:** Admin dashboard

**Talking points:**
> "Web admin cho phép quản lý toàn bộ: duyệt đơn đăng ký, xếp phòng tự động, quản lý bảo trì, báo cáo vi phạm. Hệ thống xếp phòng tự động dựa trên điểm ưu tiên và chính sách quota."

**Actions:**
1. Show admin dashboard (statistics overview)
2. Open Applications list → pending applications
3. Show an application detail → Approve
4. Show Allocation section with cycle management
5. Show Maintenance management table
6. Show a realtime notification pop up (if applicable)

**Expected result:** All data from real Atlas collections

---

## Wrap-up (30 seconds)

**Talking points:**
> "Hệ thống kết hợp backend Node.js + MongoDB Atlas + Socket.IO realtime + ứng dụng mobile React Native Expo, phục vụ đầy đủ quy trình quản lý ký túc xá: đăng ký → xét duyệt → xếp phòng → cư trú → bảo trì. Toàn bộ dữ liệu demo là dữ liệu thực từ MongoDB Atlas."

---

## Common Questions & Answers

**Q: Tại sao dùng JWT cho mobile thay vì session?**
A: Mobile app không có cookie browser tự nhiên. JWT với refresh rotation cho phép stateless auth + revocation khi cần.

**Q: Điểm ưu tiên tính như thế nào?**
A: 35% khoảng cách địa lý, 35% hoàn cảnh kinh tế, 30% cấp độ ưu tiên. Công thức đảm bảo fairness metric: deviation tối đa ≤ 10% giữa các nhóm năm học.

**Q: Realtime hoạt động như thế nào?**
A: Socket.IO với Redis adapter. Server push `student:dashboard` event khi allocation thay đổi. Client nhận và cập nhật TanStack Query cache ngay lập tức.

**Q: Bảo mật QR như thế nào?**
A: Token được ký HMAC bởi server, có TTL 24h, chứa studentId + timestamp. Guard gate check signature → không thể làm giả.

**Q: Scaling như thế nào?**
A: Stateless backend + Redis session store → horizontal scaling. Socket.IO Redis adapter đồng bộ events across instances.
