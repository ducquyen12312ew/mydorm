import { create } from 'zustand';

function getInitialTheme() {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage.getItem('student-theme');
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }

  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useAppStore = create((set) => ({
  theme: getInitialTheme(),
  dashboard: null,
  isOffline: false,
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('student-theme', theme);
    }
    set({ theme });
  },
  setDashboard: (dashboard) => set({ dashboard }),
  setOffline: (isOffline) => set({ isOffline })
}));
