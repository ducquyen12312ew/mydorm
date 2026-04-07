# Dormitory Mobile (Expo Go)

This app is a mobile shell for the existing web system.
It keeps UI and behavior aligned with web by rendering the web app directly in a React Native WebView.

## 1) Install and run

```bash
cd mobile-expo
npm install
npx expo start
```

Then scan the QR code in Expo Go.

## 2) Configure backend URL

By default:
- Android emulator uses `http://10.0.2.2:5000`
- iOS simulator uses `http://localhost:5000`

For real devices, run:

```bash
set EXPO_PUBLIC_WEBAPP_URL=http://YOUR_LAN_IP:5000
npx expo start
```

Example: `http://192.168.1.45:5000`

## 3) Realtime behavior

Because the mobile app loads the same backend pages/APIs, data updates remain in sync with web.
The app also includes:
- Pull to refresh
- Auto refresh when returning to foreground
- Basic loading and error fallback

## 4) Production

Set a real domain:

```bash
set EXPO_PUBLIC_APP_ENV=production
set EXPO_PUBLIC_WEBAPP_URL=https://your-production-domain.com
npx expo start
```
