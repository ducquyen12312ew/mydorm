import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { connectSocket, disconnectSocket, ensureConnected } from '../src/realtime/socket';
import { registerSessionExpiredCallback, refreshApiBaseUrl } from '../src/api/client';
import { initSentry } from '../src/config/sentry';
import { initApiConfig } from '../src/config';
import {
  setupNotificationChannels,
  requestNotificationPermission,
  clearBadge,
} from '../src/notifications/notificationService';

// Initialize Sentry before anything else renders
initSentry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnMount: true,
    },
  },
});

function AppLifecycle() {
  const { isAuthenticated, forceReset, restoreSession } = useAuthStore();
  const qc = useQueryClient();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Restore session on every cold start (including deep links bypassing index.tsx)
  useEffect(() => {
    restoreSession();
  }, []);

  // Register the session-expired callback once so the API interceptor can
  // force a logout without a circular import.
  useEffect(() => {
    registerSessionExpiredCallback(() => {
      forceReset();
    });
  }, [forceReset]);

  // Manage socket connection based on auth state.
  useEffect(() => {
    if (isAuthenticated) {
      connectSocket();
    } else {
      disconnectSocket();
    }
  }, [isAuthenticated]);

  // Refresh stale data and reconnect socket when app comes to foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        const prev = appStateRef.current;
        appStateRef.current = nextState;

        if (prev.match(/inactive|background/) && nextState === 'active') {
          // Người dùng quay lại app → coi như đã xem → xoá badge.
          clearBadge().catch(() => {});
          if (isAuthenticated) {
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            qc.invalidateQueries({ queryKey: ['notifications'] });
            ensureConnected();
          }
        }
      }
    );

    return () => subscription.remove();
  }, [isAuthenticated, qc]);

  return null;
}

/**
 * Lắng nghe khi người dùng tap vào push notification (kể cả khi app ở background)
 * và điều hướng theo deepLink đính kèm trong payload.
 */
function NotificationDeepLinkHandler() {
  const router = useRouter();
  const listenerRef = useRef<ReturnType<
    typeof Notifications.addNotificationResponseReceivedListener
  > | null>(null);

  useEffect(() => {
    listenerRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { deepLink?: string };
      if (data?.deepLink) {
        setTimeout(() => {
          try {
            router.push(data.deepLink as any);
          } catch (e) {
            console.warn('[DeepLink]', e);
          }
        }, 500);
      }
    });
    return () => listenerRef.current?.remove();
  }, [router]);

  return null;
}

function RootLayout() {
  const [configReady, setConfigReady] = useState(false);

  useEffect(() => {
    async function init() {
      await initApiConfig();
      refreshApiBaseUrl();
      await setupNotificationChannels();
      requestNotificationPermission().catch(() => {}); // non-blocking
      setConfigReady(true);
    }
    init();
  }, []);

  if (!configReady) return <View style={styles.root} />;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppLifecycle />
          <NotificationDeepLinkHandler />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="room/[id]"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="maintenance/index"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="maintenance/new"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="maintenance/[id]"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="violations/index"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="allocation/index"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="card/index"
              options={{ presentation: 'modal' }}
            />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

// Wrap with Sentry to catch unhandled JS crashes and report navigation context
export default Sentry.wrap(RootLayout);
