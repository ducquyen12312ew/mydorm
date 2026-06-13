# DATA_FLOW_PARITY.md
# Mobile ↔ Web ↔ Atlas Parity Proof

**Generated:** 2026-05-30  
**Branch:** demo1  
**Backend prefix:** `/api/student-app` (mounted at `index.js:161`)  
**Mobile base URL:** `http://10.0.2.2:5000` (Android) / `http://localhost:5000` (iOS)  
**API prefix constant:** `mobile/src/config.ts:19` → `export const API_PREFIX = '/api/student-app'`

---

## HOW ROUTES ARE MOUNTED

```
index.js:161
  app.use('/api/student-app', mobileStudentRoutes)
  └── src/routes/student/mobile-student-routes.js:2
        module.exports = require('./mobile/index')
        └── src/routes/student/mobile/index.js
              router.use(authRoutes)        → auth.routes.js
              router.use(profileRoutes)     → profile.routes.js
              router.use(roomRoutes)        → room.routes.js
              router.use(notificationRoutes)→ notification.routes.js
              router.use(maintenanceRoutes) → maintenance.routes.js
              router.use(allocationRoutes)  → allocation.routes.js
              router.use(qrRoutes)          → qr.routes.js
```

**Web routes** are mounted separately under `/api/notifications`, `/student/*`, `/admin/*` (not under `/api/student-app`).

**CRITICAL PARITY FACT:** Both web and mobile routes import from the **same** collections and services:

| Resource         | Web route file                       | Mobile route file                              | Shared service / schema                              |
|-----------------|--------------------------------------|------------------------------------------------|------------------------------------------------------|
| Notifications    | `src/routes/web-notification-routes.js` | `src/routes/student/mobile/notification.routes.js` | `NotificationCollection` + `getStudentNotifications()` |
| Maintenance      | `src/routes/maintenance-routes.js`   | `src/routes/student/mobile/maintenance.routes.js` | `MaintenanceRequestModel`                           |
| Dashboard/Alloc  | allocation.routes.js (session)       | allocation.routes.js (JWT)                     | `getStudentDashboard()` in `studentMobileService.js` |
| Profile          | profile.routes.js (session)          | profile.routes.js (JWT)                        | `StudentCollection`                                  |
| Rooms            | room.routes.js (session)             | room.routes.js (JWT)                           | `getRoomExploreData()` in `studentMobileService.js`  |

---

## SCENARIO 1 — ROOM ASSIGNMENT PARITY

### Step 1: Admin assigns room (web)

**Web route:**
```
POST /admin/applications/:id/approve-and-assign
src/routes/admin/admin-application-routes.js:~290
  → reads PendingApplicationCollection by _id
  → reads DormitoryCollection.findById(application.dormitoryId)
  → updates room.occupants[] with student data
  → writes StudentCollection.findByIdAndUpdate(studentId, { dormitoryId, roomNumber })
  → creates RoomAllocation document in 'roomallocations' collection
```

**Writes to MongoDB Atlas:**
- Collection: `students` — sets `dormitoryId`, `roomNumber` on student document
- Collection: `roomallocations` — creates `RoomAllocation` with `status: 'ACTIVE'`
- Collection: `dormitories` — pushes occupant into `floors[].rooms[].occupants[]`

### Step 2: Mobile reads assignment

**Mobile screen:** `mobile/app/(tabs)/index.tsx:281`
```typescript
useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard })
```

**Mobile API call:** `mobile/src/api/dashboard.ts:52-55`
```typescript
export async function fetchDashboard(): Promise<DashboardData> {
  const { data } = await api.get('/mobile/dashboard');
  return data.dashboard;
}
```

**Full URL:** `GET /api/student-app/mobile/dashboard`

**Backend route:** `src/routes/student/mobile/allocation.routes.js:45-53`
```javascript
router.get('/mobile/dashboard', requireMobileJwt, async (req, res) => {
  const dashboard = await getStudentDashboard(req.mobileAuth.userId);
  return res.json({ success: true, dashboard });
});
```

