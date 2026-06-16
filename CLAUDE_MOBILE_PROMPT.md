# 📱 CLAUDE CODE MASTER PROMPT — eDorm Android APK
# Hệ thống Quản lý Ký Túc Xá HUST · Expo React Native · Socket.IO Realtime
# ═══════════════════════════════════════════════════════════════════════════
# ĐỌC KỸ TRƯỚC KHI BẮT ĐẦU: Đây là task đồ án quan trọng. Thực hiện tuần tự
# từng TASK, KHÔNG bỏ qua bước nào, KHÔNG giả định code đang hoạt động.
# Sau mỗi task phải confirm checklist trước khi sang task tiếp theo.
# ═══════════════════════════════════════════════════════════════════════════

## 🎯 MỤC TIÊU TỔNG THỂ

Nâng cấp và build thư mục `mobile/` thành file `.apk` Android có thể cài thẳng
lên điện thoại. App phải:
- Hoạt động y hệt PWA web (đầy đủ tính năng: đăng nhập, dashboard, phòng, bảo
  trì, vi phạm, thông báo, hồ sơ, thẻ sinh viên QR)
- Nhận push notification từ admin localhost trong vòng ≤ 3 giây
- UI/UX đẹp, native, clone đúng màu sắc & design system từ PWA (#d63031 đỏ)
- Build ra file APK cài được không cần EAS cloud (dùng local build)

## 🗂️ CẤU TRÚC DỰ ÁN (quan trọng — đọc trước khi code)

```
project-root/
├── index.js              ← Backend Node.js (PORT 5000)
├── src/                  ← Server source
│   ├── realtime/student-socket-server.js  ← Socket.IO server
│   └── routes/web-notification-routes.js  ← Admin broadcast API
├── mobile/               ← Expo React Native app (TARGET)
│   ├── app.json
│   ├── package.json
│   ├── app/
│   │   ├── _layout.tsx   ← Root layout
│   │   ├── (auth)/       ← Login, Register
│   │   └── (tabs)/       ← Dashboard, Rooms, Notifications, Profile
│   └── src/
│       ├── api/          ← Axios API clients
│       ├── realtime/     ← Socket.IO client
│       ├── store/        ← Zustand auth store
│       └── constants/    ← Colors, spacing, typography
└── public/css/pwa.css    ← PWA design reference
```

**Server socket events hiện có:**
- `student:dashboard` → push dashboard data
- `new_notification` → có thể kèm payload `{title, message, category, priority}`
- `notification:push` → admin broadcast
- `student:assigned` → xếp phòng
- `allocation:revoked` → thu hồi phòng
- `application:updated` → cập nhật đơn
- `maintenance:updated` → cập nhật bảo trì
- `dashboard:refresh` → reload dashboard

**Admin gửi notification qua:**
- `POST /admin/send-announcement` (session-based)
- `POST /api/admin/notifications` (session-based)
- Socket.IO emitAdminEvent() → `io.to('admin').emit()`

---

## ═══════════════════════════════════════════════════════════
## TASK 1 — AUDIT & SETUP MÔI TRƯỜNG
## Thời gian ước tính: 15 phút
## ═══════════════════════════════════════════════════════════

### Mục tiêu
Kiểm tra môi trường, cài đúng dependencies, xác nhận app chạy được trên emulator.

### Các bước thực hiện

**1.1 Kiểm tra môi trường**
```bash
node --version          # cần >= 18
java --version          # cần JDK 17 hoặc 21
npx react-native --version
npx expo --version
```
Nếu thiếu: hướng dẫn user cài đặt, DỪNG lại chờ xác nhận.

**1.2 Kiểm tra Android SDK**
```bash
echo $ANDROID_HOME
sdkmanager --list | grep "build-tools"
```
Cần: Android SDK build-tools 34+, platform-tools, NDK.

**1.3 Cài dependencies trong `mobile/`**
```bash
cd mobile
npm install

# Thêm expo-notifications (QUAN TRỌNG — chưa có trong package.json)
npx expo install expo-notifications

# Confirm versions
npx expo-doctor
```

**1.4 Kiểm tra backend server**
```bash
# Từ project root
node -e "require('./index.js')" 2>&1 | head -5
# Hoặc
npm start &
curl http://localhost:5000/api/dormitories | head -c 100
```

**1.5 Chạy thử trên emulator**
```bash
cd mobile
npx expo start --android
```
Chụp screenshot màn hình emulator để confirm app load được.

### ✅ Checklist Task 1
- [ ] Node.js >= 18 xác nhận
- [ ] Java JDK 17+ xác nhận
- [ ] Android SDK setup đúng (ANDROID_HOME set)
- [ ] `npm install` trong mobile/ thành công
- [ ] `expo-notifications` đã cài
- [ ] `npx expo-doctor` không có lỗi nghiêm trọng
- [ ] Backend server chạy được ở port 5000
- [ ] App load được trên Android emulator (dù chưa đăng nhập)

**→ DỪNG. Báo cáo kết quả checklist trước khi sang Task 2.**

---

## ═══════════════════════════════════════════════════════════
## TASK 2 — CÀI ĐẶT PUSH NOTIFICATION (CORE FEATURE)
## Thời gian ước tính: 30 phút
## ═══════════════════════════════════════════════════════════

### Mục tiêu
Tích hợp expo-notifications để app hiển thị push notification hệ thống Android
khi nhận socket event từ server. Độ trễ mục tiêu: ≤ 1 giây từ socket → notification.

### 2.1 Tạo Notification Service

Tạo file `mobile/src/notifications/notificationService.ts`:

```typescript
/**
 * notificationService.ts
 * Quản lý toàn bộ local push notification cho Android.
 * Được gọi từ socket event handler — KHÔNG dùng FCM/remote push.
 * Cơ chế: Socket.IO (WebSocket) → scheduleLocalPush() → Android notification tray
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Hiển thị notification khi app đang foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

// Channel IDs
export const CHANNELS = {
  ALERTS: 'edorm-alerts',
  ANNOUNCEMENTS: 'edorm-announcements',
  MAINTENANCE: 'edorm-maintenance',
  SYSTEM: 'edorm-system',
} as const;

// Category → channel
const CATEGORY_CHANNEL: Record<string, string> = {
  allocation: CHANNELS.ALERTS,
  registration: CHANNELS.ALERTS,
  violation: CHANNELS.ALERTS,
  payment: CHANNELS.ALERTS,
  maintenance: CHANNELS.MAINTENANCE,
  announcement: CHANNELS.ANNOUNCEMENTS,
  system: CHANNELS.SYSTEM,
};

// Priority → Android importance
const PRIORITY_MAP: Record<string, Notifications.AndroidImportance> = {
  high: Notifications.AndroidImportance.MAX,
  medium: Notifications.AndroidImportance.HIGH,
  normal: Notifications.AndroidImportance.DEFAULT,
  low: Notifications.AndroidImportance.LOW,
};

/** Tạo Android notification channels — gọi một lần khi app khởi động */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CHANNELS.ALERTS, {
    name: '🔔 Thông báo quan trọng',
    description: 'Thông báo về phòng, vi phạm, thanh toán',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#d63031',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync(CHANNELS.ANNOUNCEMENTS, {
    name: '📢 Thông báo chung',
    description: 'Thông báo từ ban quản lý KTX',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#3498db',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync(CHANNELS.MAINTENANCE, {
    name: '🔧 Bảo trì & Sửa chữa',
    description: 'Cập nhật yêu cầu bảo trì',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#f39c12',
    sound: 'default',
    enableVibrate: false,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync(CHANNELS.SYSTEM, {
    name: '⚙️ Hệ thống',
    description: 'Thông báo hệ thống, bảo mật tài khoản',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#6b7280',
    sound: 'default',
    showBadge: true,
  });
}

/** Xin quyền notification — trả về true nếu được cấp */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export interface NotificationPayload {
  id?: string;
  title: string;
  message: string;
  type?: string;
  category?: string;
  priority?: 'high' | 'medium' | 'normal' | 'low';
  deepLink?: string;
}

/**
 * Hiển thị local push notification NGAY LẬP TỨC (trigger: null).
 * Gọi từ socket event handler sau khi nhận event từ server.
 */
export async function scheduleLocalPush(payload: NotificationPayload): Promise<void> {
  const channelId = (payload.category && CATEGORY_CHANNEL[payload.category])
    ?? CHANNELS.ANNOUNCEMENTS;
  const androidPriority = payload.priority
    ? PRIORITY_MAP[payload.priority] ?? Notifications.AndroidImportance.HIGH
    : Notifications.AndroidImportance.HIGH;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: payload.title,
      body: payload.message,
      sound: 'default',
      badge: 1,
      data: {
        notificationId: payload.id ?? '',
        category: payload.category ?? '',
        deepLink: payload.deepLink ?? '',
        type: payload.type ?? 'info',
        receivedAt: Date.now(),
      },
      ...(Platform.OS === 'android' && {
        channelId,
        priority: androidPriority,
        color: '#d63031',
        vibrate: payload.priority === 'high' ? [0, 250, 250, 250] : undefined,
      }),
    },
    trigger: null, // ← QUAN TRỌNG: null = hiển thị ngay, 0ms delay
  });
}

export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}
```

### 2.2 Cập nhật app.json

Thêm plugin `expo-notifications` vào `mobile/app.json`:

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#d63031",
          "defaultChannel": "edorm-alerts"
        }
      ],
      ["expo-font", { "fonts": [] }],
      "@sentry/react-native"
    ],
    "android": {
      "package": "vn.edu.hust.dormitory.student",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#d63031"
      },
      "permissions": [
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.VIBRATE",
        "android.permission.USE_FULL_SCREEN_INTENT",
        "android.permission.POST_NOTIFICATIONS"
      ]
    }
  }
}
```

**Lưu ý về icon notification:** Nếu `./assets/notification-icon.png` chưa có,
tạo file PNG 96x96px màu trắng trên nền trong suốt (dùng icon đơn giản của app).
Có thể copy từ `./assets/icon.png` tạm thời.

### 2.3 Cập nhật Socket Event Handler

**THAY THẾ HOÀN TOÀN** `mobile/src/realtime/useSocketEvents.ts` với version mới
tích hợp `scheduleLocalPush`:

```typescript
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, getSocket } from './socket';
import { scheduleLocalPush, type NotificationPayload } from '../notifications/notificationService';
import type { DashboardData } from '../api/dashboard';
import type { Socket } from 'socket.io-client';

