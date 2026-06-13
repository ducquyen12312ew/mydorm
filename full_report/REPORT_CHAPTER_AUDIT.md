# REPORT CHAPTER AUDIT — Hệ thống Quản lý Ký túc xá

**Ngày audit:** 2026-05-30  
**Người audit:** Claude Sonnet 4.6  
**Phiên bản báo cáo được audit:** v1.tex  
**Phiên bản source code:** demo1 branch (commit 9722947)

---

## 1. NHỮNG GÌ ĐÃ CÓ TRONG BÁO CÁO

### 1.1 Công nghệ đã mô tả

**Backend:**
- Node.js (môi trường thực thi)
- Express.js (framework web)
- MongoDB (cơ sở dữ liệu chính)
- Mongoose (ODM)
- JWT (xác thực API stateless)
- bcrypt (băm mật khẩu)
- Socket.IO (thông báo realtime — đề cập nhưng không mô tả chi tiết)
- TOTP/2FA với speakeasy (đề cập ngắn)
- Refresh token + blacklist (đề cập trong 3.5)

**Frontend Web:**
- EJS (template engine, server-side rendering)
- Bootstrap (CSS framework)
- JavaScript (client-side)
- Leaflet.js (bản đồ tương tác)
- Room 360° viewer (đề cập như hướng mở rộng)

**Mobile (đề cập rất sơ lược):**
- Expo (chỉ nhắc đến tên)
- React Native (chỉ nhắc đến tên)

**Database:**
- MongoDB (mô hình document, schema thiết kế)
- Mongoose schema validation, virtuals

### 1.2 Kiến trúc đã mô tả

- Kiến trúc 3-tier (presentation → service → data)
- Phân tách RESTful API khỏi rendering layer
- Allocation Engine với 2 chế độ: preview (mô phỏng) và commit (thực thi)
- Policy inheritance model
- Optimistic locking cho document quan trọng
- Academic window / semester lifecycle

### 1.3 Tính năng đã mô tả

- Đăng ký ở và nộp minh chứng (UC1)
- Cấu hình chính sách và tham số phân bổ (UC2)
- Mô phỏng và thực thi phân bổ (UC3)
- Tra cứu kết quả, khiếu nại (UC4)
- Quản lý danh sách phòng (UC5)
- Thông báo realtime và audit log (UC6)
- RBAC với 3 vai trò: admin toàn quyền, admin chỉ xem, sinh viên
- Priority score calculation
- Room visualization

---

## 2. NHỮNG GÌ THIẾU SO VỚI SOURCE CODE

### 2.1 Backend — Thiếu hoàn toàn

| Công nghệ/Module | File nguồn | Mức độ thiếu |
|---|---|---|
| **Redis** | `src/realtime/redis-adapter.js`, `docker-compose.yml` | Thiếu hoàn toàn — Redis dùng làm Socket.IO cluster adapter, có service riêng trong docker-compose |
| **@sentry/node** | `src/config/sentry.js` | Thiếu hoàn toàn — Sentry khởi tạo sớm (trước mọi require) để instrument mongoose/http |
| **Winston** | `src/config/logger.js` | Thiếu tên — chỉ nói "JSON log" nhưng không nêu Winston |
| **Helmet** | `src/middleware/security.js` | Thiếu hoàn toàn — `helmetConfig` được apply trong index.js |
| **express-rate-limit** | `src/middleware/security.js` | Nhắc đến rate limiting nhưng không nêu thư viện |
| **QR Signing (HMAC-SHA256)** | `src/routes/student/mobile/qr.routes.js` | Thiếu hoàn toàn — cơ chế thẻ QR có ký số HMAC-SHA256 với QR_SECRET |
| **Environment Validation** | `src/config/validateEnv.js` | Thiếu hoàn toàn — validation toàn bộ secrets trước khi khởi động |
| **Health Checks** | `src/routes/health-routes.js` | Được đề cập trong NFR nhưng không mô tả là endpoint `/health` đã implement |
| **Domain Events / Outbox** | `src/events/durable-event-publisher.js`, `DomainEventOutboxSchema.js` | Thiếu hoàn toàn — pattern Outbox cho reliable events |
| **OpenTelemetry** | `src/observability/tracing.js`, `observability.js` | Thiếu hoàn toàn |
| **Multer** | package.json | Thiếu — xử lý file upload |
| **nodemailer** | package.json | Thiếu — gửi email thông báo |
| **Twilio** | package.json, docker-compose.yml | Thiếu — SMS notification |
| **express-mongo-sanitize** | package.json | Thiếu — chống NoSQL injection |
| **connect-mongo** | KHÔNG có trong package.json | Báo cáo có thể nhầm — session không dùng connect-mongo, lưu in-memory |

