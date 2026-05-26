/**
 * SIMULATION SERVICE
 * Allows admins to test policies BEFORE applying them
 * Simulates allocation without modifying database
 */

const AllocationPolicy = require('../schemas/AllocationPolicySchema');
const AllocationCycle = require('../schemas/AllocationCycleSchema');
const AllocationRegistration = require('../schemas/AllocationRegistrationSchema');
const AllocationService = require('./allocationService');
const { DormitoryCollection } = require('../config/config');
const { logger } = require('../config/logger');

class SimulationService {
  /**
   * Run simulation with given policy
   * @param {Object} params - {cycleId, policyId | policy, registrationCount}
   * @returns {Promise<Object>} Simulation results
   */
  static async runSimulation(params = {}) {
    const { cycleId, policyId, policy: customPolicy, registrationCount } = params;

    const startTime = Date.now();

    try {
      // Get actual registrations
      const registrations = await AllocationRegistration.find({
        allocationCycleId: cycleId,
        status: 'PENDING'
      })
        .populate('studentId')
        .lean();

      // Use provided policy or fetch from DB
      let policy = customPolicy;
      if (!policy && policyId) {
        policy = await AllocationPolicy.findById(policyId).lean();
      }

      if (!policy && !customPolicy) {
        throw new Error('Policy is required for simulation');
      }

      // Get capacity snapshot
      const capacity = await this.getCapacitySnapshot();

      // Run simulation
      const simulationResults = await this.simulate(
        registrations,
        policy,
        capacity
      );

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        simulation: {
          totalRegistrations: registrations.length,
          ...simulationResults,
          capacity,
          executionTimeMs: executionTime,
          simulatedAt: new Date(),
          warning: registrationCount && registrationCount !== registrations.length
            ? `Simulation used ${registrations.length} registrations, but ${registrationCount} expected`
            : null
        }
      };
    } catch (error) {
      logger.error('Simulation failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Core simulation logic
   * @private
   */
  static async simulate(registrations, policy, capacity) {
    const results = {
      allocated: [],
      waitlisted: [],
      failed: [],
      stats: {
        totalAllocated: 0,
        totalWaitlisted: 0,
        byYearGroup: {}
      },
      fairness: {},
      warnings: []
    };

    // Calculate scores and rank
    const ranked = registrations
      .map((reg) => {
        const score = AllocationService.calculateSmartRankingScore(reg);
        return {
          registrationId: reg._id,
          studentId: reg.studentId?._id || reg.studentId,
          studentName: reg.studentName,
          yearGroup: reg.yearGroup,
          smartScore: score.totalScore,
          timestamp: reg.registrationTimestamp
        };
      })
      .sort((a, b) => {
        if (b.smartScore - a.smartScore !== 0) {
          return b.smartScore - a.smartScore;
        }
        return new Date(a.timestamp) - new Date(b.timestamp);
      });

    let availableBeds = capacity.availableBeds;

    // Simulate allocation
    for (const candidate of ranked) {
      if (availableBeds <= 0) {
        results.waitlisted.push(candidate);
        results.stats.totalWaitlisted += 1;
      } else {
        results.allocated.push(candidate);
        results.stats.totalAllocated += 1;
        availableBeds -= 1;
      }

      // Track by year group
      const yg = candidate.yearGroup || 'unknown';
      if (!results.stats.byYearGroup[yg]) {
        results.stats.byYearGroup[yg] = { allocated: 0, waitlisted: 0 };
      }

      if (availableBeds > 0) {
        results.stats.byYearGroup[yg].allocated += 1;
      } else {
        results.stats.byYearGroup[yg].waitlisted += 1;
      }
    }

    // Calculate fairness
    results.fairness = AllocationService.computeFairnessForSimulation(
      ranked,
      results.allocated
    );

    // Generate warnings
    if (results.stats.totalWaitlisted > 50) {
      results.warnings.push({
        level: 'WARNING',
        message: `Many students will be waitlisted (${results.stats.totalWaitlisted})`,
        suggestion: 'Consider increasing room capacity or adjusting auto-approve percentage'
      });
    }

    if (results.fairness.maxDeviationPercent > 15) {
      results.warnings.push({
        level: 'WARNING',
        message: 'Large fairness deviation detected',
        suggestion: 'Year group allocation is uneven. Consider adjusting weights.'
      });
    }

    if (availableBeds === 0) {
      results.warnings.push({
        level: 'INFO',
        message: 'All beds will be fully occupied',
        suggestion: 'No buffer capacity for late registrations'
      });
    }

    return results;
  }

  /**
   * Compare two policies side-by-side
   * @param {String} cycleId - Allocation cycle
   * @param {String} policyId1 - First policy ID
   * @param {String} policyId2 - Second policy ID  
   * @returns {Promise<Object>}
   */
  static async compareSimulations(cycleId, policyId1, policyId2) {
    const [sim1, sim2] = await Promise.all([
      this.runSimulation({ cycleId, policyId: policyId1 }),
      this.runSimulation({ cycleId, policyId: policyId2 })
    ]);

    if (!sim1.success || !sim2.success) {
      throw new Error('Failed to run one or both simulations');
    }

    const policy1 = await AllocationPolicy.findById(policyId1).lean();
    const policy2 = await AllocationPolicy.findById(policyId2).lean();

    return {
      comparison: {
        policy1: {
          name: policy1.name,
          allocation: sim1.simulation.stats.totalAllocated,
          waitlist: sim1.simulation.stats.totalWaitlisted,
          efficiency: ((sim1.simulation.stats.totalAllocated / (sim1.simulation.stats.totalAllocated + sim1.simulation.stats.totalWaitlisted)) * 100).toFixed(1) + '%',
          fairness: sim1.simulation.fairness.maxDeviationPercent.toFixed(1) + '%',
          warnings: sim1.simulation.warnings.length
        },
        policy2: {
          name: policy2.name,
          allocation: sim2.simulation.stats.totalAllocated,
          waitlist: sim2.simulation.stats.totalWaitlisted,
          efficiency: ((sim2.simulation.stats.totalAllocated / (sim2.simulation.stats.totalAllocated + sim2.simulation.stats.totalWaitlisted)) * 100).toFixed(1) + '%',
          fairness: sim2.simulation.fairness.maxDeviationPercent.toFixed(1) + '%',
          warnings: sim2.simulation.warnings.length
        }
      },
      recommendation: this.recommendPolicy(sim1, sim2)
    };
  }

  /**
   * Recommend which policy is better
   * @private
   */
  static recommendPolicy(sim1, sim2) {
    const allocated1 = sim1.simulation.stats.totalAllocated;
    const allocated2 = sim2.simulation.stats.totalAllocated;
    const fairness1 = sim1.simulation.fairness.maxDeviationPercent;
    const fairness2 = sim2.simulation.fairness.maxDeviationPercent;

    let score1 = 0, score2 = 0;

    // Allocation efficiency (higher is better)
    if (allocated1 > allocated2) score1 += 2;
    else if (allocated2 > allocated1) score2 += 2;

    // Fairness (lower deviation is better)
    if (fairness1 < fairness2) score1 += 3;
    else if (fairness2 < fairness1) score2 += 3;

    if (score1 > score2) {
      return {
        winner: 'policy1',
        score: score1,
        reason: `Policy 1 allocates more students fairly (${allocated1} allocated, ${fairness1}% deviation)`
      };
    } else if (score2 > score1) {
      return {
        winner: 'policy2',
        score: score2,
        reason: `Policy 2 allocates more students fairly (${allocated2} allocated, ${fairness2}% deviation)`
      };
    } else {
      return {
        winner: 'tie',
        score: score1,
        reason: 'Both policies perform similarly'
      };
    }
  }

  static async getCapacitySnapshot() {
    const dorms = await DormitoryCollection.find({ isDeleted: { $ne: true } });
    let totalRooms = 0, totalBeds = 0, availableBeds = 0;

    dorms.forEach(dorm => {
      (dorm.floors || []).forEach(floor => {
        (floor.rooms || []).forEach(room => {
          totalRooms += 1;
          totalBeds += room.maxCapacity || 0;
          const activeOccupants = (room.occupants || []).filter(o => o.active).length;
          availableBeds += Math.max((room.maxCapacity || 0) - activeOccupants, 0);
        });
      });
    });

    return { totalRooms, totalBeds, availableBeds };
  }
}

module.exports = SimulationService;