export function useStudentSocket(enabled: boolean) {
  const queryClient = useQueryClient();
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    const onDashboard = (data: DashboardData) => {
      if (!mounted) return;
      queryClient.setQueryData(['dashboard'], data);
    };

    const onAllocationResult = () => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    // ── CORE: new_notification với local push ────────────────────────
    const onNewNotification = (payload?: NotificationPayload) => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      // Hiển thị push notification hệ thống ngay lập tức
      if (payload?.title && payload?.message) {
        scheduleLocalPush(payload).catch(console.warn);
      }
    };

    // ── CORE: notification:push từ admin broadcast ───────────────────
    const onNotificationPush = (payload: NotificationPayload) => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (payload?.title) {
        scheduleLocalPush(payload).catch(console.warn);
      }
    };

    const onDashboardRefresh = () => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    const onStudentAssigned = (payload?: { roomNumber?: string; dormitoryName?: string }) => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      scheduleLocalPush({
        title: '🏠 Đã được xếp phòng!',
        message: payload?.roomNumber
          ? `Bạn đã được xếp vào phòng ${payload.roomNumber}${payload.dormitoryName ? ` – ${payload.dormitoryName}` : ''}`
          : 'Bạn đã được xếp phòng. Kiểm tra chi tiết trong app.',
        category: 'allocation',
        priority: 'high',
        deepLink: '/allocation',
      }).catch(console.warn);
    };

    const onAllocationRevoked = () => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      scheduleLocalPush({
        title: '⚠️ Xếp phòng bị thu hồi',
        message: 'Thông tin phòng ở của bạn đã thay đổi. Liên hệ ban quản lý.',
        category: 'allocation',
        priority: 'high',
        deepLink: '/allocation',
      }).catch(console.warn);
    };

    const onApplicationUpdated = (payload?: { status?: string }) => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const statusMsg: Record<string, string> = {
        approved: 'Đơn đăng ký đã được phê duyệt! 🎉',
        rejected: 'Đơn đăng ký của bạn bị từ chối.',
        waitlist: 'Bạn đang trong danh sách chờ.',
      };
      const msg = (payload?.status && statusMsg[payload.status])
        ?? 'Trạng thái đơn đăng ký đã được cập nhật.';
      scheduleLocalPush({
        title: '📋 Cập nhật đơn đăng ký',
        message: msg,
        category: 'registration',
        priority: payload?.status === 'approved' ? 'high' : 'normal',
        deepLink: '/allocation',
      }).catch(console.warn);
    };

    const onMaintenanceUpdated = () => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      scheduleLocalPush({
        title: '🔧 Cập nhật bảo trì',
        message: 'Yêu cầu sửa chữa của bạn đã được cập nhật.',
        category: 'maintenance',
        priority: 'normal',
        deepLink: '/maintenance',
      }).catch(console.warn);
    };

    function registerHandlers(s: Socket) {
      // De-register trước để tránh duplicate listeners
      const events = [
        ['student:dashboard', onDashboard],
        ['allocation:result', onAllocationResult],
        ['new_notification', onNewNotification],
        ['notification:push', onNotificationPush],
        ['dashboard:refresh', onDashboardRefresh],
        ['student:assigned', onStudentAssigned],
        ['allocation:revoked', onAllocationRevoked],
        ['application:updated', onApplicationUpdated],
        ['maintenance:updated', onMaintenanceUpdated],
      ] as const;

      events.forEach(([event, handler]) => {
        s.off(event, handler as any);
        s.on(event, handler as any);
      });
    }

    connectSocket().then((s) => {
      if (!mounted) return;
      registerHandlers(s);
      s.on('connect', () => registerHandlers(s));
      cleanupRef.current = () => {
        s.off('student:dashboard', onDashboard);
        s.off('allocation:result', onAllocationResult);
        s.off('new_notification', onNewNotification);
        s.off('notification:push', onNotificationPush);
        s.off('dashboard:refresh', onDashboardRefresh);
        s.off('student:assigned', onStudentAssigned);
        s.off('allocation:revoked', onAllocationRevoked);
        s.off('application:updated', onApplicationUpdated);
        s.off('maintenance:updated', onMaintenanceUpdated);
      };
    });

    return () => {
      mounted = false;
      cleanupRef.current?.();
    };
  }, [enabled, queryClient]);
}
```

### 2.4 Cập nhật Root Layout (_layout.tsx)

**THAY THẾ** `mobile/app/_layout.tsx` — thêm setup notifications và deep link handler:

Tìm function `RootLayout` và thêm vào `useEffect` init:

```typescript
// Thêm imports ở đầu file:
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  setupNotificationChannels,
  requestNotificationPermission,
  clearBadge,
} from '../src/notifications/notificationService';

