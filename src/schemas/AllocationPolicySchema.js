const mongoose = require('mongoose');

const AllocationPolicySchema = new mongoose.Schema({
  academicYear: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{4}$/.test(v);
      },
      message: 'Academic year must be in format YYYY-YYYY'
    }
  },
  
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Priority-based rules (no percentage/quota)
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
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students'
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students'
  },
  
  notes: String,

  effectiveFrom: { type: Date },
  effectiveTo:   { type: Date }
});

// Updated validation: only one active policy per academic year
AllocationPolicySchema.pre('save', async function(next) {
  this.updatedAt = new Date();

  if (this.active) {
    const existingActive = await mongoose.model('AllocationPolicy').findOne({
      academicYear: this.academicYear,
      active: true,
      _id: { $ne: this._id }
    });
    
    if (existingActive) {
      return next(new Error('Another active policy already exists for this academic year'));
    }
  }

  next();
});

// Instance method: calculate priority score
AllocationPolicySchema.methods.calculatePriorityScore = function(details = {}) {
  const rules = this.priorityRules || {};
  let score = 50; // base

  // Year group
  if (details.yearGroup && rules.yearGroupWeights) {
    score += rules.yearGroupWeights[details.yearGroup] || 0;
  }

  // Financial hardship
  if (rules.financialHardship) {
    if (details.financialHardship) score += rules.financialHardship.verified || 0;
  }

  // Distance
  if (rules.distanceFromHome && typeof details.distanceFromHome === 'number') {
    if (details.distanceFromHome > 500) score += rules.distanceFromHome.above500km || 0;
    else if (details.distanceFromHome > 200) score += rules.distanceFromHome.above200km || 0;
    else if (details.distanceFromHome < 50) score += rules.distanceFromHome.below50km || 0;
  }

  // Scholarship
  if (details.scholarship && rules.scholarship) {
    score += rules.scholarship;
  }

  // Violations
  if (rules.violations) {
    if (details.violations === 'critical') score += rules.violations.critical || 0;
    else if (details.violations === 'major') score += rules.violations.major || 0;
    else if (details.violations === 'minor') score += rules.violations.minor || 0;
    else score += rules.violations.none || 0;
  }

  // Family wealth
  if (rules.familyWealth && details.familyWealth) {
    score += rules.familyWealth[details.familyWealth] || 0;
  }

  // Clamp 0-100
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return score;
};

// Static methods
AllocationPolicySchema.statics.getActivePolicy = async function(academicYear) {
  return this.findOne({ academicYear, active: true });
};

AllocationPolicySchema.statics.getCurrentYearPolicy = async function() {
  const currentYear = new Date().getFullYear();
  const academicYear = `${currentYear}-${currentYear + 1}`;
  return this.findOne({ academicYear, active: true });
};

const AllocationPolicyModel = mongoose.models.AllocationPolicy
  || mongoose.model('AllocationPolicy', AllocationPolicySchema);

module.exports = AllocationPolicyModel;
