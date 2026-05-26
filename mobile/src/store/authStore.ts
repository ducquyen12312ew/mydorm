import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { loginMobile, logoutMobile, AuthUser } from '../api/auth';
import { TokenStore } from '../api/client';
import { getDeviceId, getFingerprint } from '../utils/device';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Called by the API interceptor when refresh token is expired — clears state
  // without attempting an API call (tokens are already gone).
  forceReset: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
}

const USER_KEY = 'mobile_auth_user';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (username, password) => {
    const deviceId = getDeviceId();
    const fingerprint = getFingerprint();

    await TokenStore.saveDevice(deviceId, fingerprint);

    const result = await loginMobile({ username, password, deviceId, fingerprint });

    await TokenStore.save(result.accessToken, result.refreshToken);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user));

    set({ user: result.user, isAuthenticated: true });
  },

  logout: async () => {
    await logoutMobile();
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ user: null, isAuthenticated: false });
  },

  forceReset: async () => {
    // Tokens already cleared by interceptor — just wipe user cache and reset state.
    try { await SecureStore.deleteItemAsync(USER_KEY); } catch (_) {}
    set({ user: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    try {
      const [accessToken, userJson] = await Promise.all([
        TokenStore.getAccess(),
        SecureStore.getItemAsync(USER_KEY),
      ]);

      if (accessToken && userJson) {
        const user: AuthUser = JSON.parse(userJson);
        set({ user, isAuthenticated: true, isLoading: false });
        return true;
      }
    } catch (_) {
      await TokenStore.clear();
      try { await SecureStore.deleteItemAsync(USER_KEY); } catch (_2) {}
    }

    set({ isLoading: false });
    return false;
  },
}));
