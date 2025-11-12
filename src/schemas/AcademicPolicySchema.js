const mongoose = require('mongoose');

const AcademicPolicySchema = new mongoose.Schema({
  academicYear: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  active: {
    type: Boolean,
    default: true
  },
  policies: {
    year1: {
      canChooseRoom: { type: Boolean, default: false },
      autoAssign: { type: Boolean, default: true },
      allowedBuildings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'dormitories' }],
      priority: { type: String, enum: ['low', 'default', 'medium', 'high'], default: 'default' },
      description: { type: String, default: 'Sinh viên năm 1 được phân phòng tự động' }
    },
    year2_3: {
      canChooseRoom: { type: Boolean, default: true },
      autoAssign: { type: Boolean, default: false },
      selectionWindow: {
        start: { type: Date },
        end: { type: Date }
      },
      allowedBuildings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'dormitories' }],
      priority: { type: String, enum: ['low', 'default', 'medium', 'high'], default: 'medium' },
      description: { type: String, default: 'Sinh viên năm 2-3 được tự chọn phòng trong thời gian quy định' }
    },
    year4_plus: {
      canChooseRoom: { type: Boolean, default: true },
      specialPriority: { type: Boolean, default: true },
      allowRoomChange: { type: Boolean, default: true },
      selectionWindow: {
        start: { type: Date },
        end: { type: Date }
      },
      allowedBuildings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'dormitories' }],
      priority: { type: String, enum: ['low', 'default', 'medium', 'high'], default: 'high' },
      description: { type: String, default: 'Sinh viên năm cuối có quyền ưu tiên cao nhất và có thể đổi phòng' }
    }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'students' },
  notes: { type: String }
});

// Chỉ giữ index cho active; KHÔNG tạo index trùng academicYear vì đã unique ở field
AcademicPolicySchema.index({ active: 1 });

AcademicPolicySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

AcademicPolicySchema.methods.isSelectionWindowOpen = function (yearGroup) {
  const now = new Date();
  let policy;
  if (yearGroup === 1) policy = this.policies.year1;
  else if (yearGroup === 2) policy = this.policies.year2_3;
  else policy = this.policies.year4_plus;

  if (!policy.selectionWindow || !policy.selectionWindow.start || !policy.selectionWindow.end) {
    return true;
  }
  return now >= policy.selectionWindow.start && now <= policy.selectionWindow.end;
};

AcademicPolicySchema.methods.getPolicyForYearGroup = function (yearGroup) {
  if (yearGroup === 1) return this.policies.year1;
  if (yearGroup === 2) return this.policies.year2_3;
  return this.policies.year4_plus;
};

AcademicPolicySchema.statics.getActivePolicy = async function (academicYear) {
  return this.findOne({ academicYear, active: true });
};

AcademicPolicySchema.statics.getCurrentYearPolicy = async function () {
  const currentYear = new Date().getFullYear();
  const academicYear = `${currentYear}-${currentYear + 1}`;
  return this.findOne({ academicYear, active: true });
};

const AcademicPolicyModel = mongoose.model('AcademicPolicy', AcademicPolicySchema);
module.exports = AcademicPolicyModel;
