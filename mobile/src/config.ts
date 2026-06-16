import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEV_URL_KEY = 'edorm_dev_server_url';

function buildDefaultBase(): string {
  const extra = Constants.expoConfig?.extra ?? {};
  if (__DEV__) {
    if (Platform.OS === 'android') return extra.apiBaseUrl ?? 'http://10.0.2.2:5000';
    return extra.apiBaseUrlIos ?? 'http://localhost:5000';
  }
  return extra.apiBaseUrlProd ?? 'https://api.hust-dormitory.edu.vn';
}

// Mutable config — updated once during app init via initApiConfig()
export const apiConfig = {
  baseUrl: buildDefaultBase(),
};

export const API_PREFIX = '/api/student-app';

// Called once at app startup in _layout.tsx — reads AsyncStorage override
export async function initApiConfig(): Promise<void> {
  if (!__DEV__) return;
  try {
    const override = await AsyncStorage.getItem(DEV_URL_KEY);
    if (override && override.startsWith('http')) {
      apiConfig.baseUrl = override;
    }
  } catch (_) {}
}

// Save a new dev server URL (ngrok etc.) — persists across restarts
export async function setDevServerUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/$/, '');
  apiConfig.baseUrl = clean;
  await AsyncStorage.setItem(DEV_URL_KEY, clean);
}

// Reset to default platform URL
export async function clearDevServerUrl(): Promise<void> {
  apiConfig.baseUrl = buildDefaultBase();
  await AsyncStorage.removeItem(DEV_URL_KEY);
}

export function getDefaultBase(): string {
  return buildDefaultBase();
}
