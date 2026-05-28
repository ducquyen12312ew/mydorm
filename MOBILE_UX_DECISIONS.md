# Mobile UX Design Decisions

This document explains the rationale behind major UX and technology decisions in the student mobile app.

---

## 1. Why Mobile-First for Students?

### The Problem with Web-Only
Traditional dormitory management systems give students a web portal: a desktop-style admin interface with tables, forms, and menus — accessed on a phone browser. This creates:
- Poor touch target sizing (links designed for mouse clicks)
- Horizontal scrolling on data tables
- No offline tolerance — any network interruption means lost work
- No haptic feedback — forms feel unresponsive
- No native navigation — browser back button has unexpected behavior

### The Mobile Advantage for Students
Students' primary interaction with dormitory services happens on phones:
- Checking room assignment → quick glance, shouldn't need to open a browser
- Reporting a maintenance issue → take a photo, describe, submit — a native form flow
- Showing a resident card at the gate → a QR code on the phone lock screen
- Getting notified about allocation results → a push notification that deep-links directly to the result

A native app can handle all of these naturally. A web app treats them all the same as "fill in a form on a screen."

### Why Admin Stays on Web
Admin/manager workflows are different:
- Large data tables (student lists, dormitory occupancy, violation reports)
- Multi-step approval workflows with side-by-side context
- Keyboard-heavy input (notes, decisions, reports)
- Monitor-sized layouts that show all information simultaneously

These workflows fit a web dashboard. Forcing them into a mobile layout would mean infinite scrolling through tables and tiny tap targets on critical actions.

**Principle:** Each user type gets the interface that fits their actual workflow.

---

## 2. Why Expo (not Bare React Native)?

### Expo SDK 52 Provides:
- **Expo Router v4**: File-based routing with automatic deep linking and type safety
- **expo-secure-store**: Native keychain/keystore for JWT storage (not AsyncStorage)
- **expo-haptics**: Unified haptic feedback API across iOS/Android
- **expo-clipboard**: System clipboard access
- **expo-constants**: Device info and configuration constants
- Managed build toolchain (no Xcode/Android Studio required for most changes)

### The Trade-off
Expo managed workflow has a smaller native module surface than bare React Native. This project doesn't need camera access, Bluetooth, background location, or other advanced native capabilities — so the managed workflow's constraints don't apply here.

If the project needed custom native modules (e.g., biometric auth, NFC for the QR card), migrating to bare workflow is straightforward.

---

## 3. Why Expo Router v4 (not React Navigation)?

### File-Based Routing Benefits
```
app/
  (tabs)/
    index.tsx         → route "/"
    rooms.tsx         → route "/rooms"
  maintenance/
    index.tsx         → route "/maintenance"
    [id].tsx          → route "/maintenance/:id"
    new.tsx           → route "/maintenance/new"
```

Navigation is implicit from the file system, identical to Next.js. This means:
- Deep linking works automatically — every screen is a URL
- Notification navigation (`router.push('/allocation')`) works without a navigation ref
- TypeScript has type-safe route parameters via `useLocalSearchParams<{ id: string }>()`
- New screens require no router registration — just create the file

### vs. React Navigation
React Navigation requires manually registering every screen, managing navigator hierarchies, and explicitly handling deep link mapping. Expo Router eliminates this boilerplate while producing equivalent performance.

---

## 4. Why TanStack Query v5 (not Redux Toolkit Query or SWR)?

### The Core Problem TanStack Query Solves
The student app has many screens that need the same data at different times: the dashboard, the allocation screen, and the QR card all need `fetchDashboard()`. Without a caching layer, this creates three separate API calls. With TanStack Query, all three share the same cached result.

### Key Features Used

**Automatic background refetching:** When the app comes to the foreground, stale queries are automatically revalidated. Students always see up-to-date data without manual pull-to-refresh.

**`staleTime: 30_000`:** Data is considered fresh for 30 seconds. This prevents the "flash of loading" on every navigation — if you visited the dashboard 10 seconds ago and come back, it shows instantly.

**`setQueryData` for realtime:** Socket.IO events inject data directly into the cache without triggering network requests:
```typescript
socket.on('student:dashboard', (data) => {
  queryClient.setQueryData(['dashboard'], data);
});
```

**Query invalidation:** When a student creates a maintenance request, we invalidate `['maintenance']` — all maintenance list screens automatically refetch on next focus.

**Retry logic:** Failed queries retry 2 times with exponential backoff. Transient network errors are handled transparently.

### Why Not Redux Toolkit Query?
RTKQ is tightly coupled to Redux's store architecture. For a mobile app with 12 screens and 8 data types, Redux's boilerplate (slices, reducers, selectors, dispatch) adds significant complexity without proportional benefit. TanStack Query is data-fetching–focused and composable without global state management overhead.

### Why Not SWR?
SWR lacks mutation support with optimistic updates, has a more limited FlatList integration pattern, and is less battle-tested for React Native than TanStack Query.

---

## 5. Why Zustand (not Context API or Jotai)?

### Auth State Needs
The auth store needs to:
1. Persist login state across app restarts (SecureStore)
2. Be readable from anywhere without prop drilling
3. Trigger navigation when session expires (from within an Axios interceptor)
4. Handle concurrent async operations safely

### Why Zustand Fits
```typescript
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (username, password) => { ... },
  logout: async () => { ... },
  forceReset: async () => { ... },     ← called from Axios interceptor
  restoreSession: async () => { ... }, ← called on app launch
}));
```

The `forceReset` action is called from the Axios 401 interceptor (`registerSessionExpiredCallback`) — a place where React Context is not accessible (outside component tree). Zustand's store is accessible as a plain function call (`useAuthStore.getState().forceReset()`).

