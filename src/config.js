const mongoose = require('mongoose');
const connect = mongoose.connect("mongodb://0.0.0.0:27017/Dormitory");

connect.then(() => {
    console.log("Database Connected Successfully");
})
.catch(() => {
    console.log("Database cannot be Connected");
})

// Schema cho thông tin đăng nhập
const Loginschema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    }
});

// Schema cho người ở trong phòng
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

// Schema cho thông tin phòng
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

// Schema cho ký túc xá
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
            type: [Number], // [longitude, latitude]
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

const UserCollection = mongoose.model("users", Loginschema);
const DormitoryCollection = mongoose.model("dormitories", DormitorySchema);
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
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const PendingApplicationCollection = mongoose.model("pendingApplications", PendingApplicationSchema);
module.exports = { 
    UserCollection, 
    DormitoryCollection,
    PendingApplicationCollection 
};