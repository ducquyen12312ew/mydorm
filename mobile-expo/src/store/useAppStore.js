import { create } from 'zustand';

export const useAppStore = create((set) => ({
  user: null,
  dashboard: null,
  offline: false,
  setUser: (user) => set({ user }),
  setDashboard: (dashboard) => set({ dashboard }),
  setOffline: (offline) => set({ offline })
}));
