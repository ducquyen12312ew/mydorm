# FINAL REFINEMENT REPORT — Round 2

**Ngày:** 2026-06-01
**Nhánh:** demo1
**File chính được sửa:** `full_report/v2.tex`

---

## 1. Những gì đã sửa trong v2.tex

### 1.1 Tổng quan chương

| Chương | Trạng thái trước | Trạng thái sau |
|--------|-----------------|----------------|
| Ch1 | MAJOR: thiếu liệt kê section | ✅ Thêm câu giới thiệu 4 section (1.1–1.4) |
| Ch2 | MAJOR: thiếu liệt kê section | ✅ Thêm câu giới thiệu 4 section (2.1–2.4) |
| Ch3 | CRITICAL: không có tổng quan | ✅ Đã thêm (Round 1) — 2 đoạn, liên kết Ch2 + liệt kê 8 section |
| Ch4 | MAJOR: không liên kết Ch3, câu sai | ✅ Viết lại — liên kết Ch3, liệt kê 3 mục (4.1.1–4.1.3) |

### 1.2 Kết chương

| Chương | Trạng thái |
|--------|-----------|
| Ch1 | ✅ Giữ nguyên (đạt) |
| Ch2 | ✅ Giữ nguyên (đạt) |
| Ch3 | ✅ Giữ nguyên (đạt) |
| Ch4 | ✅ Viết lại để bao gồm 4.1.3, dẫn sang Ch5 |

### 1.3 Thuật ngữ đã Việt hóa (Round 1)

| Thuật ngữ cũ | Thay thế |
|-------------|---------|
| `allocation cycle` | chu kỳ phân bổ / đợt phân bổ |
| `policy inheritance` | cơ chế kế thừa chính sách phân bổ |
| `violation workflow` | quy trình xử lý vi phạm nội quy |

### 1.4 Khẳng định sai đã sửa (Round 1)

| Khẳng định cũ | Bằng chứng | Sửa thành |
|--------------|-----------|----------|
| `optimistic locking` | Không có trong source code | Thiết kế tuần tự tuyến tính |
| `transaction logic` | Không có `startTransaction` | Cơ chế kiểm soát trạng thái ở tầng ứng dụng |
| Job queue / hàng đợi | Không có Bull/Agenda | Bỏ hoàn toàn |

### 1.5 Thêm mục 4.1.3 Thiết kế chi tiết gói

Nội dung mới gồm 3 phần:

**Allocation Package:**
- `AllocationService` — lớp điều phối trung tâm
- `SimulationService` — mô phỏng không ghi dữ liệu chính thức
- Nhóm lớp dữ liệu: `AllocationPolicy`, `AllocationCycle`, `AllocationRegistration`, `RoomAllocation`
- `AllocationAuditLog` — nhật ký bất biến

**Notification and Realtime Package:**
- `StudentSocketServer` — khởi tạo hạ tầng
- `DomainEventBridge` — cầu nối sự kiện → WebSocket
- `DurableEventPublisher` + `DomainEventOutbox` — đảm bảo độ bền sự kiện
- `RedisAdapter` — pub/sub đa instance
- `NotificationService` + `NotificationSchema` — kênh thông báo bền vững

**Authentication Package:**
- `AuthMiddleware` — session-based (web)
- `MobileJwtAuth` + `MobileTokenService` + `MobileRefreshToken` — JWT-based (mobile)
- `TwoFactorService` — TOTP, độc lập với tầng dữ liệu

**Tỷ lệ nội dung đạt được:**
- 60% UML Design Analysis (quan hệ lớp, lý do thiết kế, nguyên tắc)
- 25% Class Responsibility (vai trò từng lớp)
- 15% Tham chiếu source code (tên lớp thực tế trong `src/`)

### 1.6 \label đã thêm

- `\section{Thiết kế kiến trúc}` → `\label{sec:arch_design}` (để cross-reference từ 4.1.3)

---

## 2. Citations đã thêm

### Chiến lược phân phối (Round 2 revision)

- **Chương 3** — Tất cả citation về công nghệ và kiến thức nền
- **Chương 4** — Chỉ giữ citation giải thích UML và MVC/kiến trúc; KHÔNG cite các gói thiết kế (Allocation, Notification, Auth)

### Bảng citation

