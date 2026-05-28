const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const {
  issueMobileTokens,
  rotateRefreshToken,
  revokeRefreshToken
} = require('../../auth/mobileTokenService');
const { requireMobileJwt } = require('../../middleware/mobileJwtAuth');
const {
  StudentCollection,
  DormitoryCollection,
  NotificationCollection
} = require('../../config/config');
const {
  getStudentDashboard,
  getRoomExploreData,
  getStudentNotifications,
  scorePreviewFromPayload,
  getRegistrationAvailability,
  assignStudentToRoom
} = require('../../services/studentMobileService');
const { MaintenanceRequestModel } = require('../../schemas/MaintenanceRequestSchema');
const { ViolationModel } = require('../../schemas/ViolationSchema');

const router = express.Router();

const mobileLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.username || 'anonymous').toLowerCase()}`,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: 'Too many mobile login attempts. Please try again later.'
  }
});

function requireStudentAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  if (req.session.role === 'admin') {
    return res.status(403).json({ success: false, error: 'Student access only' });
  }
  return next();
}

function isValidObjectId(value) {
  return value && mongoose.Types.ObjectId.isValid(value);
}

function mapRoomFavorite(room, dormitory) {
  const activeCount = (room.occupants || []).filter((item) => item.active).length;
  return {
    id: String(room._id),
    dormitoryId: String(dormitory._id),
    dormName: dormitory.name,
    roomNumber: room.roomNumber,
    roomType: room.roomType,
    floor: room.floor,
    maxCapacity: room.maxCapacity,
    availableBeds: Math.max((room.maxCapacity || 0) - activeCount, 0),
    pricePerMonth: room.pricePerMonth,
    imageUrl: room.imageUrl || ''
  };
}

async function resolveFavoriteRooms(userId) {
  const student = await StudentCollection.findById(userId)
    .select('favoriteRoomIds')
    .lean();

  const favoriteRoomIds = (student?.favoriteRoomIds || []).map((id) => String(id));
  if (!favoriteRoomIds.length) {
    return [];
  }

  const objectIds = favoriteRoomIds
    .filter((id) => isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (!objectIds.length) {
    return [];
  }

  const dormitories = await DormitoryCollection.find({
    'floors.rooms._id': { $in: objectIds }
  }).lean();

  const roomMap = new Map();
  dormitories.forEach((dormitory) => {
    (dormitory.floors || []).forEach((floor) => {
      (floor.rooms || []).forEach((room) => {
        const key = String(room._id);
        if (!favoriteRoomIds.includes(key)) {
          return;
        }

        roomMap.set(key, mapRoomFavorite({ ...room, floor: floor.floorNumber }, dormitory));
      });
    });
  });

  return favoriteRoomIds
    .map((id) => roomMap.get(String(id)))
    .filter(Boolean);
}

async function addFavoriteRoom(userId, roomId) {
  if (!isValidObjectId(roomId)) {
    return { status: 400, payload: { success: false, error: 'Invalid room id' } };
  }

  const exists = await DormitoryCollection.exists({
    'floors.rooms._id': new mongoose.Types.ObjectId(roomId)
  });

  if (!exists) {
    return { status: 404, payload: { success: false, error: 'Room not found' } };
  }

  await StudentCollection.findByIdAndUpdate(userId, {
    $addToSet: {
      favoriteRoomIds: new mongoose.Types.ObjectId(roomId)
    }
  });

  return { status: 200, payload: { success: true } };
}

async function removeFavoriteRoom(userId, roomId) {
  if (!isValidObjectId(roomId)) {
    return { status: 400, payload: { success: false, error: 'Invalid room id' } };
  }

  await StudentCollection.findByIdAndUpdate(userId, {
    $pull: {
      favoriteRoomIds: new mongoose.Types.ObjectId(roomId)
    }
  });

  return { status: 200, payload: { success: true } };
}

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password, remember } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'username and password are required' });
    }

    const student = await StudentCollection.findOne({ username });
    if (!student) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    if (student.role === 'admin') {
      return res.status(403).json({ success: false, error: 'Use admin portal login' });
    }

    const isValidPassword = await bcrypt.compare(password, student.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    req.session.userId = student._id;
    req.session.name = student.name;
    req.session.role = student.role;
    req.session.studentId = student.studentId;

    if (remember) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
    }

    req.session.save((error) => {
      if (error) {
        return res.status(500).json({ success: false, error: 'Cannot persist session' });
      }

      return res.json({
        success: true,
        user: {
          id: student._id,
          name: student.name,
          role: student.role,
          studentId: student.studentId
        }
      });
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/auth/logout', (req, res) => {
  if (!req.session) {
    return res.json({ success: true });
  }

  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }

    return res.json({ success: true });
  });
});

router.post('/auth/mobile/login', mobileLoginLimiter, async (req, res) => {
  try {
    const { username, password, deviceId, fingerprint } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'username and password are required' });
    }

    if (!deviceId || !fingerprint) {
      return res.status(400).json({ success: false, error: 'deviceId and fingerprint are required' });
    }

    const student = await StudentCollection.findOne({ username });
    if (!student || student.role === 'admin') {
      return res.status(401).json({ success: false, error: 'Invalid mobile credentials' });
    }

    const ok = await bcrypt.compare(password, student.password);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Invalid mobile credentials' });
    }

    const tokens = await issueMobileTokens(student, {
      deviceId,
      fingerprint,
      ipAddress: req.ip,
      userAgentHash: crypto.createHash('sha256').update(String(req.headers['user-agent'] || '')).digest('hex')
    });
    return res.json({
      success: true,
      user: {
        id: student._id,
        name: student.name,
        role: student.role,
        studentId: student.studentId
      },
      ...tokens
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/auth/mobile/refresh', async (req, res) => {
  try {
    const { refreshToken, deviceId, fingerprint, rotateFingerprint } = req.body;
    if (!refreshToken || !deviceId || !fingerprint) {
      return res.status(400).json({ success: false, error: 'refreshToken, deviceId and fingerprint are required' });
    }

    const rotated = await rotateRefreshToken(refreshToken, {
      deviceId,
      fingerprint,
      ipAddress: req.ip,
      userAgentHash: crypto.createHash('sha256').update(String(req.headers['user-agent'] || '')).digest('hex'),
      rotateFingerprint
    });
    return res.json({ success: true, ...rotated });
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
});

router.post('/auth/mobile/logout', async (req, res) => {
  try {
    const { refreshToken, reason } = req.body;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    return res.json({ success: true, reason: reason || 'LOGOUT' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/auth/me', requireStudentAuth, async (req, res) => {
  try {
    const student = await StudentCollection.findById(req.session.userId)
      .select('name email studentId gender academicYear faculty phone priorityScore dormitoryId roomNumber')
      .lean();

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    return res.json({ success: true, user: student });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/dashboard', requireStudentAuth, async (req, res) => {
  try {
    const dashboard = await getStudentDashboard(req.session.userId);
    if (!dashboard) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    return res.json({ success: true, dashboard });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/rooms/explore', requireStudentAuth, async (req, res) => {
  try {
    const data = await getRoomExploreData(req.query || {});
    return res.json({ success: true, dormitories: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/public/rooms/explore', async (req, res) => {
  try {
    const data = await getRoomExploreData(req.query || {});
    return res.json({ success: true, dormitories: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/notifications', requireStudentAuth, async (req, res) => {
  try {
    const limit = Number(req.query.limit || 20);
    const notifications = await getStudentNotifications(req.session.userId, limit);
    return res.json({ success: true, notifications });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/notifications/:id/read', requireStudentAuth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const studentId = req.session.userId;

    await NotificationCollection.findByIdAndUpdate(notificationId, {
      $addToSet: {
        readBy: {
          userId: studentId,
          readAt: new Date()
        }
      }
    });

    return res.json({ success: true });
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

router.get('/favorites', requireStudentAuth, async (req, res) => {
  try {
    const favorites = await resolveFavoriteRooms(req.session.userId);
    return res.json({ success: true, favorites });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/favorites', requireStudentAuth, async (req, res) => {
  try {
    const result = await addFavoriteRoom(req.session.userId, req.body?.roomId);
    return res.status(result.status).json(result.payload);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/favorites/:roomId', requireStudentAuth, async (req, res) => {
  try {
    const result = await removeFavoriteRoom(req.session.userId, req.params.roomId);
    return res.status(result.status).json(result.payload);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Mobile JWT-protected endpoints
router.get('/mobile/me', requireMobileJwt, async (req, res) => {
  try {
    const student = await StudentCollection.findById(req.mobileAuth.userId)
      .select('name email studentId gender academicYear faculty phone priorityScore dormitoryId roomNumber')
      .lean();

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    return res.json({ success: true, user: student });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mobile/dashboard', requireMobileJwt, async (req, res) => {
  try {
    const dashboard = await getStudentDashboard(req.mobileAuth.userId);
    if (!dashboard) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }
    return res.json({ success: true, dashboard });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mobile/rooms/explore', requireMobileJwt, async (req, res) => {
  try {
    const data = await getRoomExploreData(req.query || {});
    return res.json({ success: true, dormitories: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mobile/notifications', requireMobileJwt, async (req, res) => {
  try {
    const limit = Number(req.query.limit || 20);
    const notifications = await getStudentNotifications(req.mobileAuth.userId, limit);
    return res.json({ success: true, notifications });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mobile/notifications/:id/read', requireMobileJwt, async (req, res) => {
  try {
    await NotificationCollection.findByIdAndUpdate(req.params.id, {
      $addToSet: {
        readBy: {
          userId: req.mobileAuth.userId,
          readAt: new Date()
        }
      }
    });

    return res.json({ success: true });
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

router.get('/mobile/favorites', requireMobileJwt, async (req, res) => {
  try {
    const favorites = await resolveFavoriteRooms(req.mobileAuth.userId);
    return res.json({ success: true, favorites });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mobile/favorites', requireMobileJwt, async (req, res) => {
  try {
    const result = await addFavoriteRoom(req.mobileAuth.userId, req.body?.roomId);
    return res.status(result.status).json(result.payload);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/mobile/favorites/:roomId', requireMobileJwt, async (req, res) => {
  try {
    const result = await removeFavoriteRoom(req.mobileAuth.userId, req.params.roomId);
    return res.status(result.status).json(result.payload);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/student-app/student/apply
 * Assign authenticated student to best available room
 * Prioritizes rooms with most available beds
 */
router.post('/student/apply', requireMobileJwt, async (req, res) => {
  try {
    const studentId = req.mobileAuth.userId;
    const result = await assignStudentToRoom(studentId);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    
    return res.json({
      success: true,
      message: `Successfully assigned to room ${result.assignment.roomNumber}`,
      assignment: result.assignment
    });
  } catch (error) {
    console.error('Error assigning student to room:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// MOBILE: PROFILE UPDATE (JWT-protected)
// ============================================================

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

    if (!student) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy sinh viên' });
    }

    return res.json({ success: true, user: student });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// MOBILE: VIOLATIONS (JWT-protected)
// ============================================================

router.get('/mobile/violations', requireMobileJwt, async (req, res) => {
  try {
    const student = await StudentCollection.findById(req.mobileAuth.userId)
      .select('studentId')
      .lean();

    const query = {
      $or: [
        { studentObjectId: req.mobileAuth.userId },
        ...(student?.studentId ? [{ studentId: String(student.studentId) }] : [])
      ]
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

// ============================================================
// MOBILE: ROOMMATES (JWT-protected)
// ============================================================

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

// ============================================================
// MOBILE: MAINTENANCE REQUESTS (JWT-protected)
// ============================================================

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

router.post('/mobile/maintenance/requests', requireMobileJwt, async (req, res) => {
  try {
    const { type, title, description, priority } = req.body;

    const VALID_TYPES = [
      'electrical', 'plumbing', 'hvac', 'furniture',
      'door_lock', 'window', 'internet', 'cleaning',
      'pest_control', 'other'
    ];

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

    if (!student) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy sinh viên' });
    }
    if (!student.dormitoryId || !student.roomNumber) {
      return res.status(400).json({ success: false, error: 'Bạn chưa được phân phòng. Vui lòng liên hệ quản lý KTX.' });
    }

    const dormitory = await DormitoryCollection.findById(student.dormitoryId)
      .select('name floors')
      .lean();

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

// ============================================================
// MOBILE: MARK ALL NOTIFICATIONS READ (JWT-protected)
// ============================================================

router.post('/mobile/notifications/read-all', requireMobileJwt, async (req, res) => {
  try {
    const userId = req.mobileAuth.userId;
    const result = await NotificationCollection.updateMany(
      { 'readBy.userId': { $ne: userId } },
      { $push: { readBy: { userId, readAt: new Date() } } }
    );
    return res.json({ success: true, count: result.modifiedCount });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
