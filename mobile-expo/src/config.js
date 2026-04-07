import { Platform } from 'react-native';

const DEFAULTS = {
  development: {
    android: 'http://10.0.2.2:5000',
    ios: 'http://localhost:5000',
    web: 'http://localhost:5000'
  },
  production: {
    android: 'https://your-production-domain.com',
    ios: 'https://your-production-domain.com',
    web: 'https://your-production-domain.com'
  }
};

export function getWebAppUrl() {
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV || 'development';
  const overrideUrl = process.env.EXPO_PUBLIC_WEBAPP_URL;

  if (overrideUrl) {
    return overrideUrl;
  }

  if (appEnv === 'production') {
    return DEFAULTS.production[Platform.OS] || DEFAULTS.production.web;
  }

  return DEFAULTS.development[Platform.OS] || DEFAULTS.development.web;
}
