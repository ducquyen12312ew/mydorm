'use strict';

/**
 * Creates the permanent protected test account (MSSV 99999999 / Phan Đức Quyền).
 * Safe to run multiple times — skips creation if account already exists.
 * This account has isProtected: true and will never be deleted by seed/reset scripts.
 *
 * Run: node scripts/create-protected-test-user.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
    console.error('ERROR: MONGO_URI not set in .env');
    process.exit(1);
}

const PROTECTED_USER = {
    name: 'Phan Đức Quyền',
    username: '99999999',
    studentId: '99999999',
    email: '99999999@student.edorm.vn',
    password: 'Dquyen12@',
    role: 'user',
    isProtected: true,
    isActive: true,
    nationality: 'VN',
    citizenship: 'VN',
    country: 'VN',
    isInternational: false,
    gender: 'male',
    faculty: 'Công nghệ thông tin',
    academicYear: '2025',
    enrollmentYear: 2025,
    language: 'vi',
    emailVerified: true,
    onboardingComplete: true,
    priorityScore: 0,
    priorityDetails: {},
    favoriteRoomIds: []
};

async function run() {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 20000 });
    const db = mongoose.connection.db;

    const existing = await db.collection('students').findOne({ studentId: '99999999' });
    if (existing) {
        // Ensure protection flag is set even if account was created before this field existed
        if (!existing.isProtected) {
            await db.collection('students').updateOne(
                { studentId: '99999999' },
                { $set: { isProtected: true } }
            );
            console.log('✅ Found existing account — updated isProtected: true');
        } else {
            console.log('✅ Protected test account already exists — no action needed');
            console.log(`   Name:     ${existing.name}`);
            console.log(`   MSSV:     ${existing.studentId}`);
            console.log(`   Username: ${existing.username}`);
            console.log(`   Email:    ${existing.email}`);
        }
        await mongoose.disconnect();
        return;
    }

    const hashedPassword = await bcrypt.hash(PROTECTED_USER.password, 10);

    await db.collection('students').insertOne({
        ...PROTECTED_USER,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    console.log('✅ Protected test account created successfully');
    console.log('');
    console.log('   Name:     Phan Đức Quyền');
    console.log('   MSSV:     99999999');
    console.log('   Username: 99999999');
    console.log('   Email:    99999999@student.edorm.vn');
    console.log('   Password: Dquyen12@');
    console.log('   Role:     user');
    console.log('   Protected: true (will never be deleted by any script)');

    await mongoose.disconnect();
}

run().catch(err => {
    console.error('FATAL ERROR:', err.message);
    process.exit(1);
});
