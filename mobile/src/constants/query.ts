/** Centralized TanStack Query time constants (milliseconds) */
export const STALE = {
  /** Real-time data — refresh frequently */
  short: 15_000,
  /** Default: dashboard, notifications */
  default: 30_000,
  /** Slow-changing: profile, favorites, room list */
  medium: 60_000,
  /** Static: QR token (20 min before auto-refresh) */
  qr: 20 * 60_000,
} as const;

export const GC = {
  default: 5 * 60_000,
  qr: 25 * 60_000,
} as const;
