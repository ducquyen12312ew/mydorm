// src/schemas/MaintenanceRequestSchema.js
const mongoose = require('mongoose');

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
    
    title: {
        type: String,
        required: true,
        minlength: 5,
        maxlength: 200
    },
    
    description: {
        type: String,
        required: true,
        minlength: 10,
        maxlength: 2000
    },
    
    type: {
        type: String,
        required: true,
        enum: [
            'electrical',      // 🔌 Điện
            'plumbing',        // 🚰 Nước
            'hvac',           // ❄️ Điều hòa
            'furniture',      // 🪑 Đồ nội thất
            'door_lock',      // 🔐 Khóa cửa
            'window',         // 🪟 Cửa sổ
            'internet',       // 📡 Internet
            'cleaning',       // 🧹 Vệ sinh
            'pest_control',   // 🐛 Kiểm soát côn trùng
            'other'          // Khác
        ],
        index: true
    },
    
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
        index: true
    },
    
    status: {
        type: String,
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
}, {
    timestamps: true
});

// Indexes
MaintenanceRequestSchema.index({ dormitoryId: 1, status: 1 });
MaintenanceRequestSchema.index({ roomNumber: 1, status: 1 });
MaintenanceRequestSchema.index({ reportedAt: -1 });
MaintenanceRequestSchema.index({ priority: 1, status: 1 });

MaintenanceRequestSchema.pre('validate', function(next) {
    this.updatedAt = new Date();

    if (!this.requestNumber) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.requestNumber = `MR${year}${month}${random}`;
    }

    next();
});

const MaintenanceRequestModel = mongoose.model('maintenance_requests', MaintenanceRequestSchema);

module.exports = {
    MaintenanceRequestModel,
    MaintenanceRequestSchema
};