// Thêm component NotificationDeepLinkHandler trước RootLayout:
function NotificationDeepLinkHandler() {
  const router = useRouter();
  const listenerRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    listenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as {
          deepLink?: string;
        };
        if (data?.deepLink) {
          setTimeout(() => {
            try {
              router.push(data.deepLink as any);
            } catch (e) {
              console.warn('[DeepLink]', e);
            }
          }, 500);
        }
      }
    );
    return () => listenerRef.current?.remove();
  }, [router]);

  return null;
}

// Trong RootLayout, thay initApiConfig().then() bằng:
useEffect(() => {
  async function init() {
    await initApiConfig();
    refreshApiBaseUrl();
    await setupNotificationChannels();
    requestNotificationPermission(); // non-blocking
    setConfigReady(true);
  }
  init();
}, []);

// Thêm <NotificationDeepLinkHandler /> vào JSX bên trong QueryClientProvider
// Thêm clearBadge() vào AppState 'active' handler
```

### 2.5 Cập nhật Server — emit notification với payload đầy đủ

Kiểm tra file `src/utils/notificationHelper.js` hoặc nơi gọi `emitStudentEvent`.
Đảm bảo khi gửi notification, server emit kèm payload đầy đủ:

```javascript
// Trong src/realtime/student-socket-server.js hoặc notificationHelper.js
// Khi tạo notification và emit socket event, đảm bảo format:
emitStudentEvent(io, studentId, 'new_notification', {
  id: notification._id.toString(),
  title: notification.title,
  message: notification.message,
  type: notification.type,
  category: notification.category,
  priority: notification.priority || 'normal',
  deepLink: getCategoryDeepLink(notification.category),
});

// Helper function
function getCategoryDeepLink(category) {
  const links = {
    allocation: '/allocation',
    registration: '/allocation',
    maintenance: '/maintenance',
    violation: '/violations',
    payment: '/profile',
  };
  return links[category] || '/';
}
```

Tìm tất cả chỗ gọi `emitStudentEvent(..., 'new_notification', ...)` và đảm bảo
payload đủ field `{title, message, type, category, priority}`.

Với admin broadcast: kiểm tra `web-notification-routes.js` — sau khi tạo
notification, phải emit `notification:push` đến từng student socket room:

```javascript
// Sau createNotification(), thêm:
const { emitStudentEvent } = require('../realtime/student-socket-server');
const io = req.app.get('io'); // cần set app.set('io', io) trong index.js

