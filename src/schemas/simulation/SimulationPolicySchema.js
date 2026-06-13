const mongoose = require('mongoose');

const SimulationPolicySchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SimulationWorkspace',
    required: true,
    index: true
  },
  sourcePolicyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AllocationPolicy'
  },
  academicYear: {
    type: String,
    required: true,
    validate: {
      validator: (v) => /^\d{4}-\d{4}$/.test(v),
      message: 'Academic year must be in format YYYY-YYYY'
    }
  },
  active: { type: Boolean, default: true },
  priorityRules: {
    yearGroupWeights: {
      year1: { type: Number, default: 30 },
      year2_3: { type: Number, default: 10 },
      year4_plus: { type: Number, default: -10 }
    },
    financialHardship: {
      verified: { type: Number, default: 30 },
      notVerified: { type: Number, default: 0 }
    },
    distanceFromHome: {
      above500km: { type: Number, default: 30 },
      above200km: { type: Number, default: 20 },
      below50km: { type: Number, default: -15 }
    },
    scholarship: { type: Number, default: 10 },
    violations: {
      none: { type: Number, default: 10 },
      minor: { type: Number, default: -5 },
      major: { type: Number, default: -20 },
      critical: { type: Number, default: -40 }
    },
    familyWealth: {
      poor: { type: Number, default: 10 },
      average: { type: Number, default: 0 },
      wealthy: { type: Number, default: -10 }
    }
  },
  rebalanceThresholds: {
    waitlistSize: { type: Number, default: 10 },
    scoreGap: { type: Number, default: 15 },
    lowPriorityStayMonths: { type: Number, default: 12 }
  },
  autoEvictionRules: {
    maxYearsInDorm: { type: Number, default: 4 },
    graduationMonthsAhead: { type: Number, default: 6 }
  },
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'sim_policies' });

SimulationPolicySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const SimulationPolicy = mongoose.models.SimulationPolicy
  || mongoose.model('SimulationPolicy', SimulationPolicySchema);

module.exports = SimulationPolicy;