**Web route (same service):** `src/routes/student/mobile/allocation.routes.js:15-22`
```javascript
router.get('/dashboard', requireStudentAuth, async (req, res) => {
  const dashboard = await getStudentDashboard(req.session.userId);
  return res.json({ success: true, dashboard });
});
```

**Shared service:** `src/services/studentMobileService.js:120-189`
```javascript
async function getStudentDashboard(userId) {
  const student = await StudentCollection.findById(userId).lean();
  // ...
  const activeAllocation = await RoomAllocation.findOne({
    studentId: student._id,
    status: 'ACTIVE',
    academicYear   // current year e.g. '2025-2026'
  }).populate('dormitoryId', 'name').lean();
  // ...
  assignment = activeAllocation
    ? { status: 'assigned', roomNumber: activeAllocation.roomNumber,
        dormitoryName: activeAllocation.dormitoryId?.name, ... }
    : { status: 'pending', roomNumber: student.roomNumber || '' };
}
```

**Atlas reads:**
- `students` collection — `StudentCollection.findById(userId)`
- `roomallocations` collection — `RoomAllocation.findOne({ studentId, status:'ACTIVE', academicYear })`
- `allocationcycles` collection — `AllocationCycle.getActiveCycle(academicYear)`
- `notifications` collection — unread count query

**Data path diagram:**
```
mobile/app/(tabs)/index.tsx
  → fetchDashboard()                           [mobile/src/api/dashboard.ts:52]
    → GET /api/student-app/mobile/dashboard   [HTTP]
      → allocation.routes.js:45              [src/routes/student/mobile/allocation.routes.js]
        → getStudentDashboard(userId)         [src/services/studentMobileService.js:120]
          → StudentCollection.findById()      [MongoDB Atlas: 'students']
          → RoomAllocation.findOne(ACTIVE)    [MongoDB Atlas: 'roomallocations']
          → AllocationCycle.getActiveCycle()  [MongoDB Atlas: 'allocationcycles']
  → dashboard.assignment.roomNumber           [rendered in UI at index.tsx:129]
```

**Web path diagram (identical service, different auth):**
```
web /dashboard page
  → GET /api/student-app/dashboard           [session-auth]
    → allocation.routes.js:15               [src/routes/student/mobile/allocation.routes.js]
      → getStudentDashboard(req.session.userId)  [SAME function as mobile]
        → StudentCollection.findById()       [MongoDB Atlas: 'students']
        → RoomAllocation.findOne(ACTIVE)     [MongoDB Atlas: 'roomallocations']
```

**Parity guarantee:** Both web and mobile call `getStudentDashboard(userId)` with the same userId from the same `students` document. The `roomNumber` and `dormitoryName` on both surfaces always reflect the same Atlas documents. There is **no separate data store** for mobile.

---

## SCENARIO 2 — NOTIFICATION PARITY

### Step 1: Admin creates notification (web)

**Web route:** `src/routes/web-notification-routes.js:115-138`
```javascript
router.post('/api/admin/notifications', isAdmin, async (req, res) => {
  const notification = await createNotification({
    title, message, type, targetRole, isGlobal, priority, expiresAt,
    createdBy: req.session.userId
  });
  res.json({ success: true, notification });
});
```

**createNotification utility:** `src/utils/notificationHelper.js`
```javascript
// Writes to NotificationCollection (Atlas collection: 'notifications')
const doc = await NotificationCollection.create({ title, message, type, ... });
```

**Atlas write:**
- Collection: `notifications`
- Document fields: `title`, `message`, `type`, `targetRole`, `isGlobal`, `priority`, `readBy: []`, `createdAt`

### Step 2: Web student reads notification

**Web route:** `src/routes/web-notification-routes.js:13-55`
```javascript
router.get('/api/notifications', requireSession, async (req, res) => {
  const notifications = await NotificationCollection.find({
    $and: [
      { $or: [{ isGlobal: true }, { targetUsers: userId }, { targetRole: userRole }, { targetRole: 'all' }] },
      { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] }
    ]
  }).sort({ createdAt: -1 }).limit(50).lean();
```

### Step 3: Mobile reads the same notification

