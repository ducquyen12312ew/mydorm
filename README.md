# Dormitory Management System — HUST

Web-based dormitory management system for HUST students with real-time allocation, academic policy engine, and admin portal.

---

## 1. Setup

### Install dependencies

```bash
npm install
```

### Environment variables

Create `.env` in root (see `.env.example`):

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/dormitory
SESSION_SECRET=your_session_secret
JWT_SECRET=your_jwt_secret
```

---

## 2. Run

```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

---

## 3. Access

| URL | Description |
|-----|-------------|
| `http://localhost:5000` | Main web app (admin + public pages) |
| `http://localhost:5000/admin` | Admin portal |
| `http://localhost:5000/student` | Student portal |
| `http://localhost:5000/api` | REST API base |
| `http://localhost:5000/health` | Health check |

---

## 4. Tests

```bash
# Quota admin API tests
npm run test:quota-api
```

Requires Node 18+.

---

## 5. Useful Scripts

```bash
# Create admin account
node scripts/create-admin.js

# Create academic registration window
node scripts/create-academic-window.js

# Seed quota admins (admin1/admin2/admin3)
npm run seed:quota-admins

# Remove legacy quota fields (migration)
npm run migrate:remove-legacy-quota

# Seed sample students for testing
node scripts/seed-sample-students.js

# Seed sample applications
node scripts/seed-sample-applications.js

# Generate mock allocation data
node scripts/generate-mock-allocation-data.js
```

---

## 6. Architecture

See `ARCHITECTURE.md` for system architecture, business logic, and data model overview.

See `report/quota-system.md` for quota system reference.

---

## 7. Troubleshooting

**MongoDB connection error** — ensure MongoDB is running locally

**Port in use** — `npx kill-port 5000`

**Session issues** — check `SESSION_SECRET` is set in `.env`
