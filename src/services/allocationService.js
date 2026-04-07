const mongoose = require('mongoose');
const AllocationPolicy = require('../schemas/AllocationPolicySchema');
const AllocationCycle = require('../schemas/AllocationCycleSchema');
const RoomAllocation = require('../schemas/RoomAllocationSchema');
const AllocationAuditLog = require('../schemas/AllocationAuditLogSchema');
const { DormitoryCollection } = require('../config/config');
const { logger } = require('../config/logger');

class AllocationService {
  static normalizeAutoApprovePercent(percent) {
    const numeric = Number(percent);
    if (!Number.isFinite(numeric)) return 55;
    if (numeric < 50) return 50;
    if (numeric > 60) return 60;
    return Math.round(numeric);
  }

  static normalizePriorityLevelValue(priorityDetails = {}, registration = {}) {
    const levelRaw = priorityDetails.priorityLevel || priorityDetails.level || priorityDetails.priority;
    if (typeof levelRaw === 'string') {
      const level = levelRaw.toLowerCase();
      if (['critical', 'urgent', 'highest', 'very_high', 'very-high'].includes(level)) return 100;
      if (['high', 'priority', 'p1'].includes(level)) return 80;
      if (['medium', 'normal', 'p2'].includes(level)) return 55;
      if (['low', 'p3'].includes(level)) return 30;
      if (['none', 'no_priority', 'no-priority'].includes(level)) return 0;
    }

    const numeric = Number(levelRaw ?? registration.priority ?? priorityDetails.priorityScore ?? 0);
    if (Number.isFinite(numeric)) {
      if (numeric <= 1) return Math.max(0, Math.min(100, Math.round(numeric * 100)));
      return Math.max(0, Math.min(100, Math.round(numeric)));
    }

    return 40;
  }

  static normalizeFinancialDifficultyValue(priorityDetails = {}) {
    if (typeof priorityDetails.financialHardship === 'boolean') {
      return priorityDetails.financialHardship ? 100 : 0;
    }

    const hardshipLevel = (priorityDetails.financialDifficulty
      || priorityDetails.financialHardshipLevel
      || priorityDetails.financialStatus
      || '').toString().toLowerCase();

    if (['critical', 'severe', 'extreme', 'hardship'].includes(hardshipLevel)) return 100;
    if (['high', 'poor', 'very_low_income', 'very-low-income'].includes(hardshipLevel)) return 85;
    if (['medium', 'moderate', 'low_income', 'low-income'].includes(hardshipLevel)) return 60;
    if (['low', 'average'].includes(hardshipLevel)) return 30;
    if (['none', 'stable', 'wealthy'].includes(hardshipLevel)) return 0;

    return 20;
  }

  static calculateSmartRankingScore(registration = {}) {
    const details = registration.studentId?.priorityDetails || {};
    const distanceFromHome = Number(details.distanceFromHome ?? registration.distanceFromHome ?? 0);
    const normalizedDistance = Math.max(0, Math.min(100, Math.round((distanceFromHome / 500) * 100)));
    const normalizedFinancial = this.normalizeFinancialDifficultyValue(details);
    const normalizedPriorityLevel = this.normalizePriorityLevelValue(details, registration);

    const weightedScore = (normalizedDistance * 0.35)
      + (normalizedFinancial * 0.35)
      + (normalizedPriorityLevel * 0.30);

    return {
      totalScore: Number(weightedScore.toFixed(2)),
      breakdown: {
        distance: {
          rawValueKm: Number.isFinite(distanceFromHome) ? distanceFromHome : 0,
          normalized: normalizedDistance,
          weight: 0.35,
          weighted: Number((normalizedDistance * 0.35).toFixed(2))
        },
        financialDifficulty: {
          normalized: normalizedFinancial,
          weight: 0.35,
          weighted: Number((normalizedFinancial * 0.35).toFixed(2))
        },
        priorityLevel: {
          normalized: normalizedPriorityLevel,
          weight: 0.30,
          weighted: Number((normalizedPriorityLevel * 0.30).toFixed(2))
        }
      }
    };
  }