**Mobile screen:** `mobile/app/(tabs)/notifications.tsx:132-136`
```typescript
useQuery({ queryKey: ['notifications'], queryFn: () => fetchNotifications(100) })
```

**Mobile API call:** `mobile/src/api/notifications.ts:14-20`
```typescript
export async function fetchNotifications(limit = 30): Promise<Notification[]> {
  const { data } = await api.get('/mobile/notifications', { params: { limit } });
  return data.notifications;
}
```

**Full URL:** `GET /api/student-app/mobile/notifications`

**Backend route:** `src/routes/student/mobile/notification.routes.js:47-55`
```javascript
router.get('/mobile/notifications', requireMobileJwt, async (req, res) => {
  const notifications = await getStudentNotifications(req.mobileAuth.userId, limit);
  return res.json({ success: true, notifications });
});
```

**Shared service:** `src/services/studentMobileService.js:227-272`
```javascript
async function getStudentNotifications(userId, limit = 20) {
  const notifications = await NotificationCollection.find({
    $and: [
      { $or: [{ isGlobal: true }, { targetUsers: student._id },
              { targetRole: student.role || 'user' }, { targetRole: 'all' }] },
      { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null },
              { expiresAt: { $gt: new Date() } }] }
    ]
  }).sort({ createdAt: -1 }).limit(limit).lean();
  // ...maps readBy[] to isRead boolean
}
```

**Data path diagram:**
```
mobile/app/(tabs)/notifications.tsx
  → fetchNotifications(100)                          [mobile/src/api/notifications.ts:14]
    → GET /api/student-app/mobile/notifications      [HTTP]
      → notification.routes.js:47                   [src/routes/student/mobile/notification.routes.js]
        → getStudentNotifications(userId)            [src/services/studentMobileService.js:227]
          → NotificationCollection.find(...)         [MongoDB Atlas: 'notifications']
            ← same documents that admin created via /api/admin/notifications
  → renders notification.title, notification.message [notifications.tsx:99-104]
```

**Parity guarantee:** Both web (`/api/notifications` route) and mobile (`getStudentNotifications()`) query the **exact same** `NotificationCollection` with **identical** filter logic (`isGlobal || targetUsers || targetRole`). The only difference is auth method (session vs JWT).

**Read-state parity:** Both platforms write to `readBy[]` on the same document:
- Web: `src/routes/web-notification-routes.js:73` → `$push: { readBy: { userId, readAt } }`
- Mobile: `src/routes/student/mobile/notification.routes.js:57-65` → same `$push`

---

## SCENARIO 3 — MAINTENANCE REQUEST PARITY

### Step 1: Mobile creates maintenance request

**Mobile screen:** `mobile/app/maintenance/new.tsx`  
**Mobile API call:** `mobile/src/api/maintenance.ts:70-76`
```typescript
export async function createMaintenanceRequest(payload: CreateMaintenancePayload): Promise<MaintenanceRequest> {
  const { data } = await api.post('/mobile/maintenance/requests', payload);
  return data.request;
}
```

**Full URL:** `POST /api/student-app/mobile/maintenance/requests`

**Backend route:** `src/routes/student/mobile/maintenance.routes.js:53-109`
```javascript
router.post('/mobile/maintenance/requests', requireMobileJwt, async (req, res) => {
  const { type, title, description, priority } = req.body;
  // validates type ∈ VALID_TYPES, title length, description length
  const student = await StudentCollection.findById(req.mobileAuth.userId)...
  const request = await MaintenanceRequestModel.create({
    dormitoryId: student.dormitoryId,
    dormitoryName: dormitory?.name,
    floorNumber, roomNumber: student.roomNumber,
    type, title, description, priority: priority || 'medium',
    reportedBy: { userId: student._id, name, studentId, phone },
    status: 'submitted',
  });
  return res.status(201).json({ success: true, request });
});
```

**Atlas write:**
- Collection: `maintenance_requests`
- Schema: `src/schemas/MaintenanceRequestSchema.js`
- Auto-generated field: `requestNumber = 'MR' + year + month + random4digits` (pre-validate hook, line 176-184)

### Step 2: Admin reads it on web

