const express = require('express');
const { StudentCollection, DormitoryCollection } = require('../../../config/config');
const { requireMobileJwt } = require('../../../middleware/mobileJwtAuth');
const { ViolationModel } = require('../../../schemas/ViolationSchema');

const router = express.Router();

// GET /mobile/me ─ full student profile
router.get('/mobile/me', requireMobileJwt, async (req, res) => {
  try {
    const student = await StudentCollection.findById(req.mobileAuth.userId)
      .select('name email studentId gender academicYear faculty phone priorityScore dormitoryId roomNumber')
      .lean();
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });
    return res.json({ success: true, user: student });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /mobile/profile ─ update phone / email
router.patch('/mobile/profile', requireMobileJwt, async (req, res) => {
  try {
    const { phone, email } = req.body;
    const update = {};

    if (phone !== undefined) {
      const p = String(phone).trim();
      if (p && !/^\+?[0-9\s\-]{7,20}$/.test(p)) {
        return res.status(400).json({ success: false, error: 'Số điện thoại không hợp lệ' });
      }
      update.phone = p;
    }
    if (email !== undefined) {
      const e = String(email).trim().toLowerCase();
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        return res.status(400).json({ success: false, error: 'Email không hợp lệ' });
      }
      update.email = e;
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, error: 'Không có trường nào để cập nhật' });
    }

    const student = await StudentCollection.findByIdAndUpdate(
      req.mobileAuth.userId,
      { $set: update },
      { new: true, select: 'name email studentId gender academicYear faculty phone priorityScore dormitoryId roomNumber' }
    ).lean();
    if (!student) return res.status(404).json({ success: false, error: 'Không tìm thấy sinh viên' });

    return res.json({ success: true, user: student });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /mobile/violations ─ student's own violation records
router.get('/mobile/violations', requireMobileJwt, async (req, res) => {
  try {
    const student = await StudentCollection.findById(req.mobileAuth.userId).select('studentId').lean();
    const query = {
      $or: [
        { studentObjectId: req.mobileAuth.userId },
        ...(student?.studentId ? [{ studentId: String(student.studentId) }] : []),
      ],
    };
    const violations = await ViolationModel
      .find(query)
      .sort({ reportedAt: -1 })
      .limit(50)
      .select('type description severity status reportedAt resolution dormitoryName roomNumber')
      .lean();
    return res.json({ success: true, violations });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /mobile/roommates ─ active roommates in assigned room
router.get('/mobile/roommates', requireMobileJwt, async (req, res) => {
  try {
    const student = await StudentCollection.findById(req.mobileAuth.userId)
      .select('studentId roomNumber dormitoryId')
      .lean();

    if (!student?.dormitoryId || !student?.roomNumber) {
      return res.json({ success: true, roommates: [], room: null });
    }

    const dormitory = await DormitoryCollection.findById(student.dormitoryId)
      .select('name floors')
      .lean();

    let roommates = [];
    let roomInfo = null;

    for (const floor of (dormitory?.floors || [])) {
      const room = (floor.rooms || []).find(r => r.roomNumber === student.roomNumber);
      if (room) {
        roomInfo = {
          roomNumber: room.roomNumber,
          floor: floor.floorNumber,
          dormitoryName: dormitory.name,
          maxCapacity: room.maxCapacity,
        };
        roommates = (room.occupants || [])
          .filter(o => o.active && String(o.studentId) !== String(student.studentId || ''))
          .map(o => ({
            name: o.name,
            studentId: o.studentId,
            phone: o.phone || null,
            checkInDate: o.checkInDate,
          }));
        break;
      }
    }

    return res.json({ success: true, roommates, room: roomInfo });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
