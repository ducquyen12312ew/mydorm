const mongoose = require('mongoose');
const { calculateSlots, validateQuota } = require('../utils/quotaConfig');

const QuotaEntrySchema = new mongoose.Schema({
  yearGroup: {
    type: String,
    required: true,
    enum: ['year1', 'year2', 'year3', 'year4_plus']
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  slot: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const QuotaConfigSchema = new mongoose.Schema({
  academicYear: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{4}$/.test(v);
      },
      message: 'Academic year must be in format YYYY-YYYY'
    }
  },
  totalCapacity: {
    type: Number,
    required: true,
    min: 1
  },
  quotas: {
    type: [QuotaEntrySchema],
    required: true,
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: 'quotas must contain at least one entry'
    }
  },
  overcapPolicy: {
    enabled: {
      type: Boolean,
      default: false
    },
    maxOverPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    byYearGroup: {
      year1: { type: Number, min: 0, max: 100, default: null },
      year2: { type: Number, min: 0, max: 100, default: null },
      year3: { type: Number, min: 0, max: 100, default: null },
      year4_plus: { type: Number, min: 0, max: 100, default: null }
    }
  },
  analyticsOptions: {
    excludeInternationalStudents: {
      type: Boolean,
      default: true
    },
    recommendationWindowYears: {
      type: Number,
      min: 1,
      max: 10,
      default: 3
    }
  },
  effectiveFrom: {
    type: Date,
    required: true
  },
  effectiveTo: {
    type: Date,
    required: true
  },
  version: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  isDraft: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students'
  }
}, {
  timestamps: true
});

QuotaConfigSchema.pre('validate', function(next) {
  const withCalculatedMissingSlots = calculateSlots(this);
  this.quotas = withCalculatedMissingSlots;

  const validationResult = validateQuota(this);
  if (!validationResult.isValid) {
    return next(new Error(validationResult.errors.join('; ')));
  }

  next();
});

QuotaConfigSchema.index({ academicYear: 1, version: 1 }, { unique: true });
QuotaConfigSchema.index(
  { academicYear: 1, isDraft: 1 },
  {
    unique: true,
    partialFilterExpression: { isDraft: false }
  }
);
QuotaConfigSchema.index({ academicYear: 1, isDraft: 1, effectiveFrom: -1 });

const QuotaConfigModel = mongoose.models.QuotaConfig
  || mongoose.model('QuotaConfig', QuotaConfigSchema);

module.exports = QuotaConfigModel;
