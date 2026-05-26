const mongoose = require('mongoose');

const MobileRefreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students',
    required: true,
    index: true
  },
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  fingerprint: {
    type: String,
    required: true,
    index: true
  },
  fingerprintHistory: {
    type: [
      {
        fingerprint: String,
        seenAt: Date
      }
    ],
    default: []
  },
  lastIpAddress: {
    type: String,
    default: null,
    index: true
  },
  lastUserAgentHash: {
    type: String,
    default: null,
    index: true
  },
  anomalyCount: {
    type: Number,
    default: 0
  },
  lastAnomalyAt: {
    type: Date,
    default: null
  },
  lastAnomalyReason: {
    type: String,
    default: null
  },
  lastRiskScore: {
    type: Number,
    default: 0
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  revokedAt: {
    type: Date,
    default: null
  },
  revokedReason: {
    type: String,
    default: null
  },
  replacedByTokenHash: {
    type: String,
    default: null
  },
  lastUsedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

MobileRefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('MobileRefreshToken', MobileRefreshTokenSchema);
