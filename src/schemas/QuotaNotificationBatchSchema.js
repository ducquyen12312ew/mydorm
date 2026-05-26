const mongoose = require('mongoose');

const QuotaNotificationBatchSchema = new mongoose.Schema({
  quotaConfigId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuotaConfig',
    required: true,
    index: true
  },
  academicYear: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  stage: {
    type: String,
    required: true,
    enum: ['PRE_NOTICE', 'FINAL_NOTICE', 'EMERGENCY_ADJUSTMENT'],
    index: true
  },
  reason: {
    type: String,
    default: '',
    trim: true
  },
  scheduledAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['PLANNED', 'SENT', 'CANCELLED'],
    default: 'PLANNED',
    index: true
  },
  targetStudentIds: {
    type: [mongoose.Schema.Types.ObjectId],
    default: []
  },
  stats: {
    targeted: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students'
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students'
  },
  sentAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

QuotaNotificationBatchSchema.index({ quotaConfigId: 1, stage: 1, scheduledAt: 1 });

const QuotaNotificationBatchModel = mongoose.models.QuotaNotificationBatch
  || mongoose.model('QuotaNotificationBatch', QuotaNotificationBatchSchema);

module.exports = QuotaNotificationBatchModel;
