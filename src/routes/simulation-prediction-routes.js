/**
 * SIMULATION & PREDICTION ROUTES
 * Admin routes for testing policies and forecasting
 */

const express = require('express');
const router = express.Router();
const simulationService = require('../services/simulationService');
const allocationService = require('../services/allocationService');
const { logger } = require('../config/logger');

// Middleware for admin authentication
const adminAuth = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
};

/**
 * GET /api/allocation/simulate/:cycleId
 * Get simulation UI data
 */
router.get('/simulate/:cycleId', adminAuth, async (req, res) => {
  try {
    const { cycleId } = req.params;

    // Get cycle and existing policies
    const [cycle, policies] = await Promise.all([
      require('../schemas/AllocationCycleSchema').findById(cycleId).lean(),
      require('../schemas/AllocationPolicySchema').find().lean()
    ]);

    if (!cycle) {
      return res.status(404).json({ error: 'Allocation cycle not found' });
    }

    res.json({
      cycle: {
        id: cycle._id,
        name: cycle.name,
        academicYear: cycle.academicYear,
        capacitySnapshot: cycle.capacitySnapshot
      },
      policies: policies.map(p => ({
        id: p._id,
        name: p.name,
        autoApprovePercentage: p.autoApprovePercentage,
        rebalanceThresholds: p.rebalanceThresholds
      }))
    });
  } catch (error) {
    logger.error('Failed to load simulation UI', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/allocation/simulate/run
 * Run a simulation with given policy
 */
router.post('/run', adminAuth, async (req, res) => {
  try {
    const { cycleId, policyId, customPolicy } = req.body;

    if (!cycleId) {
      return res.status(400).json({ error: 'cycleId is required' });
    }

    const result = await simulationService.runSimulation({
      cycleId,
      policyId,
      policy: customPolicy
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Log simulation
    const AllocationAuditLog = require('../schemas/AllocationAuditLogSchema');
    await AllocationAuditLog.create({
      action: 'SIMULATION_RUN',
      executedBy: req.user._id,
      details: {
        cycleId,
        policyUsed: policyId || 'custom',
        allocated: result.simulation.stats.totalAllocated,
        waitlisted: result.simulation.stats.totalWaitlisted
      },
      timestamp: new Date()
    });

    res.json(result);
  } catch (error) {
    logger.error('Simulation run failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/allocation/simulate/compare
 * Compare two policies side-by-side
 */
router.post('/compare', adminAuth, async (req, res) => {
  try {
    const { cycleId, policyId1, policyId2 } = req.body;

    if (!cycleId || !policyId1 || !policyId2) {
      return res.status(400).json({ error: 'cycleId, policyId1, policyId2 are required' });
    }

    const result = await simulationService.compareSimulations(cycleId, policyId1, policyId2);

    res.json(result);
  } catch (error) {
    logger.error('Policy comparison failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/allocation/simulation-status
 * Get overall simulation status
 */
router.get('/status', adminAuth, async (req, res) => {
  try {
    const AllocationCycle = require('../schemas/AllocationCycleSchema');
    const cycles = await AllocationCycle.find({ status: { $in: ['ACTIVE', 'COMPLETED'] } })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.json({
      version: '1.0.0',
      simulationServiceStatus: 'ONLINE',
      capabilities: {
        policySimulation: true,
        policyComparison: true,
        quotaPrediction: false,
        demandForecast: false
      },
      recentCycles: cycles
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
