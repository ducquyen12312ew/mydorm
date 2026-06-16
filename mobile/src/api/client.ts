import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiConfig, API_PREFIX } from '../config';

const KEYS = {
  accessToken: 'mobile_access_token',
  refreshToken: 'mobile_refresh_token',
  deviceId: 'mobile_device_id',
  fingerprint: 'mobile_fingerprint',
} as const;

// Web-safe SecureStore wrapper: falls back to localStorage on web (screenshots/demo only)
const isWeb = Platform.OS === 'web';

async function secureSet(key: string, value: string) {
  if (isWeb) { try { localStorage.setItem(key, value); } catch (_) {} return; }
  await SecureStore.setItemAsync(key, value);
}
async function secureGet(key: string): Promise<string | null> {
  if (isWeb) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  return SecureStore.getItemAsync(key);
}
async function secureDel(key: string) {
  if (isWeb) { try { localStorage.removeItem(key); } catch (_) {} return; }
  try { await SecureStore.deleteItemAsync(key); } catch (_) {}
}

export const TokenStore = {
  async save(access: string, refresh: string): Promise<void> {
    await Promise.all([secureSet(KEYS.accessToken, access), secureSet(KEYS.refreshToken, refresh)]);
  },
  async getAccess(): Promise<string | null> { return secureGet(KEYS.accessToken); },
  async getRefresh(): Promise<string | null> { return secureGet(KEYS.refreshToken); },
  async saveDevice(deviceId: string, fingerprint: string): Promise<void> {
    await Promise.all([secureSet(KEYS.deviceId, deviceId), secureSet(KEYS.fingerprint, fingerprint)]);
  },
  async getDevice(): Promise<{ deviceId: string; fingerprint: string }> {
    const [deviceId, fingerprint] = await Promise.all([secureGet(KEYS.deviceId), secureGet(KEYS.fingerprint)]);
    return { deviceId: deviceId ?? 'unknown', fingerprint: fingerprint ?? 'unknown' };
  },
  async clear(): Promise<void> {
    await Promise.all([secureDel(KEYS.accessToken), secureDel(KEYS.refreshToken)]);
  },
};

// Callback registered by the root layout so the interceptor can signal session expiry
// without creating a circular import (client → authStore).
let _onSessionExpired: (() => void) | null = null;

export function registerSessionExpiredCallback(cb: () => void): void {
  _onSessionExpired = cb;
}

export const api: AxiosInstance = axios.create({
  baseURL: `${apiConfig.baseUrl}${API_PREFIX}`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Called after initApiConfig() resolves so axios uses the correct URL
export function refreshApiBaseUrl(): void {
  api.defaults.baseURL = `${apiConfig.baseUrl}${API_PREFIX}`;
}

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

function drainQueue(token: string | null) {
  refreshQueue.forEach((resolve) => resolve(token));
  refreshQueue = [];
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await TokenStore.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retried) {
      return Promise.reject(error);
    }

    original._retried = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((newToken) => {
          if (!newToken) {
            reject(error);
            return;
          }
          original.headers.Authorization = `Bearer ${newToken}`;
          resolve(api(original));
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshToken = await TokenStore.getRefresh();
      const { deviceId, fingerprint } = await TokenStore.getDevice();

      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const { data } = await axios.post(`${apiConfig.baseUrl}${API_PREFIX}/auth/mobile/refresh`, {
        refreshToken,
        deviceId,
        fingerprint,
      });

      if (!data.success) {
        throw new Error('Refresh failed');
      }

      await TokenStore.save(data.accessToken, data.refreshToken);
      drainQueue(data.accessToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (_) {
      // Refresh token is expired or invalid — clear storage and signal the UI
      await TokenStore.clear();
      drainQueue(null);
      _onSessionExpired?.();
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);
