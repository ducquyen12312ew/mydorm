import { Home, Send, BedDouble, Bell, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/dashboard', label: 'Home', icon: Home },
  { to: '/apply', label: 'Apply', icon: Send },
  { to: '/rooms', label: 'Rooms', icon: BedDouble },
  { to: '/notifications', label: 'Alerts', icon: Bell },
  { to: '/profile', label: 'Profile', icon: UserRound }
];

export default function BottomTabs() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/70 bg-white/90 px-3 pb-6 pt-2 backdrop-blur dark:border-slate-700 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                isActive
                  ? 'bg-gradient-to-br from-coral to-amber-400 text-white shadow-soft'
                  : 'text-slate-500 dark:text-slate-300'
              }`
            }
          >
            <Icon size={18} />
            <span className="mt-1">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
