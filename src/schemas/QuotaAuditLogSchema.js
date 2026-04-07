const mongoose = require('mongoose');

const QuotaAuditLogSchema = new mongoose.Schema({
  quotaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuotaConfig',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: ['CREATE', 'UPDATE', 'PUBLISH', 'FINALIZE'],
    index: true
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students',
    required: true,
    index: true
  },
  reason: {
    type: String,
    trim: true,
    required: function requiredReason() {
      return this.action === 'UPDATE';
    }
  },
  before: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  after: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  versionKey: false
});

const QuotaAuditLogModel = mongoose.models.QuotaAuditLog
  || mongoose.model('QuotaAuditLog', QuotaAuditLogSchema);

module.exports = QuotaAuditLogModel;