const mongoose = require('mongoose');

const OperationalAlertSchema = new mongoose.Schema({
  alertType: {
    type: String,
    required: true,
    index: true
  },
  state: {
    type: String,
    enum: ['TRIGGERED', 'CLEARED'],
    required: true,
    index: true
  },
  value: {
    type: Number,
    required: true
  },
  threshold: {
    type: Number,
    required: true
  },
  windowStart: {
    type: Date,
    required: true
  },
  windowEnd: {
    type: Date,
    required: true,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  traceId: {
    type: String,
    default: null,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

OperationalAlertSchema.index({ alertType: 1, createdAt: -1 });

module.exports = mongoose.model('OperationalAlert', OperationalAlertSchema);