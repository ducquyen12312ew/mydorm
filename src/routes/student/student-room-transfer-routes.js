const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../../middleware/auth');
const { StudentCollection, DormitoryCollection } = require('../../config/config');
const RoomTransfer = require('../../schemas/RoomTransferSchema');

// Redirect legacy room-transfer page to unified service-requests
router.get('/student/room-transfer', isAuthenticated, (req, res) => {
  res.redirect('/student/service-requests?tab=room_transfer');
});

// Submit new transfer request
router.post('/student/room-transfer/submit', isAuthenticated, async (req, res) => {
  try {
    const { preferredBuilding, preferredRoomType, reason, expectedMoveDate } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Lý do phải có ít nhất 10 ký tự.' });
    }

    // Block if already has pending/approved request
    const existing = await RoomTransfer.findOne({
      studentId: req.session.userId,
      status: { $in: ['pending', 'approved'] }
    });
    if (existing) {
      return res.status(400).json({ error: 'Bạn đã có một yêu cầu chuyển phòng đang chờ xử lý.' });
    }

    const student = await StudentCollection.findById(req.session.userId).lean();
    if (!student) return res.status(401).json({ error: 'Unauthorized' });

    if (!student.dormitoryId || !student.roomNumber) {
      return res.status(400).json({ error: 'Bạn phải đang ở trong phòng KTX để yêu cầu chuyển phòng.' });
    }

    // Resolve current room info
    let fromDormitoryName = '';
    let fromRoomType = '';
    const dorm = await DormitoryCollection.findById(student.dormitoryId).lean();
    if (dorm) {
      fromDormitoryName = dorm.name;
      for (const floor of (dorm.floors || [])) {
        for (const room of (floor.rooms || [])) {
          if (room.roomNumber === student.roomNumber) {
            fromRoomType = room.roomType;
            break;
          }
        }
      }
    }

    const academicYear = _currentAcademicYear();

    const transfer = new RoomTransfer({
      studentId: student._id,
      studentName: student.name,
      studentMSSV: student.studentId,
      studentEmail: student.email,
      fromDormitoryId: student.dormitoryId,
      fromDormitoryName,
      fromRoomNumber: student.roomNumber,
      fromRoomType,
      preferredBuilding: preferredBuilding || '',
      preferredRoomType: preferredRoomType || 'any',
      reason: reason.trim(),
      expectedMoveDate: expectedMoveDate ? new Date(expectedMoveDate) : undefined,
      academicYear
    });
    transfer.addHistory('submitted', student._id, student.name, 'Yêu cầu mới được gửi');
    await transfer.save();

    res.json({ success: true, requestId: transfer._id });
  } catch (err) {
    console.error('[StudentRoomTransfer] submit error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Cancel pending request
router.post('/student/room-transfer/:id/cancel', isAuthenticated, async (req, res) => {
  try {
    const transfer = await RoomTransfer.findOne({
      _id: req.params.id,
      studentId: req.session.userId
    });
    if (!transfer) return res.status(404).json({ error: 'Not found' });
    if (transfer.status !== 'pending') {
      return res.status(400).json({ error: 'Chỉ có thể huỷ yêu cầu đang chờ xử lý.' });
    }

    transfer.status = 'cancelled';
    transfer.resolvedAt = new Date();
    transfer.addHistory('cancelled', req.session.userId, req.session.userName, 'Sinh viên tự huỷ');
    await transfer.save();

    res.json({ success: true });
  } catch (err) {
    console.error('[StudentRoomTransfer] cancel error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// JSON: status check
router.get('/student/api/room-transfer/status', isAuthenticated, async (req, res) => {
  try {
    const active = await RoomTransfer.findOne({
      studentId: req.session.userId,
      status: { $in: ['pending', 'approved'] }
    }).lean();
    res.json({ hasActive: !!active, request: active });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

function _currentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

module.exports = router;
