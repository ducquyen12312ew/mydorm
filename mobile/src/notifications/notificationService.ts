/**
 * notificationService.ts
 * Quản lý toàn bộ local push notification cho Android.
 * Được gọi từ socket event handler — KHÔNG dùng FCM/remote push.
 * Cơ chế: Socket.IO (WebSocket) → scheduleLocalPush() → Android notification tray
 *
 * Lưu ý API (expo-notifications 0.29 / SDK 52):
 *  - channelId được truyền qua TRIGGER (`{ channelId }`), không nằm trong `content`.
 *    Trigger chỉ-channelId vẫn hiển thị NGAY LẬP TỨC (0ms) nhưng route đúng channel.
 *  - `content.priority` là chuỗi (AndroidNotificationPriority), khác với
 *    AndroidImportance (số) dùng khi tạo channel.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Hiển thị notification kể cả khi app đang foreground
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

// Priority → Android content priority (chuỗi)
const CONTENT_PRIORITY: Record<string, Notifications.AndroidNotificationPriority> = {
  high: Notifications.AndroidNotificationPriority.MAX,
  medium: Notifications.AndroidNotificationPriority.HIGH,
  normal: Notifications.AndroidNotificationPriority.DEFAULT,
  low: Notifications.AndroidNotificationPriority.LOW,
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
 * Hiển thị local push notification NGAY LẬP TỨC.
 * Gọi từ socket event handler sau khi nhận event từ server.
 */
export async function scheduleLocalPush(payload: NotificationPayload): Promise<void> {
  const channelId =
    (payload.category && CATEGORY_CHANNEL[payload.category]) ?? CHANNELS.ANNOUNCEMENTS;
  const contentPriority = payload.priority
    ? CONTENT_PRIORITY[payload.priority] ?? Notifications.AndroidNotificationPriority.HIGH
    : Notifications.AndroidNotificationPriority.HIGH;

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
        priority: contentPriority,
        color: '#d63031',
        vibrate: payload.priority === 'high' ? [0, 250, 250, 250] : undefined,
      }),
    },
    // channelId qua trigger = hiển thị ngay (0ms) nhưng đúng channel.
    // iOS không có channel → trigger null.
    trigger: Platform.OS === 'android' ? { channelId } : null,
  });
}

export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}
