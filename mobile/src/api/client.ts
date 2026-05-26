import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE, API_PREFIX } from '../config';

const KEYS = {
  accessToken: 'mobile_access_token',
  refreshToken: 'mobile_refresh_token',
  deviceId: 'mobile_device_id',
  fingerprint: 'mobile_fingerprint',
} as const;

export const TokenStore = {
  async save(access: string, refresh: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.accessToken, access),
      SecureStore.setItemAsync(KEYS.refreshToken, refresh),
    ]);
  },
  async getAccess(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.accessToken);
  },
  async getRefresh(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.refreshToken);
  },
  async saveDevice(deviceId: string, fingerprint: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.deviceId, deviceId),
      SecureStore.setItemAsync(KEYS.fingerprint, fingerprint),
    ]);
  },
  async getDevice(): Promise<{ deviceId: string; fingerprint: string }> {
    const [deviceId, fingerprint] = await Promise.all([
      SecureStore.getItemAsync(KEYS.deviceId),
      SecureStore.getItemAsync(KEYS.fingerprint),
    ]);
    return { deviceId: deviceId ?? 'unknown', fingerprint: fingerprint ?? 'unknown' };
  },
  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.accessToken),
      SecureStore.deleteItemAsync(KEYS.refreshToken),
    ]);
  },
};

export const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE}${API_PREFIX}`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

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

      const { data } = await axios.post(`${API_BASE}${API_PREFIX}/auth/mobile/refresh`, {
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
      await TokenStore.clear();
      drainQueue(null);
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);
