const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PriorityClaim = require('../../schemas/PriorityClaimSchema');
const { StudentCollection } = require('../../config/config');
const { logger } = require('../../config/logger');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../..', 'public/uploads/priority-documents');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${req.user._id}-${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file PDF, JPG, PNG, DOC, DOCX'));
    }
  }
});

// GET: Lấy thông tin yêu cầu cấp điểm hiện tại
router.get('/my-claims', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
    }

    const academicYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    
    let claim = await PriorityClaim.findOne({
      studentId: req.user._id,
      academicYear
    });

    if (!claim) {
      claim = new PriorityClaim({
        studentId: req.user._id,
        studentName: req.user.name,
        studentEmail: req.user.email,
        studentPhone: req.user.phoneNumber,
        academicYear,
        status: 'DRAFT'
      });
    }

    res.json({
      success: true,
      claim: {
        _id: claim._id,
        academicYear: claim.academicYear,
        status: claim.status,
        claims: claim.claims,
        overallScore: claim.overallScore,
        reviews: claim.reviews
      }
    });
  } catch (error) {
    logger.error('Error getting claims:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST: Submit claim với file minh chứng
router.post('/submit-claim', upload.single('document'), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Vui lòng upload file minh chứng' });
    }

    const { claimType, reason, ethnicity, scholarshipType, disabilityLevel } = req.body;
    const academicYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    
    let claim = await PriorityClaim.findOne({
      studentId: req.user._id,
      academicYear
    });

    if (!claim) {
      claim = new PriorityClaim({
        studentId: req.user._id,
        studentName: req.user.name,
        studentEmail: req.user.email,
        studentPhone: req.user.phoneNumber,
        academicYear,
        status: 'DRAFT'
      });
    }

    // Cập nhật claim
    const documentUrl = `/uploads/priority-documents/${req.file.filename}`;
    
    switch (claimType) {
      case 'financialHardship':
        claim.claims.financialHardship = {
          claimed: true,
          status: 'SUBMITTED',
          documentUrl,
          submittedAt: new Date(),
          reason
        };
        break;
      
      case 'minority':
        claim.claims.minority = {
          claimed: true,
          status: 'SUBMITTED',
          ethnicity,
          documentUrl,
          submittedAt: new Date()
        };
        break;
      
      case 'scholarship':
        claim.claims.scholarship = {
          claimed: true,
          status: 'SUBMITTED',
          scholarshipType,
          documentUrl,
          submittedAt: new Date()
        };
        break;
      
      case 'orphan':
        claim.claims.orphan = {
          claimed: true,
          status: 'SUBMITTED',
          documentUrl,
          submittedAt: new Date()
        };
        break;
      
      case 'disability':
        claim.claims.disability = {
          claimed: true,
          status: 'SUBMITTED',
          disabilityLevel,
          documentUrl,
          submittedAt: new Date()
        };
        break;
      
      default:
        return res.status(400).json({ success: false, error: 'Loại yêu cầu không hợp lệ' });
    }

    claim.status = 'PENDING_REVIEW';
    claim.submittedAt = new Date();
    
    await claim.save();

    logger.info('Priority claim submitted', {
      studentId: req.user._id,
      claimType,
      academicYear
    });

    res.json({
      success: true,
      message: 'Đã gửi yêu cầu. Vui lòng đợi phê duyệt từ admin.',
      claim: claim.toObject()
    });
  } catch (error) {
    logger.error('Error submitting claim:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT: Cập nhật claim (trước khi submit)
router.put('/update-claim/:claimType', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
    }

    const { claimType } = req.params;
    const { claimed, reason, ethnicity, scholarshipType, disabilityLevel } = req.body;
    const academicYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    
    let claim = await PriorityClaim.findOne({
      studentId: req.user._id,
      academicYear
    });

    if (!claim) {
      claim = new PriorityClaim({
        studentId: req.user._id,
        studentName: req.user.name,
        studentEmail: req.user.email,
        studentPhone: req.user.phoneNumber,
        academicYear,
        status: 'DRAFT'
      });
    }

    // Cập nhật claim
    if (claimType === 'financialHardship') {
      claim.claims.financialHardship.claimed = claimed;
      if (reason) claim.claims.financialHardship.reason = reason;
    } else if (claimType === 'minority') {
      claim.claims.minority.claimed = claimed;
      if (ethnicity) claim.claims.minority.ethnicity = ethnicity;
    } else if (claimType === 'scholarship') {
      claim.claims.scholarship.claimed = claimed;
      if (scholarshipType) claim.claims.scholarship.scholarshipType = scholarshipType;
    } else if (claimType === 'orphan') {
      claim.claims.orphan.claimed = claimed;
    } else if (claimType === 'disability') {
      claim.claims.disability.claimed = claimed;
      if (disabilityLevel) claim.claims.disability.disabilityLevel = disabilityLevel;
    }

    if (!claim.status || claim.status === 'DRAFT') {
      claim.status = 'DRAFT';
    }

    await claim.save();

    res.json({
      success: true,
      message: 'Cập nhật thành công',
      claim: claim.toObject()
    });
  } catch (error) {
    logger.error('Error updating claim:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE: Xóa file minh chứng
router.delete('/delete-document/:claimType', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
    }

    const { claimType } = req.params;
    const academicYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    
    const claim = await PriorityClaim.findOne({
      studentId: req.user._id,
      academicYear
    });

    if (!claim) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    }

    // Xóa file
    if (claim.claims[claimType]?.documentUrl) {
      const filePath = path.join(__dirname, '../../..', 'public', claim.claims[claimType].documentUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      claim.claims[claimType].documentUrl = null;
      claim.claims[claimType].status = 'DRAFT';
    }

    await claim.save();

    res.json({
      success: true,
      message: 'Xóa file thành công',
      claim: claim.toObject()
    });
  } catch (error) {
    logger.error('Error deleting document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