  static computeFairnessSummary(rankedApplications, selectedApplications) {
    const totalRegistrations = rankedApplications.length;
    const totalSelected = selectedApplications.length;
    const groups = ['year1', 'year2_3', 'year4_plus'];

    const byYearGroup = groups.reduce((acc, group) => {
      const registrationCount = rankedApplications.filter((item) => item.yearGroup === group).length;
      const selectedCount = selectedApplications.filter((item) => item.yearGroup === group).length;
      const registrationShare = totalRegistrations > 0 ? registrationCount / totalRegistrations : 0;
      const selectedShare = totalSelected > 0 ? selectedCount / totalSelected : 0;
      const deviation = Number(((selectedShare - registrationShare) * 100).toFixed(2));

      acc[group] = {
        registrationCount,
        selectedCount,
        registrationShare: Number((registrationShare * 100).toFixed(2)),
        selectedShare: Number((selectedShare * 100).toFixed(2)),
        deviation
      };
      return acc;
    }, {});

    const maxAbsDeviation = Object.values(byYearGroup).reduce(
      (max, group) => Math.max(max, Math.abs(group.deviation)),
      0
    );

    return {
      byYearGroup,
      maxDeviationPercent: Number(maxAbsDeviation.toFixed(2)),
      fairnessStatus: maxAbsDeviation <= 10 ? 'BALANCED' : 'NEEDS_REVIEW'
    };
  }

  /**
   * Wrapper for simulation fairness computation
   * @param {Array} rankedApplications - All applications ranked
   * @param {Array} allocatedApplications - Allocated applications
   * @returns {Object} Fairness analysis
   */
  static computeFairnessForSimulation(rankedApplications, allocatedApplications) {
    return this.computeFairnessSummary(rankedApplications, allocatedApplications);
  }

  static async getApprovalDashboard(cycleId, options = {}) {
    const cycle = await AllocationCycle.findById(cycleId).populate('policyId');
    if (!cycle) {
      throw new Error('Allocation cycle not found');
    }

    const autoApprovePercent = this.normalizeAutoApprovePercent(options.autoApprovePercent);
    const AllocationRegistration = mongoose.model('AllocationRegistration');

    const registrations = await AllocationRegistration.find({
      allocationCycleId: cycleId,
      status: 'PENDING'
    })
      .populate('studentId')
      .lean();

    const rankedApplications = registrations
      .map((registration) => {
        const score = this.calculateSmartRankingScore(registration);
        return {
          registrationId: registration._id,
          studentId: registration.studentId?._id || registration.studentId,
          studentName: registration.studentName,
          studentEmail: registration.studentEmail,
          studentPhone: registration.studentPhone,
          studentFaculty: registration.studentFaculty,
          studentEnrollmentYear: registration.studentEnrollmentYear,
          yearGroup: registration.yearGroup,
          registrationTimestamp: registration.registrationTimestamp,
          smartScore: score.totalScore,
          scoreBreakdown: score.breakdown,
          criteria: {
            distanceFromHomeKm: score.breakdown.distance.rawValueKm,
            financialDifficultyScore: score.breakdown.financialDifficulty.normalized,
            priorityLevelScore: score.breakdown.priorityLevel.normalized
          }
        };
      })
      .sort((a, b) => {
        if (b.smartScore === a.smartScore) {
          return new Date(a.registrationTimestamp) - new Date(b.registrationTimestamp);
        }
        return b.smartScore - a.smartScore;
      })
      .map((item, index) => ({ ...item, rank: index + 1 }));

    const capacity = await this.getCapacitySnapshot();
    const targetAutoCount = Math.floor((rankedApplications.length * autoApprovePercent) / 100);
    const autoSlots = Math.max(0, Math.min(targetAutoCount, capacity.availableBeds));

    // Selection is strictly ranking-based and capped by available beds.
    const quickApproveList = rankedApplications.slice(0, autoSlots);
    const manualReviewList = rankedApplications.slice(autoSlots);

    return {
      cycle: {
        _id: cycle._id,
        name: cycle.name,
        academicYear: cycle.academicYear,
        status: cycle.status
      },
      settings: {
        autoApprovePercent,
        autoSlots,
        targetAutoCount,
        availableBeds: capacity.availableBeds
      },
      totals: {
        applications: rankedApplications.length,
        quickApprove: quickApproveList.length,
        manualReview: manualReviewList.length
      },
      fairness: this.computeFairnessSummary(rankedApplications, quickApproveList),
      quickApproveList,
      manualReviewList
    };
  }