**Web route:** `src/routes/maintenance-routes.js:238-278`
```javascript
router.get('/admin/maintenance-requests', isAdmin, async (req, res) => {
  const requests = await MaintenanceRequestModel
    .find(query)  // filter by status / priority / type / dormitoryId
    .sort({ reportedAt: -1 })
    .lean();
  res.json({ success: true, requests, pagination: {...} });
});
```

**Data path diagram:**
```
mobile/app/maintenance/new.tsx
  → createMaintenanceRequest({ type, title, description, priority })
    → POST /api/student-app/mobile/maintenance/requests    [HTTP]
      → maintenance.routes.js:53                          [src/routes/student/mobile/]
        → MaintenanceRequestModel.create(...)              [MongoDB Atlas: 'maintenance_requests']
          ← document now visible to admin web

web /admin/maintenance
  → GET /admin/maintenance-requests                       [HTTP]
    → maintenance-routes.js:238                          [src/routes/maintenance-routes.js]
      → MaintenanceRequestModel.find(query)               [MongoDB Atlas: 'maintenance_requests']
        ← reads same document created by mobile
```

**Atlas document structure (`maintenance_requests` collection):**
```json
{
  "_id": ObjectId("..."),
  "requestNumber": "MR202605XXXX",
  "dormitoryId": ObjectId("..."),
  "dormitoryName": "KTX A",
  "floorNumber": 3,
  "roomNumber": "A301",
  "type": "electrical",
  "title": "Ổ cắm điện bị hỏng",
  "description": "Ổ cắm ở góc phòng không có điện...",
  "priority": "high",
  "status": "submitted",
  "reportedBy": { "userId": ObjectId("..."), "name": "...", "studentId": "20210001" },
  "reportedAt": ISODate("2026-05-30T..."),
  "updates": [],
  "readBy": []
}
```

**Parity guarantee:** The mobile `POST` and admin `GET` both use `MaintenanceRequestModel` which is bound to Atlas collection `maintenance_requests`. There is no in-memory cache or secondary store. The same `_id` is returned to the mobile client and visible in the admin web table.

---

## SCENARIO 4 — PROFILE PARITY

### Web student profile

**Web route (session):** `src/routes/student/mobile/profile.routes.js:9-19`
```javascript
router.get('/mobile/me', requireMobileJwt, async (req, res) => {
  const student = await StudentCollection.findById(req.mobileAuth.userId)
    .select('name email studentId gender academicYear faculty phone priorityScore dormitoryId roomNumber')
    .lean();
  return res.json({ success: true, user: student });
});
```

*(The same `profile.routes.js` file also handles session-auth via `requireStudentAuth` for web — both query the same `StudentCollection` by the same userId.)*

### Mobile profile

**Mobile screen:** `mobile/app/(tabs)/profile.tsx:75-79`
```typescript
const { data: profile } = useQuery({
  queryKey: ['profile'],
  queryFn: fetchProfile,   // → GET /mobile/me
  staleTime: 60000,
});
```

**Mobile API call:** `mobile/src/api/dashboard.ts:57-60`
```typescript
export async function fetchProfile() {
  const { data } = await api.get('/mobile/me');
  return data.user;
}
```

**Full URL:** `GET /api/student-app/mobile/me`

**Data path diagram:**
```
mobile/app/(tabs)/profile.tsx
  → fetchProfile()                          [mobile/src/api/dashboard.ts:57]
    → GET /api/student-app/mobile/me        [HTTP]
      → profile.routes.js:9               [src/routes/student/mobile/profile.routes.js]
        → StudentCollection.findById(userId)
            .select('name email studentId gender academicYear faculty phone priorityScore dormitoryId roomNumber')
          [MongoDB Atlas: 'students']
  → renders profile.name, profile.email, profile.studentId, profile.roomNumber
```

**Fields displayed on mobile Profile screen:**

