# Dormitory_Graduation

Project to design a dormitory management model for HUST students.

## Run App

```bash
npm install
npm run start
```

Default local URL: `http://localhost:5000`

## Mobile App (Expo Go, Realtime With Web)

Mobile app now lives in `mobile-expo/` and uses WebView to render the same web system,
so mobile and web stay in sync in real time with the same backend data.

Install mobile dependencies:

```bash
npm run mobile:install
```

Start Expo:

```bash
npm run mobile:start
```

For real phone on same Wi-Fi, set your LAN IP:

```bash
set EXPO_PUBLIC_WEBAPP_URL=http://YOUR_LAN_IP:5000
npm run mobile:start
```

Keep web and mobile running together:

```bash
npm run dev
npm run mobile:start
```

## Mobile UI Auto Test (Playwright)

This project includes Playwright tests for mobile screen sizes.

Current coverage includes:
- Core public routes: `/`, `/map`, `/login`, `/signup`, `/register`
- Viewport meta check
- Horizontal overflow check (first paint)
- Home mobile menu open/close interaction
- Orientation-like resize stability check

Note: the Playwright mobile suite is configured with single worker to avoid local rate-limit interference during smoke checks.

```bash
npm run test:mobile
```

Run with visible browser:

```bash
npm run test:mobile:headed
```

Open HTML test report:

```bash
npm run test:mobile:report
```

## Mobile Simulator (Quick Local Emulation)

Run app in Playwright emulated iOS device:

```bash
npm run sim:mobile:ios
```

Run app in Playwright emulated Android device:

```bash
npm run sim:mobile:android
```

## Existing Script

```bash
npm run test:cohort-shift
```