  static async executeAutoAssignment(cycleId, executedBy, options = {}) {
    const cycle = await AllocationCycle.findById(cycleId);
    if (!cycle) {
      throw new Error('Allocation cycle not found');
    }

    if (!['PENDING', 'RUNNING'].includes(cycle.status)) {
      throw new Error(`Cannot auto assign for cycle with status: ${cycle.status}`);
    }

    const dashboard = await this.getApprovalDashboard(cycleId, options);
    const AllocationRegistration = mongoose.model('AllocationRegistration');

    const results = {
      assigned: [],
      waitlisted: [],
      failed: [],
      manualReview: dashboard.manualReviewList,
      fairness: dashboard.fairness,
      settings: dashboard.settings,
      totals: dashboard.totals
    };

    for (const candidate of dashboard.quickApproveList) {
      try {
        const foundRoom = await this.findSuitableRoom();
        if (!foundRoom) {
          await AllocationRegistration.updateOne(
            { _id: candidate.registrationId },
            { status: 'WAITLIST', priority: candidate.smartScore }
          );
          results.waitlisted.push(candidate);
          continue;
        }

        const { dormitoryId, room } = foundRoom;

        await RoomAllocation.create({
          academicYear: cycle.academicYear,
          allocationCycleId: cycleId,
          studentId: candidate.studentId,
          roomId: room._id,
          studentYearGroup: candidate.yearGroup,
          studentFaculty: candidate.studentFaculty,
          studentEnrollmentYear: candidate.studentEnrollmentYear,
          dormitoryId,
          roomNumber: room.roomNumber,
          roomCapacity: room.maxCapacity,
          allocationType: 'AUTO',
          allocationReason: `Auto-assigned by smart approval in ${cycle.name}`,
          allocationBy: executedBy,
          status: 'ACTIVE',
          allocationTimestamp: new Date(),
          notes: `Smart score: ${candidate.smartScore}`
        });

        await DormitoryCollection.updateOne(
          { _id: dormitoryId, 'floors.rooms._id': room._id },
          {
            $push: {
              'floors.$[].rooms.$[room].occupants': {
                studentId: String(candidate.studentId),
                name: candidate.studentName,
                email: candidate.studentEmail,
                phone: candidate.studentPhone,
                checkInDate: new Date(),
                active: true
              }
            }
          },
          { arrayFilters: [{ 'room._id': room._id }] }
        );

        await AllocationRegistration.updateOne(
          { _id: candidate.registrationId },
          { status: 'ALLOCATED', priority: candidate.smartScore }
        );

        results.assigned.push(candidate);
      } catch (error) {
        logger.error('Error in smart auto assignment', {
          error: error.message,
          cycleId,
          studentId: candidate.studentId
        });

        results.failed.push({
          ...candidate,
          error: error.message
        });
      }
    }

    cycle.status = 'RUNNING';
    cycle.executedBy = executedBy;
    cycle.executedAt = new Date();
    await cycle.save();

    await AllocationAuditLog.logAllocationAction(
      'ALLOCATION_CYCLE_EXECUTED',
      cycle.academicYear,
      executedBy,
      {
        cycleId,
        mode: 'AUTOMATIC',
        affectedStudents: results.assigned.map((item) => item.studentId),
        details: {
          feature: 'SMART_AUTO_ASSIGNMENT',
          autoApprovePercent: dashboard.settings.autoApprovePercent,
          assignedCount: results.assigned.length,
          waitlistedCount: results.waitlisted.length,
          manualReviewCount: results.manualReview.length,
          failedCount: results.failed.length,
          fairness: dashboard.fairness
        }
      }
    );

    return results;
  }

  /**
   * Calculate year group for a student based on enrollment year
   * @param {Number} enrollmentYear - Year student enrolled
   * @param {Number} currentYear - Current academic year
   * @returns {String} year1, year2_3, or year4_plus
   */
  static calculateYearGroup(enrollmentYear, currentYear = new Date().getFullYear()) {
    const yearsEnrolled = currentYear - enrollmentYear;
    if (yearsEnrolled <= 0) return 'year1';
    if (yearsEnrolled === 1 || yearsEnrolled === 2) return 'year2_3';
    return 'year4_plus';
  }