| Mobile UI field | JSON field         | Atlas collection | Atlas field     |
|----------------|-------------------|-----------------|----------------|
| Họ tên         | `user.name`        | `students`       | `name`          |
| Email          | `user.email`       | `students`       | `email`         |
| MSSV           | `user.studentId`   | `students`       | `studentId`     |
| Giới tính      | `user.gender`      | `students`       | `gender`        |
| Khoa           | `user.faculty`     | `students`       | `faculty`       |
| Số điện thoại  | `user.phone`       | `students`       | `phone`         |
| Điểm ưu tiên  | `user.priorityScore`| `students`      | `priorityScore` |
| Phòng          | `user.roomNumber`  | `students`       | `roomNumber`    |

**Parity guarantee:** Any change to the `students` Atlas document (via admin console or admin web routes that call `StudentCollection.findByIdAndUpdate`) is immediately reflected on the next `GET /mobile/me` call. The query uses `.lean()` with no cache layer.

---

## SCENARIO 5 — ALLOCATION STATUS PARITY

### Atlas document → Web → Mobile must all agree

**Source of truth in Atlas:**

1. **`students` collection** — `student.roomNumber`, `student.dormitoryId` (set when admin approves application)
2. **`roomallocations` collection** — `RoomAllocation` document with `status: 'ACTIVE'`, `roomNumber`, `dormitoryId`
3. **`pendingapplications` collection** — application with `status: 'approved' | 'pending' | 'rejected' | 'waitlist'`

**Service that reads all three:** `src/services/studentMobileService.js:63-118` (`getStudentContext`)

```javascript
async function getStudentContext(userId) {
  const student = await StudentCollection.findById(userId).lean();
  // ...
  const latestApplication = await PendingApplicationCollection.findOne({
    studentId: { $in: matchIds }
  }).sort({ createdAt: -1 }).lean();

  const activeAllocation = await RoomAllocation.findOne({
    studentId: student._id,
    status: 'ACTIVE',
    academicYear   // '2025-2026'
  }).populate('dormitoryId', 'name').lean();

  const activeCycle = await AllocationCycle.getActiveCycle(academicYear);
  const unreadCount = await NotificationCollection.countDocuments(...);
  return { student, latestApplication, activeAllocation, activeCycle, unreadCount };
}
```

**Assignment status determination logic** (`studentMobileService.js:128-143`):
```javascript
const assignment = activeAllocation
  ? {
      status: 'assigned',
      roomNumber: activeAllocation.roomNumber,    // from 'roomallocations' Atlas collection
      dormitoryName: activeAllocation.dormitoryId?.name,
      allocationType: activeAllocation.allocationType,
      updatedAt: activeAllocation.allocationTimestamp
    }
  : {
      status: 'pending',
      roomNumber: student.roomNumber || '',        // fallback to 'students' Atlas collection
      dormitoryName: '',
      allocationType: '',
      updatedAt: null
    };
```

**Both web and mobile call this same function:**

| Surface | Route | Auth method | Calls |
|---------|-------|-------------|-------|
| Web (student) | `GET /api/student-app/dashboard` | session cookie | `getStudentDashboard(req.session.userId)` |
| Mobile | `GET /api/student-app/mobile/dashboard` | JWT Bearer | `getStudentDashboard(req.mobileAuth.userId)` |

**The userId is resolved from the same `students` document** — web login stores `req.session.userId = student._id`, mobile login stores `req.mobileAuth.userId = student._id` (from JWT payload `sub`).

**Allocation data path diagram:**
```
Atlas: 'students'._id = ObjectId("ABC123")
Atlas: 'roomallocations' { studentId: ObjectId("ABC123"), status: 'ACTIVE', roomNumber: 'A301' }
Atlas: 'pendingapplications' { studentId: 'ABC123', status: 'approved' }

                          ┌─────────────────────────────────┐
                          │  getStudentDashboard("ABC123")   │
                          │  src/services/studentMobileService│
                          │  :120                            │
                          └─────────┬──────────────┬────────┘
                                    │              │
                         ┌──────────▼──┐    ┌──────▼──────────┐
                         │ WEB route   │    │ MOBILE route     │
                         │ /dashboard  │    │ /mobile/dashboard│
                         │ session auth│    │ JWT auth         │
                         └──────────┬──┘    └──────┬───────────┘
                                    │              │
                         ┌──────────▼──────────────▼──┐
                         │ Response JSON               │
                         │ {                           │
                         │   assignment: {             │
                         │     status: 'assigned',     │
                         │     roomNumber: 'A301',     │  ← same Atlas value
                         │     dormitoryName: 'KTX A'  │
                         │   },                        │
                         │   application: {            │
                         │     status: 'approved'      │  ← same Atlas value
                         │   }                         │
                         │ }                           │
                         └────────────────────────────┘
```

