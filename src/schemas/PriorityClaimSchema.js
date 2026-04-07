const mongoose = require('mongoose');

const PriorityClaimSchema = new mongoose.Schema({
  academicYear: {
    type: String,
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
  
  // CLAIMS - Yêu cầu cấp điểm
  claims: {
    financialHardship: {
      claimed: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUBMITTED'],
        default: 'SUBMITTED'
      },
      documentUrl: String,
      submittedAt: Date,
      reason: String  // Lý do yêu cầu
    },
    
    minority: {
      claimed: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUBMITTED'],
        default: 'SUBMITTED'
      },
      ethnicity: String,  // Dân tộc
      documentUrl: String,
      submittedAt: Date
    },
    
    scholarship: {
      claimed: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUBMITTED'],
        default: 'SUBMITTED'
      },
      scholarshipType: String,  // Loại học bổng
      documentUrl: String,
      submittedAt: Date
    },
    
    orphan: {
      claimed: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUBMITTED'],
        default: 'SUBMITTED'
      },
      documentUrl: String,
      submittedAt: Date
    },
    
    disability: {
      claimed: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUBMITTED'],
        default: 'SUBMITTED'
      },
      disabilityLevel: {
        type: String,
        enum: ['mild', 'moderate', 'severe']
      },
      documentUrl: String,
      submittedAt: Date
    }
  },
  
  // TÍNH ĐIỂM (cập nhật khi admin duyệt)
  calculatedScore: {
    financialHardship: { type: Number, default: 0 },
    minority: { type: Number, default: 0 },
    scholarship: { type: Number, default: 0 },
    orphan: { type: Number, default: 0 },
    disability: { type: Number, default: 0 },
    totalBonusScore: { type: Number, default: 0 }
  },
  
  // REVIEW HISTORY
  reviews: [{
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'students'
    },
    reviewedAt: Date,
    claimType: String,  // financialHardship, minority, etc.
    status: String,     // APPROVED, REJECTED
    notes: String,
    score: Number
  }],
  
  // TỔNG HỢप
  status: {
    type: String,
    enum: ['PENDING_REVIEW', 'PARTIALLY_APPROVED', 'FULLY_APPROVED', 'REJECTED', 'DRAFT'],
    default: 'DRAFT',
    index: true
  },
  
  overallScore: { type: Number, default: 0 },
  submittedAt: Date,
  approvedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students'
  },
  
  notes: String,
  
  // AUDIT
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index
PriorityClaimSchema.index({ studentId: 1, academicYear: 1 }, { unique: true });
PriorityClaimSchema.index({ status: 1, submittedAt: -1 });
PriorityClaimSchema.index({ 'claims.financialHardship.status': 1 });
PriorityClaimSchema.index({ 'claims.minority.status': 1 });

// Methods
PriorityClaimSchema.methods.calculateTotalScore = function() {
  const calc = this.calculatedScore;
  this.overallScore = (calc.financialHardship || 0) + 
                      (calc.minority || 0) + 
                      (calc.scholarship || 0) + 
                      (calc.orphan || 0) + 
                      (calc.disability || 0);
  return this.overallScore;
};

PriorityClaimSchema.methods.getApprovedClaims = function() {
  const approved = {};
  Object.keys(this.claims).forEach(claimType => {
    if (this.claims[claimType].status === 'APPROVED') {
      approved[claimType] = this.claims[claimType];
    }
  });
  return approved;
};

module.exports = mongoose.model('PriorityClaim', PriorityClaimSchema);
