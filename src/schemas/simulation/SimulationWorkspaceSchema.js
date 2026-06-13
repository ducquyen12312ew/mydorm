const mongoose = require('mongoose');

const SimulationWorkspaceSchema = new mongoose.Schema({
  adminUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students',
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['INITIALIZING', 'ACTIVE', 'ARCHIVED'],
    default: 'INITIALIZING',
    index: true
  },
  clonedAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  snapshotSummary: {
    studentCount: { type: Number, default: 0 },
    dormitoryCount: { type: Number, default: 0 },
    roomCount: { type: Number, default: 0 },
    policyCount: { type: Number, default: 0 },
    cycleCount: { type: Number, default: 0 }
  },
  notes: String
}, { collection: 'sim_workspaces' });

SimulationWorkspaceSchema.index({ adminUserId: 1, status: 1 });

const SimulationWorkspace = mongoose.models.SimulationWorkspace
  || mongoose.model('SimulationWorkspace', SimulationWorkspaceSchema);

module.exports = SimulationWorkspace;