### 2.2 Mobile — Thiếu gần hoàn toàn

| Công nghệ | File nguồn | Mức độ thiếu |
|---|---|---|
| **Expo Router v4** | `mobile/app/` (file-based routing) | Thiếu — routing dựa trên cấu trúc thư mục |
| **TanStack Query (React Query v5)** | `mobile/package.json` | Thiếu hoàn toàn — server state management |
| **Zustand v5** | `mobile/package.json` | Thiếu hoàn toàn — global state management |
| **Axios** | `mobile/package.json` | Thiếu — HTTP client |
| **react-native-qrcode-svg** | `mobile/package.json` | Thiếu — hiển thị QR code |
| **@sentry/react-native** | `mobile/package.json` | Thiếu — error monitoring mobile |
| **expo-secure-store** | `mobile/package.json` | Thiếu — lưu token an toàn |
| **socket.io-client** | `mobile/package.json` | Thiếu — realtime connection từ mobile |
| **TypeScript** | `mobile/tsconfig.json`, `.tsx` files | Thiếu — mobile viết bằng TypeScript |
| **AsyncStorage** | `mobile/package.json` | Thiếu |

### 2.3 Infrastructure / DevOps — Thiếu hoàn toàn

| Hạ tầng | File nguồn | Ghi chú |
|---|---|---|
| **Docker** | `Dockerfile` | Multi-stage build, node:20-alpine, non-root user |
| **Docker Compose** | `docker-compose.yml` | Orchestration: app + redis services, healthcheck |
| **GitHub Actions CI** | `.github/workflows/ci.yml` | 2 jobs: backend syntax check + mobile TypeScript check |
| **MongoDB Atlas** | `docker-compose.yml` env, `.env.example` | Cloud MongoDB — chỉ nói "MongoDB" không nói Atlas |
| **Redis Cloud / Redis** | `docker-compose.yml` redis service | Redis 7-alpine trong compose |

### 2.4 Security — Thiếu một phần

| Cơ chế | Trạng thái trong báo cáo |
|---|---|
| **QR Token Signing** | Thiếu hoàn toàn — HMAC-SHA256, 24h TTL, rotate mỗi lần gọi |
| **JWT Access Token (15m)** | Đề cập nhưng không nêu TTL |
| **JWT Refresh Token (30d)** | Đề cập nhưng không nêu TTL |
| **SESSION_SECRET validation** | Thiếu — validate trước khi khởi động |
| **Helmet security headers** | Đề cập "HTTP headers" nhưng không nêu Helmet |
| **Token anomaly detection** | Thiếu — `MOBILE_ALERT_ON_TOKEN_ANOMALY`, risk score |

---

## 3. NHỮNG GÌ CẦN CẬP NHẬT

### 3.1 Chương 1 — Cần sửa lỗi

**Lỗi nghiêm trọng (cần sửa ngay):**
- Dòng 383-385: *"giao diện sinh viên web mobile-first với React và Tailwind CSS"*  
  → **THỰC TẾ:** Web frontend (cả admin lẫn student) đều dùng EJS + Bootstrap. Không có React hay Tailwind CSS trong web frontend.  
  → **Sửa thành:** "giao diện quản trị và sinh viên render phía máy chủ sử dụng EJS kết hợp Bootstrap"

### 3.2 Chương 2 — Cần bổ sung nhỏ

- Mục 2.4 (Yêu cầu phi chức năng): Bảng "Stack công nghệ đề xuất" ở cuối chương cần cập nhật: bỏ "React + Tailwind CSS", thêm "Redis, Sentry, Docker"
- Mục 2.4: Section "MongoDB hoặc PostgreSQL" → thực tế chỉ dùng MongoDB Atlas, không có PostgreSQL

### 3.3 Chương 3 — Cần bổ sung lớn

**3.1 Kiến trúc hệ thống:**
- Bổ sung Docker containerization vào mô tả deployment
- Bổ sung Redis như một tầng hạ tầng riêng (cluster adapter cho Socket.IO)
- Mô tả GitHub Actions CI pipeline

**3.2 Công nghệ backend:**
- Thêm: Redis (`@socket.io/redis-adapter`) — Socket.IO cluster adapter
- Thêm: Sentry (`@sentry/node`) — error monitoring, instrumentation tự động
- Thêm: Winston — structured JSON logging
- Thêm: Helmet — HTTP security headers
- Thêm: express-rate-limit — rate limiting
- Thêm: express-mongo-sanitize — NoSQL injection protection
- Thêm: QR signing mechanism (HMAC-SHA256)
- Thêm: Environment validation (validateEnv.js) — fail-fast trước khi khởi động
- Thêm: Domain Event Outbox pattern
- Sửa: Mô tả session rõ ràng hơn (express-session, cookie HttpOnly, SameSite)

