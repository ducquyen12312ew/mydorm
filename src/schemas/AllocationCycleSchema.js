const mongoose = require('mongoose');

const AllocationCycleSchema = new mongoose.Schema({
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
  
  name: {
    type: String,
    required: true,
    trim: true,
    enum: ['Main Registration', 'Late Registration', 'Adjustment Period', 'Manual Allocation']
  },
  
  policyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AllocationPolicy',
    required: false,
    default: null
  },

  allowedAcademicYears: {
    type: [String],
    default: ['1', '2', '3', '4', '5', '6']
  },
  
  // Timeline
  registrationStart: {
    type: Date,
    required: true
  },
  
  registrationEnd: {
    type: Date,
    required: true
  },
  
  allocationDate: {
    type: Date
  },
  
  status: {
    type: String,
    enum: ['PENDING', 'RUNNING', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },
  
  // Capacity snapshot (beds) at cycle creation
  capacitySnapshot: {
    totalRooms: Number,
    totalBeds: Number,
    availableBeds: Number,
    capturedAt: {
      type: Date,
      default: Date.now
    }
  },
  
  // Statistics snapshot after execution
  stats: {
    totalRegistrations: {
      type: Number,
      default: 0
    },
    totalAllocated: {
      type: Number,
      default: 0
    },
    totalWaitlisted: {
      type: Number,
      default: 0
    },
    byYearGroup: {
      year1: {
        registrations: { type: Number, default: 0 },
        allocated: { type: Number, default: 0 },
        waitlisted: { type: Number, default: 0 },
        status: String // "SUFFICIENT", "DEFICIT", "SURPLUS"
      },
      year2_3: {
        registrations: { type: Number, default: 0 },
        allocated: { type: Number, default: 0 },
        waitlisted: { type: Number, default: 0 },
        status: String
      },
      year4_plus: {
        registrations: { type: Number, default: 0 },
        allocated: { type: Number, default: 0 },
        waitlisted: { type: Number, default: 0 },
        status: String
      }
    }
  },
  
  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students'
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  executedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students'
  },
  
  executedAt: Date,
  
  notes: String
});

// Validation: registrationEnd must be after registrationStart
AllocationCycleSchema.pre('save', function(next) {
  if (this.registrationEnd <= this.registrationStart) {
    next(new Error('Registration end date must be after start date'));
  }
  this.updatedAt = new Date();
  next();
});

// Instance methods
AllocationCycleSchema.methods.isRegistrationOpen = function() {
  const now = new Date();
  return now >= this.registrationStart && now <= this.registrationEnd;
};

AllocationCycleSchema.methods.captureCapacitySnapshot = async function(totalRooms = 0, totalBeds = 0, availableBeds = 0) {
  this.capacitySnapshot = {
    totalRooms,
    totalBeds,
    availableBeds,
    capturedAt: new Date()
  };
  return this.save();
};

// Static methods
AllocationCycleSchema.statics.getActiveCycle = async function(academicYear) {
  return this.findOne({
    academicYear,
    status: { $in: ['PENDING', 'RUNNING'] }
  }).sort({ registrationStart: -1 });
};

AllocationCycleSchema.statics.getCompletedCycles = async function(academicYear) {
  return this.find({
    academicYear,
    status: 'COMPLETED'
  }).sort({ allocationDate: -1 });
};

// Indices for common queries
AllocationCycleSchema.index({ academicYear: 1, status: 1 });
AllocationCycleSchema.index({ academicYear: 1, registrationStart: 1 });
AllocationCycleSchema.index({ policyId: 1 });

const AllocationCycleModel = mongoose.model('AllocationCycle', AllocationCycleSchema);
module.exports = AllocationCycleModel;
