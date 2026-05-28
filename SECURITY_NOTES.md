# Security Notes — HUST Dormitory Management System

This document explains the security decisions in the authentication system, JWT implementation, QR signing, and validation layer.

---

## 1. Dual Authentication Model

The system uses two separate, intentionally non-bridging auth mechanisms:

| Surface | Mechanism | Session Store |
|---------|-----------|--------------|
| Web admin portal | Session cookie (express-session) | MongoDB via connect-mongo |
| Student mobile app | JWT access + refresh tokens | MongoDB `MobileRefreshToken` collection |

**Why they don't share:** Web sessions rely on server-side session state (cookie → session ID → session record). JWTs are stateless bearer tokens. Bridging them would require either making JWTs stateful (defeating their purpose) or making sessions stateless (breaking web security assumptions). The clean split means a compromise of the mobile JWT layer doesn't grant web admin access, and vice versa.

---

## 2. JWT Access Token Flow

### Issuance (`mobileTokenService.js:issueMobileTokens`)

```
POST /auth/mobile/login
{ username, password, deviceId, fingerprint }
         │
         ▼
bcrypt.compare(password, student.passwordHash)
         │ success
         ▼
jwt.sign({ sub, role, typ: 'access' }, ACCESS_SECRET, { expiresIn: '15m' })
jwt.sign({ sub, role, typ: 'refresh', jti: 24-random-bytes }, REFRESH_SECRET, { expiresIn: '30d' })
         │
         ▼
sha256(refreshToken) → stored in MobileRefreshToken
accessToken → returned to client (NOT stored server-side)
```

**Access token lifetime: 15 minutes.** Short enough that a stolen access token has a narrow exploitation window. The HMAC-SHA256 signature prevents forgery.

**Refresh token lifetime: 30 days.** Stored *hashed* (SHA-256) in the database. The raw token is never stored server-side, so a database breach only exposes token hashes — not the tokens themselves.

### Verification (`mobileJwtAuth.js:requireMobileJwt`)

```
Authorization: Bearer <accessToken>
         │
         ▼
jwt.verify(token, ACCESS_SECRET)
  └─ Validates HMAC-SHA256 signature
  └─ Validates exp claim
  └─ Validates typ === 'access' (prevents refresh tokens being used as access tokens)
         │
         ▼
req.mobileAuth = { userId: payload.sub }
```

The `typ` claim check is important: without it, a stolen refresh token could be used directly as an access token against endpoints that only check the signature.

---

## 3. Refresh Token Rotation

Every call to `POST /auth/mobile/refresh` consumes the old refresh token and issues a new one. The old token is immediately marked `revokedAt` with reason `ROTATED`, and its hash is chained to the replacement via `replacedByTokenHash`.

```
rotateRefreshToken(refreshToken, metadata)
  1. jwt.verify(refreshToken, REFRESH_SECRET)        — signature + expiry
  2. sha256(refreshToken) → lookup MobileRefreshToken — verifies token exists + not revoked
  3. computeRiskScore(stored, metadata)               — anomaly detection
  4. If riskScore >= 70 → reject (throw)
  5. stored.revokedAt = now, revokedReason = 'ROTATED'
  6. stored.replacedByTokenHash = sha256(newRefreshToken)
  7. Create new MobileRefreshToken record
  8. Issue new accessToken + refreshToken pair
```

**Rotation chain:** The `replacedByTokenHash` field creates a linked list of token rotations. If an attacker captures an old refresh token and attempts to use it after rotation, the lookup finds `revokedAt` set and rejects it. The legitimate client's new token is unaffected.

---

## 4. Risk Scoring on Token Refresh

The `computeRiskScore` function assigns a 0–100 risk score to each refresh attempt based on contextual signals:

| Signal | Risk Added | Notes |
|--------|-----------|-------|
| Device ID mismatch | +100 | Hard signal — different device |
| Fingerprint mismatch | +35 | Soft signal |
| Same platform (same OS prefix in fingerprint) | −20 | Discount for same-platform fingerprint drift |
| IP address changed | +20 | Moderate signal |
| User-agent hash changed | +25 | Moderate signal |
| Used recently (< 10 min) + other anomaly | +10 | Suspicious velocity |

**Threshold: 70.** Above this, the token is rejected and an anomaly is recorded. The threshold and behavior are tunable via environment variables:

```
MOBILE_ANOMALY_RISK_THRESHOLD=70        # default
MOBILE_ALERT_ON_TOKEN_ANOMALY=true      # log warning
MOBILE_INVALIDATE_ON_TOKEN_ANOMALY=false # don't auto-revoke below threshold
```

**Why not always invalidate?** Fingerprint drift is common on legitimate devices (app update, OS update, carrier change). A hard revoke on every fingerprint change would log out users unexpectedly. The graduated scoring lets soft signals accumulate before triggering action.

---

