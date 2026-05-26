import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, getSocket } from './socket';
import type { DashboardData } from '../api/dashboard';
import type { Socket } from 'socket.io-client';

export function useStudentSocket(enabled: boolean) {
  const queryClient = useQueryClient();
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    // Named handlers so .off() removes exactly these, not all listeners.
    const onDashboard = (data: DashboardData) => {
      if (!mounted) return;
      queryClient.setQueryData(['dashboard'], data);
    };

    const onAllocationResult = () => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    const onNewNotification = () => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    function registerHandlers(s: Socket) {
      // De-register first to avoid doubling on reconnect cycles.
      s.off('student:dashboard', onDashboard);
      s.off('allocation:result', onAllocationResult);
      s.off('notification:new', onNewNotification);

      s.on('student:dashboard', onDashboard);
      s.on('allocation:result', onAllocationResult);
      s.on('notification:new', onNewNotification);
    }

    function deregisterHandlers(s: Socket) {
      s.off('student:dashboard', onDashboard);
      s.off('allocation:result', onAllocationResult);
      s.off('notification:new', onNewNotification);
      s.off('connect', onReconnect);
    }

    // Re-register handlers each time the socket reconnects (fresh event subscriptions).
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