// Broadcast đến tất cả connected students
if (notification.isGlobal) {
  io.emit('notification:push', {
    title: notification.title,
    message: notification.message,
    type: notification.type,
    category: notification.category || 'announcement',
    priority: notification.priority || 'normal',
  });
}
```

### ✅ Checklist Task 2
- [ ] `mobile/src/notifications/notificationService.ts` được tạo với đủ 4 channels
- [ ] `expo-notifications` plugin trong app.json với color `#d63031`
- [ ] Android permissions bao gồm `POST_NOTIFICATIONS`
- [ ] `useSocketEvents.ts` gọi `scheduleLocalPush()` trong `onNewNotification` và `onNotificationPush`
- [ ] `_layout.tsx` gọi `setupNotificationChannels()` khi khởi động
- [ ] `_layout.tsx` có `requestNotificationPermission()` 
- [ ] `NotificationDeepLinkHandler` component được mount
- [ ] Server emit `new_notification` có đủ `{title, message, category, priority}`
- [ ] Admin broadcast emit `notification:push` đến socket
- [ ] Test thủ công: gửi notification từ Postman/admin → notification xuất hiện trên emulator ≤ 3s

**→ DỪNG. Báo cáo kết quả checklist. Test notification trước khi sang Task 3.**

---

## ═══════════════════════════════════════════════════════════
## TASK 3 — CLONE & POLISH UI/UX (Design System)
## Thời gian ước tính: 45 phút
## ═══════════════════════════════════════════════════════════

### Mục tiêu
Đảm bảo UI mobile trung thành với design system PWA. Không redesign từ đầu —
kiểm tra từng screen và fix những chỗ chưa đúng.

### Design System Reference (từ PWA)

```
Màu chính:    #d63031 (đỏ HUST)
Chữ chính:    #1a1a2e
Nền:          #f5f6fa  
Card/Surface: #ffffff
Border:       #e5e7eb
Success:      #27ae60
Warning:      #f39c12
Error:        #e74c3c
Info:         #3498db

Font: Inter (sans-serif)
Border radius: 6 / 10 / 16px
Shadow: elevation 2-4
```

### 3.1 Kiểm tra và fix từng màn hình

**Audit checklist per-screen — kiểm tra mỗi màn hình:**