  /**
   * Compute a student's priority score using the active policy
   * @param {Object} policy - AllocationPolicy document
   * @param {Object} priorityDetails - student context
   * @returns {Number}
   */
  static computePriority(policy, priorityDetails = {}) {
    if (!policy || typeof policy.calculatePriorityScore !== 'function') return 50;
    return policy.calculatePriorityScore(priorityDetails);
  }

  /**
   * Compute capacity snapshot from dormitory collection
   * @returns {Promise<{totalRooms: number, totalBeds: number, availableBeds: number}>}
   */
  static async getCapacitySnapshot() {
    const dorms = await DormitoryCollection.find({ isDeleted: { $ne: true } });
    let totalRooms = 0;
    let totalBeds = 0;
    let availableBeds = 0;

    dorms.forEach(dorm => {
      (dorm.floors || []).forEach(floor => {
        (floor.rooms || []).forEach(room => {
          totalRooms += 1;
          totalBeds += room.maxCapacity || 0;
          const current = (room.occupants || []).filter(o => o.active).length;
          availableBeds += Math.max((room.maxCapacity || 0) - current, 0);
        });
      });
    });

    return { totalRooms, totalBeds, availableBeds };
  }

  /**
   * Get current allocation count for a year group in a cycle
   * @param {String} cycleId - Allocation cycle ID
   * @param {String} yearGroup - year1, year2_3, or year4_plus
   * @returns {Promise<Number>}
   */
  static async getAllocationCountForYearGroup(cycleId, yearGroup) {
    const count = await RoomAllocation.countDocuments({
      allocationCycleId: mongoose.Types.ObjectId(cycleId),
      studentYearGroup: yearGroup,
      status: 'ACTIVE'
    });
    return count;
  }

  /**
   * Get detailed allocation status for all year groups in a cycle
   * @param {String} cycleId - Allocation cycle ID
   * @returns {Promise<Object>}
   */
  static async getCycleAllocationStatus(cycleId) {
    const cycle = await AllocationCycle.findById(cycleId).populate('policyId');
    if (!cycle) {
      throw new Error('Allocation cycle not found');
    }

    const yearGroups = ['year1', 'year2_3', 'year4_plus'];
    const status = {};

    for (const yearGroup of yearGroups) {
      const currentCount = await this.getAllocationCountForYearGroup(cycleId, yearGroup);
      const registrationCount = await mongoose.model('AllocationRegistration').countDocuments({
        allocationCycleId: cycleId,
        yearGroup,
        status: { $ne: 'WITHDRAWN' }
      }).catch(() => 0);

      status[yearGroup] = {
        allocated: currentCount,
        registrations: registrationCount
      };
    }

    const capacity = await this.getCapacitySnapshot();
    const totalAllocated = yearGroups.reduce((sum, yg) => sum + status[yg].allocated, 0);

    return {
      capacity,
      yearGroupStatus: status,
      totalAllocated,
      availableBeds: Math.max(capacity.availableBeds, 0)
    };
  }

  /**
   * Find any available bed across dormitories
   * @returns {Promise<{dormitoryId: Object, room: Object, floor: Number}|null>}
   */
  static async findSuitableRoom() {
    try {
      const dorms = await DormitoryCollection.find({ isDeleted: { $ne: true } });
      for (const dorm of dorms) {
        for (const floor of dorm.floors || []) {
          for (const room of floor.rooms || []) {
            const activeOccupants = (room.occupants || []).filter(o => o.active).length;
            if (activeOccupants < (room.maxCapacity || 0)) {
              return { dormitoryId: dorm._id, room, floor: floor.floorNumber };
            }
          }
        }
      }
      return null;
    } catch (error) {
      logger.error('Error finding suitable room', { error: error.message });
      return null;
    }
  }

