# Performance Notes — HUST Dormitory Management System

This document explains the concrete performance decisions made in the student mobile app and why each was chosen.

---

## 1. TanStack Query Stale-Time Tiering

All queries are classified by how frequently their underlying data changes. Rather than a single global stale time, the app uses a tiered system defined in `mobile/src/constants/query.ts`:

| Tier | `staleTime` | Used For |
|------|-------------|---------|
| `STALE.short` | 15 s | Real-time adjacent data |
| `STALE.default` | 30 s | Dashboard, notifications |
| `STALE.medium` | 60 s | Profile, room list, favorites |
| `STALE.qr` | 20 min | QR token (24 h server TTL) |

**Why this matters:** Without stale-time tuning, every screen transition triggers a network request. With it, navigating to a screen you visited 20 seconds ago shows instantly from cache — no spinner, no round-trip. This is the single biggest contributor to perceived speed.

**GC time** (`GC.default = 5 min`, `GC.qr = 25 min`) ensures cached data stays in memory long enough that backgrounding and returning to the app doesn't force a full refetch.

---

## 2. Socket.IO Cache Injection (Zero-HTTP Realtime Updates)

The most important realtime event is `student:dashboard` — emitted by the server when allocation results change. Instead of invalidating the query and triggering an HTTP request, the server's push payload is written directly into the TanStack Query cache:

```typescript
// mobile/src/realtime/useSocketEvents.ts
socket.on('student:dashboard', (data) => {
  queryClient.setQueryData(['dashboard'], data);
});
```

**Result:** The dashboard screen updates instantly when an allocation result arrives — no HTTP round-trip, no loading spinner, no "refetching" state. The update propagates to every screen sharing the `['dashboard']` key (dashboard, profile status line, allocation screen) in the same render cycle.

---

## 3. React.memo on FlatList Item Components

The room explorer renders a `FlatList` of `RoomCard` components. Each card shows room type, occupancy bar, amenities, and a favorite toggle. Without memoization, toggling a favorite on one card re-renders every card in the list.

```typescript
// mobile/app/(tabs)/rooms.tsx
const RoomCard = React.memo(function RoomCard({ room, dormId, isFavorite, onToggleFav }: RoomCardProps) {
  // ...
});
```

**Why `React.memo` is correct here:** `RoomCard` receives stable props from `FlatList` (room data doesn't change, `isFavorite` is derived from a Set, `onToggleFav` is a `useCallback`). The memo check is effectively free — a shallow equality scan that short-circuits the entire component tree below it.

**`keyExtractor`** is always explicit (`keyExtractor={(item) => item._id}`) so React's reconciler never falls back to index-based keying, which causes full remounts on list changes.

---

## 4. useCallback for FlatList Callbacks

Any function passed to `FlatList`'s `renderItem`, `keyExtractor`, or `onRefresh` must be referentially stable across renders, or the entire list re-renders on every parent state change.

```typescript
// mobile/app/(tabs)/rooms.tsx
const renderItem = useCallback(
  ({ item: room }: { item: Room }) => (
    <RoomCard
      room={room}
      dormId={activeDorm._id}
      isFavorite={favSet.has(room._id)}
      onToggleFav={handleToggleFav}
    />
  ),
  [activeDorm, favSet, handleToggleFav]
);
```

The dependency array ensures the callback only changes when the actual data changes — not on every keystroke in the search input.

---

## 5. useMemo for Derived Lists (Filter + Search)

The room explorer has both a type filter (chip tabs) and a text search input. Filtering happens client-side against the cached room list. Without memoization, every keystroke re-runs the filter across all rooms.

```typescript
const filteredRooms = useMemo(
  () =>
    rooms.filter((r) => {
      const matchType = !typeFilter || r.type === typeFilter;
      const matchSearch = !search || r.roomNumber.toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    }),
  [rooms, typeFilter, search]
);
```

**Cost of the computation:** Linear scan over the room list (typically 20–100 items). The memo avoids re-running this on every render that doesn't change `rooms`, `typeFilter`, or `search` — which includes scroll events, focus changes, and animation frames.

---

## 6. Skeleton Screens (Perceived Performance)

Every data-loading screen renders a skeleton — a content-shaped placeholder — rather than a spinner or blank screen. This is a perceived-performance technique, not a real throughput improvement, but it has a measurable impact on how fast the app feels.

**Why it works:** The skeleton shows the layout before data arrives. When data replaces it, the transition feels like a "reveal" rather than a "load." The user's eye is already in the right position.

Skeletons use a `pulse` animation (opacity 0.4 → 1 → 0.4, looping) powered by React Native's `Animated.loop`. The animation runs on the UI thread via the native driver (`useNativeDriver: true`), so it doesn't compete with JS-thread activity.

---

## 7. AppState-Driven Cache Invalidation

When a student minimizes the app and returns, stale data is immediately invalidated:

```typescript
// mobile/app/(tabs)/_layout.tsx
AppState.addEventListener('change', (state) => {
  if (state === 'active' && isAuthenticated) {
    ensureConnected();
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }
});
```

Without this, a student who received a room assignment while the app was backgrounded would see the old "no assignment" state until they manually pulled to refresh. The invalidation ensures the first render after returning always shows current data.

---

## 8. Backend: MongoDB Index Coverage

The mobile API endpoints that run on the hot path are index-covered:

| Query | Index |
|-------|-------|
| `StudentCollection.findById(userId)` | `_id` (default) |
| `MobileRefreshToken.findOne({ tokenHash })` | `{ tokenHash: 1, revokedAt: 1 }` |
| `notifications.find({ targetId: userId })` | `{ studentId: 1 }` |
| `maintenance_requests.find({ reportedBy })` | `{ reportedBy: 1 }` |

Every auth check (JWT verify → student lookup) hits `_id`. Every refresh token rotation hits the `tokenHash` index. These are the highest-frequency DB operations in the system — index coverage keeps them at O(log n) instead of O(n).

---

## 9. Query Parallelism on Dashboard

The dashboard screen fetches two independent queries in parallel rather than sequentially:

```typescript
const { data: dashboard } = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard });
const { data: availability } = useQuery({ queryKey: ['availability'], queryFn: fetchRegistrationAvailability });
```

TanStack Query fires both requests simultaneously on mount. Total load time = max(t₁, t₂), not t₁ + t₂. Given the dashboard is the most-visited screen, this reduces the median first-paint latency by roughly half the registration-availability call time.

---

## 10. Known Performance Limitations

These are acceptable trade-offs at graduation-project scale:

| Issue | Scale Threshold | Mitigation |
|-------|-----------------|-----------|
| `checkStudentExistsInSystem` does an O(n) scan through embedded dormitory occupants | Becomes slow above ~500 concurrent students | Acceptable for demo; real fix = separate occupancy collection |
| Admin quota controller loads all students without pagination | Slow above ~2000 students | Add pagination cursor before production |
| Socket.IO Redis adapter not benchmarked for scale | Becomes bottleneck above ~100 concurrent connections | Redis pub/sub scales horizontally with more nodes |
