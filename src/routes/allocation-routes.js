const express = require('express');
const mongoose = require('mongoose');
const AllocationPolicy = require('../schemas/AllocationPolicySchema');
const AllocationCycle = require('../schemas/AllocationCycleSchema');
const RoomAllocation = require('../schemas/RoomAllocationSchema');
const AllocationAuditLog = require('../schemas/AllocationAuditLogSchema');
const AllocationRegistration = require('../schemas/AllocationRegistrationSchema');
const AllocationService = require('../services/allocationService');
const RebalancingService = require('../services/rebalancingService');
const { logger } = require('../config/logger');
const { EVENT_TYPES } = require('../events/domain-events');
const { publishDomainEvent } = require('../events/durable-event-publisher');

const router = express.Router();

// Middleware for authentication
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session || req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ============= POLICY ENDPOINTS =============

/**
 * POST /api/allocation/policies
 * Create new allocation policy
 */
router.post('/policies', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { academicYear, notes, priorityRules, rebalanceThresholds, autoEvictionRules } = req.body;

    // Validation
    if (!academicYear) {
      return res.status(400).json({
        error: 'Missing required field: academicYear'
      });
    }

    // Check if policy already exists
    const existing = await AllocationPolicy.findOne({ academicYear });
    if (existing) {
      return res.status(400).json({
        error: 'Policy already exists for this academic year'
      });
    }

    const policy = await AllocationPolicy.create({
      academicYear,
      priorityRules: priorityRules || undefined,
      rebalanceThresholds: rebalanceThresholds || undefined,
      autoEvictionRules: autoEvictionRules || undefined,
      active: true,
      createdBy: req.session.userId,
      notes
    });

    logger.info('Created allocation policy', {
      academicYear,
      admin: req.session.userId
    });

    res.status(201).json({
      message: 'Policy created successfully',
      policy
    });
  } catch (error) {
    logger.error('Error creating policy', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/policies/:academicYear
 * Get policy for academic year
 */
router.get('/policies/:academicYear', requireAuth, async (req, res) => {
  try {
    const policy = await AllocationPolicy.getActivePolicy(req.params.academicYear);

    if (!policy) {
      return res.status(404).json({ error: 'No active policy found' });
    }

    res.json({
      policy
    });
  } catch (error) {
    logger.error('Error fetching policy', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/allocation/policies/:academicYear
 * Update policy
 */
router.put('/policies/:academicYear', requireAuth, requireAdmin, async (req, res) => {
  try {
    const policy = await AllocationPolicy.findOne({ academicYear: req.params.academicYear });

    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    // Check if allocations exist
    const cycleCount = await AllocationCycle.countDocuments({
      academicYear: req.params.academicYear,
      status: 'COMPLETED'
    });

    if (cycleCount > 0) {
      return res.status(400).json({
        error: 'Cannot update policy after allocations have been executed'
      });
    }

    Object.assign(policy, req.body);
    policy.updatedBy = req.session.userId;
    await policy.save();

    logger.info('Updated allocation policy', {
      academicYear: req.params.academicYear,
      admin: req.session.userId
    });

    res.json({
      message: 'Policy updated successfully',
      policy
    });
  } catch (error) {
    logger.error('Error updating policy', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============= ALLOCATION CYCLE ENDPOINTS =============

/**
 * POST /api/allocation/cycles
 * Create allocation cycle
 */
router.post('/cycles', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      academicYear,
      name,
      registrationStart,
      registrationEnd,
      policyId
    } = req.body;

    // Validation
    if (!academicYear || !name || !registrationStart || !registrationEnd) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    // Get or use provided policy
    let policy;
    if (policyId) {
      policy = await AllocationPolicy.findById(policyId);
    } else {
      policy = await AllocationPolicy.getActivePolicy(academicYear);
    }

    if (!policy) {
      return res.status(404).json({ error: 'No active policy found' });
    }

    const cycle = await AllocationCycle.create({
      academicYear,
      name,
      registrationStart: new Date(registrationStart),
      registrationEnd: new Date(registrationEnd),
      policyId: policy._id,
      createdBy: req.session.userId
    });

    const capacity = await AllocationService.getCapacitySnapshot();
    await cycle.captureCapacitySnapshot(capacity.totalRooms, capacity.totalBeds, capacity.availableBeds);

    logger.info('Created allocation cycle', {
      academicYear,
      cycleName: name,
      admin: req.session.userId
    });

    res.status(201).json({
      message: 'Allocation cycle created successfully',
      cycle
    });
  } catch (error) {
    logger.error('Error creating cycle', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/cycles/:academicYear
 * Get cycles for academic year
 */
router.get('/cycles/:academicYear', requireAuth, async (req, res) => {
  try {
    const cycles = await AllocationCycle.find({ academicYear: req.params.academicYear })
      .populate('policyId')
      .sort({ registrationStart: -1 });

    res.json({ cycles });
  } catch (error) {
    logger.error('Error fetching cycles', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/allocation/cycles/:cycleId/execute
 * Execute allocation for cycle
 */
router.post('/cycles/:cycleId/execute', requireAuth, requireAdmin, async (req, res) => {
  try {
    const cycle = await AllocationCycle.findById(req.params.cycleId);

    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    if (cycle.status !== 'PENDING') {
      return res.status(400).json({
        error: `Cannot execute cycle with status: ${cycle.status}`
      });
    }

    const results = await AllocationService.executeAllocation(req.params.cycleId, req.session.userId);

    res.json({
      message: 'Allocation executed successfully',
      cycleStatus: cycle.status,
      results
    });
  } catch (error) {
    logger.error('Error executing allocation', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/cycles/:cycleId/approval-dashboard
 * Get ranked applications split into quick approve and manual review.
 */
router.get('/cycles/:cycleId/approval-dashboard', requireAuth, requireAdmin, async (req, res) => {
  try {
    const autoApprovePercent = parseInt(req.query.autoApprovePercent || req.query.autoPercent || '55', 10);
    const data = await AllocationService.getApprovalDashboard(req.params.cycleId, {
      autoApprovePercent
    });

    res.json({
      message: 'Approval dashboard generated successfully',
      data
    });
  } catch (error) {
    logger.error('Error generating approval dashboard', {
      error: error.message,
      cycleId: req.params.cycleId
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/allocation/cycles/:cycleId/auto-assign
 * Assign top ranked applications automatically (default 55%).
 */
router.post('/cycles/:cycleId/auto-assign', requireAuth, requireAdmin, async (req, res) => {
  try {
    const autoApprovePercent = parseInt(req.body.autoApprovePercent || req.body.autoPercent || '55', 10);
    const results = await AllocationService.executeAutoAssignment(
      req.params.cycleId,
      req.session.userId,
      { autoApprovePercent }
    );

    res.json({
      message: 'Smart auto assignment completed',
      results
    });
  } catch (error) {
    logger.error('Error executing smart auto assignment', {
      error: error.message,
      cycleId: req.params.cycleId
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/cycles/:cycleId/results
 * Get allocation results for cycle
 */
router.get('/cycles/:cycleId/results', requireAuth, async (req, res) => {
  try {
    const cycle = await AllocationCycle.findById(req.params.cycleId)
      .populate('policyId');

    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    const status = await AllocationService.getCycleAllocationStatus(req.params.cycleId);

    res.json({
      cycle: {
        _id: cycle._id,
        name: cycle.name,
        status: cycle.status,
        capacitySnapshot: cycle.capacitySnapshot,
        stats: cycle.stats
      },
      allocationStatus: status
    });
  } catch (error) {
    logger.error('Error fetching cycle results', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============= REGISTRATION ENDPOINTS =============

/**
 * POST /api/allocation/register
 * Student registers for room
 */
router.post('/register', requireAuth, async (req, res) => {
  try {
    const { academicYear, cycleId } = req.body;
    const studentId = req.session.userId;

    // Verify student
    const StudentCollection = require('../config/config').StudentCollection;
    const student = await StudentCollection.findById(studentId);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get cycle
    const cycle = await AllocationCycle.findById(cycleId);

    if (!cycle) {
      return res.status(404).json({ error: 'Allocation cycle not found' });
    }

    // Check if registration is open
    if (!cycle.isRegistrationOpen()) {
      return res.status(400).json({
        error: 'Registration window is closed'
      });
    }

    // Calculate year group
    const enrollmentYear = student.studentId
      ? parseInt(student.studentId.substring(0, 4))
      : new Date().getFullYear();

    const yearGroup = AllocationService.calculateYearGroup(enrollmentYear);

    // Check for existing registration
    const existing = await AllocationRegistration.findOne({
      studentId,
      allocationCycleId: cycleId
    });

    if (existing) {
      return res.status(400).json({
        error: 'Student already registered for this cycle'
      });
    }

    // Create registration
    const registration = await AllocationRegistration.create({
      academicYear,
      allocationCycleId: cycleId,
      studentId,
      studentName: student.name,
      studentEmail: student.email,
      studentPhone: student.phone,
      studentFaculty: student.faculty,
      studentEnrollmentYear: enrollmentYear,
      yearGroup,
      preferences: req.body.preferences || {},
      applicationNotes: req.body.notes
    });

    logger.info('Student registered for allocation', {
      studentId,
      cycleId,
      yearGroup
    });

    // Realtime: notify admin dashboard of new registration
    try {
      const io = req.app.get('io');
      if (io) {
        io.to('admin').emit('admin:new-registration', {
          studentName: student.name,
          studentEmail: student.email,
          studentFaculty: student.faculty,
          yearGroup,
          cycleId,
          registrationId: registration._id,
          at: new Date().toISOString()
        });
        io.to('admin').emit('admin:dashboard:refresh', { reason: 'new_registration', at: new Date().toISOString() });
      }
    } catch (_) {}

    res.status(201).json({
      message: 'Registration successful',
      registration,
      yearGroup,
      allocationInfo: {
        cycleStatus: cycle.status,
        registrationDeadline: cycle.registrationEnd
      }
    });
  } catch (error) {
    logger.error('Error registering for allocation', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/my-allocation
 * Get current allocation for student
 */
router.get('/my-allocation', requireAuth, async (req, res) => {
  try {
    const studentId = req.session.userId;
    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${currentYear + 1}`;

    const allocation = await RoomAllocation.getStudentAllocation(studentId, academicYear);

    if (!allocation) {
      return res.status(404).json({ error: 'No active allocation found' });
    }

    res.json({
      allocation,
      roomDetails: {
        roomNumber: allocation.roomNumber,
        building: allocation.dormitoryId?.name,
        capacity: allocation.roomCapacity,
        status: allocation.status
      }
    });
  } catch (error) {
    logger.error('Error fetching student allocation', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/registration-status/:cycleId
 * Get student's registration status for a cycle
 */
router.get('/registration-status/:cycleId', requireAuth, async (req, res) => {
  try {
    const registration = await AllocationRegistration.findOne({
      studentId: req.session.userId,
      allocationCycleId: req.params.cycleId
    }).populate('allocationCycleId');

    if (!registration) {
      return res.status(404).json({ error: 'No registration found for this cycle' });
    }

    res.json({
      registration,
      status: registration.status,
      yearGroup: registration.yearGroup
    });
  } catch (error) {
    logger.error('Error fetching registration status', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/allocation/withdraw-registration/:cycleId
 * Student withdraws registration
 */
router.post('/withdraw-registration/:cycleId', requireAuth, async (req, res) => {
  try {
    const registration = await AllocationRegistration.findOne({
      studentId: req.session.userId,
      allocationCycleId: req.params.cycleId
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    if (registration.status !== 'PENDING') {
      return res.status(400).json({
        error: 'Can only withdraw pending registrations'
      });
    }

    registration.status = 'WITHDRAWN';
    registration.withdrawnAt = new Date();
    registration.withdrawnReason = req.body.reason || 'Student initiated withdrawal';
    await registration.save();

    logger.info('Student withdrew registration', {
      studentId: req.session.userId,
      cycleId: req.params.cycleId
    });

    res.json({ message: 'Registration withdrawn successfully' });
  } catch (error) {
    logger.error('Error withdrawing registration', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============= MANUAL ALLOCATION ENDPOINTS =============

/**
 * POST /api/allocation/manual-assign
 * Admin manually assigns room to student
 */
router.post('/manual-assign', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { studentId, roomId, cycleId, reason } = req.body;

    if (!studentId || !roomId || !cycleId) {
      return res.status(400).json({
        error: 'Missing required fields: studentId, roomId, cycleId'
      });
    }

    const cycle = await AllocationCycle.findById(cycleId);
    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    // Check for existing active allocation
    const existing = await RoomAllocation.findOne({
      studentId,
      allocationCycleId: cycleId,
      status: 'ACTIVE'
    });

    if (existing) {
      return res.status(400).json({
        error: 'Student already has an active allocation'
      });
    }

    // Get room
    const Room = mongoose.model('rooms');
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Get student for year group calculation
    const StudentCollection = require('../config/config').StudentCollection;
    const student = await StudentCollection.findById(studentId);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const enrollmentYear = student.studentId
      ? parseInt(student.studentId.substring(0, 4))
      : new Date().getFullYear();

    const yearGroup = AllocationService.calculateYearGroup(enrollmentYear);

    // Create allocation
    const allocation = await RoomAllocation.create({
      academicYear: cycle.academicYear,
      allocationCycleId: cycleId,
      studentId,
      roomId,
      studentYearGroup: yearGroup,
      studentFaculty: student.faculty,
      studentEnrollmentYear: enrollmentYear,
      dormitoryId: room.dormitoryId,
      roomNumber: room.roomNumber,
      allocationType: 'MANUAL_OVERRIDE',
      allocationReason: reason || 'Manual assignment by admin',
      allocationBy: req.session.userId,
      status: 'ACTIVE'
    });

    // Add student to room occupants
    room.occupants.push({
      studentId: studentId.toString(),
      name: student.name,
      email: student.email,
      phone: student.phone,
      checkInDate: new Date(),
      active: true
    });
    await room.save();

    // Create audit log
    await AllocationAuditLog.logAllocationAction(
      'MANUAL_OVERRIDE',
      cycle.academicYear,
      req.session.userId,
      {
        cycleId,
        affectedStudents: [studentId],
        affectedRooms: [roomId],
        details: {
          allocationType: 'MANUAL_OVERRIDE',
          reason
        }
      }
    );

    logger.info('Admin manually assigned room', {
      studentId,
      roomId,
      admin: req.session.userId
    });

    await publishDomainEvent(EVENT_TYPES.STUDENT_ASSIGNED, {
      studentId: String(studentId),
      allocationType: 'MANUAL_OVERRIDE',
      roomNumber: allocation.roomNumber,
      dormitoryId: String(allocation.dormitoryId),
      cycleId: String(cycleId)
    });

    await publishDomainEvent(EVENT_TYPES.APPLICATION_UPDATED, {
      studentId: String(studentId),
      status: 'ALLOCATED',
      cycleId: String(cycleId)
    });

    res.status(201).json({
      message: 'Room assigned successfully',
      allocation
    });
  } catch (error) {
    logger.error('Error assigning room manually', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/allocation/revoke-allocation/:allocationId
 * Admin revokes an allocation
 */
router.post('/revoke-allocation/:allocationId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const allocation = await RoomAllocation.findById(req.params.allocationId);

    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    if (allocation.status !== 'ACTIVE') {
      return res.status(400).json({
        error: 'Can only revoke active allocations'
      });
    }

    await allocation.revoke(req.session.userId, req.body.reason || 'Revoked by admin');

    // Log audit
    await AllocationAuditLog.logAllocationAction(
      'ALLOCATION_REVOKED',
      allocation.academicYear,
      req.session.userId,
      {
        cycleId: allocation.allocationCycleId,
        affectedStudents: [allocation.studentId],
        affectedRooms: [allocation.roomId],
        details: {
          reason: req.body.reason
        }
      }
    );

    logger.info('Admin revoked allocation', {
      allocationId: req.params.allocationId,
      admin: req.session.userId
    });

    await publishDomainEvent(EVENT_TYPES.STUDENT_ALLOCATION_REVOKED, {
      studentId: String(allocation.studentId),
      allocationId: String(allocation._id),
      reason: req.body.reason || 'Revoked by admin',
      cycleId: String(allocation.allocationCycleId)
    });

    await publishDomainEvent(EVENT_TYPES.APPLICATION_UPDATED, {
      studentId: String(allocation.studentId),
      status: 'REVOKED',
      cycleId: String(allocation.allocationCycleId)
    });

    res.json({ message: 'Allocation revoked successfully' });
  } catch (error) {
    logger.error('Error revoking allocation', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============= REBALANCING ENDPOINTS =============

/**
 * GET /api/allocation/rebalance/suggestions/:academicYear
 * Get rebalancing suggestions
 */
router.get('/rebalance/suggestions/:cycleId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const isNeeded = await RebalancingService.isRebalancingNeeded(req.params.cycleId);

    if (!isNeeded) {
      return res.json({
        message: 'No rebalancing needed',
        suggestionsNeeded: false
      });
    }

    const suggestions = await RebalancingService.generateSuggestions(req.params.cycleId);

    // Log suggestion creation
    await AllocationAuditLog.logAllocationAction(
      'REBALANCE_SUGGESTED',
      null,
      req.session.userId,
      {
        cycleId: req.params.cycleId,
        mode: 'SUGGESTION',
        details: suggestions
      }
    );

    res.json({
      suggestionsNeeded: true,
      suggestions
    });
  } catch (error) {
    logger.error('Error generating suggestions', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/allocation/rebalance/execute
 * Execute rebalancing
 */
router.post('/rebalance/execute', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { cycleId } = req.body;

    if (!cycleId) {
      return res.status(400).json({ error: 'cycleId is required' });
    }

    const results = await RebalancingService.executeRebalancing(cycleId, req.session.userId);

    res.json({
      message: 'Rebalancing executed successfully',
      results
    });
  } catch (error) {
    logger.error('Error executing rebalancing', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/rebalance/status/:cycleId
 * Get rebalancing status
 */
router.get('/rebalance/status/:cycleId', requireAuth, async (req, res) => {
  try {
    const status = await RebalancingService.getRebalancingStatus(req.params.cycleId);

    res.json(status);
  } catch (error) {
    logger.error('Error fetching rebalancing status', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/current
 * Active cycle + policy info for the registration wizard form
 */
router.get('/current', requireAuth, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${currentYear + 1}`;

    // Find active (open) cycle
    const cycle = await AllocationCycle.findOne({
      status: 'PENDING'
    }).sort({ createdAt: -1 }).lean();

    // Find active policy
    const policy = await AllocationPolicy.findOne({ active: true })
      .sort({ createdAt: -1 })
      .lean();

    if (!cycle) {
      return res.json({ success: false, message: 'Không có chu kỳ đăng ký nào đang mở', cycle: null, policy });
    }

    // Check if student already registered
    const { StudentCollection } = require('../config/config');
    const studentId = req.session.userId;
    const existing = await AllocationRegistration.findOne({
      studentId,
      allocationCycleId: cycle._id
    }).lean();

    res.json({
      success: true,
      cycle,
      policy: policy ? {
        _id: policy._id,
        academicYear: policy.academicYear,
        priorityRules: policy.priorityRules
      } : null,
      alreadyRegistered: !!existing,
      existingRegistration: existing
    });
  } catch (error) {
    logger.error('Error fetching current cycle', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/allocation/estimate-score
 * Calculate estimated priority score using the active policy rules
 */
router.post('/estimate-score', requireAuth, async (req, res) => {
  try {
    const { distanceFromHome, financialHardship, scholarship, familyWealth, enrollmentYear } = req.body;

    // Get active policy
    const policy = await AllocationPolicy.findOne({ active: true }).sort({ createdAt: -1 });
    if (!policy) {
      return res.json({ score: 0, breakdown: [], message: 'Không tìm thấy chính sách phân bổ active' });
    }

    // Determine year group
    const currentYear = new Date().getFullYear();
    const enYear = enrollmentYear || currentYear;
    const yearsIn = currentYear - parseInt(enYear);
    let yearGroup = 'year1';
    if (yearsIn >= 4) yearGroup = 'year4_plus';
    else if (yearsIn >= 1) yearGroup = 'year2_3';

    const rules = policy.priorityRules || {};
    let score = 50;
    const breakdown = [];

    // Year group
    const ygWeight = (rules.yearGroupWeights || {})[yearGroup] || 0;
    score += ygWeight;
    breakdown.push({ label: `Năm học (${yearGroup === 'year1' ? 'Năm 1' : yearGroup === 'year2_3' ? 'Năm 2-3' : 'Năm 4+'})`, points: ygWeight });

    // Financial hardship
    if (financialHardship) {
      const fhPoints = (rules.financialHardship || {}).verified || 0;
      score += fhPoints;
      breakdown.push({ label: 'Khó khăn tài chính', points: fhPoints });
    }

    // Distance
    const dist = parseFloat(distanceFromHome) || 0;
    let distPoints = 0;
    if (dist > 500) distPoints = (rules.distanceFromHome || {}).above500km || 0;
    else if (dist > 200) distPoints = (rules.distanceFromHome || {}).above200km || 0;
    else if (dist < 50) distPoints = (rules.distanceFromHome || {}).below50km || 0;
    score += distPoints;
    breakdown.push({ label: `Khoảng cách (${dist} km)`, points: distPoints });

    // Scholarship
    if (scholarship) {
      const schPoints = rules.scholarship || 0;
      score += schPoints;
      breakdown.push({ label: 'Học bổng', points: schPoints });
    }

    // Family wealth
    if (familyWealth && rules.familyWealth) {
      const fwPoints = (rules.familyWealth)[familyWealth] || 0;
      score += fwPoints;
      breakdown.push({ label: 'Hoàn cảnh gia đình', points: fwPoints });
    }

    // Violations (assume none for estimate)
    const violPoints = (rules.violations || {}).none || 0;
    score += violPoints;
    breakdown.push({ label: 'Vi phạm (không có)', points: violPoints });

    // Clamp
    score = Math.max(0, Math.min(100, score));

    res.json({ success: true, score: Math.round(score), breakdown, yearGroup, base: 50 });
  } catch (error) {
    logger.error('Error estimating score', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/waitlist-position
 * Returns current student's position in WAITLIST for the active cycle
 */
router.get('/waitlist-position', requireAuth, async (req, res) => {
  try {
    const studentId = req.session.userId;
    const cycle = await AllocationCycle.findOne({ status: { $in: ['PENDING', 'RUNNING'] } }).sort({ createdAt: -1 });
    if (!cycle) return res.json({ position: null, total: 0, message: 'No active cycle' });

    const reg = await AllocationRegistration.findOne({
      studentId,
      allocationCycleId: cycle._id,
      status: 'WAITLIST'
    });
    if (!reg) return res.json({ position: null, total: 0, message: 'Not on waitlist' });

    // Count waitlisted registrations with higher priority
    const ahead = await AllocationRegistration.countDocuments({
      allocationCycleId: cycle._id,
      status: 'WAITLIST',
      priority: { $gt: reg.priority }
    });
    const total = await AllocationRegistration.countDocuments({ allocationCycleId: cycle._id, status: 'WAITLIST' });

    res.json({ position: ahead + 1, total, priority: reg.priority, cycleId: cycle._id });
  } catch (error) {
    logger.error('Error fetching waitlist position', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/my-registration
 * Returns student's latest AllocationRegistration (with populated cycle)
 */
router.get('/my-registration', requireAuth, async (req, res) => {
  try {
    const studentId = req.session.userId;
    const reg = await AllocationRegistration.findOne({ studentId })
      .sort({ createdAt: -1 })
      .populate('allocationCycleId')
      .lean();
    if (!reg) return res.json({ success: false, registration: null });
    res.json({ success: true, registration: reg });
  } catch (error) {
    logger.error('Error fetching my-registration', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
