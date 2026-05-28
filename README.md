# HUST Dormitory Management System

A full-stack dormitory management platform for Hanoi University of Science and Technology — with a web admin portal and a native mobile app for students.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTS                               │
│                                                          │
│  [Admin Web]     [Student Web]     [Mobile App (Expo)]  │
│  EJS templates   React SPA         React Native + TS    │
└────────┬─────────────┬───────────────────┬──────────────┘
         │             │                   │
         └─────────────┴───────────────────┘
                       │ HTTP + WebSocket
┌──────────────────────▼─────────────────────────────────┐
│                  BACKEND (Node.js + Express)             │
│                                                          │
│  Auth:     Session (web)  │  JWT + Refresh Token (mobile)│
│  Realtime: Socket.IO + Redis adapter                     │
│  Routes:   /api/student-app  (mobile-first REST API)     │
│            /admin/*          (admin portal)              │
│            /student/*        (student web SPA)           │
│  Services: allocation · notification · mobile           │
└──────────────────────┬─────────────────────────────────┘
                       │ Mongoose ODM
┌──────────────────────▼─────────────────────────────────┐
│                   MongoDB                                │
│                                                          │
│  students · dormitories · pendingApplications            │
│  AllocationCycle · RoomAllocation · AllocationPolicy     │
│  notifications · maintenance_requests · violations       │
│  MobileRefreshToken · activity_logs                      │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Node.js 18+ + Express |
| Database | MongoDB (Mongoose ODM) |
| Auth (web) | express-session + bcrypt |
| Auth (mobile) | JWT (15m access) + refresh token (30d) with rotation |
| Realtime | Socket.IO + Redis adapter |
| Mobile | React Native · Expo SDK 52 · Expo Router v4 |
| State (mobile) | Zustand + TanStack Query v5 |
| HTTP client | Axios with auto-refresh interceptor |
| Security | Helmet · express-rate-limit · express-mongo-sanitize |
| Email | Nodemailer (SMTP) |
| Logging | Winston |

---

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Redis (optional, for Socket.IO scaling)

### 1. Backend

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values

# Start development server
npm run dev
```

**Required `.env` variables:**

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/dormitory
SESSION_SECRET=your-session-secret-32-chars-min
JWT_SECRET=your-jwt-secret-32-chars-min
JWT_REFRESH_SECRET=your-refresh-secret-32-chars-min
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-app-password
```

### 2. Seed initial data

```bash
# Create admin account
node scripts/create-admin.js

# Seed sample students (for testing)
node scripts/seed-sample-students.js

# Create registration window
node scripts/create-academic-window.js
```

### 3. Mobile App

```bash
cd mobile
npm install

# Android emulator
npm run android

# iOS simulator
npm run ios
```

The mobile app auto-detects the platform and sets the API base URL:
- Android emulator: `http://10.0.2.2:5000`
- iOS simulator: `http://localhost:5000`

---

## Mobile API Reference

All mobile endpoints are prefixed `/api/student-app`.

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/mobile/login` | Login with username + password + device fingerprint |
| `POST` | `/auth/mobile/refresh` | Rotate refresh token, get new access token |
| `POST` | `/auth/mobile/logout` | Revoke refresh token |

**Login response:**
```json
{
  "success": true,
  "user": { "id", "name", "role", "studentId" },
  "accessToken": "...",
  "refreshToken": "..."
}
```

### Student (all require `Authorization: Bearer <token>`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/mobile/me` | Full student profile |
| `PATCH` | `/mobile/profile` | Update phone / email |
| `GET` | `/mobile/dashboard` | Dashboard summary (pushed via Socket.IO too) |
| `GET` | `/mobile/registration/availability` | Check if registration window is open |
| `POST` | `/student/apply` | Apply for automatic room assignment |

### Rooms & Favorites

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/mobile/rooms/explore` | All dormitories + rooms (supports `?roomType=&onlyAvailable=`) |
| `GET` | `/mobile/favorites` | Student's saved rooms |
| `POST` | `/mobile/favorites` | Save a room `{ roomId }` |
| `DELETE` | `/mobile/favorites/:roomId` | Remove from favorites |

### Notifications

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/mobile/notifications` | Notification list (`?limit=50`) |
| `POST` | `/mobile/notifications/:id/read` | Mark one as read |
| `POST` | `/mobile/notifications/read-all` | Mark all as read |

### Maintenance Requests

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/mobile/maintenance/requests` | My requests (`?status=submitted`) |
| `POST` | `/mobile/maintenance/requests` | Create request `{ type, title, description, priority }` |

**Maintenance types:** `electrical` · `plumbing` · `hvac` · `furniture` · `door_lock` · `window` · `internet` · `cleaning` · `pest_control` · `other`

### Violations & Roommates

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/mobile/violations` | Student's own violation records |
| `GET` | `/mobile/roommates` | Current roommates in assigned room |

---

## Realtime (Socket.IO)

Connect with JWT in handshake auth:
```js
io(API_BASE, { auth: { token: accessToken } })
```

| Event (server → client) | Payload | Trigger |
|--------------------------|---------|---------|
| `student:dashboard` | Full dashboard data | On connect, on allocation change |
| `allocation:result` | `{ studentId, roomNumber }` | After room assignment |
| `notification:new` | `{ count }` | When a new notification arrives |

| Event (client → server) | Action |
|--------------------------|--------|
| `student:refresh` | Force-push fresh dashboard data |

---

## Mobile App Screens

```
app/
  index.tsx               ← Session restore + redirect
  (auth)/
    login.tsx             ← Login screen
  (tabs)/
    index.tsx             ← Dashboard (profile, assignment, application, cycle)
    rooms.tsx             ← Room explorer (search, filter, favorites)
    notifications.tsx     ← Notification list (mark read, mark all)
    profile.tsx           ← Profile + roommates + menu
  room/[id].tsx           ← Room detail (occupancy, amenities, favorite)
  maintenance/
    index.tsx             ← My maintenance requests
    new.tsx               ← Create maintenance request
  violations/
    index.tsx             ← My violation records
```

---

## Business Logic

### Priority Scoring
```
Total = 35% × distance_score + 35% × financial_score + 30% × priority_level
```

### Allocation Fairness
- Year groups: year1 · year2_3 · year4_plus
- Fairness metric: max deviation ≤ 10% across groups → "BALANCED"
- Quota slots: `round(totalCapacity × percentage / 100)`

### Mobile JWT Flow
1. Login → `accessToken` (15m) + `refreshToken` (30d, hashed in DB)
2. Every request attaches `Authorization: Bearer <accessToken>`
3. On 401 → interceptor queues requests → rotates refresh token → retries
4. On refresh failure → force logout + clear SecureStore

---

## Admin Scripts

```bash
node scripts/create-admin.js                   # Create admin account
node scripts/seed-sample-students.js           # Seed test students
node scripts/seed-sample-applications.js       # Seed applications
node scripts/create-academic-window.js         # Create registration window
node scripts/generate-mock-allocation-data.js  # Generate mock allocation
npm run seed:quota-admins                      # Seed quota admin accounts
npm run migrate:remove-legacy-quota            # Remove legacy quota fields
```

---

## Project Structure

```
/
├── index.js                     ← Express app entry point
├── src/
│   ├── auth/                    ← JWT + session auth
│   ├── config/                  ← MongoDB schemas + connection
│   ├── middleware/              ← Security, rate-limit, JWT auth
│   ├── routes/
│   │   ├── admin/               ← Admin REST routes
│   │   └── student/
│   │       └── mobile-student-routes.js  ← Mobile API
│   ├── schemas/                 ← Standalone Mongoose schemas
│   ├── services/                ← Business logic
│   └── utils/                   ← Helpers
├── mobile/                      ← React Native (Expo) student app
│   ├── app/                     ← Expo Router screens
│   └── src/
│       ├── api/                 ← Axios API clients
│       ├── components/          ← UI components
│       ├── constants/           ← Colors, spacing, typography
│       ├── realtime/            ← Socket.IO hooks
│       ├── store/               ← Zustand stores
│       └── utils/               ← Helpers, scale, haptics
└── scripts/                     ← Admin/seed scripts
```

---

## Access Points (dev)

| URL | Description |
|-----|-------------|
| `http://localhost:5000` | Main web (admin + student) |
| `http://localhost:5000/admin` | Admin portal |
| `http://localhost:5000/api/student-app/*` | Mobile REST API |
| `http://localhost:5000/health` | Health check |
| `http://10.0.2.2:5000` | Backend from Android emulator |
