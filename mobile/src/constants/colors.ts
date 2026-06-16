export const Colors = {
  primary: '#d63031',
  primaryDark: '#b71c1c',
  primaryLight: '#fef2f2',

  background: '#f5f6fa',
  surface: '#ffffff',
  surfaceAlt: '#f0f0f0',

  text: '#1a1a2e',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  textInverse: '#ffffff',

  border: '#e5e7eb',
  borderFocus: '#d63031',

  success: '#27ae60',
  successLight: '#f0faf4',
  warning: '#f39c12',
  warningLight: '#fffbeb',
  error: '#e74c3c',
  errorLight: '#fef2f2',
  info: '#3498db',
  infoLight: '#eff6ff',

  statusPending: '#f39c12',
  statusApproved: '#27ae60',
  statusRejected: '#e74c3c',
  statusWaitlist: '#8b5cf6',

  tabActive: '#d63031',
  tabInactive: '#9ca3af',

  skeleton: '#e5e7eb',
  skeletonHighlight: '#f3f4f6',

  overlay: 'rgba(0,0,0,0.4)',
  shadow: 'rgba(0,0,0,0.08)',
} as const;

export type ColorKey = keyof typeof Colors;
