const express = require('express');
const { StudentCollection, DormitoryCollection } = require('../../../config/config');
const { requireMobileJwt } = require('../../../middleware/mobileJwtAuth');
const { MaintenanceRequestModel } = require('../../../schemas/MaintenanceRequestSchema');

const router = express.Router();

const VALID_TYPES = [
  'electrical', 'plumbing', 'hvac', 'furniture',
  'door_lock', 'window', 'internet', 'cleaning',
  'pest_control', 'other',
];

// GET /mobile/maintenance/requests
router.get('/mobile/maintenance/requests', requireMobileJwt, async (req, res) => {
  try {
    const { status } = req.query;
    const query = { 'reportedBy.userId': req.mobileAuth.userId };
    if (status && status !== 'all') query.status = status;

    const requests = await MaintenanceRequestModel
      .find(query)
      .sort({ reportedAt: -1 })
      .limit(50)
      .lean();

    return res.json({ success: true, requests });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /mobile/maintenance/requests
router.post('/mobile/maintenance/requests', requireMobileJwt, async (req, res) => {
  try {
    const { type, title, description, priority } = req.body;

    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({ success: false, error: 'Loại yêu cầu không hợp lệ' });
    }
    if (!title || String(title).trim().length < 5 || String(title).trim().length > 200) {
      return res.status(400).json({ success: false, error: 'Tiêu đề phải từ 5-200 ký tự' });
    }
    if (!description || String(description).trim().length < 10 || String(description).trim().length > 2000) {
      return res.status(400).json({ success: false, error: 'Mô tả phải từ 10-2000 ký tự' });
    }

    const student = await StudentCollection.findById(req.mobileAuth.userId)
      .select('name studentId phone dormitoryId roomNumber')
      .lean();

    if (!student) return res.status(404).json({ success: false, error: 'Không tìm thấy sinh viên' });
    if (!student.dormitoryId || !student.roomNumber) {
      return res.status(400).json({ success: false, error: 'Bạn chưa được phân phòng. Vui lòng liên hệ quản lý KTX.' });
    }

    const dormitory = await DormitoryCollection.findById(student.dormitoryId).select('name floors').lean();
    let floorNumber = 1;
    if (dormitory?.floors) {
      for (const floor of dormitory.floors) {
        if ((floor.rooms || []).some(r => r.roomNumber === student.roomNumber)) {
          floorNumber = floor.floorNumber;
          break;
        }
      }
    }

    const request = await MaintenanceRequestModel.create({
      dormitoryId: student.dormitoryId,
      dormitoryName: dormitory?.name ?? '',
      floorNumber,
      roomNumber: student.roomNumber,
      type,
      title: String(title).trim(),
      description: String(description).trim(),
      priority: priority || 'medium',
      imageUrls: [],
      reportedBy: {
        userId: student._id,
        name: student.name,
        studentId: student.studentId,
        phone: student.phone,
      },
      status: 'submitted',
    });

    return res.status(201).json({ success: true, request });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
