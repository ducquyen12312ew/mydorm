# CHAPTER3_CONSISTENCY_AUDIT.md
# Audit tính nhất quán Chương 3 so với source code thực tế

**Ngày audit:** 2026-06-01  
**Nhánh:** demo1  
**Phạm vi:** Use Case, Functional Requirement, Non-functional Requirement  
**Phương pháp:** So sánh nội dung Chương 3 trong v2.tex với source code trong `src/`, `mobile/`

---

## 1. Use Case — Đánh giá từng mục

### UC1: Đăng ký ở và nộp minh chứng

**Trạng thái:** KHỚP — có triển khai thực tế

Luồng đăng ký sinh viên tồn tại tại `src/routes/student/registration-routes.js`.
`AllocationRegistrationSchema` lưu trữ đơn với trường `priorityDetails`, `documents`.
Kiểm tra tính hợp lệ được thực hiện qua express-validator trong route.

**Phát hiện nhỏ:** UC1 không đề cập đến `AllocationRegistration` theo tên, trong khi đây là collection thực tế. Mô tả dùng từ "hồ sơ đăng ký" là đủ tổng quát, nhưng cần nhất quán với UC3 khi nhắc đến "ứng viên".

---

### UC2: Cấu hình chính sách và tham số phân bổ

**Trạng thái:** KHÔNG KHỚP MỘT PHẦN

**Phát hiện:**
- UC2 mô tả: *"nhập các tham số bao gồm trọng số của từng tiêu chí ưu tiên"*
- Source code thực tế (`allocationService.js`): trọng số được hardcode là `0.35 / 0.35 / 0.30`, không được đọc từ `AllocationPolicy` schema.
- `AllocationPolicy` schema lưu các ràng buộc khác (quota per year group, auto-approve percent) nhưng không lưu trọng số điểm ưu tiên.
- **Mức độ ảnh hưởng:** Trung bình — mô tả hàm ý người dùng có thể tuỳ chỉnh trọng số, nhưng thực tế là không.

**Gợi ý sửa (chưa thực hiện):** Điều chỉnh câu mô tả thành *"lựa chọn và cấu hình các tham số phân bổ như tỷ lệ chấp thuận tự động, phân bổ chỉ tiêu theo năm học và các ràng buộc phòng"* — bỏ phần "trọng số tiêu chí ưu tiên".

---

### UC3: Chạy mô phỏng & thực thi phân bổ

**Trạng thái:** KHỚP

`SimulationService` (`src/services/simulationService.js`) và `AllocationService` (`src/services/allocationService.js`) triển khai đầy đủ hai chế độ preview và commit.
`AllocationAuditLog` ghi lại mỗi hành động.
`publishDomainEvent(EVENT_TYPES.STUDENT_ASSIGNED)` kích hoạt thông báo sau commit.

---

### UC4: Tra cứu kết quả, khiếu nại và tương tác

**Trạng thái:** KHỚP MỘT PHẦN

Tra cứu kết quả: tồn tại, sinh viên có thể xem `RoomAllocation` qua API.
Khiếu nại: `PriorityClaimSchema` tồn tại tại `src/schemas/PriorityClaimSchema.js`.

**Phát hiện:** UC4 mô tả *"bản tóm tắt lời giải thích... điểm ưu tiên của mình là bao nhiêu và được tính từ các tiêu chí nào"*. Trường `breakdown` trong `AllocationRegistration` lưu chi tiết từng tiêu chí, nhưng hiện chưa rõ giao diện sinh viên web/mobile có hiển thị breakdown này không. Cần kiểm tra thêm ở phần frontend.

---

### UC5: Quản lý danh sách phòng và kiểm duyệt dữ liệu

**Trạng thái:** KHỚP

Dữ liệu phòng được quản lý qua `DormitoryCollection` (embedded documents trong `DormitorySchema`).
Các route admin cho phép thêm, cập nhật, vô hiệu hoá phòng.

**Phát hiện nhỏ:** Schema phòng tổ chức theo mô hình embedded (dormitory → floors → rooms), khác với cách mô tả "danh sách phòng" phẳng. Không ảnh hưởng đến chức năng nhưng cần lưu ý khi mô tả data model.

---

### UC6: Thông báo thời gian thực và audit log

**Trạng thái:** KHỚP

Socket.IO (`src/realtime/student-socket-server.js`) xử lý realtime.
`notificationHelper.js` tạo bản ghi `NotificationCollection`.
`ActivityLogCollection` ghi audit log.
Redis adapter đảm bảo nhất quán khi multi-instance.

---

## 2. Chức năng trong source code KHÔNG có Use Case tương ứng

### 2.1. Xác thực hai yếu tố (2FA)

**Tồn tại trong code:** `TwoFactorService` (`src/services/twoFactorService.js`), `TwoFactorSchema`, route 2FA trong admin và student.
**Không có trong Chương 3:** Không có UC nào đề cập đến việc bật/tắt 2FA, quét mã QR, nhập OTP.
**Mức độ ảnh hưởng:** Thấp đến trung bình — 2FA là tính năng bảo mật, có thể đề cập trong phần Yêu cầu phi chức năng thay vì Use Case.

