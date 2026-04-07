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
 * GET /student/enhanced-application
 * Display enhanced application form with all ranking criteria
 */
router.get('/student/enhanced-application', (req, res) => {
  try {
    if (!req.isAuthenticated() || req.user.role !== 'student') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const distanceRanges = [
      { value: 0, label: 'On campus (0 km)' },
      { value: 10, label: 'Very close (< 10 km)' },
      { value: 50, label: 'Close (10-50 km)' },
      { value: 100, label: 'Moderate (50-100 km)' },
      { value: 300, label: 'Far (100-300 km)' },
      { value: 500, label: 'Very far (300-500 km)' },
      { value: 1000, label: 'Extremely far (500+ km)' }
    ];

    const financialTiers = [
      { value: 1, label: 'Critical financial difficulty', description: 'Cannot afford basic needs' },
      { value: 2, label: 'High financial difficulty', description: 'Limited resources, needs support' },
      { value: 3, label: 'Moderate financial situation', description: 'Manageable but tight budget' },
      { value: 4, label: 'Good financial situation', description: 'Comfortable, no financial stress' }
    ];

    const priorityLevels = [
      { value: 'LOW', label: 'Low', description: 'Standard application' },
      { value: 'MEDIUM', label: 'Medium', description: 'Some priority factors' },
      { value: 'HIGH', label: 'High', description: 'Significant priority factors' },
      { value: 'SPECIAL', label: 'Special', description: 'Exceptional circumstances' }
    ];

    res.render('student/enhanced-application-form', {
      user: req.user,
      distanceRanges,
      financialTiers,
      priorityLevels
    });
  } catch (error) {
    logger.error('Enhanced app form render failed', { error: error.message });
    res.status(500).json({ error: 'Failed to load form' });
  }
});

/**
 * POST /student/enhanced-application
 * Submit enhanced application with ranking criteria
 */
router.post(
  '/student/enhanced-application',
  upload.array('attachments', 10), // Allow up to 10 files
  async (req, res) => {
    try {
      const {
        distance,
        financialCondition,
        priorityLevel,
        priorityReason,
        specialNeeds,
        preferredBuildings,
        academicYear
      } = req.body;

      // Validate required fields
      if (!distance || !financialCondition || !priorityLevel) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Prepare attachment data
      const attachments = (req.files || []).map(file => ({
        fieldname: file.fieldname,
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: new Date()
      }));

      // Create enhanced application
      const application = await EnhancedApplicationService.createApplication(
        req.user._id,
        {
          distance: parseInt(distance),
          financialCondition: parseInt(financialCondition),
          priorityLevel,
          priorityReason,
          specialNeeds,
          preferredBuildings: preferredBuildings ? preferredBuildings.split(',') : [],
          attachments,
          academicYear
        }
      );

      logger.info('Enhanced application submitted', {
        studentId: req.user._id,
        applicationId: application._id,
        score: application.priorityScore.total
      });

      res.json({
        success: true,
        applicationId: application._id,
        message: 'Application submitted successfully!',
        ranking: {
          score: application.priorityScore.total,
          components: {
            distance: application.priorityScore.distance,
            financial: application.priorityScore.financial,
            priority: application.priorityScore.priority
          }
        }
      });
    } catch (error) {
      logger.error('Application submission failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
);

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
