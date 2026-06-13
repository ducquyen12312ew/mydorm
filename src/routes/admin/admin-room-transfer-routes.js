const express = require('express');
const router = express.Router();
const { isAdmin } = require('../../middleware/auth');
const { StudentCollection, DormitoryCollection, NotificationCollection, ActivityLogCollection } = require('../../config/config');
const RoomTransfer = require('../../schemas/RoomTransferSchema');

// List all transfer requests
router.get('/admin/room-transfer', isAdmin, async (req, res) => {
  try {
    const { status, page = 1 } = req.query;
    const perPage = 20;
    const query = {};
    if (status && status !== 'all') query.status = status;

    const total = await RoomTransfer.countDocuments(query);
    const requests = await RoomTransfer.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean();

    res.render('admin/room-transfer/index', {
      user: { name: req.session.adminName, role: req.session.adminRole },
      activeNav: 'roomtransfer',
      requests,
      total,
      page: parseInt(page),
      perPage,
      totalPages: Math.ceil(total / perPage),
      filter: status || 'all'
    });
  } catch (err) {
    console.error('[AdminRoomTransfer] list error:', err);
    res.status(500).send('Server error');
  }
});

// Detail page
router.get('/admin/room-transfer/:id', isAdmin, async (req, res) => {
  try {
    const request = await RoomTransfer.findById(req.params.id).lean();
    if (!request) return res.status(404).send('Not found');

    // Get available rooms for assignment modal
    const dormitories = await DormitoryCollection.find({}).lean();
    const availableRooms = [];
    for (const dorm of dormitories) {
      for (const floor of (dorm.floors || [])) {
        for (const room of (floor.rooms || [])) {
          const occupancy = (room.occupants || []).length;
          if (occupancy < (room.maxCapacity || 4)) {
            availableRooms.push({
              dormitoryId: dorm._id,
              dormitoryName: dorm.name,
              floor: floor.floorNumber,
              roomNumber: room.roomNumber,
              roomType: room.roomType,
              occupancy,
              maxCapacity: room.maxCapacity,
              available: (room.maxCapacity || 4) - occupancy
            });
          }
        }
      }
    }

    res.render('admin/room-transfer/detail', {
      user: { name: req.session.adminName, role: req.session.adminRole },
      activeNav: 'roomtransfer',
      request,
      availableRooms
    });
  } catch (err) {
    console.error('[AdminRoomTransfer] detail error:', err);
    res.status(500).send('Server error');
  }
});

