/**
 * QR Resident Card — backend-signed tokens
 *
 * Flow:
 *   1. Mobile calls POST /mobile/qr/token  → gets a signed, time-limited token
 *   2. Mobile encodes the token into a QR code (opaque string, not parsed client-side)
 *   3. Scanner hits GET /mobile/qr/verify?token=...  → gets student identity if valid
 *
 * Security:
 *   - HMAC-SHA256 signed with QR_SECRET (falls back to JWT_SECRET)
 *   - 24-hour TTL hard-coded in payload; server rejects expired tokens
 *   - Token rotates every call — old tokens remain valid until exp
 *   - No cryptographic logic lives in the mobile app
 */
const express = require('express');
const crypto = require('crypto');
const { StudentCollection } = require('../../../config/config');
const { requireMobileJwt } = require('../../../middleware/mobileJwtAuth');

const router = express.Router();

const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET || 'fallback-qr-secret-change-me';
const QR_TTL_SECONDS = 86400; // 24 hours

function signPayload(payload) {
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', QR_SECRET).update(data).digest('hex');
  // Encode as base64url: data.signature
  return Buffer.from(data).toString('base64url') + '.' + sig;
}

function verifyToken(token) {
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1) throw new Error('Malformed token');

  const dataPart = token.slice(0, dotIdx);
  const sigPart = token.slice(dotIdx + 1);

  const expectedSig = crypto.createHmac('sha256', QR_SECRET).update(Buffer.from(dataPart, 'base64url').toString()).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sigPart, 'hex'), Buffer.from(expectedSig, 'hex'))) {
    throw new Error('Invalid signature');
  }

  const payload = JSON.parse(Buffer.from(dataPart, 'base64url').toString());
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

// POST /mobile/qr/token — generate a signed resident QR token
router.post('/mobile/qr/token', requireMobileJwt, async (req, res) => {
  try {
    const student = await StudentCollection.findById(req.mobileAuth.userId)
      .select('name studentId dormitoryId roomNumber faculty academicYear')
      .lean();

    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

    const iat = Math.floor(Date.now() / 1000);
    const payload = {
      v: 2,
      sub: String(student._id),
      sid: student.studentId || '',
      name: student.name || '',
      room: student.roomNumber || '',
      iat,
      exp: iat + QR_TTL_SECONDS,
    };

    const token = signPayload(payload);

    return res.json({
      success: true,
      token,
      expiresAt: new Date((iat + QR_TTL_SECONDS) * 1000).toISOString(),
      expiresIn: QR_TTL_SECONDS,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /mobile/qr/verify?token=... — verify a resident card QR token
// This endpoint does NOT require JWT — it's called by the scanner (admin/guard app)
router.get('/mobile/qr/verify', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, error: 'token is required' });

    let payload;
    try {
      payload = verifyToken(String(token));
    } catch (e) {
      return res.status(401).json({ success: false, error: e.message });
    }

    const student = await StudentCollection.findById(payload.sub)
      .select('name studentId roomNumber dormitoryId faculty')
      .lean();

    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

    return res.json({
      success: true,
      valid: true,
      student: {
        name: student.name,
        studentId: student.studentId,
        roomNumber: student.roomNumber,
      },
      issuedAt: new Date(payload.iat * 1000).toISOString(),
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
