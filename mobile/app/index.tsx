import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '../src/store/authStore';
import { LoadingSpinner } from '../src/components/ui/LoadingSpinner';

export default function Index() {
  const { isAuthenticated, isLoading, restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, []);

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (isAuthenticated) return <Redirect href="/(tabs)/" />;
  return <Redirect href="/(auth)/login" />;
}
