import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, getSocket } from './socket';
import { scheduleLocalPush, type NotificationPayload } from '../notifications/notificationService';
import type { DashboardData } from '../api/dashboard';
import type { Socket } from 'socket.io-client';

/**
 * Bridge các socket event của server → React Query cache + local push notification.
 *
 * QUAN TRỌNG: tên event ở đây phải khớp CHÍNH XÁC với những gì server emit
 * (xem src/realtime/register-domain-event-bridge.js & web-notification-routes.js):
 *   student:dashboard, student:dashboard:refresh, student:assigned,
 *   student:allocation-revoked, application:updated, allocation:result,
 *   notification:push (admin broadcast), new_notification (targeted), maintenance:updated
 */
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

    const onDashboardRefresh = () => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    // ── CORE: admin broadcast → local push ───────────────────────────
    const onNotificationPush = (payload?: NotificationPayload) => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (payload?.title && payload?.message) {
        scheduleLocalPush(payload).catch((e) => console.warn('[push]', e));
      }
    };

    // ── CORE: targeted per-user notification → local push ────────────
    const onNewNotification = (payload?: NotificationPayload) => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (payload?.title && payload?.message) {
        scheduleLocalPush(payload).catch((e) => console.warn('[push]', e));
      }
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
      }).catch((e) => console.warn('[push]', e));
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
      }).catch((e) => console.warn('[push]', e));
    };

    const onApplicationUpdated = (payload?: { status?: string }) => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const statusMsg: Record<string, string> = {
        approved: 'Đơn đăng ký đã được phê duyệt! 🎉',
        rejected: 'Đơn đăng ký của bạn bị từ chối.',
        waitlist: 'Bạn đang trong danh sách chờ.',
      };
      const msg =
        (payload?.status && statusMsg[payload.status]) ??
        'Trạng thái đơn đăng ký đã được cập nhật.';
      scheduleLocalPush({
        title: '📋 Cập nhật đơn đăng ký',
        message: msg,
        category: 'registration',
        priority: payload?.status === 'approved' ? 'high' : 'normal',
        deepLink: '/allocation',
      }).catch((e) => console.warn('[push]', e));
    };

    const onMaintenanceUpdated = (payload?: { message?: string }) => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      scheduleLocalPush({
        title: '🔧 Cập nhật bảo trì',
        message: payload?.message || 'Yêu cầu sửa chữa của bạn đã được cập nhật.',
        category: 'maintenance',
        priority: 'normal',
        deepLink: '/maintenance',
      }).catch((e) => console.warn('[push]', e));
    };

    // Cặp [event, handler] — một nguồn sự thật cho register/deregister.
    const handlers: Array<[string, (...args: any[]) => void]> = [
      ['student:dashboard', onDashboard],
      ['allocation:result', onAllocationResult],
      ['student:dashboard:refresh', onDashboardRefresh],
      ['notification:push', onNotificationPush],
      ['new_notification', onNewNotification],
      ['student:assigned', onStudentAssigned],
      ['student:allocation-revoked', onAllocationRevoked],
      ['application:updated', onApplicationUpdated],
      ['maintenance:updated', onMaintenanceUpdated],
    ];

    function registerHandlers(s: Socket) {
      handlers.forEach(([event, handler]) => {
        s.off(event, handler); // tránh đăng ký trùng khi reconnect
        s.on(event, handler);
      });
    }

    function deregisterHandlers(s: Socket) {
      handlers.forEach(([event, handler]) => s.off(event, handler));
      s.off('connect', onReconnect);
    }

    // Đăng ký lại mỗi lần socket reconnect.
    function onReconnect() {
      const s = getSocket();
      if (s && mounted) registerHandlers(s);
    }

    connectSocket().then((s) => {
      if (!mounted) return;
      registerHandlers(s);
      s.on('connect', onReconnect);
      cleanupRef.current = () => deregisterHandlers(s);
    });

    return () => {
      mounted = false;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [enabled, queryClient]);
}
