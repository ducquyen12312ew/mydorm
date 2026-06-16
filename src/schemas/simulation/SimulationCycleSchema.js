const mongoose = require('mongoose');

const SimulationCycleSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SimulationWorkspace',
    required: true,
    index: true
  },
  sourceCycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AllocationCycle'
  },
  academicYear: {
    type: String,
    required: true,
    validate: {
      validator: (v) => /^\d{4}-\d{4}$/.test(v),
      message: 'Academic year must be in format YYYY-YYYY'
    }
  },
  name: {
    type: String,
    required: true,
    trim: true,
    enum: ['Main Registration', 'Late Registration', 'Adjustment Period', 'Manual Allocation']
  },
  policyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SimulationPolicy'
  },
  allowedAcademicYears: {
    type: [String],
    default: ['1', '2', '3', '4', '5', '6']
  },
  registrationStart: { type: Date, required: true },
  registrationEnd: { type: Date, required: true },
  allocationDate: { type: Date },
  status: {
    type: String,
    enum: ['PENDING', 'RUNNING', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING'
  },
  capacitySnapshot: {
    totalRooms: Number,
    totalBeds: Number,
    availableBeds: Number,
    capturedAt: { type: Date, default: Date.now }
  },
  stats: {
    totalRegistrations: { type: Number, default: 0 },
    totalAllocated: { type: Number, default: 0 },
    totalWaitlisted: { type: Number, default: 0 }
  },
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'sim_cycles' });

SimulationCycleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const SimulationCycle = mongoose.models.SimulationCycle
  || mongoose.model('SimulationCycle', SimulationCycleSchema);

module.exports = SimulationCycle;
