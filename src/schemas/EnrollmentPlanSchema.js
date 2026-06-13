const mongoose = require('mongoose');

const ProgramQuotaSchema = new mongoose.Schema({
  programCode:  { type: String, required: true },
  programName:  { type: String, required: true },
  faculty:      { type: String, required: true },
  programType:  {
    type: String,
    enum: ['standard', 'advanced', 'international', 'talent'],
    default: 'standard'
  },
  plannedQuota: { type: Number, required: true, min: 0 },
  actualEnrollment: { type: Number, default: 0 },
  dormApplicationRate: { type: Number, default: 0.45 }, // historical ratio
  expectedDormResidents: { type: Number, default: 0 }
}, { _id: false });

const WorkflowStepSchema = new mongoose.Schema({
  step:        { type: String, enum: ['created', 'submitted', 'reviewed', 'approved', 'locked'] },
  actor:       { type: mongoose.Schema.Types.ObjectId, ref: 'students' },
  actorName:   String,
  note:        String,
  timestamp:   { type: Date, default: Date.now }
}, { _id: false });

const EnrollmentPlanSchema = new mongoose.Schema({
  academicYear: {
    type: String,
    required: true,
    validate: { validator: v => /^\d{4}-\d{4}$/.test(v), message: 'Format: YYYY-YYYY' }
  },

  planName: { type: String, required: true, trim: true },
  description: { type: String, trim: true },

  // Workflow state
  status: {
    type: String,
    enum: ['draft', 'review', 'approved', 'locked'],
    default: 'draft',
    index: true
  },

  // Totals (auto-computed from programs)
  totalPlannedQuota:   { type: Number, default: 0 },
  totalExpectedDorm:   { type: Number, default: 0 },
  dormCapacity:        { type: Number, default: 1308 }, // current capacity
  projectedOccupancy:  { type: Number, default: 0 },   // percentage
  capacityGap:         { type: Number, default: 0 },   // positive = shortage
  completionPercent:   { type: Number, default: 0 },   // 0-100 planning progress

  // Program breakdown
  programs: [ProgramQuotaSchema],

  // Comparison with previous year
  previousYearPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'EnrollmentPlan' },
  copiedFrom:         { type: mongoose.Schema.Types.ObjectId, ref: 'EnrollmentPlan' },
  growthRate:         { type: Number, default: 0 }, // % change from previous year

  // Workflow audit trail
  workflowHistory: [WorkflowStepSchema],

  // Locks
  lockedAt:  Date,
  lockedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'students' },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'students' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

EnrollmentPlanSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  // Recompute totals from programs
  if (this.programs && this.programs.length > 0) {
    this.totalPlannedQuota = this.programs.reduce((s, p) => s + (p.plannedQuota || 0), 0);
    this.totalExpectedDorm = this.programs.reduce((s, p) => s + (p.expectedDormResidents || 0), 0);
    if (this.dormCapacity > 0) {
      this.projectedOccupancy = Math.round((this.totalExpectedDorm / this.dormCapacity) * 100 * 10) / 10;
      this.capacityGap = this.totalExpectedDorm - this.dormCapacity;
    }
    // Completion: programs with actualEnrollment > 0
    const filled = this.programs.filter(p => p.actualEnrollment > 0).length;
    this.completionPercent = Math.round((filled / this.programs.length) * 100);
  }
  next();
});

EnrollmentPlanSchema.methods.addWorkflowStep = function(step, actor, actorName, note) {
  this.workflowHistory.push({ step, actor, actorName, note });
  this.status = step === 'locked' ? 'locked'
    : step === 'approved' ? 'approved'
    : step === 'reviewed' ? 'review'
    : 'draft';
};

EnrollmentPlanSchema.index({ academicYear: 1, status: 1 });

const EnrollmentPlanModel = mongoose.model('EnrollmentPlan', EnrollmentPlanSchema);
module.exports = EnrollmentPlanModel;