### 2.2. Xác thực ứng dụng di động (Mobile JWT)

**Tồn tại trong code:** `MobileTokenService`, `MobileRefreshToken`, `mobileJwtAuth` middleware, route mobile login.
**Không có trong Chương 3:** Không có UC đặc thù cho đăng nhập di động với JWT refresh rotation và risk scoring.
**Mức độ ảnh hưởng:** Trung bình — mobile authentication là một luồng nghiệp vụ riêng biệt, khác với web session. Có thể bổ sung sub-flow vào UC hiện có hoặc thêm note trong phần kiến trúc.

### 2.3. Quản lý vi phạm (Violations)

**Tồn tại trong code:** `ViolationSchema` (`src/schemas/ViolationSchema.js`), route quản lý vi phạm trong admin.
**Không có trong Chương 3:** Không có UC về việc ghi nhận, xem xét hoặc xử lý vi phạm nội quy ký túc xá.
**Mức độ ảnh hưởng:** Trung bình — đây là chức năng vận hành thực tế, nên có ít nhất một mention trong phần tổng quan chức năng hoặc một UC riêng.

### 2.4. Yêu cầu bảo trì (Maintenance Requests)

**Tồn tại trong code:** `MaintenanceRequestSchema` (`src/schemas/MaintenanceRequestSchema.js`).
**Không có trong Chương 3:** Không có UC về sinh viên gửi yêu cầu bảo trì phòng.
**Mức độ ảnh hưởng:** Thấp — tính năng hỗ trợ, không phải nghiệp vụ cốt lõi.

### 2.5. Chuyển dịch nhóm học kỳ (Cohort Shift)

**Tồn tại trong code:** `CohortShiftService` (`src/services/cohortShiftService.js`), `CohortShiftSchema`.
**Không có trong Chương 3:** Không có UC về việc chuyển sinh viên năm 1 → năm 2 khi bắt đầu học kỳ mới.
**Mức độ ảnh hưởng:** Thấp — có thể được bao gồm ngầm trong UC2 (cấu hình chu kỳ học kỳ).

---

## 3. Yêu cầu phi chức năng — Kiểm tra khả năng thực hiện

| Yêu cầu | Trạng thái |
|---------|-----------|
| Xử lý 5.000 yêu cầu đọc đồng thời, P95 < 300ms | Chưa có bằng chứng kiểm thử tải — chỉ là mục tiêu thiết kế |
| 200 yêu cầu ghi đồng thời | Chưa có bằng chứng kiểm thử tải |
| Allocation Engine coverage ≥ 80% | Không tìm thấy file test trong dự án (`*.test.js`, `*.spec.js`) — yêu cầu này không khớp với thực tế |
| OpenAPI 3.0 documentation | Không tìm thấy file `openapi.yaml` hay `swagger.json` trong dự án — yêu cầu này không khớp với thực tế |
| Availability 99.9% | Mục tiêu thiết kế, không thể xác minh từ code |
| TLS/HTTPS | Có cấu hình Helmet, nhưng TLS phụ thuộc hạ tầng triển khai, không nằm trong code |
| JWT + RBAC với 3 vai trò | KHỚP — `isAuthenticated`, `isAdmin`, `requireMobileJwt` triển khai đầy đủ |
| Audit log bộ lưu trữ riêng với quyền ghi một lần | KHỚP MỘT PHẦN — `ActivityLogCollection` tồn tại nhưng không có cơ chế immutability ở tầng DB |

**Phát hiện quan trọng:**
- Câu *"đạt coverage kiểm thử đơn vị tối thiểu 80%"* và *"tài liệu API theo chuẩn OpenAPI 3.0"* không có tương ứng trong source code. Nếu giữ lại trong báo cáo, cần ghi rõ đây là yêu cầu đặt ra cho giai đoạn sản xuất thực tế, chưa được thực hiện trong phạm vi đồ án.

---

## 4. Tóm tắt mức độ ưu tiên sửa

| Mức | Nội dung |
|-----|---------|
| **Cao** | UC2: Bỏ phần "tuỳ chỉnh trọng số tiêu chí ưu tiên" vì trọng số hardcode trong code |
| **Cao** | NFR: Bỏ hoặc ghi rõ phạm vi cho yêu cầu "coverage 80%" và "OpenAPI 3.0" |
| **Trung bình** | Bổ sung UC hoặc sub-flow cho Mobile JWT authentication |
| **Trung bình** | Bổ sung đề cập đến Violations management trong phần tổng quan chức năng |
| **Thấp** | UC4: Làm rõ giao diện có hiển thị breakdown điểm ưu tiên không |
| **Thấp** | Bổ sung mention về 2FA, Maintenance Requests trong phần chức năng hỗ trợ |
