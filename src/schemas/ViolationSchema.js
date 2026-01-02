// src/schemas/ViolationSchema.js
const mongoose = require('mongoose');

const ViolationSchema = new mongoose.Schema({
    studentId: {
        type: String,
        required: true,
        index: true
    },
    studentObjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'students'
    },
    studentName: {
        type: String,
        required: true
    },
    dormitoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'dormitories'
    },
    dormitoryName: String,
    roomNumber: String,
    
    type: {
        type: String,
        required: true,
        enum: [
            'noise', // Ồn ào
            'alcohol', // Rượu bia
            'smoking', // Hút thuốc
            'late_return', // Về muộn
            'unauthorized_guest', // Khách không phép
            'damage', // Hư hỏng tài sản
            'hygiene', // Vi phạm vệ sinh
            'theft', // Trộm cắp
            'violence', // Bạo lực
            'other' // Khác
        ],
        index: true
    },
    
    description: {
        type: String,
        required: true,
        maxlength: 2000
    },
    
    severity: {
        type: String,
        required: true,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
        index: true
    },
    
    status: {
        type: String,
        required: true,
        enum: ['pending', 'investigating', 'resolved', 'dismissed'],
        default: 'pending',
        index: true
    },
    
    evidenceUrls: [{
        type: String
    }],
    
    reportedBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'students',
            required: true
        },
        name: String,
        role: {
            type: String,
            enum: ['admin', 'staff', 'student']
        }
    },
    
    reportedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    resolvedBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'students'
        },
        name: String
    },
    
    resolvedAt: Date,
    
    resolution: {
        action: {
            type: String,
            enum: ['warning', 'fine', 'suspension', 'expulsion', 'dismissed']
        },
        notes: String,
        fineAmount: Number
    },
    
    investigationNotes: [{
        addedBy: {
            userId: mongoose.Schema.Types.ObjectId,
            name: String
        },
        note: String,
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes for performance
ViolationSchema.index({ studentId: 1, status: 1 });
ViolationSchema.index({ dormitoryId: 1, status: 1 });
ViolationSchema.index({ reportedAt: -1 });
ViolationSchema.index({ severity: 1, status: 1 });

// Pre-save hook
ViolationSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Virtual for violation count per student
ViolationSchema.statics.getStudentViolationCount = async function(studentId) {
    const result = await this.aggregate([
        { $match: { studentId, status: { $ne: 'dismissed' } } },
        { 
            $group: {
                _id: '$severity',
                count: { $sum: 1 }
            }
        }
    ]);
    return result;
};

const ViolationModel = mongoose.model('violations', ViolationSchema);

// ============================================
// MAINTENANCE REQUEST SCHEMA
// ============================================

const MaintenanceRequestSchema = new mongoose.Schema({
    requestNumber: {
        type: String,
        unique: true,
        required: true
    },
    
    dormitoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'dormitories',
        required: true,
        index: true
    },
    
    dormitoryName: {
        type: String,
        required: true
    },
    
    floorNumber: {
        type: Number,
        required: true
    },
    
    roomNumber: {
        type: String,
        required: true,
        index: true
    },
    
    type: {
        type: String,
        required: true,
        enum: [
            'electrical', // Điện
            'plumbing', // Nước
            'hvac', // Điều hòa
            'furniture', // Nội thất
            'door_lock', // Cửa/khóa
            'window', // Cửa sổ
            'internet', // Mạng internet
            'cleaning', // Vệ sinh
            'pest_control', // Diệt côn trùng
            'other' // Khác
        ],
        index: true
    },
    
    title: {
        type: String,
        required: true,
        maxlength: 200
    },
    
    description: {
        type: String,
        required: true,
        maxlength: 2000
    },
    
    priority: {
        type: String,
        required: true,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
        index: true
    },
    
    status: {
        type: String,
        required: true,
        enum: ['submitted', 'assigned', 'in_progress', 'completed', 'cancelled'],
        default: 'submitted',
        index: true
    },
    
    imageUrls: [{
        type: String
    }],
    
    reportedBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'students',
            required: true
        },
        name: String,
        studentId: String,
        phone: String
    },
    
    reportedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    assignedTo: {
        staffId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'students'
        },
        name: String,
        phone: String
    },
    
    assignedBy: {
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'students'
        },
        name: String
    },
    
    assignedAt: Date,
    
    startedAt: Date,
    
    completedAt: Date,
    
    estimatedCost: {
        type: Number,
        min: 0
    },
    
    actualCost: {
        type: Number,
        min: 0
    },
    
    completionNotes: String,
    
    feedbackRating: {
        type: Number,
        min: 1,
        max: 5
    },
    
    feedbackComment: String,
    
    updates: [{
        addedBy: {
            userId: mongoose.Schema.Types.ObjectId,
            name: String,
            role: String
        },
        message: String,
        imageUrls: [String],
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes
MaintenanceRequestSchema.index({ dormitoryId: 1, status: 1 });
MaintenanceRequestSchema.index({ roomNumber: 1, status: 1 });
MaintenanceRequestSchema.index({ reportedAt: -1 });
MaintenanceRequestSchema.index({ priority: 1, status: 1 });

// Pre-save hook
MaintenanceRequestSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    
    // Auto-generate request number if not exists
    if (!this.requestNumber) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.requestNumber = `MR${year}${month}${random}`;
    }
    
    next();
});

// Static methods
MaintenanceRequestSchema.statics.getStatsByStatus = async function(dormitoryId = null) {
    const match = dormitoryId ? { dormitoryId } : {};
    
    const result = await this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);
    
    return result;
};

MaintenanceRequestSchema.statics.getStatsByPriority = async function(dormitoryId = null) {
    const match = dormitoryId ? { dormitoryId } : {};
    
    const result = await this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$priority',
                count: { $sum: 1 }
            }
        }
    ]);
    
    return result;
};

const MaintenanceRequestModel = mongoose.model('maintenanceRequests', MaintenanceRequestSchema);

module.exports = {
    ViolationModel,
    MaintenanceRequestModel
};