  /**
   * Execute allocation for a cycle
   * Allocates rooms to students based on policy
   * @param {String} cycleId - Allocation cycle ID
   * @param {String} executedBy - Admin user ObjectId
   * @returns {Promise<Object>} Allocation results
   */
  static async executeAllocation(cycleId, executedBy) {
    const cycle = await AllocationCycle.findById(cycleId).populate('policyId');
    if (!cycle) {
      throw new Error('Allocation cycle not found');
    }

    const startTime = AllocationAuditLog.recordActionStart(
      'ALLOCATION_CYCLE_EXECUTED',
      cycle.academicYear,
      executedBy,
      { cycleId }
    );

    try {
      if (cycle.status !== 'PENDING') {
        throw new Error(`Cannot execute cycle with status: ${cycle.status}`);
      }

      cycle.status = 'RUNNING';
      await cycle.save();

      const AllocationRegistration = mongoose.model('AllocationRegistration');
      const policy = cycle.policyId;

      // Capture capacity snapshot at execution time
      const capacity = await this.getCapacitySnapshot();
      await cycle.captureCapacitySnapshot(capacity.totalRooms, capacity.totalBeds, capacity.availableBeds);

      // Rank all pending registrations by policy priority score
      const registrations = await AllocationRegistration.find({
        allocationCycleId: cycleId,
        status: 'PENDING'
      }).populate('studentId').lean();

      const ranked = registrations
        .map(reg => {
          const details = reg.studentId?.priorityDetails || {};
          details.yearGroup = reg.yearGroup;
          const priority = this.computePriority(policy, details);
          return { ...reg, priority };
        })
        .sort((a, b) => {
          if (b.priority === a.priority) {
            return new Date(a.registrationTimestamp) - new Date(b.registrationTimestamp);
          }
          return b.priority - a.priority;
        });

      const results = {
        allocated: [],
        waitlisted: [],
        failed: [],
        byYearGroup: {
          year1: { allocated: 0, waitlisted: 0, failed: 0 },
          year2_3: { allocated: 0, waitlisted: 0, failed: 0 },
          year4_plus: { allocated: 0, waitlisted: 0, failed: 0 }
        }
      };

      let availableBeds = capacity.availableBeds;

      for (const registration of ranked) {
        try {
          if (availableBeds <= 0) {
            await AllocationRegistration.updateOne(
              { _id: registration._id },
              { status: 'WAITLIST', priority: registration.priority }
            );
            results.waitlisted.push(registration);
            results.byYearGroup[registration.yearGroup].waitlisted++;
            continue;
          }

          const foundRoom = await this.findSuitableRoom();
          if (!foundRoom) {
            await AllocationRegistration.updateOne(
              { _id: registration._id },
              { status: 'WAITLIST', priority: registration.priority }
            );
            results.waitlisted.push(registration);
            results.byYearGroup[registration.yearGroup].waitlisted++;
            continue;
          }

          const { dormitoryId, room } = foundRoom;

          await RoomAllocation.create({
            academicYear: cycle.academicYear,
            allocationCycleId: cycleId,
            studentId: registration.studentId,
            roomId: room._id,
            studentYearGroup: registration.yearGroup,
            studentFaculty: registration.studentFaculty,
            studentEnrollmentYear: registration.studentEnrollmentYear,
            dormitoryId,
            roomNumber: room.roomNumber,
            roomCapacity: room.maxCapacity,
            allocationType: 'AUTO',
            allocationReason: `Allocated in ${cycle.name}`,
            allocationBy: executedBy,
            status: 'ACTIVE',
            allocationTimestamp: new Date()
          });

          await DormitoryCollection.updateOne(
            { _id: dormitoryId, 'floors.rooms._id': room._id },
            {
              $push: {
                'floors.$[].rooms.$[room].occupants': {
                  studentId: registration.studentId.toString(),
                  name: registration.studentName,
                  email: registration.studentEmail,
                  phone: registration.studentPhone,
                  checkInDate: new Date(),
                  active: true
                }
              }
            },
            { arrayFilters: [{ 'room._id': room._id }] }
          );

          await AllocationRegistration.updateOne(
            { _id: registration._id },
            { status: 'ALLOCATED', priority: registration.priority }
          );
          availableBeds -= 1;

          results.allocated.push(registration);
          results.byYearGroup[registration.yearGroup].allocated++;
        } catch (error) {
          logger.error('Error allocating room to student', {
            error: error.message,
            studentId: registration.studentId,
            cycleId
          });
          results.failed.push({
            registration,
            error: error.message
          });
          results.byYearGroup[registration.yearGroup].failed++;
        }
      }

      results.totalRegistrations = await AllocationRegistration.countDocuments({ allocationCycleId: cycleId });
      results.totalAllocated = results.allocated.length;
      results.totalWaitlisted = results.waitlisted.length;

      cycle.status = 'COMPLETED';
      cycle.allocationDate = new Date();
      cycle.executedBy = executedBy;
      cycle.executedAt = new Date();
      cycle.stats = {
        totalRegistrations: results.totalRegistrations,
        totalAllocated: results.totalAllocated,
        totalWaitlisted: results.totalWaitlisted,
        byYearGroup: results.byYearGroup,
        capacitySnapshot: capacity
      };

      await cycle.save();

      await AllocationAuditLog.recordActionEnd(startTime, 'SUCCESS', {
        details: {
          allocatedCount: results.allocated.length,
          waitlistedCount: results.waitlisted.length,
          failedCount: results.failed.length,
          byYearGroup: results.byYearGroup,
          capacity
        },
        itemsProcessed: results.allocated.length + results.waitlisted.length + results.failed.length,
        itemsSucceeded: results.allocated.length,
        itemsFailed: results.failed.length
      });

      logger.info('Allocation cycle executed successfully', {
        cycleId,
        allocated: results.allocated.length,
        waitlisted: results.waitlisted.length
      });

      return results;
    } catch (error) {
      logger.error('Error executing allocation cycle', { error: error.message, cycleId });

      await AllocationAuditLog.recordActionEnd(startTime, 'FAILED', {
        error: error.message,
        errorStack: error.stack
      });

      throw error;
    }
  }

