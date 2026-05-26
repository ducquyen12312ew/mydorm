import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getApiBaseUrl } from '../config';

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 20000
});

export const apiClient = api;

const ACCESS_TOKEN_KEY = 'mobile_access_token';
const REFRESH_TOKEN_KEY = 'mobile_refresh_token';
const DEVICE_ID_KEY = 'mobile_device_id';

let inMemoryAccessToken = null;

async function getDeviceId() {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const generated = `device_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}

async function getFingerprint() {
  const userAgent = typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : 'unknown-user-agent';
  const platform = `${Platform.OS}:${String(Platform.Version)}`;
  return `${userAgent}|${platform}`;
}

async function getAccessToken() {
  if (inMemoryAccessToken) {
    return inMemoryAccessToken;
  }
  const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  inMemoryAccessToken = token;
  return token;
}

async function getRefreshToken() {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

async function persistTokens({ accessToken, refreshToken }) {
  inMemoryAccessToken = accessToken;
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens() {
  inMemoryAccessToken = null;
  await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const fullUrl = `${api.defaults.baseURL}${config.url}`;
  console.log(`📡 API Request: ${config.method.toUpperCase()} ${fullUrl}`);
  return config;
});

api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.method.toUpperCase()} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const fullUrl = error.config ? `${api.defaults.baseURL}${error.config.url}` : 'unknown';
    console.log(`❌ API Error: ${error.message} - ${fullUrl}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
    } else if (error.request) {
      console.log('   No response received from server');
    }
    
    const originalRequest = error.config || {};
    if (error?.response?.status !== 401 || originalRequest._retry) {
      throw error;
    }

    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      await clearTokens();
      throw error;
    }

    const deviceId = await getDeviceId();
    const fingerprint = await getFingerprint();

    originalRequest._retry = true;

    try {
      const { data } = await axios.post(`${getApiBaseUrl()}/auth/mobile/refresh`, {
        refreshToken,
        deviceId,
        fingerprint
      });

      await persistTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      });

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      await clearTokens();
      throw refreshError;
    }
  }
);

export async function login(payload) {
  const deviceId = await getDeviceId();
  const fingerprint = await getFingerprint();
  const { data } = await api.post('/auth/mobile/login', {
    ...payload,
    deviceId,
    fingerprint
  });
  await persistTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken
  });
  return data;
}

export async function logout() {
  const refreshToken = await getRefreshToken();
  const deviceId = await getDeviceId();
  const fingerprint = await getFingerprint();
  try {
    const { data } = await api.post('/auth/mobile/logout', { refreshToken, deviceId, fingerprint });
    await clearTokens();
    return data;
  } catch (error) {
    await clearTokens();
    throw error;
  }
}

export async function me() {
  const { data } = await api.get('/mobile/me');
  return data;
}

export async function dashboard() {
  const { data } = await api.get('/mobile/dashboard');
  return data.dashboard;
}

function normalizeDormitories(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.dormitories)) {
    return data.dormitories;
  }

  return [];
}

export async function rooms() {
  const { data } = await api.get('/mobile/rooms/explore', { params: { onlyAvailable: 'true' } });
  const dormitories = normalizeDormitories(data);
  return dormitories;
}

export async function publicRooms() {
  const { data } = await api.get('/public/rooms/explore', { params: { onlyAvailable: 'true' } });
  console.log('🏠 publicRooms response:', { success: data.success, dormitoriesCount: data.dormitories?.length });
  return data.dormitories || [];
}

export async function notifications() {
  const { data } = await api.get('/mobile/notifications', { params: { limit: 20 } });
  return data.notifications;
}

export async function markRead(id) {
  const { data } = await api.post(`/mobile/notifications/${id}/read`);
  return data;
}

export async function scorePreview(payload) {
  const { data } = await api.post('/mobile/applications/score-preview', payload);
  return data.score;
}

export async function submitApplication(payload) {
  const { data } = await api.post('/mobile/applications/submit', payload);
  return data;
}

export async function getFavorites() {
  const { data } = await api.get('/mobile/favorites');
  return data.favorites || [];
}

export async function saveFavorite(roomId) {
  const { data } = await api.post('/mobile/favorites', { roomId });
  return data;
}

export async function removeFavorite(roomId) {
  const { data } = await api.delete(`/mobile/favorites/${roomId}`);
  return data;
}

export async function getDeviceContext() {
  return {
    deviceId: await getDeviceId(),
    fingerprint: await getFingerprint()
  };
}
