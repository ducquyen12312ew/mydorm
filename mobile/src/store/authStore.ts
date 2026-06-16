import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { loginMobile, logoutMobile, AuthUser } from '../api/auth';
import { TokenStore } from '../api/client';
import { getDeviceId, getFingerprint } from '../utils/device';

const isWeb = Platform.OS === 'web';
async function storeUser(key: string, value: string) {
  if (isWeb) { try { localStorage.setItem(key, value); } catch (_) {} return; }
  await SecureStore.setItemAsync(key, value);
}
async function loadUser(key: string): Promise<string | null> {
  if (isWeb) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  return SecureStore.getItemAsync(key);
}
async function deleteUser(key: string) {
  if (isWeb) { try { localStorage.removeItem(key); } catch (_) {} return; }
  try { await SecureStore.deleteItemAsync(key); } catch (_) {}
}

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
    await storeUser(USER_KEY, JSON.stringify(result.user));

    set({ user: result.user, isAuthenticated: true });
  },

  logout: async () => {
    await logoutMobile();
    await deleteUser(USER_KEY);
    set({ user: null, isAuthenticated: false });
  },

  forceReset: async () => {
    try { await deleteUser(USER_KEY); } catch (_) {}
    set({ user: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    try {
      const [accessToken, userJson] = await Promise.all([
        TokenStore.getAccess(),
        loadUser(USER_KEY),
      ]);

      if (accessToken && userJson) {
        const user: AuthUser = JSON.parse(userJson);
        set({ user, isAuthenticated: true, isLoading: false });
        return true;
      }
    } catch (_) {
      await TokenStore.clear();
      try { await deleteUser(USER_KEY); } catch (_2) {}
    }

    set({ isLoading: false });
    return false;
  },
}));
