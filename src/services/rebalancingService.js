const mongoose = require('mongoose');
const AllocationPolicy = require('../schemas/AllocationPolicySchema');
const AllocationCycle = require('../schemas/AllocationCycleSchema');
const RoomAllocation = require('../schemas/RoomAllocationSchema');
const AllocationAuditLog = require('../schemas/AllocationAuditLogSchema');
const ViolationSchema = require('../schemas/ViolationSchema');
const AllocationService = require('./allocationService');
const { StudentCollection, DormitoryCollection } = require('../config/config');
const { logger } = require('../config/logger');

class RebalancingService {
  /**
   * Evaluate rebalancing needs using policy thresholds
   * @param {String} cycleId - Allocation cycle ID
   * @returns {Promise<Object>} Rebalancing assessment
   */
  static async isRebalancingNeeded(cycleId) {
    const cycle = await AllocationCycle.findById(cycleId).populate('policyId');
    if (!cycle || !cycle.policyId) {
      throw new Error('Allocation cycle or policy not found');
    }

    const policy = cycle.policyId;
    const thresholds = policy.rebalanceThresholds || {};
    const AllocationRegistration = mongoose.model('AllocationRegistration');

    // Check waitlist size
    const waitlistCount = await AllocationRegistration.countDocuments({
      allocationCycleId: cycleId,
      status: 'WAITLIST'
    });

    const waitlistThreshold = thresholds.waitlistSize || 20;
    const waitlistExceeded = waitlistCount > waitlistThreshold;

    // Check score gaps between waitlist top and allocated bottom
    const topWaitlist = await AllocationRegistration.findOne({
      allocationCycleId: cycleId,
      status: 'WAITLIST'
    }).sort({ priority: -1 });

    const lowAllocated = await AllocationRegistration.findOne({
      allocationCycleId: cycleId,
      status: 'ALLOCATED'
    }).sort({ priority: 1 });

    const scoreGapThreshold = thresholds.scoreGap || 20;
    const scoreGapExceeded = topWaitlist && lowAllocated && 
      (topWaitlist.priority - lowAllocated.priority) > scoreGapThreshold;

    return {
      needed: waitlistExceeded || scoreGapExceeded,
      reasons: {
        waitlistSize: { exceeded: waitlistExceeded, count: waitlistCount, threshold: waitlistThreshold },
        scoreGap: { exceeded: scoreGapExceeded, gap: topWaitlist && lowAllocated ? topWaitlist.priority - lowAllocated.priority : 0, threshold: scoreGapThreshold }
      },
      timestamp: new Date()
    };
  }

