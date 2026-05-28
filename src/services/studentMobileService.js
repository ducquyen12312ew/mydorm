const mongoose = require('mongoose');
const {
  StudentCollection,
  DormitoryCollection,
  PendingApplicationCollection,
  NotificationCollection,
  AcademicWindowCollection
} = require('../config/config');
const RoomAllocation = require('../schemas/RoomAllocationSchema');
const AllocationCycle = require('../schemas/AllocationCycleSchema');
const { calculatePriorityScore } = require('../utils/priorityCalculator');

function toObjectId(id) {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  return new mongoose.Types.ObjectId(id);
}

function studentIdentifiers(student, userId) {
  const ids = [String(userId)];
  if (student?.studentId) {
    ids.push(String(student.studentId));
  }
  return ids;
}

function deriveAcademicYear(studentId) {
  const now = new Date().getFullYear();
  const parsed = parseInt((studentId || '').slice(0, 4), 10);
  if (!parsed || Number.isNaN(parsed)) {
    return '1';
  }

  const year = Math.max(1, Math.min(6, now - parsed));
  return String(year);
}

function flattenRooms(dormitory) {
  const rooms = [];
  (dormitory.floors || []).forEach((floor) => {
    (floor.rooms || []).forEach((room) => {
      const activeCount = (room.occupants || []).filter((o) => o.active).length;
      rooms.push({
        id: room._id,
        roomNumber: room.roomNumber,
        roomType: room.roomType,
        floor: floor.floorNumber,
        maxCapacity: room.maxCapacity,
        currentOccupants: activeCount,
        availableBeds: Math.max(0, room.maxCapacity - activeCount),
        pricePerMonth: room.pricePerMonth,
        amenities: room.amenities || [],
        imageUrl: room.imageUrl || '',
        isAvailable: activeCount < room.maxCapacity
      });
    });
  });

  return rooms;
}

async function getStudentContext(userId) {
  const student = await StudentCollection.findById(userId).lean();
  if (!student) {
    return null;
  }

  const matchIds = studentIdentifiers(student, userId);
  const latestApplication = await PendingApplicationCollection.findOne({
    studentId: { $in: matchIds }
  })
    .sort({ createdAt: -1 })
    .lean();

  const currentYear = new Date().getFullYear();
  const academicYear = `${currentYear}-${currentYear + 1}`;
  const activeAllocation = await RoomAllocation.findOne({
    studentId: student._id,
    status: 'ACTIVE',
    academicYear
  })
    .populate('dormitoryId', 'name')
    .sort({ allocationTimestamp: -1 })
    .lean();

  const activeCycle = await AllocationCycle.getActiveCycle(academicYear);

  const unreadCount = await NotificationCollection.countDocuments({
    $and: [
      {
        $or: [
          { isGlobal: true },
          { targetUsers: student._id },
          { targetRole: student.role || 'user' },
          { targetRole: 'all' }
        ]
      },
      {
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      }
    ]
    ,
    'readBy.userId': { $ne: student._id }
  });

  return {
    student,
    latestApplication,
    activeAllocation,
    activeCycle,
    unreadCount
  };
}

async function getStudentDashboard(userId) {
  const context = await getStudentContext(userId);
  if (!context) {
    return null;
  }

  const { student, latestApplication, activeAllocation, activeCycle, unreadCount } = context;

  const assignment = activeAllocation
    ? {
        status: 'assigned',
        roomNumber: activeAllocation.roomNumber,
        dormitoryName: activeAllocation.dormitoryId?.name || '',
        allocationType: activeAllocation.allocationType,
        updatedAt: activeAllocation.allocationTimestamp
      }
    : {
        status: 'pending',
        roomNumber: student.roomNumber || '',
        dormitoryName: '',
        allocationType: '',
        updatedAt: null
      };

  return {
    profile: {
      id: student._id,
      name: student.name,
      studentId: student.studentId,
      email: student.email,
      phone: student.phone,
      gender: student.gender,
      faculty: student.faculty,
      academicYear: student.academicYear || deriveAcademicYear(student.studentId),
      priorityScore: student.priorityScore || 0,
      roomNumber: student.roomNumber,
      dormitoryId: student.dormitoryId,
      preferences: {
        isInternational: !!student.isInternational,
        country: student.country || '',
        nationality: student.nationality || ''
      }
    },
    application: latestApplication
      ? {
          id: latestApplication._id,
          status: latestApplication.status,
          roomNumber: latestApplication.roomNumber,
          dormitoryId: latestApplication.dormitoryId,
          submittedAt: latestApplication.createdAt,
          updatedAt: latestApplication.updatedAt,
          priorityScore: latestApplication.priorityScore || student.priorityScore || 0
        }
      : null,
    assignment,
    cycle: activeCycle
      ? {
          id: activeCycle._id,
          name: activeCycle.name,
          status: activeCycle.status,
          registrationStart: activeCycle.registrationStart,
          registrationEnd: activeCycle.registrationEnd
        }
      : null,
    notifications: {
      unreadCount
    },
    syncAt: new Date().toISOString()
  };
}

