# Dormitory Graduation System

Dormitory management system for HUST students with real-time allocation, mobile app, and production-ready architecture.

---

# 1. Setup

## 1.1 Install dependencies

```bash
npm install
npm run student:web:install
npm run mobile:install
```

## 1.2 Environment variables

Create `.env` in root:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/dormitory
JWT_SECRET=your_secret
REDIS_URL=redis://localhost:6379
```

Mobile (`mobile-expo/.env`):

```env
EXPO_PUBLIC_API_URL=http://localhost:5000/api/student-app
EXPO_PUBLIC_SOCKET_URL=http://localhost:5000
```

---

# 2. Run

## Option A (recommended): run backend + web together

```bash
npm start
```

This command starts both backend and student web and prints active localhost links.

## Option B: run services separately

1. Backend

```bash
npm run start:backend
```

2. Student Web (Vite)

```bash
npm run student:web
```

3. Mobile App

```bash
npm run mobile:start
```

---

# 3. Access

- Backend + Web links: read the links printed by `npm start`
- Default backend (if free): http://localhost:5000
- Student route: http://localhost:5000/student
- API base: http://localhost:5000/api

---

# 4. Mobile App

## Run on emulator

```bash
npm run mobile:start
```

- Press `a`: Android emulator
- Press `i`: iOS simulator (Mac only)

## Run on real device

Set LAN IP:

```env
EXPO_PUBLIC_API_URL=http://YOUR_IP:5000/api/student-app
EXPO_PUBLIC_SOCKET_URL=http://YOUR_IP:5000
```

---

# 5. Build APK (EAS)

```bash
cd mobile-expo
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```

APK will be available via Expo dashboard download link.

---

# 6. Tests

```bash
npm run test:mobile
```

---

# 7. Mobile Simulation (Browser)

```bash
npm run sim:mobile:ios
npm run sim:mobile:android
```

Note: This is browser emulation, not real device behavior.

---

# 8. Troubleshooting

Expo cannot connect:
- Ensure same Wi-Fi network
- Use LAN IP instead of localhost

Port already in use:

```bash
npx kill-port 5000
```

Mongo connection error:
- Ensure MongoDB is running locally

---

# 9. Health Check

```http
GET /health
```

Expected response:

```json
{ "status": "ok" }
```

---

# 10. Quick Demo Checklist

- [ ] Backend runs
- [ ] Web loads `/student`
- [ ] Mobile connects
- [ ] Login works
- [ ] Realtime updates work
- [ ] Offline to online sync works
- [ ] APK installs and runs

---

# Notes

- Web uses session auth
- Mobile uses JWT auth
- Realtime via Socket.IO + Redis adapter
- Event-driven architecture with durable outbox
