const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

mongoose.connect('mongodb://0.0.0.0:27017/Dormitory', {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
});

mongoose.connection.on('connected', () => {
    console.log('Ket noi MongoDB thanh cong');
});

mongoose.connection.on('error', (err) => {
    console.error('Loi ket noi MongoDB:', err.message);
    process.exit(1);
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

const Student = mongoose.model('students', StudentSchema);

async function createAdmin() {
    try {
        await mongoose.connection.asPromise();
        
        const existingAdmin = await Student.findOne({ 
            $or: [
                { email: 'admin@gmail.com' },
                { username: 'admin' }
            ]
        });
        
        if (existingAdmin) {
            console.log('\nTai khoan admin da ton tai!');
            console.log('Username: admin');
            console.log('Email: admin@gmail.com');
            console.log('Password: admin123\n');
        } else {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            
            const admin = new Student({
                name: 'Administrator',
                username: 'admin',
                studentId: 'ADMIN001',
                email: 'admin@gmail.com',
                phone: '0123456789',
                password: hashedPassword,
                gender: 'other',
                academicYear: '2024',
                role: 'admin'
            });
            
            await admin.save();
            
            console.log('\nTao tai khoan admin thanh cong!');
            console.log('Username: admin');
            console.log('Email: admin@gmail.com');
            console.log('Password: admin123\n');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('\nLoi khi tao admin:', error.message);
        process.exit(1);
    }
}

setTimeout(() => {
    createAdmin();
}, 2000);