**3.3 Công nghệ frontend:**
- Sửa lỗi: xóa bỏ đề cập React/Tailwind CSS
- Làm rõ: cả admin panel và student portal đều dùng EJS
- Thêm: Progressive enhancement approach
- Giữ nguyên: Leaflet.js, 360° viewer

**3.4 Cơ sở dữ liệu:**
- Bổ sung: MongoDB Atlas (cloud-hosted, không phải local)
- Bổ sung: Connection pooling configuration
- Bổ sung: Collection schemas đầy đủ theo source code thực tế

**Cần thêm section mới:**

**3.7 Ứng dụng di động (Mobile):**
- React Native 0.76 + Expo SDK 52
- Expo Router v4 (file-based routing)
- TanStack Query v5 (server state)
- Zustand v5 (global client state)
- Axios (HTTP client)
- Socket.IO client (realtime)
- expo-secure-store (token storage)
- react-native-qrcode-svg (QR card)
- Sentry React Native (error monitoring)
- TypeScript

**3.8 Hạ tầng và vận hành:**
- Docker (Dockerfile multi-stage, node:20-alpine, non-root user)
- Docker Compose (app + redis, healthcheck)
- GitHub Actions CI (backend syntax check + mobile TypeScript check)
- MongoDB Atlas (managed cloud MongoDB)
- Redis (cluster adapter, local trong Docker Compose)
- Sentry (error monitoring, cloud)
- Health endpoint `/health`

---

## 4. DANH SÁCH THAY ĐỔI ĐỀ XUẤT

| Mục | Hiện tại trong báo cáo | Thực tế source code | Cần cập nhật |
|---|---|---|---|
| Web frontend framework | "React và Tailwind CSS" (Ch.1, Ch.3.3) | EJS + Bootstrap | Sửa lỗi |
| Redis | Không đề cập | `@socket.io/redis-adapter`, docker-compose có redis:7 service | Thêm vào 3.2 + 3.8 |
| Sentry backend | Không đề cập | `@sentry/node`, instrument mongoose+http | Thêm vào 3.2 + 3.8 |
| Sentry mobile | Không đề cập | `@sentry/react-native` | Thêm vào section mobile mới |
| Expo Router | Không đề cập | `expo-router ~4.0.20`, file-based routing | Thêm vào section mobile mới |
| TanStack Query | Không đề cập | `@tanstack/react-query ^5.62.0` | Thêm vào section mobile mới |
| Zustand | Không đề cập | `zustand ^5.0.2` | Thêm vào section mobile mới |
| Axios | Không đề cập | `axios ^1.7.9` | Thêm vào section mobile mới |
| QR Signing | Không đề cập | HMAC-SHA256, QR_SECRET, 24h TTL, rotate | Thêm vào 3.5 + section security |
| Docker | Không đề cập | `Dockerfile`, multi-stage, node:20-alpine | Thêm vào 3.8 |
| Docker Compose | Không đề cập | `docker-compose.yml`, app+redis | Thêm vào 3.8 |
| GitHub Actions | Không đề cập | `.github/workflows/ci.yml`, 2 jobs | Thêm vào 3.8 |
| Winston | "JSON structured log" | `winston ^3.19.0` | Nêu rõ tên thư viện |
| Helmet | "HTTP security headers" | `helmet ^8.1.0`, `helmetConfig` | Nêu rõ tên thư viện |
| Environment Validation | Không đề cập | `src/config/validateEnv.js`, fail-fast | Thêm vào 3.2 hoặc 3.5 |
| connect-mongo | Có thể bị nhầm | KHÔNG có trong package.json | Ghi rõ: session in-memory (dev), cần Redis store cho production |
| MongoDB Atlas | Chỉ nói "MongoDB" | MONGODB_URI = Atlas connection string | Cập nhật 3.4 |
| JWT TTL | Không nêu | Access: 15m, Refresh: 30d | Bổ sung 3.5 |
| Token anomaly detection | Không đề cập | `MOBILE_ALERT_ON_TOKEN_ANOMALY`, risk score | Bổ sung 3.5 |
| TypeScript (mobile) | Không đề cập | Mobile app 100% TypeScript | Bổ sung section mobile |
| react-native-qrcode-svg | Không đề cập | `react-native-qrcode-svg ^6.3.2` | Bổ sung section mobile |

---

## 5. DANH SÁCH CÔNG NGHỆ CUỐI CÙNG

### Backend

