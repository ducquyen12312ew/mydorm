# Dormitory Student Mobile App

React Native + Expo student app for HUST Dormitory Management System.

## Stack

- Expo SDK 52 + Expo Router v4 (file-based routing)
- TypeScript
- Zustand (auth state)
- TanStack Query v5 (data fetching + caching)
- Socket.IO client (realtime updates)
- expo-secure-store (JWT token storage)
- Axios (HTTP client with auto token refresh)

## Setup

```bash
cd mobile
npm install
```

### iOS (simulator)
```bash
npm run ios
```

### Android (emulator)
```bash
npm run android
```

The API base URL defaults to:
- Android emulator: `http://10.0.2.2:5000`
- iOS simulator: `http://localhost:5000`

Change in `app.json` → `extra.apiBaseUrl` / `extra.apiBaseUrlIos`.

## Backend dependency

Start the backend first:
```bash
# from repo root
npm run dev
```

## Architecture

```
app/
  _layout.tsx         — root: QueryClient, SafeAreaProvider, GestureHandler
  index.tsx           — redirect: auth check → login or dashboard
  (auth)/
    login.tsx         — JWT login screen
  (tabs)/
    index.tsx         — dashboard (profile, assignment, application, cycle)
    rooms.tsx         — room explorer with filters and favorites
    notifications.tsx — notification list with read state
    profile.tsx       — student profile + room application action
  room/[id].tsx       — room detail with occupancy bar and amenities

src/
  api/                — Axios API modules (auto-refreshing access tokens)
  store/              — Zustand auth store (SecureStore-backed)
  realtime/           — Socket.IO client (JWT auth via handshake)
  components/         — UI primitives: Button, Card, Badge, EmptyState
  constants/          — Colors, Spacing, Radius, Shadow
  utils/              — scale(), format helpers, device fingerprint
  config.ts           — API base URL resolver (platform-aware)
```

## Auth flow

1. Login → `POST /api/student-app/auth/mobile/login` with `{username, password, deviceId, fingerprint}`
2. Receive `{accessToken, refreshToken}` → stored in SecureStore
3. All API requests attach `Authorization: Bearer <accessToken>`
4. On 401 → auto-refresh via `POST /api/student-app/auth/mobile/refresh`
5. Logout → revokes refresh token server-side + clears SecureStore

## Realtime

Socket.IO connects with `auth: { token: <accessToken> }` to `/socket.io`.
- Server pushes `student:dashboard` on connect and on allocation changes
- Client can request refresh via `student:refresh` event