### Why Not Context API?
Context re-renders every consumer on every state update. For an auth store that changes infrequently, this is acceptable — but Zustand's selector-based subscription (`useAuthStore(s => s.isAuthenticated)`) ensures only components that care about a specific field re-render. Context also doesn't solve the "call from outside React" problem.

### Why Not Jotai?
Jotai is excellent for fine-grained atom state but adds complexity for auth flows that have inter-dependent async actions. Zustand's action pattern maps naturally to the login/logout/refresh lifecycle.

---

## 6. Why Socket.IO for Realtime? (not polling or SSE)

### The Realtime Use Case
The primary realtime event is **room assignment**: when an admin runs the allocation algorithm, thousands of students need to know their result instantly. Polling (checking every N seconds) creates unnecessary load and adds latency. Socket.IO maintains a persistent WebSocket connection that allows instant push.

### Connection Strategy
```typescript
// Connect once when student logs in
useEffect(() => {
  if (isAuthenticated) connectSocket();
  else disconnectSocket();
}, [isAuthenticated]);

// Reconnect on app foreground
AppState.addEventListener('change', (state) => {
  if (state === 'active' && isAuthenticated) {
    ensureConnected();
    queryClient.invalidateQueries(['dashboard']);
  }
});
```

### Events
| Direction | Event | Payload |
|-----------|-------|---------|
| Server → Client | `student:dashboard` | Full dashboard snapshot |
| Server → Client | `allocation:result` | Triggers dashboard invalidation |
| Server → Client | `notification:new` | Triggers notification list refetch |
| Client → Server | `student:refresh` | Requests fresh dashboard push |

### Why Not SSE (Server-Sent Events)?
SSE is unidirectional — client can receive but not send. The `student:refresh` event (client requests fresh data) requires bidirectional communication. Socket.IO also handles reconnection, fallback to polling, and load balancing via Redis adapter.

---

## 7. Navigation UX Decisions

### Modal Presentation for QR Card
The resident QR card (`app/card/index.tsx`) is presented as a modal (`presentation: 'modal'`) rather than a card (`slide_from_right`). This signals to the user that it's a transient overlay — something to show and dismiss — not a destination to navigate into. The swipe-down-to-dismiss gesture reinforces this.

### Slide-from-right for Detail Screens
All detail screens (room detail, maintenance detail, violations, allocation) use `presentation: 'card', animation: 'slide_from_right'`. This is the native iOS default and Android's standard navigation metaphor: going deeper = slide right, going back = slide left. Maintaining this convention means users don't need to learn a new navigation model.

### Tab State Preservation
Expo Router's tab navigator preserves scroll position and state within each tab. A student who scrolled halfway through the room list, switched to notifications, and came back — still sees the same scroll position. This is the native behavior users expect.

### Deep Linking from Notifications
Tapping a notification doesn't just open the app — it navigates directly to the relevant screen:
- Allocation notifications → `/allocation` (the timeline)
- Maintenance notifications → `/maintenance` (the request list)
This eliminates the "I got a notification, now where do I find it?" friction.

---

## 8. Loading State Strategy

### Skeleton Screens (not Spinners)
Every data-loading screen shows a skeleton — a content-shaped placeholder that matches the real layout. This communicates:
- "Data is loading"
- "Here's roughly what you'll see"
- "The page structure makes sense even before data arrives"

A centered spinner communicates none of this. It's disorienting when the content appears in a completely different layout than the spinner.

### Skeleton Coverage
| Screen | Has Skeleton |
|--------|-------------|
| Dashboard | ✅ `SkeletonDashboard()` matching card layout |
| Rooms | ✅ `SkeletonRoomCard()` list items |
| Notifications | ✅ `SkeletonNotifItem()` list items |
| Allocation | ✅ Timeline-shaped skeleton |
| Maintenance list | ✅ Card-shaped skeleton |
| Maintenance detail | ✅ Section-by-section skeleton |
| Profile | ✅ Inline skeleton for each section |
| QR Card | ✅ Spinner with loading message |

### Pull-to-Refresh
All scrollable screens implement `RefreshControl` with `tintColor={Colors.primary}`. This gives students a consistent manual refresh affordance and matches the expected behavior of every major mobile app.

---

## 9. Empty State Design Philosophy

Empty states are not errors — they're states. The copy reflects this:

| Screen | Empty State Message | Why |
|--------|--------------------|----|
| Notifications | "Chưa có thông báo" / "Các thông báo từ hệ thống sẽ xuất hiện ở đây" | Reassuring: no notification is normal, not a problem |
| Maintenance | "Chưa có yêu cầu nào" / "Nhấn dấu + để gửi yêu cầu bảo trì mới" | Actionable: tells user exactly what to do |
| Violations | "Không có vi phạm" / "Bạn không có vi phạm nào được ghi nhận" | Positive: zero violations is a good outcome to celebrate |
| Rooms (filtered) | "Không tìm thấy phòng" / "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm" | Helpful: tells user how to get results |

---

## 10. Haptic Feedback Strategy

Haptics make the interface feel mechanical and real — actions have physical weight. The strategy:

| Haptic Type | When Used |
|------------|----------|
| `haptic.light()` | Tapping any navigation element, chips, read-only touches |
| `haptic.selection()` | Toggling a filter, selecting an option, adding/removing favorites |
| `haptic.medium()` | Submitting a form, confirming an action dialog |
| `haptic.success()` | Login success, request created, action completed |
| `haptic.warning()` | Showing confirmation dialog for destructive action |
| `haptic.error()` | Login failure, validation error, API error |

This maps haptic intensity to action importance. A filter chip tap and a form submission feel different because they are different.
