/**
 * Cohort Shift Routes  –  Admin only
 *
 * UI:
 *   GET  /admin/cohort-shift            → main timeline page
 *
 * REST API:
 *   GET  /api/cohort-shift/timeline     → all snapshots (for charts)
 *   GET  /api/cohort-shift/transitions   → explicit year-to-year transition reports
 *   GET  /api/cohort-shift/snapshot/:year  → one snapshot
 *   GET  /api/cohort-shift/preview/:year   → next-year projection
 *   POST /api/cohort-shift/run          → run (or re-run) shift for a year
 */
const express = require('express');
const router  = express.Router();
const CohortShiftService = require('../../services/cohortShiftService');
const { logger } = require('../../config/logger');

// ─── Auth middleware ──────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return req.path.startsWith('/api/')
      ? res.status(401).json({ error: 'Unauthorized' })
      : res.redirect('/login');
  }
  if (req.session.role !== 'admin') {
    return req.path.startsWith('/api/')
      ? res.status(403).json({ error: 'Admin only' })
      : res.status(403).send('Forbidden');
  }
  next();
}

function requireAdminOrApiKey(req, res, next) {
  const expectedApiKey = process.env.COHORT_SHIFT_API_KEY;
  const providedApiKey = req.headers['x-cohort-shift-api-key'];
  if (expectedApiKey && providedApiKey && expectedApiKey === providedApiKey) {
    return next();
  }
  return requireAdmin(req, res, next);
}

// ─── Helper: derive academic year list starting from 2022 ────────────────────
function buildYearList() {
  const start = 2022;
  const now   = new Date().getFullYear();
  const years = [];
  for (let y = start; y <= now + 1; y++) {
    years.push(`${y}-${y + 1}`);
  }
  return years;
}

// ─── UI: Main Timeline Page ───────────────────────────────────────────────────

router.get('/admin/cohort-shift', requireAdmin, async (req, res) => {
  try {
    const yearList   = buildYearList();
    const snapshots  = await CohortShiftService.getAllSnapshots();
    const timeline   = await CohortShiftService.getTimelineData();

    // Default: most recent existing snapshot, or current year
    const nowYear = new Date().getFullYear();
    const defaultYear = req.query.year ||
      (snapshots.length ? snapshots[snapshots.length - 1].academicYear : `${nowYear}-${nowYear + 1}`);

    const currentSnap   = snapshots.find(s => s.academicYear === defaultYear) || null;
    const previewSnap   = await CohortShiftService.previewNextYear(defaultYear).catch(() => null);

    res.render('admin/cohort-shift/index', {
      yearList,
      snapshots,
      timeline,
      selectedYear:  defaultYear,
      currentSnap,
      previewSnap,
      activeNav:     'cohort-shift',
      user: { name: req.session.name, role: req.session.role }
    });
  } catch (err) {
    logger.error('cohort-shift UI error', { error: err.message, stack: err.stack });
    res.status(500).send('Server error: ' + err.message);
  }
});

// ─── API: Full timeline data ──────────────────────────────────────────────────

router.get('/api/cohort-shift/timeline', requireAdmin, async (req, res) => {
  try {
    const timeline = await CohortShiftService.getTimelineData();
    res.json({ success: true, timeline });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── API: Explicit transition reports ─────────────────────────────────────────

router.get('/api/cohort-shift/transitions', requireAdminOrApiKey, async (req, res) => {
  try {
    const { from, to } = req.query;

    if ((from && !/^\d{4}-\d{4}$/.test(from)) || (to && !/^\d{4}-\d{4}$/.test(to))) {
      return res.status(400).json({
        success: false,
        error: 'from/to must be academic year format YYYY-YYYY'
      });
    }

    if (from && to) {
      const pair = await CohortShiftService.getTransitionReport(from, to);
      if (!pair.found) {
        return res.status(404).json({
          success: false,
          error: 'Snapshot pair not found',
          missing: pair.missing
        });
      }

      return res.json({
        success: true,
        mode: 'pair',
        report: pair.report
      });
    }

    const reports = await CohortShiftService.getAllTransitionReports({
      fromAcademicYear: from,
      toAcademicYear: to
    });

    return res.json({
      success: true,
      mode: 'series',
      count: reports.length,
      reports
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── API: Single snapshot ─────────────────────────────────────────────────────

router.get('/api/cohort-shift/snapshot/:year', requireAdmin, async (req, res) => {
  try {
    const snap = await CohortShiftService.getSnapshot(req.params.year);
    if (!snap) return res.status(404).json({ error: 'Snapshot not found' });
    res.json({ success: true, snapshot: snap });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── API: Next-year preview ───────────────────────────────────────────────────

router.get('/api/cohort-shift/preview/:year', requireAdmin, async (req, res) => {
  try {
    const preview = await CohortShiftService.previewNextYear(req.params.year);
    res.json({ success: true, preview });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── API: Run / re-run shift ──────────────────────────────────────────────────

router.post('/api/cohort-shift/run', requireAdmin, async (req, res) => {
  try {
    const { academicYear, notes } = req.body;

    if (!academicYear || !/^\d{4}-\d{4}$/.test(academicYear)) {
      return res.status(400).json({ error: 'academicYear must be YYYY-YYYY' });
    }

    const snap = await CohortShiftService.generateShiftSnapshot(academicYear, {
      auto:        false,
      triggeredBy: req.session.userId,
      notes
    });

    logger.info('Manual cohort shift run', {
      academicYear,
      by: req.session.username
    });

    res.json({ success: true, snapshot: snap });
  } catch (err) {
    logger.error('Cohort shift run failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
