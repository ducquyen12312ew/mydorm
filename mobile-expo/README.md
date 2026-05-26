# Dormitory Mobile App (Expo Native)

## 1) Install

```bash
npm install
```

## 2) Environment (required)

Create `.env` from `.env.example`.

Local development example:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.45:5000/api/student-app
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.45:5000
```

Production server example:

```env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api/student-app
EXPO_PUBLIC_SOCKET_URL=https://api.yourdomain.com
```

## 3) Run

```bash
npm run start
```

## 4) Simulators

Android emulator:

```bash
npm run android
```

iOS simulator (macOS only):

```bash
npm run ios
```

## 5) EAS APK/AAB build

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
eas build -p android --profile production
```

`preview` profile builds APK and can be installed without Expo Go.

APK download location: EAS build dashboard URL shown in CLI output after build completes.