| Thư viện | Phiên bản | Vai trò |
|---|---|---|
| Node.js | 20 (LTS) | Runtime |
| Express.js | ^4.21.2 | Web framework |
| Mongoose | ^8.13.1 | MongoDB ODM |
| Socket.IO | ^4.8.1 | WebSocket server |
| `@socket.io/redis-adapter` | ^8.3.0 | Cluster adapter cho Socket.IO |
| redis | ^5.8.3 | Redis client |
| jsonwebtoken | ^9.0.2 | JWT access/refresh token |
| bcrypt | ^6.0.0 | Password hashing |
| express-session | ^1.18.1 | Web session (admin portal) |
| speakeasy | ^2.0.0 | TOTP/2FA |
| `@sentry/node` | ^10.55.0 | Error monitoring, instrumentation |
| winston | ^3.19.0 | Structured logging |
| helmet | ^8.1.0 | HTTP security headers |
| express-rate-limit | ^8.2.1 | Rate limiting |
| express-mongo-sanitize | ^2.2.0 | NoSQL injection protection |
| express-validator | ^7.3.1 | Input validation |
| joi | ^18.0.2 | Schema validation |
| multer | ^2.0.2 | File upload |
| nodemailer | ^7.0.12 | Email |
| twilio | ^5.11.1 | SMS |
| qrcode | ^1.5.4 | QR code generation |
| uuid | ^11.1.0 | ID generation |
| ejs | ^3.1.10 | Template engine (server-side rendering) |
| `@opentelemetry/api` | ^1.9.0 | Distributed tracing |
| exceljs | ^4.4.0 | Excel export |

### Mobile

| Thư viện | Phiên bản | Vai trò |
|---|---|---|
| React Native | 0.76.9 | UI framework đa nền tảng |
| Expo SDK | ~52.0.46 | Build toolchain, native APIs |
| Expo Router | ~4.0.20 | File-based routing |
| TypeScript | ~5.3.3 | Static type checking |
| `@tanstack/react-query` | ^5.62.0 | Server state management |
| Zustand | ^5.0.2 | Global client state |
| Axios | ^1.7.9 | HTTP client |
| socket.io-client | ^4.8.1 | WebSocket client |
| expo-secure-store | ~14.0.0 | Secure token storage |
| `@sentry/react-native` | ~6.10.0 | Error monitoring |
| react-native-qrcode-svg | ^6.3.2 | QR code display |
| react-native-svg | ~15.8.0 | SVG rendering |
| `@react-native-async-storage/async-storage` | 1.23.1 | Local storage |
| expo-haptics | ~14.0.1 | Haptic feedback |
| expo-clipboard | ~7.0.0 | Clipboard API |

### Frontend Web (Admin & Student Portal)

| Công nghệ | Vai trò |
|---|---|
| EJS 3.x | Server-side template engine |
| Bootstrap (CSS) | Responsive UI framework |
| JavaScript (vanilla) | Client-side interactions |
| Leaflet.js | Interactive map |

### Database

| Công nghệ | Vai trò |
|---|---|
| MongoDB Atlas | Cloud-hosted document database |
| Mongoose 8 | ODM, schema validation, middleware |

### Infrastructure & DevOps

| Công nghệ | Vai trò |
|---|---|
| Docker (node:20-alpine) | Container image, multi-stage build |
| Docker Compose | Local orchestration (app + redis) |
| GitHub Actions | CI pipeline (backend syntax + mobile TS check) |
| Redis 7 | Socket.IO cluster adapter, session store |
| MongoDB Atlas | Cloud database (MONGODB_URI) |

### Security

| Cơ chế | Chi tiết |
|---|---|
| JWT Access Token | TTL: 15m, MOBILE_JWT_ACCESS_SECRET |
| JWT Refresh Token | TTL: 30d, MOBILE_JWT_REFRESH_SECRET, lưu hash trong DB |
| QR Token Signing | HMAC-SHA256, QR_SECRET, 24h TTL, rotate mỗi call |
| Session Cookie | HttpOnly, SameSite=strict, SESSION_SECRET |
| TOTP/2FA | speakeasy, dùng cho admin |
| Environment Validation | Fail-fast production, warn development |
| Token Anomaly Detection | Risk score, alert on reuse anomaly |

### Monitoring

| Công nghệ | Vai trò |
|---|---|
| Sentry (backend) | Error tracking, performance, mongoose instrumentation |
| Sentry (React Native) | Mobile crash reporting |
| Winston | Structured JSON log, console + file transport |
| OpenTelemetry | Distributed tracing spans |
| Health Endpoint | `GET /health` — được check bởi Docker healthcheck |