async function getRoomExploreData(filters = {}) {
  const query = {
    $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
  };

  if (filters.dormitoryId) {
    query._id = toObjectId(filters.dormitoryId);
  }

  const dormitories = await DormitoryCollection.find(query).lean();

  const mapped = dormitories.map((dormitory) => {
    let rooms = flattenRooms(dormitory);

    if (filters.onlyAvailable === 'true') {
      rooms = rooms.filter((room) => room.isAvailable);
    }

    if (filters.roomType) {
      rooms = rooms.filter((room) => room.roomType === filters.roomType);
    }

    return {
      id: dormitory._id,
      name: dormitory.name,
      address: dormitory.address,
      imageUrl: dormitory.imageUrl || '',
      category: dormitory?.details?.category || '',
      totalRooms: rooms.length,
      rooms
    };
  });

  return mapped;
}

async function getStudentNotifications(userId, limit = 20) {
  const student = await StudentCollection.findById(userId).lean();
  if (!student) {
    return [];
  }

  const notifications = await NotificationCollection.find({
    $and: [
      {
        $or: [
          { isGlobal: true },
          { targetUsers: student._id },
          { targetRole: student.role || 'user' },
          { targetRole: 'all' }
        ]
      },
      {
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return notifications.map((item) => {
    const isRead = (item.readBy || []).some(
      (entry) => String(entry.userId) === String(student._id)
    );

    return {
      id: item._id,
      title: item.title,
      message: item.message,
      type: item.type,
      category: item.category || null,
      priority: item.priority,
      createdAt: item.createdAt,
      isRead
    };
  });
}

function scorePreviewFromPayload(payload) {
  const studentData = {
    priorityPolicies: payload.priorityPolicies || [],
    yearGroup: payload.yearGroup || 'year1',
    gpa: Number(payload.gpa || 0),
    violations: payload.violations || [],
    distanceFromHome: Number(payload.distanceFromHome || 0),
    familyWealth: payload.familyWealth || 'average'
  };

  return calculatePriorityScore(studentData);
}

async function getRegistrationAvailability() {
  const now = new Date();
  const windows = await AcademicWindowCollection.find({
    startDate: { $lte: now },
    endDate: { $gte: now },
    status: 'active'
  })
    .sort({ startDate: -1 })
    .lean();

  if (!windows.length) {
    return {
      openForRegistration: false,
      message: 'No active registration window'
    };
  }

  const current = windows[0];
  return {
    openForRegistration: true,
    window: {
      id: current._id,
      academicYear: current.academicYear,
      startDate: current.startDate,
      endDate: current.endDate,
      allowedAcademicYears: current.allowedAcademicYears || ['1', '2', '3', '4', '5', '6']
    }
  };
}

/**
 * Assign a student to the best available room
 * Prioritizes rooms with most available beds
 */
async function assignStudentToRoom(studentId) {
  try {
    // Find student
    const student = await StudentCollection.findById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    // Find all dormitories with available rooms
    const dormitories = await DormitoryCollection.find({
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
    });

    // Find best room (most available beds)
    let bestRoom = null;
    let bestFloorIndex = -1;
    let bestRoomIndex = -1;
    let bestDormId = null;
    let maxAvailableBeds = -1;

    for (const dorm of dormitories) {
      if (!dorm.floors) continue;

      for (let floorIdx = 0; floorIdx < dorm.floors.length; floorIdx++) {
        const floor = dorm.floors[floorIdx];
        if (!floor.rooms) continue;

        for (let roomIdx = 0; roomIdx < floor.rooms.length; roomIdx++) {
          const room = floor.rooms[roomIdx];
          const occupiedCount = (room.occupants || []).filter(o => o.active).length;
          const availableBeds = (room.maxCapacity || 0) - occupiedCount;

          // Prefer rooms with more available beds
          if (availableBeds > 0 && availableBeds > maxAvailableBeds) {
            maxAvailableBeds = availableBeds;
            bestRoom = room;
            bestFloorIndex = floorIdx;
            bestRoomIndex = roomIdx;
            bestDormId = dorm._id;
          }
        }
      }
    }

    if (!bestRoom) {
      throw new Error('No available rooms found');
    }

    // Create occupant record
    const occupantData = {
      studentId: student.studentId || student._id.toString(),
      name: student.fullName || student.name || 'Unknown',
      phone: student.phone || '',
      email: student.email || '',
      checkInDate: new Date(),
      active: true
    };

    // Add student to room occupants
    if (!bestRoom.occupants) {
      bestRoom.occupants = [];
    }
    bestRoom.occupants.push(occupantData);

    // Save updated dormitory
    await DormitoryCollection.findByIdAndUpdate(
      bestDormId,
      { floors: dormitories.find(d => d._id.equals(bestDormId)).floors },
      { new: true }
    );

    return {
      success: true,
      assignment: {
        studentId: student._id,
        studentName: student.fullName || student.name,
        roomNumber: bestRoom.roomNumber,
        dormitory: bestDormId,
        floor: bestFloorIndex + 1,
        occupants: bestRoom.occupants.length,
        maxCapacity: bestRoom.maxCapacity
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  getStudentDashboard,
  getRoomExploreData,
  getStudentNotifications,
  scorePreviewFromPayload,
  getRegistrationAvailability,
  assignStudentToRoom
};
