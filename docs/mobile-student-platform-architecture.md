# Mobile-First Student Platform Extension

## 1. Target Architecture

### Existing system (kept)
- Backend: Express + MongoDB + session auth
- Admin UI: EJS (unchanged)
- Existing student allocation logic: unchanged and reused

### New layers added
- Student app API facade: `/api/student-app/*`
- Realtime service: Socket.IO namespace/path `/socket.io`
- New student web app: `student-web/` (React + Tailwind + Framer Motion)
- Native mobile app: `mobile-expo/` (Expo + React Navigation + React Query + Zustand)

## 2. Folder Structure

```text
src/
  realtime/
    student-socket-server.js
  routes/
    student/
      mobile-student-routes.js
  services/
    studentMobileService.js

student-web/
  src/
    components/
      BottomTabs.jsx
      CardSkeleton.jsx
      Shell.jsx
    lib/
      api.js
      socket.js
    screens/
      LoginScreen.jsx
      DashboardScreen.jsx
      ApplyScreen.jsx
      RoomsScreen.jsx
      NotificationsScreen.jsx
      ProfileScreen.jsx
    store/
      appStore.js

mobile-expo/
  App.js
  eas.json
  src/
    api/client.js
    config.js
    navigation/AppNavigator.js
    realtime/socket.js
    screens/
      LoginScreen.js
      DashboardScreen.js
      ApplyScreen.js
      RoomsScreen.js
      NotificationsScreen.js
      ProfileScreen.js
    store/useAppStore.js
```

## 3. API Design (Student App)

### Auth
- `POST /api/student-app/auth/login`
- `POST /api/student-app/auth/logout`
- `GET /api/student-app/auth/me`

### Dashboard and assignment state
- `GET /api/student-app/dashboard`
  - returns profile, application status, assignment, active cycle, unread count

### Rooms and explore
- `GET /api/student-app/rooms/explore?onlyAvailable=true&roomType=...&dormitoryId=...`

### Notifications
- `GET /api/student-app/notifications?limit=20`
- `POST /api/student-app/notifications/:id/read`

### Application support
- `GET /api/student-app/registration/availability`
- `POST /api/student-app/applications/score-preview`
- Final form submit with files stays on existing endpoint: `POST /api/registration`

## 4. Realtime Flow

### Server
- Socket server attaches to same Express HTTP server
- Session middleware reused in socket handshake (same login session)
- Each student joins room: `student:<studentId>`
- Server polls dashboard snapshot every 12s and emits:
  - `student:dashboard`

### Client (Web + Mobile)
- Connect with `socket.io-client`
- Listen `student:dashboard` and update Zustand store instantly
- Polling fallback remains in React Query `refetchInterval`

## 5. UX Notes
- Mobile-first card layout with fixed bottom tabs
- Rounded cards, gradient accents, soft shadows
- Skeleton loading state for dashboard/rooms
- Smooth route transitions with Framer Motion (web)
- Dark mode toggle-ready store (`theme`) and offline state (`isOffline`)

## 6. Backward Compatibility
- No admin routes changed
- Existing allocation scripts and registration endpoints preserved
- Added facade routes without removing legacy EJS routes
