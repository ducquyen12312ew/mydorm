const mongoose = require('mongoose');

/**
 * ACADEMIC POLICY SCHEMA
 * Schema quản lý chính sách đăng ký phòng theo năm học
 * Mỗi năm học có chính sách riêng cho từng nhóm sinh viên
 */

const AcademicPolicySchema = new mongoose.Schema({
    // Năm học (VD: 2024-2025)
    academicYear: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },

    // Chính sách có đang kích hoạt không
    active: {
        type: Boolean,
        default: true
    },

    // Chính sách cho từng nhóm năm học
    policies: {
        // Chính sách cho sinh viên năm 1
        year1: {
            canChooseRoom: {
                type: Boolean,
                default: false, // Năm 1 thường không được tự chọn
                description: 'Cho phép sinh viên năm 1 tự chọn phòng'
            },
            autoAssign: {
                type: Boolean,
                default: true, // Năm 1 được phân tự động
                description: 'Tự động phân phòng cho sinh viên năm 1'
            },
            allowedBuildings: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'dormitories',
                description: 'Danh sách KTX được phép cho năm 1 (rỗng = tất cả)'
            }],
            priority: {
                type: String,
                enum: ['low', 'default', 'medium', 'high'],
                default: 'default',
                description: 'Mức độ ưu tiên khi phân phòng'
            },
            description: {
                type: String,
                default: 'Sinh viên năm 1 được phân phòng tự động'
            }
        },

        // Chính sách cho sinh viên năm 2-3
        year2_3: {
            canChooseRoom: {
                type: Boolean,
                default: true, // Năm 2-3 được tự chọn
                description: 'Cho phép sinh viên năm 2-3 tự chọn phòng'
            },
            autoAssign: {
                type: Boolean,
                default: false,
                description: 'Tự động phân phòng nếu không tự chọn'
            },
            selectionWindow: {
                start: {
                    type: Date,
                    description: 'Thời gian bắt đầu chọn phòng'
                },
                end: {
                    type: Date,
                    description: 'Thời gian kết thúc chọn phòng'
                }
            },
            allowedBuildings: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'dormitories',
                description: 'Danh sách KTX được phép cho năm 2-3'
            }],
            priority: {
                type: String,
                enum: ['low', 'default', 'medium', 'high'],
                default: 'medium',
                description: 'Mức độ ưu tiên'
            },
            description: {
                type: String,
                default: 'Sinh viên năm 2-3 được tự chọn phòng trong thời gian quy định'
            }
        },

        // Chính sách cho sinh viên năm 4+
        year4_plus: {
            canChooseRoom: {
                type: Boolean,
                default: true,
                description: 'Cho phép sinh viên năm cuối tự chọn phòng'
            },
            specialPriority: {
                type: Boolean,
                default: true,
                description: 'Ưu tiên đặc biệt cho sinh viên năm cuối'
            },
            allowRoomChange: {
                type: Boolean,
                default: true,
                description: 'Cho phép đổi phòng'
            },
            selectionWindow: {
                start: {
                    type: Date,
                    description: 'Thời gian bắt đầu chọn phòng'
                },
                end: {
                    type: Date,
                    description: 'Thời gian kết thúc chọn phòng'
                }
            },
            allowedBuildings: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'dormitories',
                description: 'Danh sách KTX được phép cho năm 4+'
            }],
            priority: {
                type: String,
                enum: ['low', 'default', 'medium', 'high'],
                default: 'high',
                description: 'Mức độ ưu tiên cao nhất'
            },
            description: {
                type: String,
                default: 'Sinh viên năm cuối có quyền ưu tiên cao nhất và có thể đổi phòng'
            }
        }
    },

    // Metadata
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'students',
        description: 'Admin tạo chính sách này'
    },
    notes: {
        type: String,
        description: 'Ghi chú về chính sách'
    }
});

// Index để tìm kiếm nhanh
AcademicPolicySchema.index({ academicYear: 1 });
AcademicPolicySchema.index({ active: 1 });

// Middleware: Update updatedAt khi save
AcademicPolicySchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Methods
AcademicPolicySchema.methods.isSelectionWindowOpen = function(yearGroup) {
    const now = new Date();
    
    let policy;
    if (yearGroup === 1) {
        policy = this.policies.year1;
    } else if (yearGroup === 2) {
        policy = this.policies.year2_3;
    } else {
        policy = this.policies.year4_plus;
    }

    // Nếu không có selection window, coi như luôn mở
    if (!policy.selectionWindow || !policy.selectionWindow.start || !policy.selectionWindow.end) {
        return true;
    }

    return now >= policy.selectionWindow.start && now <= policy.selectionWindow.end;
};

AcademicPolicySchema.methods.getPolicyForYearGroup = function(yearGroup) {
    if (yearGroup === 1) {
        return this.policies.year1;
    } else if (yearGroup === 2) {
        return this.policies.year2_3;
    } else {
        return this.policies.year4_plus;
    }
};

// Static methods
AcademicPolicySchema.statics.getActivePolicy = async function(academicYear) {
    return await this.findOne({ 
        academicYear: academicYear, 
        active: true 
    });
};

AcademicPolicySchema.statics.getCurrentYearPolicy = async function() {
    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${currentYear + 1}`;
    
    return await this.findOne({ 
        academicYear: academicYear, 
        active: true 
    });
};

const AcademicPolicyModel = mongoose.model('AcademicPolicy', AcademicPolicySchema);

module.exports = AcademicPolicyModel;