| Key | Loại tài liệu | Vị trí cite | Chương |
|-----|--------------|------------|--------|
| `fowler2002patterns` | Sách | 3.1 (kiến trúc phân lớp) + 4.1.1 (MVC) | Ch3 + Ch4 |
| `mongodb2024datamodel` | Tài liệu chính thức | 3.4 (data model hướng document) | Ch3 |
| `rfc7519` | RFC / Tiêu chuẩn internet | 3.5 (JWT authentication) | Ch3 |
| `reactnative2024` | Tài liệu chính thức | 3.6 (React Native 0.76) | Ch3 |
| `expo2024router` | Tài liệu chính thức | 3.6 (Expo SDK 52) | Ch3 |
| `redis2024pubsub` | Tài liệu chính thức | 3.7 (Redis Pub/Sub) | Ch3 |
| `socketio2024docs` | Tài liệu chính thức | 3.7 (Socket.IO cluster adapter) | Ch3 |
| `omg2017uml` | Đặc tả kỹ thuật | 4.1.2 (Package Diagram) + 4.1.3 (Class Diagram) | Ch4 |

### Tài liệu tham khảo theo loại

**Sách:**
- M. Fowler, *Patterns of Enterprise Application Architecture*, Addison-Wesley, 2002

**Đặc tả kỹ thuật:**
- OMG, *OMG Unified Modeling Language, Version 2.5.1*, formal/2017-12-05, 2017

**RFC / Tiêu chuẩn internet:**
- M. Jones et al., RFC 7519 — JSON Web Token, IETF, 2015

**Tài liệu chính thức (Online Reference):**
- MongoDB, Inc. — Data Model Design (MongoDB Manual 7.0)
- Redis Ltd. — Pub/Sub (Redis Documentation)
- Socket.IO — Socket.IO Documentation v4.x
- Meta Platforms — React Native Documentation 0.76
- Expo — Expo Router Documentation SDK 52

Không dùng Wikipedia, Blog, Medium, Viblo, StackOverflow.

---

## 3. Files đã thay đổi

| File | Loại thay đổi |
|------|--------------|
| `full_report/v2.tex` | Sửa Ch1/Ch2/Ch4 tổng quan; thêm 4.1.3; thêm label; thêm citations; thêm thebibliography |
| `full_report/HUONG_DAN_VE_CLASS_DIAGRAM.md` | Viết lại hoàn toàn với hướng dẫn Draw.io chi tiết + PlantUML |
| `full_report/FINAL_REFINEMENT_REPORT.md` | Tạo mới |

---

## 4. Lỗi audit đã xử lý

| Mã lỗi | Mô tả | Trạng thái |
|--------|-------|-----------|
| CRITICAL-Ch3 | Không có tổng quan chương 3 | ✅ Đã sửa (Round 1) |
| MAJOR-Ch1 | Tổng quan thiếu liệt kê section | ✅ Đã sửa (Round 2) |
| MAJOR-Ch2 | Tổng quan thiếu liệt kê section | ✅ Đã sửa (Round 2) |
| MAJOR-Ch4 | Tổng quan không liên kết Ch3 | ✅ Đã sửa (Round 2) |
| MAJOR-Ch4 | Câu "làm nền tảng cho chương triển khai" sai | ✅ Đã sửa (Round 2) |
| MAJOR-Ch3 | `optimistic locking`, `transaction logic`, job queue không có trong code | ✅ Đã sửa (Round 1) |
| MINOR-Ch3 | Thuật ngữ internal/developer (`allocation cycle`, `policy inheritance`) | ✅ Đã sửa (Round 1) |

---

## 5. Việc còn lại (chưa thực hiện trong Round 2)

| Hạng mục | Lý do chưa làm |
|---------|---------------|
| Vẽ 3 Class Diagram PNG | Cần thực hiện trên Draw.io bởi người dùng — xem HUONG_DAN_VE_CLASS_DIAGRAM.md |
| UC2: bỏ "trọng số tiêu chí ưu tiên" | Thuộc Ch2 — xử lý ở Bước 3 (Round tiếp theo) |
| NFR: làm rõ "coverage 80%" và "OpenAPI 3.0" | Thuộc Ch2 — xử lý ở Bước 3 (Round tiếp theo) |
| Chương 5 (Kiểm thử) | Chưa có nội dung |
| Chương 6 (Kết luận) | Chưa có nội dung |
| Phần Tóm tắt đồ án | Còn placeholder |
| Lời cảm ơn | Còn trống |
