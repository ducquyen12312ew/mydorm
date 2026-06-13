/**
 * Seed 100 HUST student accounts with @sis.hust.edu.vn emails
 * Email format: [given_name_no_accent].[initials_family_middle][mssv]@sis.hust.edu.vn
 * Run: npm run seed:hust-students
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://0.0.0.0:27017/Dormitory';

// Vietnamese name data
const familyNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
    'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Trịnh', 'Tô', 'Đoàn'];

const maleMiddleNames = ['Văn', 'Đức', 'Minh', 'Quốc', 'Hữu', 'Công', 'Bá', 'Thành', 'Tuấn', 'Anh',
    'Duy', 'Quang', 'Hùng', 'Khoa', 'Phú', 'Tiến', 'Trọng', 'Thế', 'Xuân', 'Đình'];

const femaleMiddleNames = ['Thị', 'Thanh', 'Thu', 'Minh', 'Phương', 'Lan', 'Anh', 'Hương', 'Mai', 'Ngọc',
    'Thùy', 'Hà', 'Hoa', 'Yến', 'Linh', 'Tuyết', 'Kim', 'Diệu', 'Ánh', 'Bảo'];

const maleGivenNames = ['Quân', 'Hưng', 'Nam', 'Hải', 'Long', 'Tú', 'Kiên', 'Đạt', 'Toàn', 'Cường',
    'Phong', 'Nghĩa', 'Thắng', 'Lâm', 'Khôi', 'Bình', 'Tài', 'Hiếu', 'Dũng', 'Vũ',
    'Hoàng', 'Quý', 'Việt', 'An', 'Hào', 'Trí', 'Sơn', 'Giang', 'Khang', 'Huy'];

const femaleGivenNames = ['Linh', 'Hà', 'Anh', 'Trang', 'Hương', 'Thảo', 'Ngọc', 'Phương', 'Yến', 'Mai',
    'Khánh', 'Vy', 'Ly', 'Quỳnh', 'Châu', 'Nhung', 'Giang', 'Tú', 'Thư', 'Nhi',
    'Trâm', 'Phương', 'Diệu', 'Huyền', 'Ánh', 'Hiền', 'Loan', 'Thương', 'Ngân', 'Bích'];

const faculties = [
    'Viện Công nghệ Thông tin và Truyền thông',
    'Viện Điện',
    'Viện Điện tử - Viễn thông',
    'Viện Cơ khí',
    'Viện Kỹ thuật Hóa học',
    'Viện Vật lý Kỹ thuật',
    'Viện Toán ứng dụng và Tin học',
    'Viện Kinh tế và Quản lý'
];

// Remove Vietnamese accents
const accentMap = {
    'à':'a','á':'a','ả':'a','ã':'a','ạ':'a',
    'ă':'a','ắ':'a','ằ':'a','ẳ':'a','ẵ':'a','ặ':'a',
    'â':'a','ấ':'a','ầ':'a','ẩ':'a','ẫ':'a','ậ':'a',
    'è':'e','é':'e','ẻ':'e','ẽ':'e','ẹ':'e',
    'ê':'e','ế':'e','ề':'e','ể':'e','ễ':'e','ệ':'e',
    'ì':'i','í':'i','ỉ':'i','ĩ':'i','ị':'i',
    'ò':'o','ó':'o','ỏ':'o','õ':'o','ọ':'o',
    'ô':'o','ố':'o','ồ':'o','ổ':'o','ỗ':'o','ộ':'o',
    'ơ':'o','ớ':'o','ờ':'o','ở':'o','ỡ':'o','ợ':'o',
    'ù':'u','ú':'u','ủ':'u','ũ':'u','ụ':'u',
    'ư':'u','ứ':'u','ừ':'u','ử':'u','ữ':'u','ự':'u',
    'ỳ':'y','ý':'y','ỷ':'y','ỹ':'y','ỵ':'y',
    'đ':'d',
    'À':'a','Á':'a','Ả':'a','Ã':'a','Ạ':'a',
    'Ă':'a','Ắ':'a','Ằ':'a','Ẳ':'a','Ẵ':'a','Ặ':'a',
    'Â':'a','Ấ':'a','Ầ':'a','Ẩ':'a','Ẫ':'a','Ậ':'a',
    'È':'e','É':'e','Ẻ':'e','Ẽ':'e','Ẹ':'e',
    'Ê':'e','Ế':'e','Ề':'e','Ể':'e','Ễ':'e','Ệ':'e',
    'Ì':'i','Í':'i','Ỉ':'i','Ĩ':'i','Ị':'i',
    'Ò':'o','Ó':'o','Ỏ':'o','Õ':'o','Ọ':'o',
    'Ô':'o','Ố':'o','Ồ':'o','Ổ':'o','Ỗ':'o','Ộ':'o',
    'Ơ':'o','Ớ':'o','Ờ':'o','Ở':'o','Ỡ':'o','Ợ':'o',
    'Ù':'u','Ú':'u','Ủ':'u','Ũ':'u','Ụ':'u',
    'Ư':'u','Ứ':'u','Ừ':'u','Ử':'u','Ữ':'u','Ự':'u',
    'Ỳ':'y','Ý':'y','Ỷ':'y','Ỹ':'y','Ỵ':'y',
    'Đ':'d'
};

function removeAccents(str) {
    return str.split('').map(c => accentMap[c] || c).join('').toLowerCase();
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateEmail(family, middles, given, mssv) {
    const givenNoAccent = removeAccents(given);
    // Take first letters of family + middle names
    const familyInitial = removeAccents(family)[0];
    const middleInitials = middles.map(m => removeAccents(m)[0]).join('');
    return `${givenNoAccent}.${familyInitial}${middleInitials}${mssv}@sis.hust.edu.vn`;
}

async function seed() {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log('Connected to MongoDB');

    // Load StudentCollection directly (avoid circular issues with full config)
    const StudentSchema = new mongoose.Schema({
        name: { type: String, required: true },
        username: { type: String, required: true, unique: true },
        studentId: { type: String, sparse: true },
        email: { type: String, sparse: true },
        phone: String,
        password: { type: String, required: false },
        oauthProvider: { type: String, default: null },
        oauthId: { type: String, sparse: true },
        emailVerified: { type: Boolean, default: false },
        onboardingComplete: { type: Boolean, default: false },
        faculty: String,
        academicYear: String,
        gender: { type: String, enum: ['male', 'female', 'other'] },
        role: { type: String, default: 'user' },
        priorityScore: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now }
    }, { strict: false });

    const Student = mongoose.models.students || mongoose.model('students', StudentSchema);

    const BATCH_SIZE = 100;
    const startMssv = 230001;
    const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 8);

    const students = [];
    const usedEmails = new Set();
    let mssv = startMssv;
    let created = 0;

    while (created < BATCH_SIZE) {
        const gender = Math.random() > 0.45 ? 'male' : 'female';
        const family = pickRandom(familyNames);
        const middleCount = Math.random() > 0.3 ? 1 : 2;
        const middlePool = gender === 'male' ? maleMiddleNames : femaleMiddleNames;
        const middles = Array.from({ length: middleCount }, () => pickRandom(middlePool));
        const given = pickRandom(gender === 'male' ? maleGivenNames : femaleGivenNames);
        const fullName = `${family} ${middles.join(' ')} ${given}`;
        const mssvStr = String(mssv);
        const email = generateEmail(family, middles, given, mssvStr);

        // Ensure email uniqueness in this batch
        if (usedEmails.has(email)) {
            mssv++;
            continue;
        }
        usedEmails.add(email);

        const academicYear = String(2020 + Math.floor((mssv - 230001) / 30));

        students.push({
            name: fullName,
            username: email,
            email,
            studentId: mssvStr,
            password: randomHash,
            faculty: pickRandom(faculties),
            academicYear,
            gender,
            phone: `09${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
            role: 'user',
            emailVerified: true,
            onboardingComplete: true,
            priorityScore: Math.floor(Math.random() * 30),
            createdAt: new Date()
        });

        mssv++;
        created++;
    }

    let inserted = 0;
    let skipped = 0;

    for (const s of students) {
        try {
            const exists = await Student.findOne({ $or: [{ email: s.email }, { studentId: s.studentId }] });
            if (exists) { skipped++; continue; }
            await Student.create(s);
            inserted++;
        } catch (e) {
            if (e.code === 11000) { skipped++; } else { console.error('Error:', e.message); }
        }
    }

    console.log(`\nSeed complete: ${inserted} inserted, ${skipped} skipped (already exist)`);
    console.log('Sample accounts:');
    students.slice(0, 5).forEach(s => console.log(`  ${s.studentId}  ${s.email}  (${s.name})`));

    await mongoose.disconnect();
}

seed().catch(e => {
    console.error('Seed failed:', e.message);
    process.exit(1);
});
