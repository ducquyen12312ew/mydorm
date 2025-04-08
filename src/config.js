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
    currentOccupants: {
        type: Number,
        default: 0,
        min: 0
    },
    pricePerMonth: {
        type: Number,
        required: true
    },
    floor: {
        type: Number,
        required: true
    },
    available: {
        type: Boolean,
        default: true
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
    }
});

// Schema cho thông tin ký túc xá
const DormitorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
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
        totalCapacity: {
            type: Number,
            default: 0
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
    rooms: [RoomSchema], // Mảng các phòng trong ký túc xá
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

// Tạo index cho tọa độ vị trí để tìm kiếm dựa trên vị trí
DormitorySchema.index({ location: '2dsphere' });

// Middleware để cập nhật thời gian khi cập nhật dữ liệu
DormitorySchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    
    // Tính toán lại tổng sức chứa từ các phòng
    if (this.rooms && this.rooms.length > 0) {
        this.details.totalCapacity = this.rooms.reduce((total, room) => total + room.maxCapacity, 0);
    }
    
    // Cập nhật lại giá min/max dựa trên giá phòng
    if (this.rooms && this.rooms.length > 0) {
        const prices = this.rooms.map(room => room.pricePerMonth);
        this.details.priceRange.min = Math.min(...prices);
        this.details.priceRange.max = Math.max(...prices);
    }
    
    next();
});
// Model cho thông tin đăng nhập
const UserCollection = mongoose.model("users", Loginschema);

// Model cho thông tin ký túc xá
const DormitoryCollection = mongoose.model("dormitories", DormitorySchema);

module.exports = { UserCollection, DormitoryCollection };