const mongoose = require('mongoose');

mongoose.connect('mongodb://0.0.0.0:27017/Dormitory', {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
});

mongoose.connection.on('connected', () => {
    console.log('Database Connected Successfully');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

const StudentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    studentId: {
        type: String,
        trim: true,
        sparse: true
    },
    email: {
        type: String,
        trim: true,
        sparse: true
    },
    phone: {
        type: String,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    faculty: {
        type: String,
        trim: true
    },
    academicYear: {
        type: String
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other']
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    dormitoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'dormitories'
    },
    roomNumber: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const OccupantSchema = new mongoose.Schema({
    studentId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    phone: {
        type: String
    },
    email: {
        type: String
    },
    checkInDate: {
        type: Date,
        default: Date.now
    },
    active: {
        type: Boolean,
        default: true
    }
});

const RoomSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: true,
        trim: true
    },
    roomType: {
        type: String,
        enum: ['8-person', '4-person-service', '5-person', '10-person'],
        required: true
    },
    maxCapacity: {
        type: Number,
        required: true,
        min: 1
    },
    floor: {
        type: Number,
        required: true
    },
    pricePerMonth: {
        type: Number,
        required: true
    },
    amenities: {
        type: [String],
        default: []
    },
    description: {
        type: String,
        default: ''
    },
    imageUrl: {
        type: String,
        default: ''
    },
    occupants: {
        type: [OccupantSchema],
        default: []
    }
});

RoomSchema.virtual('currentOccupants').get(function() {
    return this.occupants ? this.occupants.filter(o => o.active).length : 0;
});

RoomSchema.virtual('available').get(function() {
    return this.occupants.filter(o => o.active).length < this.maxCapacity;
});

const FloorSchema = new mongoose.Schema({
    floorNumber: {
        type: Number,
        required: true
    },
    rooms: [RoomSchema]
});

const DormitorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    contact: {
        phone: {
            type: String,
            trim: true
        },
        email: {
            type: String,
            trim: true
        }
    },
    details: {
        type: {
            type: String,
            enum: ['school', 'private'],
            required: true
        },
        category: {
            type: String,
            enum: ['basic', 'premium', 'international'],
            required: true
        },
        totalFloors: {
            type: Number,
            required: true,
            min: 1
        },
        amenities: {
            type: [String],
            default: []
        },
        priceRange: {
            min: {
                type: Number,
                required: true
            },
            max: {
                type: Number,
                required: true
            }
        },
        available: {
            type: Boolean,
            default: true
        }
    },
    floors: [FloorSchema],
    imageUrl: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

DormitorySchema.index({ location: '2dsphere' });
DormitorySchema.index({ name: 1 }, { unique: true });

DormitorySchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    
    if (this.floors && this.floors.length > 0) {
        this.details.totalFloors = this.floors.length;
    } else if (!this.details.totalFloors) {
        this.details.totalFloors = 1;
    }
    
    let prices = [];
    
    if (this.floors && this.floors.length > 0) {
        this.floors.forEach(floor => {
            if (floor.rooms && floor.rooms.length > 0) {
                floor.rooms.forEach(room => {
                    prices.push(room.pricePerMonth);
                });
            }
        });
    }
    
    if (prices.length > 0) {
        this.details.priceRange.min = Math.min(...prices);
        this.details.priceRange.max = Math.max(...prices);
    }
    
    next();
});

const PendingApplicationSchema = new mongoose.Schema({
    studentId: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    faculty: {
        type: String
    },
    academicYear: {
        type: String
    },
    gender: {
        type: String,
        enum: ['male', 'female']
    },
    dormitoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'dormitories',
        required: true
    },
    dormitoryName: {
        type: String
    },
    roomNumber: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    comments: {
        type: String
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'students'
    },
    approvedAt: {
        type: Date
    },
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'students'
    },
    rejectedAt: {
        type: Date
    },
    rejectionReason: {
        type: String
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const NotificationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['success', 'warning', 'info', 'error'],
        default: 'info'
    },
    targetUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'students'
    }],
    targetRole: {
        type: String,
        enum: ['all', 'user', 'admin'],
        default: 'all'
    },
    isGlobal: {
        type: Boolean,
        default: false
    },
    readBy: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'students'
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'students',
        required: true
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high'],
        default: 'normal'
    },
    expiresAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const ActivityLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'students',
        required: true
    },
    action: {
        type: String,
        required: true,
        enum: [
            'register_success', 
            'register_failed', 
            'payment_success', 
            'payment_failed',
            'room_assigned',
            'room_changed',
            'profile_updated',
            'login',
            'logout',
            'application_approved',  
            'application_rejected',  
            'password_changed',
            'registration_approved',
            'registration_rejected'
        ]
    },
    description: {
        type: String,
        required: true
    },
    details: {
        type: mongoose.Schema.Types.Mixed
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const StudentCollection = mongoose.model('students', StudentSchema);
const DormitoryCollection = mongoose.model('dormitories', DormitorySchema);
const PendingApplicationCollection = mongoose.model('pendingApplications', PendingApplicationSchema);
const NotificationCollection = mongoose.model('notifications', NotificationSchema);
const ActivityLogCollection = mongoose.model('activity_logs', ActivityLogSchema);

module.exports = { 
    StudentCollection, 
    DormitoryCollection,
    PendingApplicationCollection,
    NotificationCollection,
    ActivityLogCollection
};