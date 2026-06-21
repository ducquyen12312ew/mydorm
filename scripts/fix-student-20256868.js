/**
 * One-shot fix: write dormitoryId + roomNumber from approved application back to student 20256868.
 * Run once: node scripts/fix-student-20256868.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://0.0.0.0:27017/Dormitory';

async function main() {
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;

    const STUDENT_ID = '20256868';

    // Find the approved application for this student
    const app = await db.collection('pendingapplications').findOne(
        { studentId: STUDENT_ID, status: 'approved' },
        { sort: { updatedAt: -1 } }
    );

    if (!app) {
        console.error('No approved application found for student', STUDENT_ID);
        process.exit(1);
    }

    console.log('Found application:', {
        _id: app._id,
        dormitoryId: app.dormitoryId,
        dormitoryName: app.dormitoryName,
        roomNumber: app.roomNumber,
        status: app.status,
    });

    const result = await db.collection('students').findOneAndUpdate(
        { studentId: STUDENT_ID },
        {
            $set: {
                dormitoryId: app.dormitoryId,
                roomNumber: app.roomNumber,
                registrationStatus: 'approved',
                updatedAt: new Date(),
            }
        },
        { returnDocument: 'after' }
    );

    if (!result) {
        console.error('Student not found:', STUDENT_ID);
        process.exit(1);
    }

    console.log('Student updated:', {
        studentId: result.studentId,
        dormitoryId: result.dormitoryId,
        roomNumber: result.roomNumber,
        registrationStatus: result.registrationStatus,
    });

    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