  /**
   * Find students eligible for eviction based on policy rules
   * @param {String} cycleId - Allocation cycle ID
   * @param {Number} count - Number to evict
   * @returns {Promise<Array>} Eviction candidates
   */
  static async findEvictionCandidates(cycleId, count = 10) {
    const cycle = await AllocationCycle.findById(cycleId).populate('policyId');
    const policy = cycle.policyId;
    const evictionRules = policy.autoEvictionRules || {};

    const AllocationRegistration = mongoose.model('AllocationRegistration');
    const allocated = await AllocationRegistration.find({
      allocationCycleId: cycleId,
      status: 'ALLOCATED'
    }).populate('studentId').lean();

    const candidates = [];

    for (const reg of allocated) {
      const student = reg.studentId;
      if (!student) continue;

      const allocation = await RoomAllocation.findOne({
        allocationCycleId: cycleId,
        studentId: student._id,
        status: 'ACTIVE'
      });

      if (!allocation) continue;

      // Check violation count
      const violations = await ViolationSchema.countDocuments({
        studentId: student._id,
        status: { $in: ['pending', 'investigating'] }
      });

      // Check tenure (months in dorm)
      const stayMonths = allocation.startDate 
        ? Math.floor((Date.now() - allocation.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
        : 0;

      // Check if near graduation
      const enrollmentYear = student.academicYear ? parseInt(student.academicYear) : new Date().getFullYear();
      const yearsEnrolled = new Date().getFullYear() - enrollmentYear;
      const nearGraduation = yearsEnrolled >= (evictionRules.nearGraduationYears || 5);

      let evictionScore = 0;
      const reasons = [];

      if (violations >= (evictionRules.violationThreshold || 3)) {
        evictionScore += 30;
        reasons.push(`${violations} violations`);
      }

      if (stayMonths >= (evictionRules.lowPriorityStayMonths || 24)) {
        evictionScore += 20;
        reasons.push(`${stayMonths} months tenure`);
      }

      if (nearGraduation) {
        evictionScore += 25;
        reasons.push('Near graduation');
      }

      if (reg.priority < 50) {
        evictionScore += 15;
        reasons.push(`Low priority score: ${reg.priority}`);
      }

      if (evictionScore > 30) {
        candidates.push({
          allocationId: allocation._id,
          studentId: student._id,
          studentName: student.name,
          priority: reg.priority,
          evictionScore,
          reasons: reasons.join(', '),
          violations,
          stayMonths,
          yearGroup: reg.yearGroup
        });
      }
    }

    return candidates.sort((a, b) => b.evictionScore - a.evictionScore).slice(0, count);
  }

  /**
   * Find students that should be promoted from waitlist
   * @param {String} cycleId - Allocation cycle ID
   * @param {Number} count - Number to promote
   * @returns {Promise<Array>} Promotion candidates
   */
  static async findPromotionCandidates(cycleId, count = 10) {
    const AllocationRegistration = mongoose.model('AllocationRegistration');

    const waitlist = await AllocationRegistration.find({
      allocationCycleId: cycleId,
      status: 'WAITLIST'
    }).populate('studentId').sort({ priority: -1, registrationTimestamp: 1 }).limit(count);

    return waitlist.map(w => ({
      registrationId: w._id,
      studentId: w.studentId._id,
      studentName: w.studentId.name,
      priority: w.priority,
      yearGroup: w.yearGroup,
      registeredAt: w.registrationTimestamp
    }));
  }

  /**
   * Generate rebalancing suggestions in SUGGESTION mode
   * @param {String} cycleId - Allocation cycle ID
   * @returns {Promise<Object>} Suggestions
   */
  static async generateSuggestions(cycleId) {
    const violations = await this.detectViolations(cycleId);
    const suggestions = {
      timestamp: new Date(),
      violations,
      actions: []
    };

    // Suggest removal from surplus year groups
    for (const surplus of violations.surplus) {
      const removableCandidates = await this.findRemovableCandidates(
        cycleId,
        surplus.yearGroup,
        surplus.excess
      );

      for (const candidate of removableCandidates) {
        suggestions.actions.push({
          actionType: 'REVOKE_ALLOCATION',
          priority: 'HIGH',
          student: candidate.studentId,
          yearGroup: candidate.yearGroup,
          reason: 'REBALANCE_SURPLUS',
          impact: 'Student allocation will be revoked and returned to waitlist',
          candidate
        });
      }
    }

    // Suggest allocations from deficit year groups
    for (const deficit of violations.deficit) {
      const waitlistCandidates = await this.findWaitlistCandidates(
        cycleId,
        deficit.yearGroup,
        deficit.shortage
      );

      for (const candidate of waitlistCandidates) {
        suggestions.actions.push({
          actionType: 'ALLOCATE_FROM_WAITLIST',
          priority: 'MEDIUM',
          student: candidate.studentId,
          yearGroup: deficit.yearGroup,
          reason: 'REBALANCE_DEFICIT',
          impact: 'Student will be promoted from waitlist',
          candidate
        });
      }
    }

    return suggestions;
  }

  /**
   * Execute rebalancing in ENFORCED mode
   * @param {String} cycleId - Allocation cycle ID
   * @param {String} executedBy - Admin user ObjectId
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution results
   */
  static async executeRebalancing(cycleId, executedBy, options = {}) {
    const startTime = AllocationAuditLog.recordActionStart(
      'REBALANCE_EXECUTED',
      null,
      executedBy,
      { cycleId }
    );

    const results = {
      revokedCount: 0,
      allocatedCount: 0,
      failedCount: 0,
      details: []
    };

    try {
      const suggestions = await this.generateSuggestions(cycleId);

      for (const suggestion of suggestions.actions) {
        try {
          if (suggestion.actionType === 'REVOKE_ALLOCATION') {
            const allocation = await RoomAllocation.findOne({
              studentId: suggestion.student._id,
              allocationCycleId: mongoose.Types.ObjectId(cycleId),
              status: 'ACTIVE'
            });

            if (allocation) {
              // Revoke allocation
              await allocation.revoke(executedBy, 'Rebalancing: capacity adjustment');

              // Move student to waitlist
              const AllocationRegistration = mongoose.model('AllocationRegistration');
              await AllocationRegistration.updateOne(
                {
                  studentId: suggestion.student._id,
                  allocationCycleId: mongoose.Types.ObjectId(cycleId)
                },
                { status: 'WAITLIST' }
              );

              results.revokedCount++;
              results.details.push({
                action: 'REVOKED',
                studentId: suggestion.student._id,
                timestamp: new Date()
              });

              logger.info('Rebalancing: Revoked allocation', {
                studentId: suggestion.student._id,
                cycleId
              });
            }
          } else if (suggestion.actionType === 'ALLOCATE_FROM_WAITLIST') {
            // Find suitable room
            const cycle = await AllocationCycle.findById(cycleId).populate('policyId');
            const room = await AllocationService.findSuitableRoom(
              suggestion.student._id,
              suggestion.yearGroup,
              cycle.policyId.getPolicyForYearGroup(suggestion.yearGroup)
            );

            if (room) {
              // Create allocation
              const allocation = await RoomAllocation.create({
                academicYear: cycle.academicYear,
                allocationCycleId: cycleId,
                studentId: suggestion.student._id,
                roomId: room._id,
                studentYearGroup: suggestion.yearGroup,
                dormitoryId: room.dormitoryId,
                roomNumber: room.roomNumber,
                allocationType: 'REBALANCE',
                allocationReason: 'Promoted from waitlist during rebalancing',
                allocationBy: executedBy,
                status: 'ACTIVE'
              });

              // Update room occupants
              room.occupants.push({
                studentId: suggestion.student._id.toString(),
                name: suggestion.student.name,
                email: suggestion.student.email,
                checkInDate: new Date(),
                active: true
              });
              await room.save();

              // Update registration status
              const AllocationRegistration = mongoose.model('AllocationRegistration');
              await AllocationRegistration.updateOne(
                {
                  studentId: suggestion.student._id,
                  allocationCycleId: mongoose.Types.ObjectId(cycleId)
                },
                { status: 'ALLOCATED' }
              );

              results.allocatedCount++;
              results.details.push({
                action: 'ALLOCATED',
                studentId: suggestion.student._id,
                roomId: room._id,
                timestamp: new Date()
              });

              logger.info('Rebalancing: Allocated from waitlist', {
                studentId: suggestion.student._id,
                roomId: room._id,
                cycleId
              });
            }
          }
        } catch (error) {
          logger.error('Error executing rebalancing action', {
            error: error.message,
            suggestion
          });
          results.failedCount++;
        }
      }

      // Log audit
      await AllocationAuditLog.recordActionEnd(startTime, 'SUCCESS', {
        details: {
          revokedCount: results.revokedCount,
          allocatedCount: results.allocatedCount,
          failedCount: results.failedCount
        },
        itemsProcessed: results.revokedCount + results.allocatedCount + results.failedCount,
        itemsSucceeded: results.revokedCount + results.allocatedCount,
        itemsFailed: results.failedCount,
        mode: 'ENFORCED'
      });

      logger.info('Rebalancing completed successfully', {
        cycleId,
        revoked: results.revokedCount,
        allocated: results.allocatedCount
      });

      return results;
    } catch (error) {
      logger.error('Error executing rebalancing', { error: error.message, cycleId });

      await AllocationAuditLog.recordActionEnd(startTime, 'FAILED', {
        error: error.message,
        errorStack: error.stack,
        mode: 'ENFORCED'
      });

      throw error;
    }
  }

  /**
   * Generate rebalancing suggestions based on dynamic criteria
   * @param {String} cycleId - Allocation cycle ID
   * @returns {Promise<Object>} Suggestions
   */
  static async generateSuggestions(cycleId) {
    const assessment = await this.isRebalancingNeeded(cycleId);
    
    const suggestions = {
      timestamp: new Date(),
      needed: assessment.needed,
      reasons: assessment.reasons,
      actions: []
    };

    if (!assessment.needed) {
      return suggestions;
    }

    const evictionCandidates = await this.findEvictionCandidates(cycleId, 10);
    const promotionCandidates = await this.findPromotionCandidates(cycleId, 10);
    const countToRebalance = Math.min(evictionCandidates.length, promotionCandidates.length, 5);

    for (let i = 0; i < countToRebalance; i++) {
      const evictCandidate = evictionCandidates[i];
      const promoteCandidate = promotionCandidates[i];

      suggestions.actions.push({
        actionType: 'EVICT',
        priority: 'HIGH',
        studentId: evictCandidate.studentId,
        studentName: evictCandidate.studentName,
        yearGroup: evictCandidate.yearGroup,
        reason: evictCandidate.reasons,
        evictionScore: evictCandidate.evictionScore,
        impact: 'Student allocation will be revoked'
      });

      suggestions.actions.push({
        actionType: 'PROMOTE',
        priority: 'HIGH',
        studentId: promoteCandidate.studentId,
        studentName: promoteCandidate.studentName,
        yearGroup: promoteCandidate.yearGroup,
        priorityScore: promoteCandidate.priority,
        impact: 'Student will be allocated from waitlist'
      });
    }

    return suggestions;
  }

  /**
   * Execute rebalancing: evict low-performers, promote high-priority waitlist
   * @param {String} cycleId - Allocation cycle ID
   * @param {String} executedBy - Admin user ObjectId
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution results
   */
  static async executeRebalancing(cycleId, executedBy, options = {}) {
    const startTime = AllocationAuditLog.recordActionStart(
      'REBALANCE_EXECUTED',
      null,
      executedBy,
      { cycleId }
    );

    const results = {
      evictedCount: 0,
      promotedCount: 0,
      failedCount: 0,
      details: []
    };

    try {
      const suggestions = await this.generateSuggestions(cycleId);

      for (const action of suggestions.actions) {
        try {
          if (action.actionType === 'EVICT') {
            const allocation = await RoomAllocation.findOne({
              studentId: action.studentId,
              allocationCycleId: cycleId,
              status: 'ACTIVE'
            });

            if (allocation) {
              await allocation.revoke(executedBy, `Rebalancing: ${action.reason}`);

              await DormitoryCollection.updateOne(
                { _id: allocation.dormitoryId, 'floors.rooms._id': allocation.roomId },
                { $pull: { 'floors.$[].rooms.$[room].occupants': { studentId: action.studentId.toString() } } },
                { arrayFilters: [{ 'room._id': allocation.roomId }] }
              );

              const AllocationRegistration = mongoose.model('AllocationRegistration');
              await AllocationRegistration.updateOne(
                { studentId: action.studentId, allocationCycleId: cycleId },
                { status: 'WAITLIST' }
              );

              results.evictedCount++;
              results.details.push({ action: 'EVICTED', studentId: action.studentId, reason: action.reason, timestamp: new Date() });

              logger.info('Rebalancing: Evicted student', { studentId: action.studentId, reason: action.reason, cycleId });
            }
          } else if (action.actionType === 'PROMOTE') {
            const foundRoom = await AllocationService.findSuitableRoom();
            if (!foundRoom) continue;

            const { dormitoryId, room } = foundRoom;
            const cycle = await AllocationCycle.findById(cycleId);

            await RoomAllocation.create({
              academicYear: cycle.academicYear,
              allocationCycleId: cycleId,
              studentId: action.studentId,
              roomId: room._id,
              studentYearGroup: action.yearGroup,
              dormitoryId,
              roomNumber: room.roomNumber,
              roomCapacity: room.maxCapacity,
              allocationType: 'WAITLIST_PROMOTION',
              allocationReason: 'Promoted from waitlist during rebalancing',
              allocationBy: executedBy,
              status: 'ACTIVE',
              allocationTimestamp: new Date()
            });

            await DormitoryCollection.updateOne(
              { _id: dormitoryId, 'floors.rooms._id': room._id },
              { $push: { 'floors.$[].rooms.$[room].occupants': { studentId: action.studentId.toString(), name: action.studentName, checkInDate: new Date(), active: true } } },
              { arrayFilters: [{ 'room._id': room._id }] }
            );

            const AllocationRegistration = mongoose.model('AllocationRegistration');
            await AllocationRegistration.updateOne(
              { studentId: action.studentId, allocationCycleId: cycleId },
              { status: 'ALLOCATED' }
            );

            results.promotedCount++;
            results.details.push({ action: 'PROMOTED', studentId: action.studentId, roomId: room._id, timestamp: new Date() });

            logger.info('Rebalancing: Promoted from waitlist', { studentId: action.studentId, roomId: room._id, cycleId });
          }
        } catch (error) {
          logger.error('Error executing rebalancing action', { error: error.message, action });
          results.failedCount++;
        }
      }

      await AllocationAuditLog.recordActionEnd(startTime, 'SUCCESS', {
        details: { evictedCount: results.evictedCount, promotedCount: results.promotedCount, failedCount: results.failedCount },
        itemsProcessed: results.evictedCount + results.promotedCount + results.failedCount,
        itemsSucceeded: results.evictedCount + results.promotedCount,
        itemsFailed: results.failedCount
      });

      logger.info('Rebalancing completed successfully', { cycleId, evicted: results.evictedCount, promoted: results.promotedCount });

      return results;
    } catch (error) {
      logger.error('Error executing rebalancing', { error: error.message, cycleId });
      await AllocationAuditLog.recordActionEnd(startTime, 'FAILED', { error: error.message, errorStack: error.stack });
      throw error;
    }
  }

  /**
   * Get rebalancing status and metrics
   * @param {String} cycleId - Allocation cycle ID
   * @returns {Promise<Object>}
   */
  static async getRebalancingStatus(cycleId) {
    const assessment = await this.isRebalancingNeeded(cycleId);
    const evictionCandidates = await this.findEvictionCandidates(cycleId, 5);
    const promotionCandidates = await this.findPromotionCandidates(cycleId, 5);

    return {
      cycleId,
      rebalancingNeeded: assessment.needed,
      reasons: assessment.reasons,
      evictionCandidates: evictionCandidates.length,
      promotionCandidates: promotionCandidates.length,
      potentialSwaps: Math.min(evictionCandidates.length, promotionCandidates.length)
    };
  }
}

module.exports = RebalancingService;
