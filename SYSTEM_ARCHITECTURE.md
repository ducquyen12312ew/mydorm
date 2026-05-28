# System Architecture — HUST Dormitory Management System

## Overview

A mobile-first dormitory management platform with a clear role split:

| Actor | Interface | Technology |
|-------|-----------|-----------|
| Students | **Mobile app only** (iOS + Android) | React Native / Expo |
| Administrators | **Web portal only** | Node.js + EJS server-rendered |
| Public | Web landing pages | EJS templates |

This architecture decision eliminates duplicate UI work and ensures each user type gets an experience optimized for their workflow.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                 │
│                                                                  │
│  ┌─────────────────┐   ┌─────────────────┐   ┌───────────────┐  │
│  │  Admin Web      │   │  Student Mobile │   │  Public Web   │  │
│  │  (EJS + htmx)   │   │  (Expo SDK 52)  │   │  (EJS)        │  │
│  │  localhost:5000 │   │  10.0.2.2:5000  │   │  localhost:5000│  │
│  └────────┬────────┘   └────────┬────────┘   └───────┬───────┘  │
│           │                     │ HTTP + JWT           │          │
└───────────┼─────────────────────┼──────────────────────┼─────────┘
            │                     │                      │
            └─────────────────────┴──────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   BACKEND (Node.js/Express) │
                    │   Port 5000                 │
                    │                             │
                    │  ┌─────────────────────┐   │
                    │  │  Auth Layer          │   │
                    │  │  Session (web)       │   │
                    │  │  JWT 15m+30d (mobile)│   │
                    │  └─────────────────────┘   │
                    │                             │
                    │  ┌─────────────────────┐   │
                    │  │  API Routes          │   │
                    │  │  /api/student-app/*  │   │ ← Mobile API
                    │  │  /admin/*            │   │ ← Web admin
                    │  │  /student/*          │   │ ← Web student
                    │  └─────────────────────┘   │
                    │                             │
                    │  ┌─────────────────────┐   │
                    │  │  Services            │   │
                    │  │  studentMobileService│   │
                    │  │  allocationService   │   │
                    │  │  notificationHelper  │   │
                    │  └─────────────────────┘   │
                    │                             │
                    │  ┌─────────────────────┐   │
                    │  │  Socket.IO           │   │
                    │  │  (with Redis adapter)│   │
                    │  └─────────────────────┘   │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │         MONGODB              │
                    │    Dormitory database        │
                    └─────────────────────────────┘
```

---

## Mobile API Architecture

The student mobile app exclusively uses the `/api/student-app/*` prefix, all authenticated with JWT.

```
/api/student-app/
│
├── auth/
│   ├── POST mobile/login       ← JWT login (username + password + device fingerprint)
│   ├── POST mobile/refresh     ← Rotate refresh token
│   └── POST mobile/logout      ← Revoke refresh token
│
├── mobile/
│   ├── GET  me                 ← Full student profile
│   ├── PATCH profile           ← Update phone / email
│   ├── GET  dashboard          ← Unified dashboard data
│   ├── GET  rooms/explore      ← Room list with filters
│   ├── GET/POST/DELETE favorites ← Favorite rooms
│   ├── GET  notifications      ← Notification list (with category)
│   ├── POST notifications/:id/read  ← Mark one read
│   ├── POST notifications/read-all  ← Bulk mark all read
│   ├── GET/POST maintenance/requests ← Maintenance CRUD
│   ├── GET  maintenance/requests/:id ← Maintenance detail
│   ├── GET  registration/availability ← Is registration open?
│   ├── POST applications/score-preview ← Priority score preview
│   ├── GET  roommates          ← Current roommates
│   ├── GET  violations         ← Student's own violations
│   ├── POST qr/token           ← Generate signed QR token
│   └── GET  qr/verify          ← Verify QR token (scanner)
│
└── student/
    └── POST apply              ← Apply for automatic room assignment
```

---

## Backend Module Structure

```
src/
├── routes/
│   ├── student/
│   │   ├── mobile/               ← Mobile API (modular, ≤130 lines each)
│   │   │   ├── index.js          ← Assembler (20 lines)
│   │   │   ├── utils.js          ← Shared middleware helpers
│   │   │   ├── auth.routes.js    ← Authentication endpoints
│   │   │   ├── profile.routes.js ← Profile, violations, roommates
│   │   │   ├── room.routes.js    ← Rooms, favorites
│   │   │   ├── notification.routes.js ← Notifications
│   │   │   ├── maintenance.routes.js  ← Maintenance requests
│   │   │   ├── allocation.routes.js   ← Dashboard, registration, apply
│   │   │   └── qr.routes.js     ← QR token generation + verification
│   │   └── mobile-student-routes.js  ← 2-line entry delegator
│   └── admin/                    ← Admin web routes
├── services/
│   ├── studentMobileService.js   ← Unified mobile data queries
│   ├── allocationService.js      ← Allocation engine
│   └── notificationService.js    ← Email + push notifications
├── schemas/
│   ├── MaintenanceRequestSchema.js
│   ├── ViolationSchema.js
│   ├── AllocationCycleSchema.js
│   └── RoomAllocationSchema.js
├── auth/
│   └── mobileTokenService.js     ← JWT issue, rotate, revoke
├── middleware/
│   └── mobileJwtAuth.js          ← requireMobileJwt middleware
└── utils/
    └── mobileResponse.js         ← Centralized response helpers
```

---

## Mobile App Structure

```
mobile/
├── app/                          ← Expo Router screens (file-based routing)
│   ├── _layout.tsx               ← Root: providers + stack config
│   ├── index.tsx                 ← Session restore + redirect
│   ├── (auth)/
│   │   └── login.tsx             ← Login screen
│   ├── (tabs)/
│   │   ├── _layout.tsx           ← Tab navigator + socket init
│   │   ├── index.tsx             ← Dashboard
│   │   ├── rooms.tsx             ← Room explorer
│   │   ├── notifications.tsx     ← Notification center
│   │   └── profile.tsx           ← Profile + menu
│   ├── room/[id].tsx             ← Room detail
│   ├── allocation/index.tsx      ← Allocation timeline
│   ├── card/index.tsx            ← QR resident card
│   ├── maintenance/
│   │   ├── index.tsx             ← My requests list
│   │   ├── [id].tsx              ← Request detail
│   │   └── new.tsx               ← Create request form
│   └── violations/index.tsx      ← Violation records
└── src/
    ├── api/                      ← Axios API clients (one file per domain)
    │   ├── client.ts             ← Axios instance + 401 interceptor + refresh queue
    │   ├── auth.ts               ← Login, logout
    │   ├── dashboard.ts          ← Dashboard, profile
    │   ├── rooms.ts              ← Rooms, favorites
    │   ├── notifications.ts      ← Notifications
    │   ├── maintenance.ts        ← Maintenance requests
    │   ├── registration.ts       ← Registration availability, apply
    │   ├── violations.ts         ← Violations, roommates, profile update
    │   └── qr.ts                 ← QR token generation
    ├── components/
    │   ├── SafeLayout.tsx        ← Safe area aware container
    │   ├── ScreenHeader.tsx      ← Reusable header with back + right slot
    │   └── ui/
    │       ├── Button.tsx        ← Variants: primary, secondary, outline, danger, ghost
    │       ├── Card.tsx          ← Surface container with padding + shadow options
    │       ├── Badge.tsx         ← Status badge (pending/approved/rejected/...)
    │       ├── EmptyState.tsx    ← Empty screen placeholder with icon
    │       ├── LoadingSpinner.tsx ← Full-screen loading
    │       ├── Skeleton.tsx      ← Loading skeleton (pulse animation)
    │       └── Timeline.tsx      ← Reusable vertical timeline (5 states)
    ├── constants/
    │   ├── colors.ts             ← Color palette (matches web branding #d63031)
    │   ├── spacing.ts            ← Spacing scale, border radii, shadows
    │   ├── typography.ts         ← Font sizes (scaled), font weights
    │   └── query.ts              ← TanStack Query time constants
    ├── realtime/
    │   ├── socket.ts             ← Socket.IO connect/disconnect/emit
    │   └── useSocketEvents.ts    ← useStudentSocket hook (dashboard push + notifications)
    ├── store/
    │   └── authStore.ts          ← Zustand auth store (login/logout/restoreSession)
    └── utils/
        ├── scale.ts              ← sw(), sh(), sf() responsive scaling
        ├── haptics.ts            ← Haptic feedback (light/medium/heavy/success/warning)
        ├── format.ts             ← Date/currency/status label formatters
        └── device.ts             ← Device ID + fingerprint generation
```

---

## Data Flow: Dashboard (Normal Read)

```
┌──────────────┐   1. queryFn: fetchDashboard()
│   Dashboard  │──────────────────────────────────► GET /mobile/dashboard
│   Screen     │                                         │
│              │◄────────────────────────────────── 200 { profile, application,
│              │   5. React re-renders                    assignment, cycle, notifications }
└──────────────┘                                         │
       ▲                                                  │
       │ 4. setQueryData(['dashboard'], data)             ▼
  ┌────┴─────┐   2. Socket.IO connected         ┌─────────────────┐
  │ TanStack │◄─────────────────────────────────│   Socket.IO      │
  │  Query   │   3. 'student:dashboard' event   │   Server Push    │
  │  Cache   │   (instant, no HTTP round-trip)  └─────────────────┘
  └──────────┘
```

---

## Data Flow: JWT Authentication

```
Login Request
     │
     ▼
POST /auth/mobile/login
{ username, password, deviceId, fingerprint }
     │
     ▼
bcrypt.compare(password, student.hash)
     │ OK
     ▼
issueMobileTokens(student, context)
  └─ accessToken  (JWT, 15min)
  └─ refreshToken (hashed, stored in MobileRefreshToken collection, 30 days)
     │
     ▼
SecureStore.setItemAsync('mobile_access_token', accessToken)
SecureStore.setItemAsync('mobile_refresh_token', refreshToken)

─────────────────────────────────────────────────────────────

On API request:
Authorization: Bearer <accessToken>
     │
     ▼
requireMobileJwt middleware
  └─ Verify HMAC-SHA256 signature
  └─ Check exp claim
  └─ Attach req.mobileAuth = { userId }

─────────────────────────────────────────────────────────────

On 401 (access token expired):
     │
     ▼
Axios interceptor
  └─ isRefreshing = true
  └─ Queue concurrent requests in refreshQueue[]
  └─ POST /auth/mobile/refresh { refreshToken, deviceId, fingerprint }
       │
       ▼
  rotateRefreshToken()
  └─ Verify old token against hashed value
  └─ Issue new accessToken + refreshToken pair
  └─ Invalidate old refresh token
       │
       ▼
  Drain refreshQueue with new token
  Retry original request

─────────────────────────────────────────────────────────────

On refresh failure (revoked / expired):
     │
     ▼
TokenStore.clear()
forceReset() → Zustand auth state → redirect to login
```

---

## Realtime Architecture

```
Mobile App                     Backend
    │                              │
    │── connectSocket() ──────────►│
    │   auth: { token: accessToken }│
    │                              │
    │◄── 'student:dashboard' ──────│ (on connect)
    │    Full dashboard payload     │
    │    queryClient.setQueryData() │
    │                              │
    │── 'student:refresh' ────────►│ (manual pull)
    │◄── 'student:dashboard' ──────│
    │                              │
    │◄── 'notification:new' ───────│ (new notification)
    │    queryClient.invalidate()  │
    │                              │
    │◄── 'allocation:result' ──────│ (room assigned)
    │    queryClient.invalidate()  │

App enters background → socket disconnected
App returns to foreground → socket reconnected
                          → stale queries invalidated
```

---

## Key MongoDB Collections

| Collection | Purpose | Key Fields |
|-----------|---------|-----------|
| `students` | User accounts | `username`, `password` (bcrypt), `role`, `priorityScore`, `dormitoryId`, `roomNumber`, `favoriteRoomIds` |
| `dormitories` | Buildings with embedded floors → rooms → occupants | `floors[].rooms[].occupants[]` (embedded) |
| `pendingApplications` | Registration applications | `studentId`, `status`, `priorityScore` |
| `AllocationCycle` | Allocation periods | `name`, `status`, `registrationStart/End` |
| `RoomAllocation` | Student-to-room assignments | `studentId`, `roomNumber`, `status: ACTIVE` |
| `notifications` | System notifications | `type` (visual), `category` (semantic), `readBy[]`, `targetRole` |
| `maintenance_requests` | Maintenance tickets | `reportedBy`, `assignedTo`, `status`, `updates[]` |
| `violations` | Student disciplinary records | `studentId`, `type`, `severity`, `status` |
| `MobileRefreshToken` | JWT refresh token store | `tokenHash`, `deviceId`, `expiresAt`, `revokedAt` |

---

## Security Architecture

See [SECURITY_NOTES.md](./SECURITY_NOTES.md) for detailed security implementation.

## Performance Architecture

See [PERFORMANCE_NOTES.md](./PERFORMANCE_NOTES.md) for optimization decisions.

## UX Design Rationale

See [MOBILE_UX_DECISIONS.md](./MOBILE_UX_DECISIONS.md) for design decisions.
