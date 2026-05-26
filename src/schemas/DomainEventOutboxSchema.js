const mongoose = require('mongoose');

const DomainEventOutboxSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  idempotencyKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    index: true
  },
  aggregateType: {
    type: String,
    default: null,
    index: true
  },
  aggregateId: {
    type: String,
    default: null,
    index: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'done', 'dead_letter'],
    default: 'pending',
    index: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 5
  },
  nextAttemptAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lockedAt: {
    type: Date,
    default: null
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  deadLetteredAt: {
    type: Date,
    default: null
  },
  deadLetterReason: {
    type: String,
    default: null
  },
  replayCount: {
    type: Number,
    default: 0
  },
  lastReplayAt: {
    type: Date,
    default: null
  },
  replayedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students',
    default: null
  },
  error: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

DomainEventOutboxSchema.pre('save', function setUpdatedAt(next) {
  this.updatedAt = new Date();
  next();
});

DomainEventOutboxSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });

module.exports = mongoose.model('DomainEventOutbox', DomainEventOutboxSchema);