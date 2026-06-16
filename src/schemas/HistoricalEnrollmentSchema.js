const mongoose = require('mongoose');

const FacultyBreakdownSchema = new mongoose.Schema({
  faculty:      String,
  enrollment:   Number,
  dormApps:     Number,
  dormResidents: Number
}, { _id: false });

const HistoricalEnrollmentSchema = new mongoose.Schema({
  academicYear: {
    type: String,
    required: true,
    unique: true,
    validate: { validator: v => /^\d{4}-\d{4}$/.test(v), message: 'Format: YYYY-YYYY' }
  },

  // Raw enrollment numbers
  totalEnrollmentQuota:    { type: Number, required: true },
  totalActualEnrollment:   { type: Number, required: true },
  enrollmentFillRate:      { type: Number }, // actualEnrollment / quota

  // Year-1 (freshmen) — biggest cohort
  freshmanQuota:           { type: Number },
  freshmanActual:          { type: Number },

  // Dormitory metrics
  dormApplications:        { type: Number },
  dormApplicationRate:     { type: Number }, // applications / total students
  dormAcceptedStudents:    { type: Number },
  dormAcceptanceRate:      { type: Number }, // accepted / applications
  dormResidents:           { type: Number },
  dormOccupancyRate:       { type: Number }, // residents / dormCapacity
  dormCapacity:            { type: Number },

  // Retention by year group
  retentionYear2:  { type: Number }, // % of year-1 who stay year-2
  retentionYear3:  { type: Number },
  retentionYear4:  { type: Number },

  // Average dormitory application rate by year group
  appRateYear1:    { type: Number },
  appRateYear2_3:  { type: Number },
  appRateYear4Plus:{ type: Number },

  // Faculty breakdown
  faculties: [FacultyBreakdownSchema],

  // Growth vs previous year
  growthRate: { type: Number }, // % growth in total enrollment
  dormGrowthRate: { type: Number }, // % growth in dorm residents

  notes: String,
  isActual: { type: Boolean, default: true }, // false = projected

  createdAt: { type: Date, default: Date.now }
});

HistoricalEnrollmentSchema.pre('save', function(next) {
  if (this.totalEnrollmentQuota > 0 && this.totalActualEnrollment) {
    this.enrollmentFillRate = Math.round((this.totalActualEnrollment / this.totalEnrollmentQuota) * 1000) / 1000;
  }
  if (this.dormApplications > 0 && this.totalActualEnrollment) {
    this.dormApplicationRate = Math.round((this.dormApplications / this.totalActualEnrollment) * 1000) / 1000;
  }
  if (this.dormApplications > 0 && this.dormAcceptedStudents) {
    this.dormAcceptanceRate = Math.round((this.dormAcceptedStudents / this.dormApplications) * 1000) / 1000;
  }
  if (this.dormCapacity > 0 && this.dormResidents) {
    this.dormOccupancyRate = Math.round((this.dormResidents / this.dormCapacity) * 1000) / 1000;
  }
  next();
});

HistoricalEnrollmentSchema.index({ academicYear: 1 });

const HistoricalEnrollmentModel = mongoose.model('HistoricalEnrollment', HistoricalEnrollmentSchema);
module.exports = HistoricalEnrollmentModel;
