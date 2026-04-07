const mongoose = require('mongoose');

const AllocationRegistrationSchema = new mongoose.Schema({
  academicYear: {
    type: String,
    required: true,
    index: true
  },

  allocationCycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AllocationCycle',
    required: true,
    index: true
  },

  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students',
    required: true,
    index: true
  },

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

  // Registration details
  registrationTimestamp: {
    type: Date,
    default: Date.now,
    index: true
  },

  status: {
    type: String,
    enum: ['PENDING', 'ALLOCATED', 'WAITLIST', 'WITHDRAWN', 'REJECTED'],
    default: 'PENDING',
    index: true
  },

  // Priority for allocation
  priority: {
    type: Number,
    default: 0,
    index: true
  },

  // Student preferences
  preferences: {
    preferredBuildings: [mongoose.Schema.Types.ObjectId],
    preferredRoomType: String,
    accommodationNeeds: String
  },

  // Application metadata
  applicationNotes: String,

  // Audit
  withdrawnAt: Date,
  withdrawnReason: String,

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent duplicate registrations
AllocationRegistrationSchema.index(
  { studentId: 1, allocationCycleId: 1 },
  { unique: true, sparse: true }
);

// Indices for queries
AllocationRegistrationSchema.index({ allocationCycleId: 1, status: 1 });
AllocationRegistrationSchema.index({ yearGroup: 1, status: 1 });

AllocationRegistrationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const AllocationRegistrationModel = mongoose.model('AllocationRegistration', AllocationRegistrationSchema);
module.exports = AllocationRegistrationModel;
