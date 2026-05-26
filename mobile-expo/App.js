import 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { me } from './src/api/client';
import AppNavigator from './src/navigation/AppNavigator';
import { createRealtimeSocket } from './src/realtime/socket';
import { useAppStore } from './src/store/useAppStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20000,
      refetchOnWindowFocus: true,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000)
    }
  }
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage });

function getNavTheme(colorScheme) {
  return {
    ...DefaultTheme,
    dark: colorScheme === 'dark',
    colors: {
      ...DefaultTheme.colors,
      background: colorScheme === 'dark' ? '#0f172a' : '#f4f7ff',
      card: colorScheme === 'dark' ? '#111827' : '#ffffff',
      text: colorScheme === 'dark' ? '#eef3ff' : '#0f172a',
      border: colorScheme === 'dark' ? '#1f2937' : '#e2e8f0',
      primary: '#667eea'
    }
  };
}

function Bootstrap() {
  const queryClient = useQueryClient();
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const setDashboard = useAppStore((s) => s.setDashboard);
  const setOffline = useAppStore((s) => s.setOffline);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const profile = await me();
        if (mounted) {
          setUser(profile.user);
        }
      } catch (_) {
        if (mounted) {
          setUser(null);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [setUser]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let socket;
    let disposed = false;

    (async () => {
      socket = await createRealtimeSocket();
      if (disposed) {
        socket.disconnect();
        return;
      }

      socket.on('connect', () => setOffline(false));
      socket.on('disconnect', () => setOffline(true));
      socket.on('student:dashboard', (dashboard) => {
        if (dashboard) {
          setDashboard(dashboard);
          queryClient.setQueryData(['dashboard'], dashboard);
        }
      });
      socket.on('student:dashboard:refresh', () => {
        socket.emit('student:dashboard:request');
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      });
      socket.on('application:updated', () => {
        socket.emit('student:dashboard:request');
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      });
      socket.on('student:assigned', () => {
        socket.emit('student:dashboard:request');
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
      });
    })();

    return () => {
      disposed = true;
      if (socket) {
        socket.disconnect();
      }
    };
  }, [queryClient, user, setDashboard, setOffline]);

  return <AppNavigator />;
}

export default function App() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 6 }}>
        <NavigationContainer theme={getNavTheme(colorScheme)}>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Bootstrap />
        </NavigationContainer>
      </PersistQueryClientProvider>
    </QueryClientProvider>
  );
}