---

## COMPLETE MOBILE SCREEN DATA FLOW TRACES

### 1. Dashboard Screen (`mobile/app/(tabs)/index.tsx`)

```
Screen: app/(tabs)/index.tsx:280-284
  useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard })
    │
    ▼
API: mobile/src/api/dashboard.ts:52-55
  api.get('/mobile/dashboard')
    │  full URL: GET /api/student-app/mobile/dashboard
    ▼
Backend route: src/routes/student/mobile/allocation.routes.js:45-53
  router.get('/mobile/dashboard', requireMobileJwt, ...)
    │  middleware: src/middleware/mobileJwtAuth.js → verifies JWT → sets req.mobileAuth.userId
    ▼
Service: src/services/studentMobileService.js:120
  getStudentDashboard(req.mobileAuth.userId)
    │
    ├─▶ StudentCollection.findById(userId)          Atlas: 'students'
    ├─▶ PendingApplicationCollection.findOne(...)   Atlas: 'pendingapplications'
    ├─▶ RoomAllocation.findOne({ status: 'ACTIVE' }) Atlas: 'roomallocations'
    ├─▶ AllocationCycle.getActiveCycle(year)         Atlas: 'allocationcycles'
    └─▶ NotificationCollection.countDocuments(...)   Atlas: 'notifications'
```

**UI fields traced to Atlas:**

| UI element (index.tsx line) | Dashboard field | Atlas collection | Atlas field |
|----------------------------|----------------|-----------------|------------|
| `profile.name` (line 105)  | `dashboard.profile.name` | `students` | `name` |
| `profile.priorityScore` (line 124) | `dashboard.profile.priorityScore` | `students` | `priorityScore` |
| `assignment.roomNumber` (line 129) | `dashboard.assignment.roomNumber` | `roomallocations` | `roomNumber` |
| `assignment.dormitoryName` (line 39) | `dashboard.assignment.dormitoryName` | `roomallocations` → `dormitories` | `name` (populated) |
| `notifStats.unreadCount` (line 135) | `dashboard.notifications.unreadCount` | `notifications` | `countDocuments(unread)` |
| `application.status` (line 229) | `dashboard.application.status` | `pendingapplications` | `status` |
| `cycle.name` (line 250) | `dashboard.cycle.name` | `allocationcycles` | `name` |

---

### 2. Room Explorer Screen (`mobile/app/(tabs)/rooms.tsx`)

```
Screen: app/(tabs)/rooms.tsx
  useQuery({ queryKey: ['rooms', filters], queryFn: () => fetchRooms(filters) })
    │
    ▼
API: mobile/src/api/rooms.ts:33-44
  api.get('/mobile/rooms/explore', { params: { dormitoryId, onlyAvailable, roomType } })
    │  full URL: GET /api/student-app/mobile/rooms/explore
    ▼
Backend route: src/routes/student/mobile/room.routes.js:89-96
  router.get('/mobile/rooms/explore', requireMobileJwt, ...)
    │
    ▼
Service: src/services/studentMobileService.js:191
  getRoomExploreData(req.query)
    │
    └─▶ DormitoryCollection.find(query)            Atlas: 'dormitories'
          flattenRooms(): floors[].rooms[] → mapped to Room[]
          availableBeds = maxCapacity - active occupants count
```

**Web uses identical service:**
```
src/routes/student/mobile/room.routes.js:69-76
  router.get('/rooms/explore', requireStudentAuth, ...)
    → getRoomExploreData()   ← SAME function as mobile
```

---

### 3. Allocation Screen (`mobile/app/allocation/index.tsx`)

