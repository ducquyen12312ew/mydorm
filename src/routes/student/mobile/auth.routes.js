const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { StudentCollection } = require('../../../config/config');
const { issueMobileTokens, rotateRefreshToken, revokeRefreshToken } = require('../../../auth/mobileTokenService');
const { requireStudentAuth } = require('./utils');

const router = express.Router();

const mobileLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.username || 'anonymous').toLowerCase()}`,
  skipSuccessfulRequests: true,
  message: { success: false, error: 'Too many mobile login attempts. Please try again later.' },
});

// ── Web session auth ────────────────────────────────────────

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password, remember } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'username and password are required' });
    }
    const student = await StudentCollection.findOne({ username });
    if (!student) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    if (student.role === 'admin') return res.status(403).json({ success: false, error: 'Use admin portal login' });
    const ok = await bcrypt.compare(password, student.password);
    if (!ok) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    req.session.userId = student._id;
    req.session.name = student.name;
    req.session.role = student.role;
    req.session.studentId = student.studentId;
    if (remember) req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;

    req.session.save((err) => {
      if (err) return res.status(500).json({ success: false, error: 'Cannot persist session' });
      return res.json({ success: true, user: { id: student._id, name: student.name, role: student.role, studentId: student.studentId } });
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/auth/logout', (req, res) => {
  if (!req.session) return res.json({ success: true });
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ success: false, error: 'Logout failed' });
    return res.json({ success: true });
  });
});

router.get('/auth/me', requireStudentAuth, async (req, res) => {
  try {
    const student = await StudentCollection.findById(req.session.userId)
      .select('name email studentId gender academicYear faculty phone priorityScore dormitoryId roomNumber')
      .lean();
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });
    return res.json({ success: true, user: student });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Mobile JWT auth ─────────────────────────────────────────

router.post('/auth/mobile/login', mobileLoginLimiter, async (req, res) => {
  try {
    const { username, password, deviceId, fingerprint } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: 'username and password are required' });
    if (!deviceId || !fingerprint) return res.status(400).json({ success: false, error: 'deviceId and fingerprint are required' });

    const student = await StudentCollection.findOne({ username });
    if (!student || student.role === 'admin') return res.status(401).json({ success: false, error: 'Invalid mobile credentials' });
    const ok = await bcrypt.compare(password, student.password);
    if (!ok) return res.status(401).json({ success: false, error: 'Invalid mobile credentials' });

    const tokens = await issueMobileTokens(student, {
      deviceId,
      fingerprint,
      ipAddress: req.ip,
      userAgentHash: crypto.createHash('sha256').update(String(req.headers['user-agent'] || '')).digest('hex'),
    });
    return res.json({
      success: true,
      user: { id: student._id, name: student.name, role: student.role, studentId: student.studentId },
      ...tokens,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/auth/mobile/refresh', async (req, res) => {
  try {
    const { refreshToken, deviceId, fingerprint, rotateFingerprint } = req.body;
    if (!refreshToken || !deviceId || !fingerprint) {
      return res.status(400).json({ success: false, error: 'refreshToken, deviceId and fingerprint are required' });
    }
    const rotated = await rotateRefreshToken(refreshToken, {
      deviceId,
      fingerprint,
      ipAddress: req.ip,
      userAgentHash: crypto.createHash('sha256').update(String(req.headers['user-agent'] || '')).digest('hex'),
      rotateFingerprint,
    });
    return res.json({ success: true, ...rotated });
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
});

router.post('/auth/mobile/logout', async (req, res) => {
  try {
    const { refreshToken, reason } = req.body;
    if (refreshToken) await revokeRefreshToken(refreshToken);
    return res.json({ success: true, reason: reason || 'LOGOUT' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
