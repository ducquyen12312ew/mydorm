import axios from 'axios';
import { API_BASE, API_PREFIX } from '../config';
import { TokenStore } from './client';

export interface LoginPayload {
  username: string;
  password: string;
  deviceId: string;
  fingerprint: string;
}

export interface AuthUser {
  id: string;
  name: string;
  role: string;
  studentId: string;
}

export interface LoginResponse {
  success: boolean;
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
}

export async function loginMobile(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await axios.post<LoginResponse>(
    `${API_BASE}${API_PREFIX}/auth/mobile/login`,
    payload,
    { timeout: 15000 }
  );
  if (!data.success) {
    throw new Error((data as any).error || 'Login failed');
  }
  return data;
}

export async function logoutMobile(): Promise<void> {
  try {
    const refreshToken = await TokenStore.getRefresh();
    if (refreshToken) {
      await axios.post(
        `${API_BASE}${API_PREFIX}/auth/mobile/logout`,
        { refreshToken, reason: 'LOGOUT' },
        { timeout: 8000 }
      );
    }
  } catch (_) {
    // Best-effort logout
  } finally {
    await TokenStore.clear();
  }
}
