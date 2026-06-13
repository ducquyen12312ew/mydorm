require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

mongoose.connect(process.env.MONGO_URI || 'mongodb://0.0.0.0:27017/Dormitory', {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
});

mongoose.connection.on('connected', () => console.log('MongoDB connected'));
mongoose.connection.on('error', (err) => { console.error(err.message); process.exit(1); });

const Student = mongoose.model('students', new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    studentId: { type: String, trim: true, sparse: true },
    email: { type: String, trim: true, sparse: true },
    phone: { type: String, trim: true },
    password: { type: String, required: true },
    faculty: { type: String, trim: true },
    academicYear: { type: String },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isSuperAdmin: { type: Boolean, default: false },
    isSimulationAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}));

async function createAdmintest() {
    try {
        await mongoose.connection.asPromise();

        const existing = await Student.findOne({ username: 'admintest' });

        if (existing) {
            if (!existing.isSimulationAdmin) {
                await Student.updateOne({ _id: existing._id }, {
                    role: 'admin',
                    isSimulationAdmin: true
                });
                console.log('\nisSimulationAdmin flag updated for existing admintest account.');
            }
            console.log('\nTai khoan admintest da ton tai!');
            console.log('Username: admintest');
            console.log('Password: Dquyen12@');
            console.log('Role: admin');
            console.log('isSimulationAdmin: true\n');
        } else {
            const hashedPassword = await bcrypt.hash('Dquyen12@', 10);

            await Student.create({
                name: 'Admin Test',
                username: 'admintest',
                studentId: 'ADMINTEST001',
                email: 'admintest@edorm.local',
                phone: '0000000000',
                password: hashedPassword,
                gender: 'other',
                academicYear: '2024',
                role: 'admin',
                isSuperAdmin: false,
                isSimulationAdmin: true
            });

            console.log('\nTao tai khoan admintest thanh cong!');
            console.log('Username: admintest');
            console.log('Password: Dquyen12@');
            console.log('Role: admin');
            console.log('isSimulationAdmin: true\n');
        }

        process.exit(0);
    } catch (error) {
        console.error('\nLoi khi tao admintest:', error.message);
        process.exit(1);
    }
}

setTimeout(createAdmintest, 1000);
