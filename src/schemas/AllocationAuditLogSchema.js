const mongoose = require('mongoose');

const AllocationAuditLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    expires: 63072000 // 2 years
  },
  
  academicYear: {
    type: String,
    required: true,
    index: true
  },
  
  cycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AllocationCycle'
  },
  
  actionType: {
    type: String,
    enum: ['ALLOCATION_CYCLE_CREATED', 'ALLOCATION_CYCLE_EXECUTED', 'ALLOCATION_CREATED', 
           'ALLOCATION_REVOKED', 'ALLOCATION_TRANSFERRED', 'REBALANCE_SUGGESTED', 
           'REBALANCE_EXECUTED', 'POLICY_CREATED', 'POLICY_UPDATED', 'MANUAL_OVERRIDE',
           'REGISTRATION_RECEIVED'],
    required: true,
    index: true
  },
  
  // Context
  affectedYearGroups: [String],
  affectedStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students'
  }],
  
  affectedRooms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'rooms'
  }],
  
  // Before/After snapshot
  before: {
    allocationStatus: mongoose.Schema.Types.Mixed,
    policySnapshot: mongoose.Schema.Types.Mixed
  },
  
  after: {
    allocationStatus: mongoose.Schema.Types.Mixed,
    policySnapshot: mongoose.Schema.Types.Mixed
  },
  
  // Execution details
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students',
    required: true
  },
  
  mode: {
    type: String,
    enum: ['AUTOMATIC', 'SUGGESTION', 'ENFORCED'],
    default: 'AUTOMATIC'
  },
  
  result: {
    type: String,
    enum: ['SUCCESS', 'PARTIAL', 'FAILED', 'PENDING'],
    default: 'PENDING'
  },
  
  error: String,
  errorStack: String,
  
  // Action-specific details
  details: mongoose.Schema.Types.Mixed,
  
  // Metrics
  executionTimeMs: Number,
  itemsProcessed: Number,
  itemsSucceeded: Number,
  itemsFailed: Number,
  
  // Audit trail enrichment
  userAgent: String,
  ipAddress: String,
  sessionId: String,
  
  notes: String
});

// Indices for efficient querying
AllocationAuditLogSchema.index({ academicYear: 1, timestamp: -1 });
AllocationAuditLogSchema.index({ cycleId: 1, actionType: 1 });
AllocationAuditLogSchema.index({ actionType: 1, timestamp: -1 });
AllocationAuditLogSchema.index({ performedBy: 1, timestamp: -1 });
AllocationAuditLogSchema.index({ affectedStudents: 1 });
AllocationAuditLogSchema.index({ result: 1 });

// Pre-save middleware
AllocationAuditLogSchema.pre('save', function(next) {
  // Ensure immutability by not allowing updates
  if (!this.isNew) {
    next(new Error('Audit logs are immutable and cannot be updated'));
  }
  next();
});

// Instance methods
AllocationAuditLogSchema.methods.getImpactSummary = function() {
  const summary = {
    action: this.actionType,
    timestamp: this.timestamp,
    performedBy: this.performedBy,
    affectedCount: (this.affectedStudents || []).length,
    result: this.result,
    duration: this.executionTimeMs
  };
  
  if (this.before && this.after) {
    summary.changes = {
      before: this.before.allocationStatus,
      after: this.after.allocationStatus
    };
  }
  
  return summary;
};

AllocationAuditLogSchema.methods.wasSuccessful = function() {
  return this.result === 'SUCCESS' || this.result === 'PARTIAL';
};

// Static methods
AllocationAuditLogSchema.statics.logAllocationAction = async function(
  actionType,
  academicYear,
  performedBy,
  options = {}
) {
  const log = new this({
    actionType,
    academicYear,
    performedBy,
    cycleId: options.cycleId,
    affectedYearGroups: options.affectedYearGroups || [],
    affectedStudents: options.affectedStudents || [],
    affectedRooms: options.affectedRooms || [],
    before: options.before,
    after: options.after,
    mode: options.mode || 'AUTOMATIC',
    details: options.details,
    userAgent: options.userAgent,
    ipAddress: options.ipAddress,
    sessionId: options.sessionId,
    notes: options.notes
  });
  
  return log.save();
};

AllocationAuditLogSchema.statics.recordActionStart = function(
  actionType,
  academicYear,
  performedBy,
  options = {}
) {
  return {
    startTime: Date.now(),
    actionType,
    academicYear,
    performedBy,
    ...options
  };
};

AllocationAuditLogSchema.statics.recordActionEnd = async function(
  actionStartData,
  result,
  options = {}
) {
  const executionTime = Date.now() - actionStartData.startTime;
  
  return this.logAllocationAction(
    actionStartData.actionType,
    actionStartData.academicYear,
    actionStartData.performedBy,
    {
      ...actionStartData,
      result,
      executionTimeMs: executionTime,
      ...options
    }
  );
};

AllocationAuditLogSchema.statics.getActionHistory = async function(
  academicYear,
  options = {}
) {
  const query = { academicYear };
  
  if (options.actionType) {
    query.actionType = options.actionType;
  }
  
  if (options.cycleId) {
    query.cycleId = options.cycleId;
  }
  
  if (options.startDate || options.endDate) {
    query.timestamp = {};
    if (options.startDate) query.timestamp.$gte = options.startDate;
    if (options.endDate) query.timestamp.$lte = options.endDate;
  }
  
  if (options.performedBy) {
    query.performedBy = options.performedBy;
  }
  
  if (options.result) {
    query.result = options.result;
  }
  
  const limit = options.limit || 100;
  const skip = options.skip || 0;
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .populate(['performedBy', 'cycleId', 'affectedStudents']);
};

AllocationAuditLogSchema.statics.getStudentAuditHistory = async function(
  studentId,
  academicYear,
  limit = 50
) {
  return this.find({
    affectedStudents: studentId,
    academicYear
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('performedBy');
};

AllocationAuditLogSchema.statics.getCycleAuditTrail = async function(cycleId) {
  return this.find({ cycleId })
    .sort({ timestamp: 1 })
    .populate(['performedBy', 'affectedStudents']);
};

AllocationAuditLogSchema.statics.getFailedActions = async function(
  academicYear,
  options = {}
) {
  const query = {
    academicYear,
    result: 'FAILED'
  };
  
  if (options.startDate) query.timestamp = { $gte: options.startDate };
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .populate('performedBy');
};

const AllocationAuditLogModel = mongoose.model('AllocationAuditLog', AllocationAuditLogSchema);
module.exports = AllocationAuditLogModel;
