const mongoose = require('mongoose');

const RoomAllocationSchema = new mongoose.Schema({
  academicYear: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{4}$/.test(v);
      },
      message: 'Academic year must be in format YYYY-YYYY'
    }
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
  
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'rooms',
    required: true
  },
  
  // Student context snapshot at allocation time
  studentYearGroup: {
    type: String,
    enum: ['year1', 'year2_3', 'year4_plus'],
    required: true,
    index: true
  },
  
  studentFaculty: String,
  studentEnrollmentYear: Number,
  
  // Room context snapshot
  dormitoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'dormitories',
    required: true
  },
  
  roomNumber: {
    type: String,
    required: true
  },
  
  buildingCode: String,
  roomCapacity: Number,
  
  // Allocation details
  allocationType: {
    type: String,
    enum: ['AUTO', 'MANUAL', 'REBALANCE', 'MANUAL_OVERRIDE', 'WAITLIST_PROMOTION'],
    default: 'AUTO',
    index: true
  },
  
  allocationReason: {
    type: String,
    required: true
  },
  
  // Lifecycle
  status: {
    type: String,
    enum: ['ACTIVE', 'REVOKED', 'TRANSFERRED', 'EXPIRED', 'WAITLISTED'],
    default: 'ACTIVE',
    index: true
  },
  
  startDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  endDate: Date,
  
  // Audit
  allocationBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students'
  },
  
  allocationTimestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  revokedAt: Date,
  
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students'
  },
  
  revocationReason: String,
  
  notes: String
});

// Unique constraint: one active allocation per student per cycle
RoomAllocationSchema.index({ studentId: 1, allocationCycleId: 1, status: 1 }, {
  unique: true,
  sparse: true,
  partialFilterExpression: { status: 'ACTIVE' }
});

// Compound indices for common queries
RoomAllocationSchema.index({ academicYear: 1, studentYearGroup: 1, status: 1 });
RoomAllocationSchema.index({ dormitoryId: 1, roomId: 1, status: 1 });
RoomAllocationSchema.index({ allocationCycleId: 1, status: 1 });

// Pre-save middleware
RoomAllocationSchema.pre('save', function(next) {
  if (this.status === 'REVOKED' && !this.revokedAt) {
    this.revokedAt = new Date();
  }
  next();
});

// Instance methods
RoomAllocationSchema.methods.isExpired = function() {
  if (!this.endDate) return false;
  return new Date() > this.endDate;
};

RoomAllocationSchema.methods.revoke = async function(revokedBy, reason = '') {
  if (this.status !== 'ACTIVE') {
    throw new Error('Can only revoke active allocations');
  }
  
  this.status = 'REVOKED';
  this.revokedAt = new Date();
  this.revokedBy = revokedBy;
  this.revocationReason = reason;
  
  return this.save();
};

RoomAllocationSchema.methods.transfer = async function(newRoomId, newDormitoryId, transferBy, reason = '') {
  if (this.status !== 'ACTIVE') {
    throw new Error('Can only transfer active allocations');
  }
  
  this.status = 'TRANSFERRED';
  this.endDate = new Date();
  this.notes = (this.notes || '') + `\nTransferred on ${new Date().toISOString()}: ${reason}`;
  
  const newAllocation = new mongoose.model('RoomAllocation')({
    academicYear: this.academicYear,
    allocationCycleId: this.allocationCycleId,
    studentId: this.studentId,
    roomId: newRoomId,
    studentYearGroup: this.studentYearGroup,
    studentFaculty: this.studentFaculty,
    studentEnrollmentYear: this.studentEnrollmentYear,
    dormitoryId: newDormitoryId,
    allocationType: 'MANUAL_OVERRIDE',
    allocationReason: `Transfer: ${reason}`,
    allocationBy: transferBy,
    status: 'ACTIVE'
  });
  
  await this.save();
  return newAllocation.save();
};

// Static methods
RoomAllocationSchema.statics.getStudentAllocation = async function(studentId, academicYear) {
  return this.findOne({
    studentId,
    academicYear,
    status: 'ACTIVE'
  }).populate(['roomId', 'dormitoryId', 'studentId']);
};

RoomAllocationSchema.statics.getCycleAllocations = async function(cycleId) {
  return this.find({
    allocationCycleId: cycleId,
    status: 'ACTIVE'
  }).populate(['studentId', 'roomId', 'dormitoryId']);
};

RoomAllocationSchema.statics.getYearGroupAllocations = async function(cycleId, yearGroup) {
  return this.find({
    allocationCycleId: cycleId,
    studentYearGroup: yearGroup,
    status: 'ACTIVE'
  }).populate(['studentId', 'roomId']);
};

RoomAllocationSchema.statics.countByStatus = async function(cycleId) {
  return this.aggregate([
    { $match: { allocationCycleId: new mongoose.Types.ObjectId(cycleId) } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
};

RoomAllocationSchema.statics.countByYearGroup = async function(cycleId, status = 'ACTIVE') {
  return this.aggregate([
    { 
      $match: { 
        allocationCycleId: new mongoose.Types.ObjectId(cycleId),
        status: status
      } 
    },
    { $group: { _id: '$studentYearGroup', count: { $sum: 1 } } }
  ]);
};

const RoomAllocationModel = mongoose.model('RoomAllocation', RoomAllocationSchema);
module.exports = RoomAllocationModel;
