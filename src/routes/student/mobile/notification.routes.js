const express = require('express');
const { NotificationCollection } = require('../../../config/config');
const { requireMobileJwt } = require('../../../middleware/mobileJwtAuth');
const { getStudentNotifications } = require('../../../services/studentMobileService');
const { requireStudentAuth } = require('./utils');

const router = express.Router();

// ── Session-auth routes (student web) ───────────────────────

router.get('/notifications', requireStudentAuth, async (req, res) => {
  try {
    const limit = Number(req.query.limit || 20);
    const notifications = await getStudentNotifications(req.session.userId, limit);
    return res.json({ success: true, notifications });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/notifications/:id/read', requireStudentAuth, async (req, res) => {
  try {
    await NotificationCollection.findByIdAndUpdate(req.params.id, {
      $addToSet: { readBy: { userId: req.session.userId, readAt: new Date() } },
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── JWT-auth routes (mobile) — static before dynamic ────────

router.post('/mobile/notifications/read-all', requireMobileJwt, async (req, res) => {
  try {
    const userId = req.mobileAuth.userId;
    const result = await NotificationCollection.updateMany(
      { 'readBy.userId': { $ne: userId } },
      { $push: { readBy: { userId, readAt: new Date() } } }
    );
    return res.json({ success: true, count: result.modifiedCount });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mobile/notifications', requireMobileJwt, async (req, res) => {
  try {
    const limit = Number(req.query.limit || 20);
    const notifications = await getStudentNotifications(req.mobileAuth.userId, limit);
    return res.json({ success: true, notifications });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mobile/notifications/:id/read', requireMobileJwt, async (req, res) => {
  try {
    await NotificationCollection.findByIdAndUpdate(req.params.id, {
      $addToSet: { readBy: { userId: req.mobileAuth.userId, readAt: new Date() } },
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