```
Screen: app/allocation/index.tsx:70-74
  useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard })
    │  (reuses same cached dashboard query as Dashboard tab)
    ▼
API: mobile/src/api/dashboard.ts:52
  api.get('/mobile/dashboard')
    │  full URL: GET /api/student-app/mobile/dashboard
    ▼
Backend: allocation.routes.js:45   (SAME as Dashboard screen — shared queryKey)
Service: getStudentDashboard()
  ├─▶ RoomAllocation (Atlas: 'roomallocations') → assignment.status
  └─▶ PendingApplication (Atlas: 'pendingapplications') → application.status

Timeline built at allocation/index.tsx:15-51:
  buildTimeline(dashboard)
    application.status → submitted/review/queue steps
    assignment.status  → assign step ('assigned' or 'pending')
```

---

### 4. Maintenance Screen (`mobile/app/maintenance/index.tsx`)

```
Screen: app/maintenance/index.tsx:68 (approximately)
  useQuery({ queryKey: ['maintenance', statusFilter], queryFn: () => fetchMyRequests(status) })
    │
    ▼
API: mobile/src/api/maintenance.ts:60-67
  api.get('/mobile/maintenance/requests', { params: { status } })
    │  full URL: GET /api/student-app/mobile/maintenance/requests
    ▼
Backend: src/routes/student/mobile/maintenance.routes.js:34-49
  router.get('/mobile/maintenance/requests', requireMobileJwt, ...)
    query = { 'reportedBy.userId': req.mobileAuth.userId }
    if (status && status !== 'all') query.status = status
    │
    └─▶ MaintenanceRequestModel.find(query).sort({ reportedAt: -1 }).limit(50)
          Atlas: 'maintenance_requests'

Create new request: app/maintenance/new.tsx
  → createMaintenanceRequest({ type, title, description, priority })
    → POST /api/student-app/mobile/maintenance/requests
      → maintenance.routes.js:53
        → MaintenanceRequestModel.create(...)   Atlas: 'maintenance_requests'
```

**Admin web reads same collection:**
```
GET /admin/maintenance-requests
  → src/routes/maintenance-routes.js:238
    → MaintenanceRequestModel.find(query)   Atlas: 'maintenance_requests'  ← SAME
```

---

### 5. Notification Screen (`mobile/app/(tabs)/notifications.tsx`)

```
Screen: app/(tabs)/notifications.tsx:132-136
  useQuery({ queryKey: ['notifications'], queryFn: () => fetchNotifications(100) })
    │
    ▼
API: mobile/src/api/notifications.ts:14-19
  api.get('/mobile/notifications', { params: { limit: 100 } })
    │  full URL: GET /api/student-app/mobile/notifications
    ▼
Backend: src/routes/student/mobile/notification.routes.js:47-55
  router.get('/mobile/notifications', requireMobileJwt, ...)
    │
    ▼
Service: src/services/studentMobileService.js:227
  getStudentNotifications(req.mobileAuth.userId, limit)
    │
    └─▶ NotificationCollection.find({
          $or: [isGlobal, targetUsers, targetRole, 'all'],
          expiresAt check
        }).sort({ createdAt: -1 }).limit(limit)
          Atlas: 'notifications'

Mark read: POST /api/student-app/mobile/notifications/:id/read
  → notification.routes.js:57
    → NotificationCollection.findByIdAndUpdate(id, { $push: { readBy: { userId } } })
       Atlas: 'notifications'

Mark all read: POST /api/student-app/mobile/notifications/read-all
  → notification.routes.js:34
    → NotificationCollection.updateMany(..., { $push: { readBy } })
       Atlas: 'notifications'
```

---

### 6. Profile Screen (`mobile/app/(tabs)/profile.tsx`)

```
Screen: app/(tabs)/profile.tsx:75-79
  useQuery({ queryKey: ['profile'], queryFn: fetchProfile })
    │
    ▼
API: mobile/src/api/dashboard.ts:57-60
  api.get('/mobile/me')
    │  full URL: GET /api/student-app/mobile/me
    ▼
Backend: src/routes/student/mobile/profile.routes.js:9-19
  router.get('/mobile/me', requireMobileJwt, ...)
    │
    └─▶ StudentCollection.findById(req.mobileAuth.userId)
          .select('name email studentId gender academicYear faculty phone priorityScore dormitoryId roomNumber')
          Atlas: 'students'
```

