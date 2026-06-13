const mongoose = require('mongoose');

const ScenarioOutputSchema = new mongoose.Schema({
  // Inputs used
  enrollmentQuota:       Number,
  growthAssumption:      Number, // % growth

  // Computed outputs
  expectedApplications:  Number,
  applicationRate:       Number, // % of students who apply
  expectedAccepted:      Number,
  acceptanceRate:        Number,
  expectedResidents:     Number,
  roomDemand:            Number, // beds needed
  occupancyRate:         Number, // % of total capacity
  capacityGap:           Number, // positive = shortage
  surplusDeficit:        Number, // negative = shortage

  // By year group
  byYearGroup: {
    year1:     { applications: Number, residents: Number },
    year2_3:   { applications: Number, residents: Number },
    year4Plus:  { applications: Number, residents: Number }
  },

  // Confidence
  confidenceScore:   { type: Number, min: 0, max: 100 },
  confidenceLevel:   { type: String, enum: ['low', 'medium', 'high'] },
  explanation:       String,
  warnings:          [String]
}, { _id: false });

const DemandForecastSchema = new mongoose.Schema({
  academicYear: {
    type: String,
    required: true,
    index: true,
    validate: { validator: v => /^\d{4}-\d{4}$/.test(v), message: 'Format: YYYY-YYYY' }
  },

  // Forecast method used
  method: {
    type: String,
    enum: ['ratio-nearest', 'weighted-average', 'manual-override', 'scenario'],
    default: 'weighted-average'
  },

  // Historical data used
  yearsUsed: [String], // e.g. ['2022-2023', '2023-2024']
  dormCapacity: { type: Number, default: 1308 },

  // All four scenarios
  scenarios: {
    A: { // Same as previous year
      description: { type: String, default: 'Giữ nguyên như năm trước' },
      output: ScenarioOutputSchema
    },
    B: { // Manual custom quotas
      description: { type: String, default: 'Chỉ tiêu tuỳ chỉnh thủ công' },
      customQuota: Number,
      output: ScenarioOutputSchema
    },
    C: { // Growth 5-10%
      description: { type: String, default: 'Tăng trưởng 5-10%' },
      growthRate: { type: Number, default: 0.07 },
      output: ScenarioOutputSchema
    },
    D: { // Decline 5-10%
      description: { type: String, default: 'Giảm 5-10%' },
      declineRate: { type: Number, default: 0.07 },
      output: ScenarioOutputSchema
    }
  },

  // Recommended scenario
  recommendedScenario: { type: String, enum: ['A', 'B', 'C', 'D'] },
  recommendation:      String,

  // Manual override applied
  manualOverride: {
    applied: { type: Boolean, default: false },
    overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'students' },
    overriddenByName: String,
    originalValues: Object,
    overrideNote: String
  },

  // Primary forecast (before choosing scenario)
  baseEnrollmentQuota: Number,
  baseApplicationRate: Number,
  baseAcceptanceRate:  Number,
  baseRetentionRate:   Number,

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'students' },
  createdAt:  { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now }
});

DemandForecastSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

DemandForecastSchema.index({ academicYear: 1 });

const DemandForecastModel = mongoose.model('DemandForecast', DemandForecastSchema);
module.exports = DemandForecastModel;
