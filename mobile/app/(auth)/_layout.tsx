import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (isAuthenticated) return <Redirect href="/(tabs)/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