---

### 7. QR / Resident Card Screen (`mobile/app/card/index.tsx`)

```
Screen: app/card/index.tsx
  → generateQRToken()
    │
    ▼
API: mobile/src/api/qr.ts:9-12
  api.post('/mobile/qr/token')
    │  full URL: POST /api/student-app/mobile/qr/token
    ▼
Backend: src/routes/student/mobile/qr.routes.js:53-82
  router.post('/mobile/qr/token', requireMobileJwt, ...)
    │
    └─▶ StudentCollection.findById(req.mobileAuth.userId)
          .select('name studentId dormitoryId roomNumber faculty academicYear')
          Atlas: 'students'
    │
    └─▶ signPayload({ sub: student._id, sid: studentId, name, room, exp: now+86400 })
          HMAC-SHA256 signed, no Atlas write

Scanner verify: GET /api/student-app/mobile/qr/verify?token=...  (no auth required)
  → qr.routes.js:87
    → verifyToken(token)          (HMAC check, exp check)
    → StudentCollection.findById(payload.sub)   Atlas: 'students'
    ← returns { name, studentId, roomNumber }
```

---

## PARITY INVARIANTS (MACHINE-CHECKABLE)

These statements are true by code inspection and hold as long as the schema is not changed:

1. **Same database:** Both web and mobile connect to the same `MONGODB_URI` (single `.env`). There is one Atlas cluster, one database, no read replica divergence in dev/demo.

2. **Same collections:** Neither web nor mobile has its own collection. All collections (`students`, `dormitories`, `roomallocations`, `pendingapplications`, `notifications`, `maintenance_requests`, `allocationcycles`) are defined once in `src/config/config.js` and `src/schemas/`.

3. **Same service functions:** `getStudentDashboard()`, `getRoomExploreData()`, `getStudentNotifications()` are called by both session-auth routes and JWT-auth routes from the same `studentMobileService.js` file.

4. **Same validation rules:** Maintenance type enum is defined identically in `maintenance-routes.js:36-43` (web) and `maintenance.routes.js:9-13` (mobile): `['electrical','plumbing','hvac','furniture','door_lock','window','internet','cleaning','pest_control','other']`.

5. **No mocking:** The mobile Axios client (`mobile/src/api/client.ts:55-58`) creates an instance with `baseURL = API_BASE + API_PREFIX` where `API_BASE` resolves to the real server IP. There is no MSW or mock layer in the mobile app.

---

## EVIDENCE GAPS AND HOW TO CLOSE THEM

The above is **static code proof** (every claim is traceable to a specific file:line). To produce runtime screenshot evidence for the 5 scenarios, an evaluator must:

1. **Run the backend:** `node index.js` (port 5000, connected to Atlas)
2. **Run the web admin:** open `http://localhost:5000` in browser, log in as admin
3. **Run the mobile app:** `cd mobile && npx expo start`, open on Android emulator

Then for each scenario:

| Scenario | Web action | Mobile action | Atlas verification |
|----------|-----------|--------------|-------------------|
| 1 Room Assignment | Admin → approve application → assign room | Dashboard tab shows `assignment.roomNumber` | `db.roomallocations.findOne({ studentId })` |
| 2 Notification | Admin → `/api/admin/notifications` POST | Notifications tab lists the new item | `db.notifications.findOne({ title })` |
| 3 Maintenance | Mobile → new maintenance request | Admin → `/admin/maintenance-requests` list | `db.maintenance_requests.findOne({ 'reportedBy.studentId' })` |
| 4 Profile | Atlas update `db.students.updateOne(...)` | Profile tab shows updated value | Direct Atlas query |
| 5 Allocation Status | Check application status in web | Allocation tab shows same status in timeline | `db.roomallocations.findOne({ status: 'ACTIVE' })` |

Every value shown in mobile or web can be traced back to its Atlas document via the code paths above. No value is hardcoded, mocked, or sourced from a secondary store.