  /**
   * Get comprehensive dashboard data for a year group
   * @param {String} academicYear - Academic year (YYYY-YYYY)
   * @param {String} yearGroup - Optional: filter by year group
   * @returns {Promise<Object>}
   */
  static async getDashboardData(academicYear, yearGroup = null) {
    const policy = await AllocationPolicy.getActivePolicy(academicYear);
    if (!policy) {
      throw new Error(`No active policy found for ${academicYear}`);
    }

    const cycle = await AllocationCycle.getActiveCycle(academicYear);
    const capacity = await this.getCapacitySnapshot();

    const dashboardData = {
      academicYear,
      policy: {
        priorityRules: policy.priorityRules,
        rebalanceThresholds: policy.rebalanceThresholds,
        autoEvictionRules: policy.autoEvictionRules
      },
      capacity,
      yearGroups: {}
    };

    const yearGroupsToQuery = yearGroup ? [yearGroup] : ['year1', 'year2_3', 'year4_plus'];

    for (const yg of yearGroupsToQuery) {
      const currentCount = cycle
        ? await this.getAllocationCountForYearGroup(cycle._id, yg)
        : 0;

      const AllocationRegistration = mongoose.model('AllocationRegistration');
      const registrationCount = await AllocationRegistration.countDocuments({
        academicYear,
        yearGroup: yg
      }).catch(() => 0);

      dashboardData.yearGroups[yg] = {
        allocated: currentCount,
        registrations: registrationCount
      };
    }

    return dashboardData;
  }

  /**
   * Get list of students in a room
   * @param {String} roomId - Room ObjectId
   * @returns {Promise<Array>}
   */
  static async getRoomOccupants(roomId) {
    const Room = mongoose.model('rooms');
    const room = await Room.findById(roomId);
    return room ? room.occupants : [];
  }

  /**
   * Get all allocations for a student
   * @param {String} studentId - Student ObjectId
   * @param {String} academicYear - Optional: filter by year
   * @returns {Promise<Array>}
   */
  static async getStudentAllocations(studentId, academicYear = null) {
    const query = { studentId };
    if (academicYear) {
      query.academicYear = academicYear;
    }

    return RoomAllocation.find(query)
      .populate(['roomId', 'dormitoryId', 'allocationCycleId'])
      .sort({ startDate: -1 });
  }
}

module.exports = AllocationService;
