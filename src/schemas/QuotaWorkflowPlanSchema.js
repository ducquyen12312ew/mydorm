const mongoose = require('mongoose');

const MilestoneSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'MISSED'],
    default: 'PENDING'
  }
}, { _id: false });

const QuotaWorkflowPlanSchema = new mongoose.Schema({
  academicYear: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  quotaConfigId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuotaConfig',
    required: true,
    index: true
  },
  milestones: {
    type: [MilestoneSchema],
    default: []
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students'
  },
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

QuotaWorkflowPlanSchema.index({ academicYear: 1, quotaConfigId: 1 }, { unique: true });

const QuotaWorkflowPlanModel = mongoose.models.QuotaWorkflowPlan
  || mongoose.model('QuotaWorkflowPlan', QuotaWorkflowPlanSchema);

module.exports = QuotaWorkflowPlanModel;
