import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { Navigate, Route, Routes } from 'react-router-dom';
import Shell from './components/Shell';
import DashboardScreen from './screens/DashboardScreen';
import ApplyScreen from './screens/ApplyScreen';
import RoomsScreen from './screens/RoomsScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import ProfileScreen from './screens/ProfileScreen';
import LoginScreen from './screens/LoginScreen';
import { createStudentSocket } from './lib/socket';
import { useAppStore } from './store/appStore';

function AppRoutes() {
  return (
    <Shell>
      <Routes>
        <Route path="/dashboard" element={<DashboardScreen />} />
        <Route path="/apply" element={<ApplyScreen />} />
        <Route path="/rooms" element={<RoomsScreen />} />
        <Route path="/notifications" element={<NotificationsScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Shell>
  );
}

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined
});

export default function App() {
  const queryClient = useQueryClient();
  const setDashboard = useAppStore((s) => s.setDashboard);
  const setOffline = useAppStore((s) => s.setOffline);
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const socket = createStudentSocket();

    socket.on('connect', () => setOffline(false));
    socket.on('disconnect', () => setOffline(true));
    socket.on('student:dashboard', (dashboard) => {
      if (dashboard) {
        setDashboard(dashboard);
        queryClient.setQueryData(['dashboard'], dashboard);
      }
    });
    socket.on('student:dashboard:refresh', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
    socket.on('application:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['registration-window'] });
    });
    socket.on('student:assigned', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    });

    return () => socket.disconnect();
  }, [queryClient, setDashboard, setOffline]);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 6 }}>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/*" element={<AppRoutes />} />
      </Routes>
    </PersistQueryClientProvider>
  );
}