## 5. QR Resident Card — Backend Signing

The resident QR card uses a custom HMAC-SHA256 token, not JWT. The design prioritizes clarity over reuse:

### Token Format
```
base64url(JSON payload) + "." + HMAC-SHA256(JSON payload, QR_SECRET)
```

### Payload
```json
{
  "v": 2,
  "sub": "<student MongoDB _id>",
  "sid": "<student ID number>",
  "name": "<display name>",
  "room": "<room number>",
  "iat": 1716900000,
  "exp": 1716986400
}
```

### Security Properties

**Server-signed, client-opaque:** The mobile app receives the token as an opaque string and encodes it into a QR code without parsing or modifying it. All cryptographic logic lives on the server (`qr.routes.js`).

**TTL: 24 hours.** Sufficient for a student to show their card throughout a day without requiring a network connection. The token is auto-regenerated every visit to the card screen if the stored token is within `STALE.qr` (20 minutes of its generation, triggering a background refetch).

**Timing-safe comparison:** Signature verification uses `crypto.timingSafeEqual` to prevent timing side-channel attacks:
```javascript
if (!crypto.timingSafeEqual(Buffer.from(sigPart, 'hex'), Buffer.from(expectedSig, 'hex'))) {
  throw new Error('Invalid signature');
}
```

**Replay mitigation:** The `exp` claim is verified server-side. An expired token (even if the HMAC is valid) is rejected. A stolen token can only be used within its 24-hour window — acceptable for a campus ID card scenario where a guard visually confirms the student matches the card.

**Verification endpoint is public:** `GET /mobile/qr/verify?token=...` does not require a JWT. It is intended for guard/admin scanner apps that may not be authenticated students. The endpoint only returns the student's name, ID, and room number — not sensitive fields.

---

## 6. Input Validation

All mobile API endpoints validate inputs using `express-validator` before they reach route logic. Common patterns:

```javascript
body('username').trim().notEmpty().isLength({ max: 50 })
body('password').notEmpty().isLength({ min: 6, max: 128 })
body('deviceId').optional().trim().isLength({ max: 200 })
```

**MongoDB injection prevention:** `express-mongo-sanitize` is applied globally (`app.use(mongoSanitize())`). It strips `$` and `.` from request body keys, preventing operator injection attacks like `{ "username": { "$gt": "" } }`.

**XSS prevention:** `helmet` is applied globally with default CSP, X-Content-Type-Options, and X-Frame-Options headers. EJS templates use `<%= %>` (escaped output) by default; `<%- %>` is only used for explicitly safe, server-controlled content.

---

## 7. Session Security (Web Portal)

```
SESSION_SECRET           — must be set in production (warns at startup if using fallback)
dormitory_session cookie — httpOnly, sameSite: 'lax'
maxAge                   — 1 day default, 30 days if "remember me" checked
```

**`sameSite: 'lax'`** prevents CSRF in most cross-site scenarios (top-level navigation is allowed, but cross-origin POST is not). This is the correct setting for a standard web app with form submissions.

**Session store:** connect-mongo stores sessions in MongoDB. Sessions are expired by TTL index — no manual cleanup required.

---

## 8. Password Security

- **Hashing:** bcrypt with salt rounds = 10 (cost factor). Each password hash is unique even if two users have the same password.
- **No plaintext storage:** Passwords are hashed at registration and on admin password reset. The hash is never logged.
- **Default admin:** `createDefaultAdmin()` uses password `admin123` for development. This is acceptable only in the dev environment. Production deployments must rotate this immediately.

---

## 9. Rate Limiting

`express-rate-limit` is applied on authentication endpoints to prevent brute-force attacks:

```javascript
// Login endpoint
rateLimit({ windowMs: 15 * 60 * 1000, max: 20 })

// Token refresh endpoint  
rateLimit({ windowMs: 15 * 60 * 1000, max: 60 })
```

This limits an attacker to 20 login attempts per 15 minutes per IP — insufficient for a meaningful dictionary attack against bcrypt hashes.

---

## 10. Known Limitations

These are accepted limitations appropriate for a graduation project:

| Limitation | Risk | Mitigation |
|-----------|------|-----------|
| QR token has no revocation (only expiry) | Stolen token valid up to 24h | Acceptable for campus ID; real fix = revocation list |
| Refresh token DB lookup on every rotation (not cached) | Adds ~5 ms latency per refresh | Acceptable at this scale |
| Default admin password `admin123` | Admin account takeover if deployed as-is | Document: must be changed before production |
| Social login buttons (Google/Facebook) non-functional | User confusion | Display "coming soon" or remove buttons |
| `forgot-password` renders success without sending email | Silently broken feature | Fix before production: integrate Nodemailer + verified SMTP |
| No HTTPS enforced at app layer | MITM if deployed without TLS proxy | Production must terminate TLS at nginx/load balancer |
