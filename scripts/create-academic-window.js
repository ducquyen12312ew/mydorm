const mongoose = require('mongoose');
require('dotenv').config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dormitoryDB';

const AcademicWindowSchema = new mongoose.Schema({
    academicYear: {
        type: String,
        required: true
    },
    semester: {
        type: String,
        enum: ['fall', 'spring', 'summer'],
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['upcoming', 'active', 'closed'],
        default: 'upcoming'
    },
    allowedAcademicYears: {
        type: [String],
        default: ['1', '2', '3', '4', '5', '6'],
        enum: ['1', '2', '3', '4', '5', '6', 'all']
    },
    description: {
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

const AcademicWindowCollection = mongoose.model('academic_windows', AcademicWindowSchema);

async function createAcademicWindow() {
    try {
        await mongoose.connect(mongoURI);
        console.log('Connected to MongoDB');

        // Check if there's already an active window
        const existingActive = await AcademicWindowCollection.findOne({ status: 'active' });
        
        if (existingActive) {
            console.log('Found existing active window:');
            console.log('  Academic Year:', existingActive.academicYear);
            console.log('  Semester:', existingActive.semester);
            console.log('  Start Date:', existingActive.startDate);
            console.log('  End Date:', existingActive.endDate);
            console.log('  Allowed Years:', existingActive.allowedAcademicYears);
            console.log('\nNo need to create a new one.');
        } else {
            // Create a new active registration window
            const now = new Date();
            const threeMonthsLater = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
            
            const newWindow = new AcademicWindowCollection({
                academicYear: '2025-2026',
                semester: 'spring',
                startDate: now,
                endDate: threeMonthsLater,
                status: 'active',
                allowedAcademicYears: ['1', '2', '3', '4', '5', '6'],
                description: 'Đợt đăng ký KTX học kỳ xuân 2025-2026'
            });

            await newWindow.save();
            console.log('✓ Created new active academic window:');
            console.log('  Academic Year:', newWindow.academicYear);
            console.log('  Semester:', newWindow.semester);
            console.log('  Start Date:', newWindow.startDate);
            console.log('  End Date:', newWindow.endDate);
            console.log('  Status:', newWindow.status);
            console.log('  Allowed Years:', newWindow.allowedAcademicYears);
        }

        await mongoose.connection.close();
        console.log('\nDone! Registration should now be open.');
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createAcademicWindow();
