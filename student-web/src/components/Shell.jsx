import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { MoonStar, SunMedium } from 'lucide-react';
import BottomTabs from './BottomTabs';
import { useAppStore } from '../store/appStore';

export default function Shell({ children }) {
  const location = useLocation();
  const isOffline = useAppStore((s) => s.isOffline);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <div className="relative min-h-screen bg-haze pb-28 text-ink dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,#ffbe987a,transparent_35%),radial-gradient(circle_at_bottom_left,#7be3d37a,transparent_30%)]" />
      <main className="relative mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-4 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Student Space</p>
            <p className="text-sm text-slate-500">Realtime allocation shell</p>
          </div>
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold shadow-soft dark:bg-slate-900"
          >
            {theme === 'dark' ? <SunMedium size={16} /> : <MoonStar size={16} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>

        {isOffline ? (
          <div className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">
            Offline mode enabled. Showing cached data.
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="space-y-4"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomTabs />
    </div>
  );
}
