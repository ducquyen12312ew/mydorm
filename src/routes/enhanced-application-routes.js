/**
 * ENHANCED APPLICATION ROUTES
 * Improved registration form with ranking criteria, file upload, and 360 room viewer
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const EnhancedApplicationService = require('../services/enhancedApplicationService');
const RoomViewerService = require('../services/roomViewerService');
const AllocationRegistration = require('../schemas/AllocationRegistrationSchema');
const { logger } = require('../config/logger');

// ============================================
// MULTER FILE UPLOAD CONFIGURATION
// ============================================

const uploadsDir = path.join(__dirname, '../uploads/applications');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow: PDF, Word, Excel, Images, Videos
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB for videos
  }
});

// ============================================
// ROUTES
// ============================================

/**
 * GET /student/my-ranking
 * Display student's ranking, score, and position
 */
router.get('/student/my-ranking', async (req, res) => {
  try {
    if (!req.isAuthenticated() || req.user.role !== 'student') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${currentYear + 1}`;

    const ranking = await EnhancedApplicationService.getRankingInfo(
      req.user._id,
      academicYear
    );

    if (!ranking) {
      return res.status(404).json({ error: 'No application found' });
    }

    const explanations = EnhancedApplicationService.getScoringExplanation(ranking);

    res.json({
      ranking,
      explanations,
      topCutoff: 0.5, // Top 50% for auto-approval
      message: ranking.percentile <= 50
        ? '✅ You are in the top 50% - likely to be auto-approved!'
        : '⏳ Manual review - your ranking will be considered carefully.'
    });
  } catch (error) {
    logger.error('Ranking fetch failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /student/compare-rankings
 * Display all rankings (anonymous) for transparency
 */
router.get('/student/compare-rankings', async (req, res) => {
  try {
    if (!req.isAuthenticated() || req.user.role !== 'student') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${currentYear + 1}`;

    const allApplications = await AllocationRegistration.find({
      academicYear,
      status: { $in: ['PENDING', 'ALLOCATED', 'WAITLIST'] }
    })
      .select('priorityScore.total status')
      .lean();

    const sorted = allApplications.sort((a, b) => b.priorityScore.total - a.priorityScore.total);

    // Get quartiles for comparison
    const quartiles = {
      top25: sorted.slice(0, Math.ceil(sorted.length * 0.25)).map(a => a.priorityScore.total),
      top50: sorted.slice(0, Math.ceil(sorted.length * 0.50)).map(a => a.priorityScore.total),
      top75: sorted.slice(0, Math.ceil(sorted.length * 0.75)).map(a => a.priorityScore.total),
      all: sorted.map(a => a.priorityScore.total)
    };

    const stats = {
      minScore: Math.min(...quartiles.all),
      maxScore: Math.max(...quartiles.all),
      avgScore: (quartiles.all.reduce((a, b) => a + b, 0) / quartiles.all.length).toFixed(1),
      medianScore: quartiles.all[Math.floor(quartiles.all.length / 2)],
      top25Threshold: quartiles.top25[quartiles.top25.length - 1],
      top50Threshold: quartiles.top50[quartiles.top50.length - 1]
    };

    res.json({
      stats,
      totalApplications: sorted.length,
      message: `You can see distribution - your score in percentile matters more than absolute number`
    });
  } catch (error) {
    logger.error('Rankings comparison failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /room/360-view/:roomId
 * Display 360-degree room viewer
 */
router.get('/room/360-view/:roomId', (req, res) => {
  try {
    const { roomId } = req.params;

    // Get room view data (in production, fetch from DB)
    const roomView = RoomViewerService.getSampleRoomData(roomId);
    const viewerEmbed = RoomViewerService.getViewerEmbed(roomView);

    res.render('student/room-360-viewer', {
      roomId,
      roomView,
      viewerEmbed,
      user: req.user
    });
  } catch (error) {
    logger.error('360 viewer failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /admin/forced-exit-candidates
 * Display students who will be evicted (lowest ranking)
 */
router.get('/admin/forced-exit-candidates', async (req, res) => {
  try {
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${currentYear + 1}`;
    const count = req.query.count || 20;

    const candidates = await EnhancedApplicationService.getEvictionCandidates(
      academicYear,
      parseInt(count)
    );

    res.json({
      message: `Top ${count} students by eviction priority (lowest ranking)`,
      candidates,
      total: candidates.length,
      reason: 'These students have the lowest combined ranking scores and may be considered for reallocation if needed'
    });
  } catch (error) {
    logger.error('Forced exit candidates failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /uploads/:filename
 * Delete uploaded file (admin only)
 */
router.delete('/uploads/:filename', (req, res) => {
  try {
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const filePath = path.join(uploadsDir, req.params.filename);

    // Security: Prevent directory traversal
    if (!filePath.startsWith(uploadsDir)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ message: 'File deleted' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    logger.error('File deletion failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