// Approve (without room assignment yet)
router.post('/admin/room-transfer/:id/approve', isAdmin, async (req, res) => {
  try {
    const { adminNote } = req.body;
    const transfer = await RoomTransfer.findById(req.params.id);
    if (!transfer) return res.status(404).json({ error: 'Not found' });
    if (transfer.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be approved' });

    transfer.status = 'approved';
    transfer.adminNote = adminNote || '';
    transfer.addHistory('approved', req.session.adminId, req.session.adminName, adminNote);
    await transfer.save();

    // Notify student
    await NotificationCollection.create({
      userId: transfer.studentId,
      type: 'system',
      title: 'Yêu cầu chuyển phòng được chấp thuận',
      message: `Yêu cầu chuyển phòng của bạn đã được chấp thuận. ${adminNote ? 'Ghi chú: ' + adminNote : ''}`,
      read: false,
      createdAt: new Date()
    });

    await ActivityLogCollection.create({
      action: 'room_transfer_approved',
      performedBy: req.session.adminId,
      performedByName: req.session.adminName,
      targetId: transfer._id,
      details: `Approved transfer request for student ${transfer.studentName}`
    }).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error('[AdminRoomTransfer] approve error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reject
router.post('/admin/room-transfer/:id/reject', isAdmin, async (req, res) => {
  try {
    const { adminNote } = req.body;
    if (!adminNote || !adminNote.trim()) return res.status(400).json({ error: 'Rejection reason required' });

    const transfer = await RoomTransfer.findById(req.params.id);
    if (!transfer) return res.status(404).json({ error: 'Not found' });
    if (!['pending', 'approved'].includes(transfer.status)) {
      return res.status(400).json({ error: 'Cannot reject in current status' });
    }

    transfer.status = 'rejected';
    transfer.adminNote = adminNote;
    transfer.resolvedBy = req.session.adminId;
    transfer.resolvedByName = req.session.adminName;
    transfer.resolvedAt = new Date();
    transfer.addHistory('rejected', req.session.adminId, req.session.adminName, adminNote);
    await transfer.save();

    await NotificationCollection.create({
      userId: transfer.studentId,
      type: 'system',
      title: 'Yêu cầu chuyển phòng bị từ chối',
      message: `Yêu cầu chuyển phòng của bạn đã bị từ chối. Lý do: ${adminNote}`,
      read: false,
      createdAt: new Date()
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[AdminRoomTransfer] reject error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Assign room and complete transfer
router.post('/admin/room-transfer/:id/assign', isAdmin, async (req, res) => {
  try {
    const { dormitoryId, roomNumber, adminNote } = req.body;
    if (!dormitoryId || !roomNumber) return res.status(400).json({ error: 'dormitoryId and roomNumber required' });

    const transfer = await RoomTransfer.findById(req.params.id);
    if (!transfer) return res.status(404).json({ error: 'Not found' });
    if (!['pending', 'approved'].includes(transfer.status)) {
      return res.status(400).json({ error: 'Cannot assign room in current status' });
    }

    // Fetch destination dormitory
    const destDorm = await DormitoryCollection.findById(dormitoryId);
    if (!destDorm) return res.status(404).json({ error: 'Dormitory not found' });

    // Find target room
    let targetRoom = null;
    let targetFloor = null;
    for (const floor of (destDorm.floors || [])) {
      for (const room of (floor.rooms || [])) {
        if (room.roomNumber === roomNumber) {
          targetRoom = room;
          targetFloor = floor;
          break;
        }
      }
      if (targetRoom) break;
    }
    if (!targetRoom) return res.status(404).json({ error: 'Room not found' });

    const occupancy = (targetRoom.occupants || []).length;
    if (occupancy >= (targetRoom.maxCapacity || 4)) {
      return res.status(400).json({ error: 'Room is full' });
    }

    const student = await StudentCollection.findById(transfer.studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Remove from old room if the student has a current room
    if (student.dormitoryId && student.roomNumber) {
      const oldDorm = await DormitoryCollection.findById(student.dormitoryId);
      if (oldDorm) {
        for (const floor of (oldDorm.floors || [])) {
          for (const room of (floor.rooms || [])) {
            if (room.roomNumber === student.roomNumber) {
              room.occupants = (room.occupants || []).filter(
                o => o.studentId && o.studentId.toString() !== student._id.toString()
              );
              break;
            }
          }
        }
        oldDorm.markModified('floors');
        await oldDorm.save();
      }
    }

    // Add to new room
    if (!targetRoom.occupants) targetRoom.occupants = [];
    targetRoom.occupants.push({
      studentId: student._id,
      studentName: student.name,
      studentMSSV: student.studentId,
      checkInDate: new Date()
    });
    destDorm.markModified('floors');
    await destDorm.save();

    // Update student record
    student.dormitoryId = destDorm._id;
    student.roomNumber = roomNumber;
    await student.save();

    // Update transfer record
    transfer.toDormitoryId = destDorm._id;
    transfer.toDormitoryName = destDorm.name;
    transfer.toRoomNumber = roomNumber;
    transfer.toRoomType = targetRoom.roomType;
    transfer.status = 'completed';
    transfer.adminNote = adminNote || '';
    transfer.resolvedBy = req.session.adminId;
    transfer.resolvedByName = req.session.adminName;
    transfer.resolvedAt = new Date();
    transfer.addHistory('assigned', req.session.adminId, req.session.adminName,
      `Assigned to ${destDorm.name} - Room ${roomNumber}`);
    transfer.addHistory('completed', req.session.adminId, req.session.adminName, adminNote);
    await transfer.save();

    await NotificationCollection.create({
      userId: transfer.studentId,
      type: 'room_assigned',
      title: 'Đã chuyển phòng thành công',
      message: `Bạn đã được chuyển đến phòng ${roomNumber} tại ${destDorm.name}.`,
      read: false,
      createdAt: new Date()
    });

    await ActivityLogCollection.create({
      action: 'room_transfer_completed',
      performedBy: req.session.adminId,
      performedByName: req.session.adminName,
      targetId: transfer._id,
      details: `Transferred ${transfer.studentName} to ${destDorm.name} room ${roomNumber}`
    }).catch(() => {});

    res.json({ success: true, message: `Student moved to ${destDorm.name} room ${roomNumber}` });
  } catch (err) {
    console.error('[AdminRoomTransfer] assign error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// JSON: available rooms API
router.get('/admin/api/room-transfer/available-rooms', isAdmin, async (req, res) => {
  try {
    const { building, roomType } = req.query;
    const dormQuery = building ? { name: { $regex: building, $options: 'i' } } : {};
    const dormitories = await DormitoryCollection.find(dormQuery).lean();
    const available = [];

    for (const dorm of dormitories) {
      for (const floor of (dorm.floors || [])) {
        for (const room of (floor.rooms || [])) {
          if (roomType && room.roomType !== roomType) continue;
          const occupancy = (room.occupants || []).length;
          if (occupancy < (room.maxCapacity || 4)) {
            available.push({
              dormitoryId: dorm._id,
              dormitoryName: dorm.name,
              floor: floor.floorNumber,
              roomNumber: room.roomNumber,
              roomType: room.roomType,
              occupancy,
              maxCapacity: room.maxCapacity,
              slots: (room.maxCapacity || 4) - occupancy
            });
          }
        }
      }
    }

    res.json({ rooms: available, total: available.length });
  } catch (err) {
    console.error('[AdminRoomTransfer] available rooms error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// JSON: stats
router.get('/admin/api/room-transfer/stats', isAdmin, async (req, res) => {
  try {
    const [pending, approved, rejected, completed] = await Promise.all([
      RoomTransfer.countDocuments({ status: 'pending' }),
      RoomTransfer.countDocuments({ status: 'approved' }),
      RoomTransfer.countDocuments({ status: 'rejected' }),
      RoomTransfer.countDocuments({ status: 'completed' })
    ]);
    res.json({ pending, approved, rejected, completed, total: pending + approved + rejected + completed });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
