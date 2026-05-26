import { Platform } from 'react-native';
import Constants from 'expo-constants';

function resolveApiBase(): string {
  const extra = Constants.expoConfig?.extra ?? {};

  if (__DEV__) {
    if (Platform.OS === 'android') {
      return extra.apiBaseUrl ?? 'http://10.0.2.2:5000';
    }
    return extra.apiBaseUrlIos ?? 'http://localhost:5000';
  }

  return extra.apiBaseUrlProd ?? 'https://api.hust-dormitory.edu.vn';
}

export const API_BASE = resolveApiBase();
export const SOCKET_URL = API_BASE;
export const API_PREFIX = '/api/student-app';
