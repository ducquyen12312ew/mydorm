const express = require('express');
const router = express.Router();
const PriorityClaim = require('../../schemas/PriorityClaimSchema');
const { logger } = require('../../config/logger');

// Middleware kiểm tra admin
const requireAdmin = (req, res, next) => {
    if (req.session && req.session.userId && req.session.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Chỉ admin có thể truy cập' });
};

// GET: Danh sách yêu cầu cần duyệt
router.get('/pending-claims', requireAdmin, async (req, res) => {
  try {
    const claims = await PriorityClaim.find({
      status: { $in: ['PENDING_REVIEW', 'PARTIALLY_APPROVED'] }
    })
      .sort({ submittedAt: -1 })
      .limit(100);

    const claimsData = claims.map(claim => ({
      _id: claim._id,
      studentId: claim.studentId,
      studentName: claim.studentName,
      studentEmail: claim.studentEmail,
      academicYear: claim.academicYear,
      status: claim.status,
      claims: {
        financialHardship: {
          claimed: claim.claims.financialHardship.claimed,
          status: claim.claims.financialHardship.status,
          documentUrl: claim.claims.financialHardship.documentUrl,
          reason: claim.claims.financialHardship.reason
        },
        minority: {
          claimed: claim.claims.minority.claimed,
          status: claim.claims.minority.status,
          ethnicity: claim.claims.minority.ethnicity,
          documentUrl: claim.claims.minority.documentUrl
        },
        scholarship: {
          claimed: claim.claims.scholarship.claimed,
          status: claim.claims.scholarship.status,
          scholarshipType: claim.claims.scholarship.scholarshipType,
          documentUrl: claim.claims.scholarship.documentUrl
        },
        orphan: {
          claimed: claim.claims.orphan.claimed,
          status: claim.claims.orphan.status,
          documentUrl: claim.claims.orphan.documentUrl
        },
        disability: {
          claimed: claim.claims.disability.claimed,
          status: claim.claims.disability.status,
          disabilityLevel: claim.claims.disability.disabilityLevel,
          documentUrl: claim.claims.disability.documentUrl
        }
      },
      submittedAt: claim.submittedAt,
      reviews: claim.reviews,
      overallScore: claim.overallScore
    }));

    res.json({
      success: true,
      claims: claimsData,
      totalPending: claimsData.length
    });
  } catch (error) {
    logger.error('Error fetching pending claims:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Chi tiết claim
router.get('/claim/:id', requireAdmin, async (req, res) => {
  try {
    const claim = await PriorityClaim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    }

    res.json({
      success: true,
      claim: claim.toObject()
    });
  } catch (error) {
    logger.error('Error fetching claim details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST: Phê duyệt/Từ chối claim
router.post('/review-claim/:id', requireAdmin, async (req, res) => {
  try {
    const { claimType, decision, score, notes } = req.body;
    const adminId = req.session.userId;
    const adminName = req.session.name;

    if (!['APPROVED', 'FULLY_APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'Quyết định không hợp lệ' });
    }

    const claim = await PriorityClaim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    }

    // Cập nhật status của claim type
    if (claim.claims[claimType]) {
      if (decision === 'APPROVED' || decision === 'FULLY_APPROVED') {
        claim.claims[claimType].status = 'FULLY_APPROVED';
        if (score) {
          claim.calculatedScore[claimType] = parseInt(score);
        }
      } else if (decision === 'REJECTED') {
        claim.claims[claimType].status = 'REJECTED';
        claim.calculatedScore[claimType] = 0;
      }
    }

    // Calculate total score
    claim.overallScore = Object.values(claim.calculatedScore).reduce((a, b) => a + (b || 0), 0);

    // Thêm vào review history
    claim.reviews.push({
      adminId,
      adminName,
      reviewedAt: new Date(),
      claimType,
      decision: decision === 'FULLY_APPROVED' ? 'APPROVED' : decision,
      notes,
      score: (decision === 'APPROVED' || decision === 'FULLY_APPROVED') ? (score || 0) : 0
    });

    // Kiểm tra nếu tất cả claims đều được duyệt
    const allClaims = Object.keys(claim.claims);
    const allReviewed = allClaims.every(type => 
      !claim.claims[type].claimed || 
      claim.claims[type].status === 'FULLY_APPROVED' || 
      claim.claims[type].status === 'REJECTED'
    );

    if (allReviewed) {
      const allApproved = allClaims.every(type => 
        !claim.claims[type].claimed || 
        claim.claims[type].status === 'FULLY_APPROVED'
      );
      
      claim.status = allApproved ? 'FULLY_APPROVED' : 'PARTIALLY_APPROVED';
      claim.approvedAt = new Date();
      claim.approvedBy = adminId;
    }

    await claim.save();

    logger.info('Priority claim reviewed', {
      claimId: claim._id,
      claimType,
      decision,
      adminId
    });

    res.json({
      success: true,
      message: decision === 'REJECTED' ? 'Đã từ chối' : 'Đã phê duyệt',
      claim: claim.toObject()
    });
  } catch (error) {
    logger.error('Error reviewing claim:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Thống kê claims
router.get('/statistics', requireAdmin, async (req, res) => {
  try {
    const academicYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

    const stats = {
      total: await PriorityClaim.countDocuments({ academicYear }),
      pending: await PriorityClaim.countDocuments({ 
        academicYear,
        status: 'PENDING_REVIEW' 
      }),
      approved: await PriorityClaim.countDocuments({ 
        academicYear,
        status: { $in: ['FULLY_APPROVED', 'PARTIALLY_APPROVED'] }
      }),
      rejected: await PriorityClaim.countDocuments({ 
        academicYear,
        status: 'REJECTED' 
      }),
      claimTypes: {
        financialHardship: await PriorityClaim.countDocuments({
          academicYear,
          'claims.financialHardship.claimed': true
        }),
        minority: await PriorityClaim.countDocuments({
          academicYear,
          'claims.minority.claimed': true
        }),
        scholarship: await PriorityClaim.countDocuments({
          academicYear,
          'claims.scholarship.claimed': true
        }),
        orphan: await PriorityClaim.countDocuments({
          academicYear,
          'claims.orphan.claimed': true
        }),
        disability: await PriorityClaim.countDocuments({
          academicYear,
          'claims.disability.claimed': true
        })
      }
    };

    res.json({
      success: true,
      statistics: stats,
      academicYear
    });
  } catch (error) {
    logger.error('Error getting statistics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

