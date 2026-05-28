import { api } from './client';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  createdAt: string;
  isRead: boolean;
}

export async function fetchNotifications(limit = 30): Promise<Notification[]> {
  const { data } = await api.get<{ success: boolean; notifications: Notification[] }>(
    '/mobile/notifications',
    { params: { limit } }
  );
  return data.notifications;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/mobile/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<number> {
  const { data } = await api.post<{ success: boolean; count: number }>(
    '/mobile/notifications/read-all'
  );
  return data.count;
}
