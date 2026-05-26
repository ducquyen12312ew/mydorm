import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, disconnectSocket, getSocket } from './socket';
import { DashboardData } from '../api/dashboard';

export function useStudentSocket(enabled: boolean) {
  const queryClient = useQueryClient();
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    connectSocket().then((socket) => {
      if (!mounted) return;
      connectedRef.current = true;

      socket.on('student:dashboard', (data: DashboardData) => {
        if (!mounted) return;
        queryClient.setQueryData(['dashboard'], data);
        queryClient.setQueryData(
          ['notifications', 'unread'],
          data.notifications?.unreadCount ?? 0
        );
      });

      socket.on('allocation:result', (data: any) => {
        if (!mounted) return;
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      });

      socket.on('notification:new', () => {
        if (!mounted) return;
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      });
    });

    return () => {
      mounted = false;
      getSocket()?.off('student:dashboard');
      getSocket()?.off('allocation:result');
      getSocket()?.off('notification:new');
    };
  }, [enabled, queryClient]);
}
