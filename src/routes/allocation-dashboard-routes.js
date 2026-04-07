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

const router = express.Router();

// Middleware
const requireAdmin = (req, res, next) => {
  if (!req.session || req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ============= DASHBOARD ENDPOINTS =============

/**
 * GET /api/allocation/dashboard/:academicYear
 * Comprehensive allocation dashboard
 */
router.get('/dashboard/:academicYear', requireAdmin, async (req, res) => {
  try {
    const dashboardData = await AllocationService.getDashboardData(req.params.academicYear);

    // Get active cycle
    const activeCycle = await AllocationCycle.getActiveCycle(req.params.academicYear);

    // Calculate summary
    const yearGroups = dashboardData.yearGroups;
    const summary = {
      totalCapacity: dashboardData.capacity.totalBeds,
      totalAllocated: Object.values(yearGroups).reduce((sum, yg) => sum + (yg.allocated || 0), 0),
      totalRegistrations: Object.values(yearGroups).reduce((sum, yg) => sum + (yg.registrations || 0), 0),
      availableBeds: dashboardData.capacity.availableBeds
    };

    // Get rebalancing status if cycle exists
    let rebalancingStatus = null;
    if (activeCycle) {
      rebalancingStatus = await RebalancingService.getRebalancingStatus(activeCycle._id);
    }

    res.json({
      academicYear: req.params.academicYear,
      policy: dashboardData.policy,
      capacity: dashboardData.capacity,
      yearGroups,
      summary,
      activeCycle: activeCycle ? {
        _id: activeCycle._id,
        name: activeCycle.name,
        status: activeCycle.status,
        registrationStart: activeCycle.registrationStart,
        registrationEnd: activeCycle.registrationEnd
      } : null,
      rebalancingStatus
    });
  } catch (error) {
    logger.error('Error fetching dashboard data', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/usage-report/:academicYear
 * Detailed utilization report
 */
router.get('/usage-report/:academicYear', requireAdmin, async (req, res) => {
  try {
    const academicYear = req.params.academicYear;
    const cycles = await AllocationCycle.find({ academicYear })
      .sort({ createdAt: -1 });

    const report = {
      academicYear,
      generatedAt: new Date(),
      cycles: []
    };

    for (const cycle of cycles) {
      const status = await AllocationService.getCycleAllocationStatus(cycle._id);

      report.cycles.push({
        cycleName: cycle.name,
        cycleId: cycle._id,
        status: cycle.status,
        registrationWindow: {
          start: cycle.registrationStart,
          end: cycle.registrationEnd
        },
        capacitySnapshot: cycle.capacitySnapshot || {},
        utilizationByYearGroup: status.yearGroupStatus,
        totalUtilization: {
          allocated: status.totalAllocated,
          capacity: status.capacity?.totalBeds || 0,
          availableBeds: status.availableBeds || 0,
          percentage: status.capacity?.totalBeds ? ((status.totalAllocated / status.capacity.totalBeds) * 100).toFixed(2) + '%' : '0%'
        }
      });
    }

    res.json(report);
  } catch (error) {
    logger.error('Error generating usage report', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/year-group-details/:academicYear/:yearGroup
 * Detailed breakdown for specific year group
 */
router.get('/year-group-details/:academicYear/:yearGroup', requireAdmin, async (req, res) => {
  try {
    const { academicYear, yearGroup } = req.params;

    const policy = await AllocationPolicy.getActivePolicy(academicYear);
    if (!policy) {
      return res.status(404).json({ error: 'No active policy found' });
    }

    const cycle = await AllocationCycle.getActiveCycle(academicYear);
    if (!cycle) {
      return res.status(404).json({ error: 'No active cycle found' });
    }

    // Get all allocations for this year group
    const allocations = await RoomAllocation.find({
      allocationCycleId: cycle._id,
      studentYearGroup: yearGroup,
      status: 'ACTIVE'
    })
      .populate(['studentId', 'roomId', 'dormitoryId'])
      .sort({ allocationTimestamp: -1 });

    // Get waitlisted students
    const waitlisted = await AllocationRegistration.find({
      allocationCycleId: cycle._id,
      yearGroup,
      status: 'WAITLIST'
    })
      .populate('studentId')
      .sort({ priority: -1, createdAt: 1 });

    const capacity = await AllocationService.getCapacitySnapshot();

    res.json({
      yearGroup,
      academicYear,
      policy: policy.priorityRules || {},
      capacity,
      allocated: allocations.length,
      utilizationPercentage: capacity.totalBeds ? ((allocations.length / capacity.totalBeds) * 100).toFixed(2) : '0',
      availableBeds: capacity.availableBeds,
      allocatedStudents: allocations.map(a => ({
        studentId: a.studentId._id,
        studentName: a.studentId.name,
        room: `${a.roomId.roomNumber}`,
        dormitory: a.dormitoryId?.name,
        allocationType: a.allocationType,
        allocationDate: a.allocationTimestamp
      })),
      waitlistedStudents: waitlisted.map(w => ({
        studentId: w.studentId._id,
        studentName: w.studentId.name,
        priority: w.priority,
        registeredAt: w.registrationTimestamp
      }))
    });
  } catch (error) {
    logger.error('Error fetching year group details', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/room-status/:dormitoryId
 * Room occupancy status for a dormitory
 */
router.get('/room-status/:dormitoryId', requireAdmin, async (req, res) => {
  try {
    const Room = mongoose.model('rooms');
    const rooms = await Room.find({ dormitoryId: req.params.dormitoryId });

    const status = rooms.map(room => ({
      roomId: room._id,
      roomNumber: room.roomNumber,
      capacity: room.maxCapacity,
      occupied: room.occupants?.length || 0,
      availableSlots: (room.maxCapacity - (room.occupants?.length || 0)),
      occupants: room.occupants?.map(o => ({
        studentId: o.studentId,
        name: o.name,
        checkInDate: o.checkInDate
      })) || []
    }));

    const summary = {
      totalRooms: status.length,
      totalCapacity: status.reduce((sum, r) => sum + r.capacity, 0),
      totalOccupied: status.reduce((sum, r) => sum + r.occupied, 0),
      totalAvailable: status.reduce((sum, r) => sum + r.availableSlots, 0),
      utilizationPercentage: (
        (status.reduce((sum, r) => sum + r.occupied, 0) / 
         status.reduce((sum, r) => sum + r.capacity, 0)) * 100
      ).toFixed(2)
    };

    res.json({
      dormitoryId: req.params.dormitoryId,
      summary,
      rooms: status
    });
  } catch (error) {
    logger.error('Error fetching room status', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/violation-report/:academicYear
 * Report of allocation balance violations
 */
router.get('/violation-report/:academicYear', requireAdmin, async (req, res) => {
  try {
    const cycle = await AllocationCycle.getActiveCycle(req.params.academicYear);

    if (!cycle) {
      return res.json({
        academicYear: req.params.academicYear,
        message: 'No active cycle found',
        violations: { surplus: [], deficit: [] }
      });
    }

    const violations = await RebalancingService.detectViolations(cycle._id);

    res.json({
      academicYear: req.params.academicYear,
      cycleId: cycle._id,
      cycleName: cycle.name,
      violations,
      requiresRebalancing: violations.surplus.length > 0 || violations.deficit.length > 0
    });
  } catch (error) {
    logger.error('Error generating violation report', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/audit-log/:academicYear
 * Retrieve audit trail
 */
router.get('/audit-log/:academicYear', requireAdmin, async (req, res) => {
  try {
    const options = {
      limit: parseInt(req.query.limit) || 100,
      skip: parseInt(req.query.skip) || 0,
      startDate: req.query.startDate ? new Date(req.query.startDate) : null,
      endDate: req.query.endDate ? new Date(req.query.endDate) : null,
      actionType: req.query.actionType,
      result: req.query.result
    };

    const logs = await AllocationAuditLog.getActionHistory(req.params.academicYear, options);

    res.json({
      academicYear: req.params.academicYear,
      queryOptions: options,
      logs,
      count: logs.length
    });
  } catch (error) {
    logger.error('Error fetching audit logs', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/student-history/:studentId
 * Student's allocation history
 */
router.get('/student-history/:studentId', requireAdmin, async (req, res) => {
  try {
    const allocations = await AllocationService.getStudentAllocations(req.params.studentId);

    const auditHistory = await AllocationAuditLog.getStudentAuditHistory(req.params.studentId, null, 50);

    res.json({
      studentId: req.params.studentId,
      allocations,
      auditHistory
    });
  } catch (error) {
    logger.error('Error fetching student history', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/summary-stats/:academicYear
 * High-level summary statistics
 */
router.get('/summary-stats/:academicYear', requireAdmin, async (req, res) => {
  try {
    const policy = await AllocationPolicy.getActivePolicy(req.params.academicYear);
    const cycles = await AllocationCycle.find({ academicYear: req.params.academicYear });

    const totalAllocations = await RoomAllocation.countDocuments({
      academicYear: req.params.academicYear,
      status: 'ACTIVE'
    });

    const totalRegistrations = await AllocationRegistration.countDocuments({
      academicYear: req.params.academicYear,
      status: { $ne: 'WITHDRAWN' }
    });

    const capacity = await AllocationService.getCapacitySnapshot();

    const stats = {
      academicYear: req.params.academicYear,
      policy: policy ? {
        active: policy.active
      } : null,
      cycles: {
        total: cycles.length,
        pending: cycles.filter(c => c.status === 'PENDING').length,
        running: cycles.filter(c => c.status === 'RUNNING').length,
        completed: cycles.filter(c => c.status === 'COMPLETED').length
      },
      allocations: {
        total: totalAllocations,
        capacity: capacity.totalBeds,
        utilizationPercentage: capacity.totalBeds > 0
          ? ((totalAllocations / capacity.totalBeds) * 100).toFixed(2)
          : '0.00'
      },
      registrations: {
        total: totalRegistrations
      },
      generatedAt: new Date()
    };

    res.json(stats);
  } catch (error) {
    logger.error('Error generating summary stats', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
