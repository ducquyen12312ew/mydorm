/**
 * Script phục hồi tài khoản sinh viên 20259999
 *
 * Hành vi:
 *   - Nếu TÀI KHOẢN CHƯA TỒN TẠI: tạo mới với đầy đủ thông tin
 *   - Nếu TÀI KHOẢN ĐÃ TỒN TẠI:   reset password + cập nhật ký túc xá A1
 *
 * Idempotent: chạy nhiều lần đều an toàn, không ảnh hưởng tài khoản khác.
 *
 * Usage: node scripts/recover-student-20259999.js
 */

'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

// ─── Cấu hình ──────────────────────────────────────────────────────────────
const TARGET_STUDENT_ID = '20259999';
const TARGET_USERNAME   = '20259999';
const PLAIN_PASSWORD    = 'Dquyen12@';
const HASH_ROUNDS       = 10;
const TARGET_DORM_NAME  = 'A1';         // tên ký túc xá cần gán

// ─── Kết nối DB ────────────────────────────────────────────────────────────
const MONGO_URI =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://0.0.0.0:27017/Dormitory';

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
}).catch((err) => {
    console.error('[FATAL] Không thể kết nối MongoDB:', err.message);
    process.exit(1);
});

// ─── Schemas (inline để script tự chạy được độc lập) ───────────────────────
const StudentSchema = new mongoose.Schema({
    name:             { type: String, required: true, trim: true },
    username:         { type: String, required: true, unique: true, trim: true },
    studentId:        { type: String, trim: true, sparse: true },
    email:            { type: String, trim: true, sparse: true },
    phone:            { type: String, trim: true },
    password:         { type: String },
    oauthProvider:    { type: String, default: null },
    oauthId:          { type: String, sparse: true },
    emailVerified:    { type: Boolean, default: false },
    onboardingComplete: { type: Boolean, default: false },
    faculty:          { type: String, trim: true },
    academicYear:     { type: String },
    gender:           { type: String, enum: ['male', 'female', 'other'] },
    nationality:      { type: String, trim: true, default: '' },
    citizenship:      { type: String, trim: true, default: '' },
    country:          { type: String, trim: true, default: '' },
    isInternational:  { type: Boolean, default: false },
    role:             { type: String, enum: ['user', 'admin'], default: 'user' },
    isSuperAdmin:     { type: Boolean, default: false },
    language:         { type: String, default: 'vi' },
    dormitoryId:      { type: mongoose.Schema.Types.ObjectId, ref: 'dormitories' },
    roomNumber:       { type: String },
    priorityScore:    { type: Number, default: 0 },
    priorityDetails:  { type: Object, default: {} },
    favoriteRoomIds:  { type: [{ type: mongoose.Schema.Types.ObjectId }], default: [] },
    createdAt:        { type: Date, default: Date.now },
    updatedAt:        { type: Date, default: Date.now },
});

const DormitorySchema = new mongoose.Schema({
    name:    { type: String },
    address: { type: String },
}, { strict: false });

const Student   = mongoose.model('students',    StudentSchema);
const Dormitory = mongoose.model('dormitories', DormitorySchema);

// ─── Logic chính ───────────────────────────────────────────────────────────
async function run() {
    await mongoose.connection.asPromise();
    console.log('\n========================================');
    console.log(' RECOVER STUDENT ACCOUNT — 20259999');
    console.log('========================================');

    // 1. Tìm ký túc xá A1
    const dorm = await Dormitory.findOne({
        name: { $regex: TARGET_DORM_NAME, $options: 'i' },
    }).lean();

    if (!dorm) {
        console.warn(`\n[WARN] Không tìm thấy ký túc xá có tên chứa "${TARGET_DORM_NAME}".`);
        console.warn('       Tài khoản sẽ được tạo/cập nhật mà KHÔNG gán dormitoryId.\n');
    } else {
        console.log(`\n[INFO] Ký túc xá "${dorm.name}" → _id: ${dorm._id}`);
    }

    // 2. Tìm tài khoản hiện tại (khớp studentId hoặc username)
    const existing = await Student.findOne({
        $or: [
            { studentId: TARGET_STUDENT_ID },
            { username:  TARGET_USERNAME  },
        ],
    });

    // 3. Hash password an toàn
    console.log(`\n[INFO] Đang hash password (${HASH_ROUNDS} rounds)...`);
    const hashedPassword = await bcrypt.hash(PLAIN_PASSWORD, HASH_ROUNDS);

    if (existing) {
        // ── Tài khoản ĐÃ TỒN TẠI → update ──────────────────────────────
        console.log(`\n[FOUND] Tài khoản đã tồn tại:`);
        console.log(`        _id:       ${existing._id}`);
        console.log(`        username:  ${existing.username}`);
        console.log(`        studentId: ${existing.studentId || '(chưa có)'}`);
        console.log(`        name:      ${existing.name}`);

        const updatePayload = {
            password:  hashedPassword,
            updatedAt: new Date(),
        };
        if (dorm) {
            updatePayload.dormitoryId = dorm._id;
        }

        await Student.updateOne({ _id: existing._id }, { $set: updatePayload });

        console.log('\n[OK] Đã cập nhật thành công:');
        console.log('     ✔ password reset  → Dquyen12@');
        if (dorm) {
            console.log(`     ✔ dormitoryId    → ${dorm._id} (${dorm.name})`);
        }

    } else {
        // ── Tài khoản CHƯA TỒN TẠI → tạo mới ───────────────────────────
        console.log('\n[NOT FOUND] Tài khoản chưa tồn tại. Đang tạo mới...');

        const newStudent = new Student({
            name:       'Sinh viên 20259999',
            username:   TARGET_USERNAME,
            studentId:  TARGET_STUDENT_ID,
            password:   hashedPassword,
            email:      `${TARGET_STUDENT_ID}@sis.hust.edu.vn`,
            faculty:    'Viện CNTT & TT',
            academicYear: '2025',
            gender:     'male',
            role:       'user',
            language:   'vi',
            ...(dorm ? { dormitoryId: dorm._id } : {}),
        });

        await newStudent.save();

        console.log('\n[OK] Tạo tài khoản mới thành công:');
        console.log(`     _id:       ${newStudent._id}`);
        console.log(`     username:  ${newStudent.username}`);
        console.log(`     studentId: ${newStudent.studentId}`);
        console.log(`     name:      ${newStudent.name}`);
        if (dorm) {
            console.log(`     dormitory: ${dorm.name} (${dorm._id})`);
        }
    }

    console.log('\n----------------------------------------');
    console.log(' Thông tin đăng nhập:');
    console.log(`   Student ID / Username : ${TARGET_STUDENT_ID}`);
    console.log(`   Password              : ${PLAIN_PASSWORD}`);
    if (dorm) {
        console.log(`   Ký túc xá             : ${dorm.name}`);
    }
    console.log('----------------------------------------\n');
}

// ─── Entry point ───────────────────────────────────────────────────────────
run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\n[ERROR]', err.message);
        if (err.code === 11000) {
            console.error('[HINT]  Duplicate key — kiểm tra lại studentId hoặc username trùng lặp.');
        }
        process.exit(1);
    });
