const mongoose = require('mongoose');

const SimulationRegistrationSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SimulationWorkspace',
    required: true,
    index: true
  },
  simCycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SimulationCycle',
    required: true,
    index: true
  },
  simStudentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SimulationStudent',
    required: true,
    index: true
  },
  sourceStudentId: { type: mongoose.Schema.Types.ObjectId },
  academicYear: { type: String, required: true, index: true },
  studentName: String,
  studentEmail: String,
  studentPhone: String,
  studentFaculty: String,
  studentEnrollmentYear: Number,
  yearGroup: {
    type: String,
    enum: ['year1', 'year2_3', 'year4_plus'],
    required: true,
    index: true
  },
  registrationTimestamp: { type: Date, default: Date.now, index: true },
  status: {
    type: String,
    enum: ['PENDING', 'ALLOCATED', 'WAITLIST', 'WITHDRAWN'],
    default: 'PENDING',
    index: true
  },
  priority: { type: Number, default: 0 },
  preferences: {
    preferredBuildings: [mongoose.Schema.Types.ObjectId],
    preferredRoomType: String,
    accommodationNeeds: String
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'sim_registrations' });

SimulationRegistrationSchema.index({ workspaceId: 1, simCycleId: 1, status: 1 });
SimulationRegistrationSchema.index({ workspaceId: 1, yearGroup: 1, status: 1 });

SimulationRegistrationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const SimulationRegistration = mongoose.models.SimulationRegistration
  || mongoose.model('SimulationRegistration', SimulationRegistrationSchema);

module.exports = SimulationRegistration;
