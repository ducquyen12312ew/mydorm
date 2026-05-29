# Mobile Screenshots — HUST Dormitory Student App

All screenshots must be taken from the **running application connected to MongoDB Atlas** with real student data. No mock data permitted.

## How to Generate Screenshots

1. Start backend: `npm start` (root directory)
2. Launch mobile app: `cd mobile && npx expo start`
3. Open on Android emulator or physical device
4. Log in with a real student account
5. Navigate to each screen and capture

**Recommended tool:** Android emulator screenshot via `adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png`

---

## Required Screenshots

### 01-login.png
**Screen:** Login  
**Purpose:** Entry point — demonstrates clean authentication UI  
**APIs used:** `POST /auth/mobile/login`  
**Collections:** `students`  
**What to show:** KTX logo, username/password fields, login button

---

### 02-dashboard.png
**Screen:** Dashboard (Tổng quan)  
**Purpose:** Main hub — shows profile, priority score, room status, quick actions  
**APIs used:** `GET /mobile/dashboard`, `GET /api/student-app/registration/availability`  
**Collections:** `students`, `RoomAllocation`, `pendingApplications`, `AllocationCycle`, `notifications`  
**What to show:** Profile header with real student name, priority score, room assignment card, application card

---

### 03-allocation-timeline.png
**Screen:** Allocation Timeline (Tiến trình)  
**Purpose:** Shows student's position in the allocation pipeline  
**APIs used:** `GET /mobile/dashboard`  
**Collections:** `pendingApplications`, `RoomAllocation`, `AllocationCycle`  
**What to show:** 4-step timeline with real status, priority score hero card, cycle info

---

### 04-room-list.png
**Screen:** Room Explorer (Phòng ở)  
**Purpose:** Browse all rooms with occupancy data  
**APIs used:** `GET /mobile/rooms/explore`  
**Collections:** `dormitories`  
**What to show:** Multiple dormitory groups, room cards with occupancy bars, filter chips

---

### 05-room-detail.png
**Screen:** Room Detail  
**Purpose:** Full room info with occupancy bar and amenities  
**APIs used:** `GET /mobile/rooms/explore`  
**Collections:** `dormitories`  
**What to show:** Hero status banner, price card, occupancy bar with percentage, amenities

---

### 06-roommates.png
**Screen:** Profile → Bạn cùng phòng section  
**Purpose:** See assigned roommates with contact info  
**APIs used:** `GET /mobile/roommates`  
**Collections:** `dormitories` (occupants), `students`  
**What to show:** Roommate list with avatar letters, name, MSSV, call button

---

### 07-notifications.png
**Screen:** Notifications (Thông báo)  
**Purpose:** System notifications with category filter  
**APIs used:** `GET /mobile/notifications`  
**Collections:** `notifications`  
**What to show:** Notification list with unread items highlighted, category chips, badge count

---

### 08-maintenance-list.png
**Screen:** Maintenance List (Yêu cầu bảo trì)  
**Purpose:** Student's maintenance requests with status  
**APIs used:** `GET /mobile/maintenance/my-requests`  
**Collections:** `MaintenanceRequest`  
**What to show:** Request cards with type icon, status badge, priority indicator, FAB button

---

### 09-maintenance-detail.png
**Screen:** Maintenance New Request form  
**Purpose:** Submit a new maintenance issue  
**APIs used:** `POST /mobile/maintenance`  
**Collections:** `MaintenanceRequest`  
**What to show:** Type selection grid (icons), title/description fields, priority selector

---

### 10-profile.png
**Screen:** Profile (Hồ sơ)  
**Purpose:** Student profile with personal and academic info  
**APIs used:** `GET /mobile/profile`  
**Collections:** `students`  
**What to show:** Avatar, name, MSSV, priority score badge, personal info card, academic info card

---

### 11-qr-card.png
**Screen:** Resident Card (Thẻ cư trú)  
**Purpose:** Digital ID card with server-signed QR code  
**APIs used:** `GET /mobile/qr/generate`, `GET /mobile/dashboard`  
**Collections:** `students`, `RoomAllocation`  
**What to show:** Physical card design with QR code, student name, room info, "Đang cư trú" pill, security note

---

## Screenshot Quality Requirements

- Resolution: minimum 1080 × 1920 (portrait)
- Format: PNG, no compression artifacts
- Status bar: ideally hidden or showing clean time (12:00, full battery)
- No personal data of real students beyond what the demo account shows
- All text must be legible at 100% zoom
