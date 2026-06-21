'use strict';
const mongoose = require('mongoose');

const SimulationResultSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SimulationWorkspace',
    required: true,
    index: true
  },
  runId:      { type: String, required: true, index: true },
  snapshotId: { type: String, required: true, unique: true },

  status: {
    type: String,
    enum: ['APPLIED', 'UNDONE'],
    default: 'APPLIED'
  },

  simYear:      String,
  academicYear: String,
  appliedAt:    { type: Date, default: Date.now },
  undoneAt:     Date,
  appliedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'students' },

  allocations: [{
    simStudentId:  { type: mongoose.Schema.Types.ObjectId },
    studentId:     { type: mongoose.Schema.Types.ObjectId },
    studentCode:   String,
    studentName:   String,
    yearGroup:     String,
    gender:        String,
    faculty:       String,
    priorityScore: Number,
    dormName:      String,
    floor:         Number,
    roomNumber:    String,
    roomType:      String,
    isNewYear1:    Boolean
  }],

  waitlist: [{
    simStudentId:  { type: mongoose.Schema.Types.ObjectId },
    studentId:     { type: mongoose.Schema.Types.ObjectId },
    studentCode:   String,
    studentName:   String,
    yearGroup:     String,
    priorityScore: Number,
    reason:        String
  }],

  stats: {
    total:          { type: Number, default: 0 },
    allocated:      { type: Number, default: 0 },
    waitlisted:     { type: Number, default: 0 },
    skippedYear1:   { type: Number, default: 0 },
    fillRate:       Number,
    occupancyAfter: Number,
    byYear:         { type: mongoose.Schema.Types.Mixed, default: {} }
  }
}, {
  collection: 'simulation_results'
});

SimulationResultSchema.index({ workspaceId: 1, runId: 1 });
SimulationResultSchema.index({ workspaceId: 1, status: 1 });

const SimulationResult = mongoose.models.SimulationResult
  || mongoose.model('SimulationResult', SimulationResultSchema);

module.exports = SimulationResult;
