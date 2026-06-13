/*
 * Seed 360 sample students with realistic Vietnamese names and HUST data.
 * Usage: node scripts/seed-sample-students.js
 *
 * Distribution by enrollment year (academicYear):
 * - 2025 (year 1): 140 (38%)
 * - 2024 (year 2): 100 (27%)
 * - 2023 (year 3):  65 (18%)
 * - 2022 (year 4):  35  (9%)
 * - 2021 (year 5):  10  (3%)
 * - 2020 (year 6):  10  (3%)
 * Total: 360 students
 */

const bcrypt = require('bcrypt');
const { StudentCollection } = require('../src/config/config');

// Configuration
const PASSWORD_PLAIN = 'Passw0rd!';
const PASSWORD_HASH_ROUNDS = 10;

const FACULTIES = [
    'Viện CNTT & TT',
    'Viện Điện',
    'Viện Điện tử - Viễn thông',
    'Viện Cơ khí',
    'Viện Hóa học',
    'Viện Vật lý KT',
    'Viện Toán ứng dụng',
    'Viện Kinh tế & QL',
    'Khoa Ngoại ngữ',
    'Viện Kỹ thuật Hạt nhân',
    'Viện Môi trường',
];

const GENDERS = ['male', 'female'];

const FAMILY_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ'];
const GIVEN_NAMES_MALE = ['Nam', 'Hưng', 'Minh', 'Tuấn', 'Đức', 'Khoa', 'Dũng', 'Quân', 'Long', 'Tùng', 'Việt', 'Cường', 'Thắng', 'Bình', 'Lâm'];
const GIVEN_NAMES_FEMALE = ['Linh', 'Anh', 'Thảo', 'Phương', 'Mai', 'Hoa', 'Trang', 'Ngọc', 'Hương', 'Thu', 'Lan', 'Hà', 'Ly', 'Yến', 'Quỳnh'];
const MIDDLE_NAMES_MALE = ['Văn', 'Đình', 'Xuân', 'Quốc', 'Đức', 'Hữu', 'Công'];
const MIDDLE_NAMES_FEMALE = ['Thị', 'Ngọc', 'Thanh', 'Bảo', 'Kim'];

const PROVINCES = [
    'Hà Nội', 'Hải Phòng', 'Hải Dương', 'Nam Định', 'Thái Bình',
    'Nghệ An', 'Thanh Hóa', 'Quảng Ninh', 'Lạng Sơn', 'Hà Giang',
    'Cao Bằng', 'Lào Cai', 'Điện Biên', 'Sơn La', 'Hòa Bình',
    'Cần Thơ', 'TP HCM', 'Đà Nẵng', 'Huế', 'Nha Trang',
];

// Distribution by year
const YEAR_DISTRIBUTION = [
    { year: 2025, count: 140, suffixLength: 5 },
    { year: 2024, count: 100, suffixLength: 5 },
    { year: 2023, count: 65,  suffixLength: 4 },
    { year: 2022, count: 35,  suffixLength: 4 },
    { year: 2021, count: 10,  suffixLength: 4 },
    { year: 2020, count: 10,  suffixLength: 4 },
];

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateUniqueSuffixes(count, length) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    const set = new Set();
    while (set.size < count) {
        set.add(randomInt(min, max));
    }
    return Array.from(set);
}

function generateVietnameseName(gender) {
    const family = randomChoice(FAMILY_NAMES);
    if (gender === 'male') {
        const middle = randomChoice(MIDDLE_NAMES_MALE);
        const given  = randomChoice(GIVEN_NAMES_MALE);
        return `${family} ${middle} ${given}`;
    } else {
        const middle = randomChoice(MIDDLE_NAMES_FEMALE);
        const given  = randomChoice(GIVEN_NAMES_FEMALE);
        return `${family} ${middle} ${given}`;
    }
}

function priorityScoreForYear(year) {
    const currentYear = 2026;
    const yearsIn = currentYear - year;
    if (yearsIn <= 1)  return randomInt(60, 90); // year 1
    if (yearsIn === 2) return randomInt(50, 80); // year 2
    if (yearsIn === 3) return randomInt(40, 70); // year 3
    if (yearsIn === 4) return randomInt(30, 55); // year 4
    return randomInt(20, 45); // year 5+
}

async function buildStudents() {
    const passwordHash = await bcrypt.hash(PASSWORD_PLAIN, PASSWORD_HASH_ROUNDS);
    const students = [];

    for (const { year, count, suffixLength } of YEAR_DISTRIBUTION) {
        const suffixes = generateUniqueSuffixes(count, suffixLength);
        suffixes.forEach((suffix) => {
            const studentId = `${year}${suffix.toString().padStart(suffixLength, '0')}`;
            const username  = `sv${studentId}`;
            const gender    = randomChoice(GENDERS);
            const name      = generateVietnameseName(gender);
            const email     = `${username}@sis.hust.edu.vn`;
            const phone     = `09${randomInt(10000000, 99999999)}`;
            const faculty   = randomChoice(FACULTIES);
            const province  = randomChoice(PROVINCES);
            const priorityScore = priorityScoreForYear(year);

            students.push({
                name,
                username,
                studentId,
                email,
                phone,
                password: passwordHash,
                faculty,
                academicYear: year.toString(),
                gender,
                role: 'user',
                province,
                priorityScore,
            });
        });
    }

    return students;
}

async function seed() {
    try {
        const students = await buildStudents();
        console.log(`Generated ${students.length} students. Seeding...`);

        let inserted = 0;
        for (const student of students) {
            const res = await StudentCollection.updateOne(
                { username: student.username },
                { $setOnInsert: student },
                { upsert: true }
            );
            if (res.upsertedCount === 1) inserted += 1;
        }

        const byYear = {};
        students.forEach(s => {
            byYear[s.academicYear] = (byYear[s.academicYear] || 0) + 1;
        });
        console.log('Distribution by year:', byYear);
        console.log(`Done. Inserted: ${inserted}, Skipped (already existed): ${students.length - inserted}`);
        process.exit(0);
    } catch (err) {
        console.error('Seed failed:', err);
        process.exit(1);
    }
}

seed();