#### (a) Login Screen (`app/(auth)/login.tsx`)
- [ ] Logo eDorm hiển thị đúng (đỏ #d63031)
- [ ] Input fields có border-radius 10px, border #e5e7eb, focus border #d63031
- [ ] Nút "Đăng nhập" màu #d63031, text trắng, border-radius 10px
- [ ] Error message màu #e74c3c
- [ ] Keyboard không che mất nút submit (dùng KeyboardAvoidingView)
- [ ] Loading state hiển thị spinner

#### (b) Dashboard Screen (`app/(tabs)/index.tsx`)
- [ ] Header greeting theo giờ (Chào buổi sáng/chiều/tối)
- [ ] Status card có màu đúng theo trạng thái (success/warning/error)
- [ ] Stats section: grid 2 cột với icon Ionicons
- [ ] Phần "Thông báo mới" hiển thị unread count badge đỏ
- [ ] Pull-to-refresh hoạt động
- [ ] Skeleton loader hiển thị khi đang load

#### (c) Notifications Screen (`app/(tabs)/notifications.tsx`)
- [ ] Unread items có background khác biệt (ví dụ: #fef2f2 nhạt)
- [ ] Priority indicator: dải màu bên trái (đỏ=high, vàng=medium, xám=low)
- [ ] Category icon đúng (nhà=allocation, búa=maintenance, v.v.)
- [ ] "Đánh dấu tất cả đã đọc" button hoạt động
- [ ] Timestamp hiển thị dạng "2 phút trước", "3 giờ trước"
- [ ] Empty state đẹp khi không có thông báo

#### (d) Rooms Screen (`app/(tabs)/rooms.tsx`)
- [ ] Filter tabs (Tất cả / 8 người / 5 người...) style đúng
- [ ] Room card có occupancy bar màu đỏ/vàng/xanh
- [ ] Favorite button hoạt động (heart icon toggle)
- [ ] Search bar có border-radius và icon search

#### (e) Profile Screen (`app/(tabs)/profile.tsx`)
- [ ] Avatar placeholder với màu primary
- [ ] Info rows với icon + label + value
- [ ] Dev server URL input (chỉ hiện khi __DEV__)
- [ ] Logout button màu đỏ, có confirm dialog

#### (f) Maintenance Screens
- [ ] List screen: status badge đúng màu
- [ ] Detail screen: timeline/status updates
- [ ] New request form: input validation, photo picker (nếu có)

#### (g) Student Card Screen (`app/card.tsx` nếu có)
- [ ] QR code hiển thị đúng
- [ ] Thông tin sinh viên đầy đủ
- [ ] Share/download button

### 3.2 Fix chung cho tất cả màn hình

**Safe Area:** Tất cả màn hình phải dùng `SafeAreaView` hoặc component `SafeLayout`
hiện có để tránh notch/home indicator che content.

**Status Bar:** Đặt màu status bar #d63031 với text trắng:
```typescript
import { StatusBar } from 'expo-status-bar';
// Trong root layout:
<StatusBar style="light" backgroundColor="#d63031" />
```

**Tab Bar:** Kiểm tra `app/(tabs)/_layout.tsx`:
- Tab active color: #d63031
- Tab inactive: #9ca3af
- Background trắng với shadow nhẹ
- Badge thông báo đỏ hiển thị đúng

**Loading States:** Mọi screen phải có skeleton loader (component `Skeleton` 
đã có) — KHÔNG dùng ActivityIndicator đơn lẻ giữa màn hình trắng.

**Error States:** Mọi screen phải xử lý lỗi network gracefully:
```typescript
if (error) return (
  <EmptyState
    icon="wifi-off-outline"
    title="Không thể kết nối"
    description="Kiểm tra kết nối mạng và thử lại"
    action={{ label: 'Thử lại', onPress: refetch }}
  />
);
```

### 3.3 Thêm Haptic Feedback

Đảm bảo tất cả TouchableOpacity quan trọng có haptic:
```typescript
import { haptic } from '../../src/utils/haptics';

// Trong handler:
const handlePress = () => {
  haptic.light(); // hoặc haptic.success() cho actions quan trọng
  // ... logic
};
```

### 3.4 Animations & Transitions

Thêm fade animation cho màn hình chuyển trang nếu chưa có:
```typescript
// Trong Stack.Screen options:
options={{ animation: 'slide_from_right' }}
// hoặc 'fade' cho modals
```

### ✅ Checklist Task 3
- [ ] Login screen: màu sắc và UX đúng
- [ ] Dashboard: greeting + status card + stats đúng
- [ ] Notifications: unread indicator + category icon + timestamp
- [ ] Rooms: filter + occupancy bar + favorite
- [ ] Profile: info rows + logout confirm
- [ ] Status bar màu #d63031 trên tất cả màn hình
- [ ] Tab bar active color #d63031
- [ ] Skeleton loaders trên tất cả màn hình
- [ ] Error states với retry button
- [ ] Haptic feedback trên actions chính
- [ ] KeyboardAvoidingView trên tất cả forms

**→ DỪNG. Chụp screenshot 3-4 màn hình chính báo cáo trước khi sang Task 4.**

---

## ═══════════════════════════════════════════════════════════
## TASK 4 — KIỂM TRA TÍNH NĂNG ĐẦY ĐỦ (Feature Parity)
## Thời gian ước tính: 30 phút
## ═══════════════════════════════════════════════════════════

### Mục tiêu
Đảm bảo mọi tính năng của PWA đều hoạt động trên app. Test từng flow end-to-end.

### 4.1 Authentication Flow
```
Test case A — Login thành công:
  1. Mở app → màn hình login
  2. Nhập username/password sinh viên hợp lệ
  3. Tap "Đăng nhập"
  4. → Dashboard hiển thị (không trắng)
  5. → Tab bar hiện ra đủ 4 tab

Test case B — Login sai:
  1. Nhập sai password
  2. → Hiện lỗi "Sai tên đăng nhập hoặc mật khẩu" (KHÔNG crash)

Test case C — Token refresh:
  1. Đăng nhập xong
  2. Đợi access token expire (hoặc xóa từ SecureStore)
  3. Mở lại app → tự refresh token, KHÔNG bị đẩy về login
  4. (Nếu refresh token cũng expire → đẩy về login)
```

**Nếu có lỗi:** Kiểm tra `mobile/src/api/client.ts` — axios interceptor phải
handle 401 → refresh token → retry request.

### 4.2 Dashboard Data

```
Test:
  1. Sau login, dashboard load trong ≤ 2s
  2. Hiển thị: tên sinh viên, mã SV, trạng thái phòng
  3. Số thông báo chưa đọc đúng (match với web)
  4. Pull-to-refresh cập nhật data mới
  5. Socket update: khi admin thay đổi data → dashboard tự refresh (≤ 3s)
```

### 4.3 Notifications Flow

```
Test A — Xem danh sách:
  1. Tab Notifications → hiện danh sách ≤ 0.5s (skeleton → data)
  2. Unread items có indicator
  3. Tap item → mark as read (indicator biến mất)

Test B — Real-time push:
  1. App đang chạy foreground
  2. Admin gửi notification từ localhost (xem hướng dẫn trong báo cáo)
  3. → Notification banner xuất hiện TRONG app ≤ 3s
  4. → Badge trên tab notifications tăng
  
Test C — Background push:
  1. Minimize app (Home button)
  2. Admin gửi notification
  3. → Notification xuất hiện trong Android notification tray ≤ 3s
  4. Tap notification → mở app đến đúng màn hình (deep link)
```

### 4.4 Room Search & Booking

```
Test:
  1. Tab Rooms → list load đúng với occupancy
  2. Filter tab hoạt động (8 người, 5 người...)
  3. Search bar lọc theo tên phòng
  4. Tap room → Room detail hiển thị (app/(tabs)/rooms/ hoặc app/room/[id])
  5. Favorite toggle hoạt động và persist
```

### 4.5 Maintenance Requests

```
Test A — Xem danh sách:
  1. Menu/navigation → Maintenance
  2. Danh sách yêu cầu của sinh viên hiển thị
  3. Status badge đúng màu

Test B — Tạo mới:
  1. Tap "Tạo yêu cầu mới" (nút +)
  2. Form: type, description, location
  3. Submit → success toast
  4. Quay lại list → item mới xuất hiện
```

### 4.6 Violations (Xem vi phạm)

```
Test:
  1. Navigation → Violations
  2. Danh sách vi phạm (nếu có)
  3. Detail: type, severity, status, mô tả
  4. Empty state đẹp nếu không có vi phạm
```

### 4.7 Profile & Settings

```
Test:
  1. Tab Profile → thông tin đầy đủ: tên, MSSV, email, khoa, năm
  2. Hiển thị thông tin phòng nếu đã được xếp
  3. Đăng xuất → confirm dialog → về màn hình login
  4. (Dev mode) URL server input hoạt động
```

### 4.8 Student Card (QR Code)

```
Test:
  1. Tab Profile → "Thẻ sinh viên" hoặc app/card
  2. QR code hiển thị (không trắng, không lỗi)
  3. Thông tin SV dưới QR đúng
```

### 4.9 Network Resilience

```
Test:
  1. Tắt WiFi → app hiển thị offline state gracefully (không crash)
  2. Bật lại WiFi → tự reconnect socket, tự refresh data
  3. Server restart → socket reconnect tự động
```

### ✅ Checklist Task 4
- [ ] Login/logout flow hoạt động
- [ ] Token refresh tự động (không bị đẩy về login đột ngột)
- [ ] Dashboard load data đúng
- [ ] Notification list: unread, mark as read, mark all
- [ ] Push notification foreground ≤ 3s ✓ (test thực tế)
- [ ] Push notification background ≤ 3s ✓ (test thực tế)  
- [ ] Deep link từ notification hoạt động
- [ ] Room list + filter + search hoạt động
- [ ] Maintenance: list + create mới
- [ ] Violations: list + detail
- [ ] Profile: info đúng + logout
- [ ] QR code hiển thị
- [ ] Offline graceful (không crash)
- [ ] Socket reconnect sau khi mất mạng

**→ DỪNG. Ghi lại lỗi nếu có, fix tất cả trước khi sang Task 5.**

---

## ═══════════════════════════════════════════════════════════
## TASK 5 — BUILD FILE APK
## Thời gian ước tính: 20-60 phút (tùy máy)
## ═══════════════════════════════════════════════════════════

### Mục tiêu
Build ra file `.apk` có thể cài trực tiếp lên điện thoại Android.

### 5.1 Tạo eas.json

Tạo `mobile/eas.json`:

```json
{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "local-apk": {
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      }
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

### 5.2 Tạo notification icon asset

```bash
# Nếu chưa có assets/notification-icon.png:
cd mobile
# Copy icon.png làm notification icon tạm thời
cp assets/icon.png assets/notification-icon.png
```

Icon notification Android phải là PNG 96x96px, màu trắng trên nền trong suốt.
Nếu có thể, tạo icon đúng chuẩn. Nếu không, dùng icon.png tạm — app vẫn build được.

### 5.3 Prebuild (tạo android/ native project)

```bash
cd mobile

# Xóa android/ cũ nếu có (tránh conflict)
rm -rf android/

# Prebuild để tạo native Android project
npx expo prebuild --platform android --clean

# Verify structure tạo ra
ls android/app/src/main/
```

Sau prebuild phải có:
- `android/app/` — main Android module
- `android/app/build.gradle` — Gradle config
- `android/app/src/main/AndroidManifest.xml` — permissions

### 5.4 Kiểm tra AndroidManifest.xml

```bash
cat mobile/android/app/src/main/AndroidManifest.xml | grep -A5 "permission"
```

Đảm bảo có các permissions:
```xml
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
<uses-permission android:name="android.permission.VIBRATE"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

Nếu thiếu, thêm vào trước `<application>` tag.

### 5.5 Build APK

**Phương án A — Local build với Gradle (KHÔNG cần EAS account):**

```bash
cd mobile/android

# Debug APK (nhanh hơn, dùng để test)
./gradlew assembleDebug

# Output:
# mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

**Phương án B — Dùng EAS local build:**

```bash
cd mobile
npx eas build --platform android --profile local-apk --local

# Output: ./build-*.apk trong thư mục hiện tại
```

**Phương án C — Nếu cả hai fail, thử:**

```bash
cd mobile

# Đảm bảo Metro bundler không đang chạy
# Build với expo run:android --no-dev rồi export
npx expo export --platform android
```

### 5.6 Xử lý lỗi build thường gặp

**Lỗi: "SDK location not found"**
```bash
echo "sdk.dir=$ANDROID_HOME" > mobile/android/local.properties
```

**Lỗi: "Gradle version mismatch"**
```bash
cd mobile/android
./gradlew wrapper --gradle-version 8.3
```

**Lỗi: "Could not resolve expo-notifications"**
```bash
cd mobile
npx expo install expo-notifications --fix
npx expo prebuild --clean
```

**Lỗi: TypeScript errors khi build**
```bash
cd mobile
npx tsc --noEmit  # xem lỗi
# Fix từng lỗi, đặc biệt trong file mới (notificationService.ts)
```

**Lỗi: "Metro bundler error"**
```bash
cd mobile
npx expo start --clear  # clear cache
# Ctrl+C sau khi bundle xong, rồi build lại
```

### 5.7 Verify APK

```bash
# Kiểm tra file tồn tại và có dung lượng hợp lý (thường 50-150MB)
ls -lh mobile/android/app/build/outputs/apk/debug/app-debug.apk

# Kiểm tra APK hợp lệ
file mobile/android/app/build/outputs/apk/debug/app-debug.apk
# Expected: "Zip archive data" hoặc "Android application package"
```

### 5.8 Cài APK lên điện thoại/emulator

```bash
# Cài lên emulator đang chạy
adb install mobile/android/app/build/outputs/apk/debug/app-debug.apk

# Hoặc nếu dùng điện thoại thật (enable USB Debugging)
adb devices  # kiểm tra device connected
adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

### ✅ Checklist Task 5
- [ ] `mobile/eas.json` đã tạo
- [ ] `assets/notification-icon.png` tồn tại
- [ ] `npx expo prebuild --clean` thành công
- [ ] `android/app/src/main/AndroidManifest.xml` có đủ permissions
- [ ] Build command chạy không lỗi (chỉ định rõ phương án nào dùng)
- [ ] File APK tồn tại tại đường dẫn cụ thể
- [ ] Dung lượng APK hợp lý (30-200MB)
- [ ] `adb install` thành công
- [ ] App mở được từ launcher điện thoại
- [ ] App không crash ngay sau khi mở

**→ DỪNG. Ghi rõ đường dẫn file APK và kết quả cài đặt.**

---

## ═══════════════════════════════════════════════════════════
## TASK 6 — TEST TOÀN DIỆN TRÊN THIẾT BỊ THỰC
## Thời gian ước tính: 20 phút
## ═══════════════════════════════════════════════════════════

### Mục tiêu
Test APK đã cài trên điện thoại thật (hoặc emulator) với server thật ở localhost.

### 6.1 Chuẩn bị server và mạng

**Bước 1: Xác định IP máy tính**
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig | findstr "IPv4"
```
Ghi lại IP, ví dụ: `192.168.1.100`

**Bước 2: Khởi động server**
```bash
cd [project-root]
npm start
# Confirm: "Server running on port 5000"
```

**Bước 3: Cấu hình app trỏ về server**

Nếu test trên điện thoại thật (cùng WiFi):
- Trong Profile screen → "Đổi server URL" (dev feature)
- Nhập: `http://192.168.1.100:5000`
- Tap "Lưu" → restart app

Nếu test trên emulator:
- URL mặc định `http://10.0.2.2:5000` = localhost máy tính
- Không cần đổi gì

### 6.2 Test Notification End-to-End

**Cách gửi notification từ admin:**

```bash
# Option A — Dùng curl (terminal)
curl -X POST http://localhost:5000/admin/send-announcement \
  -H "Content-Type: application/json" \
  -c cookies.txt \  # cần có session cookie admin
  -d '{
    "title": "TEST NOTIFICATION",
    "message": "Đây là test từ server lúc $(date)",
    "type": "info",
    "targetRole": "all",
    "priority": "high"
  }'

# Option B — Qua web admin panel
# Mở http://localhost:5000/admin → Login → Gửi thông báo
# (Đây là cách dễ nhất để test)
```

**Kịch bản test chi tiết:**

```
TEST 1 — Foreground notification:
  - App đang mở, đang ở màn hình bất kỳ
  - Admin gửi thông báo
  - PASS nếu: banner notification xuất hiện trong ≤ 3 giây

TEST 2 — Background notification:
  - Nhấn Home button (app chạy nền)
  - Admin gửi thông báo
  - PASS nếu: notification tray Android có notification ≤ 3 giây

TEST 3 — Deep link:
  - Từ notification ở background, tap vào notification về bảo trì
  - PASS nếu: app mở và navigate đến màn hình Maintenance

TEST 4 — Badge:
  - Nhận notification mới
  - PASS nếu: badge số đỏ xuất hiện trên tab Notifications

TEST 5 — Latency measurement:
  - Ghi thời điểm gửi notification
  - Ghi thời điểm nhận (xuất hiện trên màn hình)
  - PASS nếu: delta ≤ 3000ms
```

### 6.3 Test Regression (tính năng không bị phá)

```
- [ ] Đăng nhập vẫn hoạt động
- [ ] Dashboard load data
- [ ] Tab navigation mượt
- [ ] Không có crash log trong adb logcat
```

```bash
# Xem crash log real-time
adb logcat | grep -E "(ReactNative|Expo|ERROR|FATAL)"
```

### ✅ Checklist Task 6
- [ ] Server khởi động thành công, port 5000 accessible
- [ ] App connect được server (dashboard load data)
- [ ] Test 1 PASS: foreground notification ≤ 3s
- [ ] Test 2 PASS: background notification ≤ 3s
- [ ] Test 3 PASS: deep link từ notification
- [ ] Test 4 PASS: badge count đúng
- [ ] Test 5: ghi lại latency thực tế (ví dụ: 450ms)
- [ ] Không có crash trong suốt quá trình test
- [ ] Tất cả màn hình chính load được

---

## ═══════════════════════════════════════════════════════════
## TASK 7 — VIẾT BÁO CÁO & HƯỚNG DẪN
## Thời gian ước tính: 15 phút
## ═══════════════════════════════════════════════════════════

### Mục tiêu
Viết file báo cáo `.md` đầy đủ, chuyên nghiệp, phù hợp nộp đồ án.

### Yêu cầu nội dung báo cáo

Tạo file `EDORM_ANDROID_REPORT.md` tại project root với các section:

```markdown
# Báo Cáo Phát Triển eDorm Android App
## Hệ Thống Quản Lý Ký Túc Xá ĐHBK Hà Nội

### 1. Tổng Quan
- Mô tả app, công nghệ sử dụng
- Version: 1.0.0 | Build: [ngày build]
- File APK: [đường dẫn]

### 2. Kiến Trúc Hệ Thống
- Stack: Expo 52 + React Native 0.76 + TypeScript
- Realtime: Socket.IO (WebSocket)
- State: Zustand + React Query
- Navigation: Expo Router (file-based)
- Sơ đồ flow notification

### 3. Tính Năng
Bảng tất cả features với status PASS/FAIL

### 4. Push Notification Architecture
- Giải thích tại sao dùng Local Push (không phải FCM)
- Flow: Server → Socket.IO → scheduleLocalPush() → Android tray
- Latency đo được thực tế

### 5. Kết Quả Test
- Bảng test cases với PASS/FAIL và latency

### 6. Hướng Dẫn Cài Đặt & Chạy Server
(chi tiết — xem phần dưới)

### 7. Cấu Trúc Code Mobile
- Giải thích từng thư mục/file quan trọng

### 8. Kết Luận & Hướng Phát Triển
```

### Nội dung bắt buộc trong mục "Hướng Dẫn Cài Đặt & Chạy Server":

```markdown
## 🚀 Hướng Dẫn Chạy Server & Test App

### Yêu Cầu Hệ Thống
- Node.js >= 18.x
- MongoDB (local hoặc Atlas)
- Android device/emulator (Android 10+)
- ADB (Android Debug Bridge)

### Bước 1: Cài Đặt Backend

\`\`\`bash
# Tại thư mục gốc project
npm install

# Tạo file .env từ template
cp .env.example .env
# Chỉnh sửa .env: điền MONGO_URI, SESSION_SECRET, JWT secrets

# Khởi động server
npm start
# ✓ Server running on http://localhost:5000
\`\`\`

### Bước 2: Tạo Tài Khoản Admin & Sinh Viên

\`\`\`bash
# Tạo admin account (nếu chưa có)
node scripts/create-admin.js
# hoặc đăng ký qua http://localhost:5000/signup
\`\`\`

### Bước 3: Cài APK Lên Điện Thoại

\`\`\`bash
# Kết nối điện thoại qua USB (bật USB Debugging)
adb devices  # phải thấy device trong list

# Cài APK
adb install -r [đường-dẫn-file.apk]
# ✓ Success

# Nếu dùng emulator:
# Mở Android Studio → AVD Manager → Start emulator
# adb install -r [đường-dẫn-file.apk]
\`\`\`

### Bước 4: Cấu Hình App Trỏ Về Server

**Emulator:** Không cần làm gì — `10.0.2.2:5000` tự động trỏ về localhost.

**Điện thoại thật:**
1. Đảm bảo điện thoại và máy tính cùng WiFi
2. Lấy IP máy tính: `ifconfig | grep inet` (Mac/Linux) hoặc `ipconfig` (Windows)
3. Mở app → Tab Profile → Cuộn xuống dưới → "Đổi Server URL"
4. Nhập: `http://[IP-may-tinh]:5000` (ví dụ: `http://192.168.1.100:5000`)
5. Tap "Lưu & Kết nối lại"

### Bước 5: Test Notification Realtime

**Cách 1: Qua Admin Panel (dễ nhất)**
\`\`\`
1. Mở http://localhost:5000/admin trên máy tính
2. Đăng nhập tài khoản admin
3. Vào mục "Thông báo" → "Gửi thông báo mới"
4. Nhập tiêu đề, nội dung → Gửi
5. → Điện thoại nhận notification trong ≤ 3 giây
\`\`\`

**Cách 2: Dùng curl**
\`\`\`bash
# Đầu tiên lấy session cookie bằng login
curl -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@hust.edu.vn","password":"your-password"}'

# Gửi notification
curl -b cookies.txt -X POST http://localhost:5000/admin/send-announcement \
  -H "Content-Type: application/json" \
  -d '{
    "title": "🔔 Test Notification",
    "message": "Notification realtime từ server lúc '$(date +%H:%M:%S)'",
    "type": "info",
    "targetRole": "all",
    "priority": "high"
  }'
\`\`\`

### Bước 6: Xem Log Debugging

\`\`\`bash
# Log realtime từ app
adb logcat | grep -E "(eDorm|Socket|Notification|ReactNative)"

# Log server
# Xem terminal đang chạy npm start
\`\`\`

### Troubleshooting

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|-----------|
| App không kết nối server | Sai URL hoặc firewall | Kiểm tra URL trong Profile, tắt firewall |
| Không nhận notification | Chưa cấp quyền | Settings → Apps → eDorm → Notifications → Allow |
| Socket disconnect liên tục | Server restart | Pull-to-refresh trên Dashboard |
| APK không cài được | "Install unknown apps" tắt | Settings → Security → Allow unknown sources |
```

### ✅ Checklist Task 7
- [ ] File `EDORM_ANDROID_REPORT.md` được tạo ở project root
- [ ] Có đủ 8 section như yêu cầu
- [ ] Latency thực tế được ghi vào báo cáo (không điền placeholder)
- [ ] Đường dẫn file APK chính xác
- [ ] Hướng dẫn server step-by-step đủ chi tiết để người khác chạy được
- [ ] Bảng troubleshooting có ít nhất 4 vấn đề thường gặp
- [ ] Hướng dẫn test notification có ít nhất 2 cách (admin panel + curl)

---

## ═══════════════════════════════════════════════════════════
## TỔNG KẾT — DEFINITION OF DONE
## ═══════════════════════════════════════════════════════════

Task hoàn thành khi và CHỈ KHI tất cả điều kiện sau được thỏa mãn:

### Must Have (bắt buộc)
- [ ] **File APK tồn tại** tại đường dẫn rõ ràng, cài được lên Android
- [ ] **Push notification hoạt động** — admin gửi → điện thoại nhận ≤ 3s
- [ ] **Notification foreground** — hiện banner khi app đang mở
- [ ] **Notification background** — hiện trong notification tray khi app bị thu nhỏ
- [ ] **Login/Dashboard** hoạt động
- [ ] **Không có crash** trong quá trình sử dụng bình thường
- [ ] **File báo cáo .md** đầy đủ với hướng dẫn chạy server

### Should Have (quan trọng)
- [ ] UI màu sắc đúng (#d63031, đúng design system)
- [ ] Skeleton loaders trên tất cả màn hình
- [ ] Deep link từ notification
- [ ] Badge count trên tab Notifications
- [ ] Tất cả 6 màn hình hoạt động (Dashboard, Rooms, Notifications, Profile, Maintenance, Violations)

### Nice to Have (nếu có thời gian)
- [ ] Haptic feedback
- [ ] Offline graceful handling
- [ ] Socket reconnect animation/indicator

---

## 📋 NOTES QUAN TRỌNG CHO CLAUDE CODE

1. **Không tự ý thay đổi backend** nếu không cần thiết. Chỉ thêm emit socket
   events với payload đầy đủ.

2. **Không dùng FCM/Expo Push Tokens** — local notification qua Socket.IO là đủ
   và không cần setup Firebase.

3. **Import path cẩn thận:** `notificationService.ts` ở `src/notifications/`,
   import trong `_layout.tsx` phải là `'../src/notifications/notificationService'`

4. **Khi prebuild xong**, đừng edit file trong `android/` thủ công trừ khi thực
   sự cần thiết — chạy `npx expo prebuild --clean` sẽ xóa hết.

5. **Nếu build fail vì thiếu signing key** cho release APK, dùng debug build là đủ
   để demo.

6. **Thứ tự ưu tiên khi có conflict:** Notification working > UI đẹp > Features đầy đủ

7. **Log mọi thứ khi test:** Dùng `console.log('[Socket] event received:', eventName)`
   để debug dễ hơn qua `adb logcat`.
