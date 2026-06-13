const mongoose = require('mongoose');

// Tracks a single apply operation: what was written to real DB and how to undo it
const SimulationApplySchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SimulationWorkspace',
    required: true,
    index: true
  },
  runId:      { type: String, required: true, index: true },
  snapshotId: { type: String, required: true, unique: true, index: true },

  status: {
    type: String,
    enum: ['APPLIED', 'UNDONE'],
    default: 'APPLIED'
  },

  simYear:      { type: String },
  academicYear: { type: String },

  // AllocationCycle created for this apply
  createdCycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AllocationCycle' },

  // RoomAllocation._id records created
  createdAllocationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RoomAllocation' }],

  // Per-room occupant additions (for surgical removal on undo)
  modifiedRooms: [{
    dormitoryId:    { type: mongoose.Schema.Types.ObjectId },
    dormitoryName:  String,
    floorNumber:    Number,
    roomId:         { type: mongoose.Schema.Types.ObjectId },
    roomNumber:     String,
    studentMongoId: String,
    studentName:    String
  }],

  stats: {
    studentsApplied: { type: Number, default: 0 },
    realStudents:    { type: Number, default: 0 },
    skippedYear1:    { type: Number, default: 0 }
  },

  appliedAt: { type: Date, default: Date.now },
  undoneAt:  { type: Date },
  appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'students' },

  // Snapshot of summary BEFORE apply (for report)
  beforeState: {
    totalAllocations: { type: Number, default: 0 },
    dormOccupancy:    { type: Object, default: {} }
  }
}, { collection: 'sim_applies' });

SimulationApplySchema.index({ workspaceId: 1, runId: 1 });
SimulationApplySchema.index({ workspaceId: 1, status: 1 });

const SimulationApply = mongoose.models.SimulationApply
  || mongoose.model('SimulationApply', SimulationApplySchema);

module.exports = SimulationApply;
