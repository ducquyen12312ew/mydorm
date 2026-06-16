const express = require('express');
const { requireMobileJwt } = require('../../../middleware/mobileJwtAuth');
const {
  getStudentDashboard,
  getRegistrationAvailability,
  scorePreviewFromPayload,
  assignStudentToRoom,
} = require('../../../services/studentMobileService');
const { requireStudentAuth } = require('./utils');

const router = express.Router();

// ── Session-auth routes (student web) ───────────────────────

router.get('/dashboard', requireStudentAuth, async (req, res) => {
  try {
    const dashboard = await getStudentDashboard(req.session.userId);
    if (!dashboard) return res.status(404).json({ success: false, error: 'Student not found' });
    return res.json({ success: true, dashboard });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/registration/availability', requireStudentAuth, async (req, res) => {
  try {
    const availability = await getRegistrationAvailability();
    return res.json({ success: true, ...availability });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/applications/score-preview', requireStudentAuth, (req, res) => {
  try {
    const score = scorePreviewFromPayload(req.body || {});
    return res.json({ success: true, score });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ── JWT-auth routes (mobile) ─────────────────────────────────

router.get('/mobile/dashboard', requireMobileJwt, async (req, res) => {
  try {
    const dashboard = await getStudentDashboard(req.mobileAuth.userId);
    if (!dashboard) return res.status(404).json({ success: false, error: 'Student not found' });
    return res.json({ success: true, dashboard });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mobile/registration/availability', requireMobileJwt, async (req, res) => {
  try {
    const availability = await getRegistrationAvailability();
    return res.json({ success: true, ...availability });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mobile/applications/score-preview', requireMobileJwt, (req, res) => {
  try {
    const score = scorePreviewFromPayload(req.body || {});
    return res.json({ success: true, score });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /student/apply — assign student to best available room
router.post('/student/apply', requireMobileJwt, async (req, res) => {
  try {
    const result = await assignStudentToRoom(req.mobileAuth.userId);
    if (!result.success) return res.status(400).json({ success: false, error: result.error });
    return res.json({
      success: true,
      message: `Successfully assigned to room ${result.assignment.roomNumber}`,
      assignment: result.assignment,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
