/**
 * Fix student academic year distribution to reflect realistic KTX demographics.
 * Target: Year1 35-40%, Year2 25-30%, Year3 15-20%, Year4 8-12%, Year5+ 3-5%
 *
 * Strategy:
 * 1. Delete unassigned seed/demo students from old years
 * 2. Redistribute academicYear of room-assigned students to correct proportions
 * 3. Seed new unassigned students with correct distribution for applications/queue
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const { StudentCollection } = require('../src/config/config');

const FACULTIES = [
    'Viện CNTT & TT', 'Viện Điện', 'Viện Điện tử - Viễn thông', 'Viện Cơ khí',
    'Viện Kỹ thuật Hóa học', 'Viện Vật lý KT', 'Viện Toán ứng dụng & TH',
    'Viện Kinh tế & QL', 'Khoa Ngoại ngữ', 'Viện MT & PTBV', 'Viện KTHNN'
];

const PROVINCES = [
    'Hà Nội', 'TP HCM', 'Hải Phòng', 'Đà Nẵng', 'Cần Thơ',
    'Nghệ An', 'Thanh Hóa', 'Quảng Ninh', 'Lạng Sơn', 'Hà Giang',
    'Cao Bằng', 'Lào Cai', 'Điện Biên', 'Sơn La', 'Hòa Bình',
    'Bắc Giang', 'Nam Định', 'Thái Bình', 'Hải Dương', 'Vĩnh Phúc',
    'Phú Thọ', 'Yên Bái', 'Tuyên Quang', 'Bắc Ninh', 'Hưng Yên',
    'Huế', 'Bình Định', 'Khánh Hòa', 'Bình Dương', 'Đồng Nai'
];

const FAMILY_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Phan', 'Võ'];
const MALE_GIVEN = ['Nam', 'Hưng', 'Minh', 'Tuấn', 'Long', 'Kiên', 'Đạt', 'Khoa', 'Bình', 'Hải', 'Quân', 'Tú', 'Việt', 'Thắng', 'Lâm'];
const FEMALE_GIVEN = ['Linh', 'Anh', 'Thảo', 'Phương', 'Ngọc', 'Hương', 'Mai', 'Trang', 'Yến', 'Vy', 'Quỳnh', 'Châu', 'Nhung', 'Hà', 'Thu'];
const MIDDLE_MALE = ['Văn', 'Đức', 'Minh', 'Quốc', 'Hữu', 'Công', 'Duy', 'Quang'];
const MIDDLE_FEMALE = ['Thị', 'Thanh', 'Thu', 'Minh', 'Phương', 'Ngọc', 'Hương', 'Bảo'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

function generateName(gender) {
    const family = pick(FAMILY_NAMES);
    const mid = gender === 'male' ? pick(MIDDLE_MALE) : pick(MIDDLE_FEMALE);
    const given = gender === 'male' ? pick(MALE_GIVEN) : pick(FEMALE_GIVEN);
    return `${family} ${mid} ${given}`;
}

async function main() {
    console.log('=== FIX STUDENT DISTRIBUTION ===\n');

    // Step 1: Delete unassigned old seed students (username starts with 'sv20' for year 2020-2024)
    console.log('Step 1: Removing unassigned old demo students...');
    const delResult = await StudentCollection.deleteMany({
        role: 'user',
        isProtected: { $ne: true },
        dormitoryId: { $exists: false },
        username: { $regex: /^sv20(20|21|22|23|24)/ }
    });
    console.log(`  Deleted: ${delResult.deletedCount} old unassigned students\n`);

    // Also remove old students seeded with @example.edu or @sis.hust without dormitory
    const delResult2 = await StudentCollection.deleteMany({
        role: 'user',
        isProtected: { $ne: true },
        dormitoryId: { $exists: false },
        email: { $regex: /@example\.edu|@sis\.hust/ },
        academicYear: { $in: ['2020', '2021', '2022', '2023', '2024'] }
    });
    console.log(`  Deleted ${delResult2.deletedCount} old @example/@sis students without rooms\n`);

    // Step 2: Redistribute academicYear of room-assigned students
    // Current: 2021=196, 2022=327, 2023=393, 2024=392 (1308 total)
    // Target: year1(2025)=36%, year2(2024)=28%, year3(2023)=20%, year4(2022)=12%, year5+(2021)=4%
    // = ~471, ~366, ~261, ~157, ~53 = 1308 total
    console.log('Step 2: Redistributing academicYear of room-assigned students...');

    // Get all room-assigned student IDs
    const roomStudents = await StudentCollection.find(
        { role: 'user', dormitoryId: { $exists: true, $ne: null } },
        { _id: 1, academicYear: 1 }
    ).lean();

    console.log(`  Total room-assigned students: ${roomStudents.length}`);

    // Shuffle the list
    const shuffled = [...roomStudents].sort(() => Math.random() - 0.5);

    const targets = [
        { year: '2025', count: Math.round(roomStudents.length * 0.36) },  // ~471
        { year: '2024', count: Math.round(roomStudents.length * 0.28) },  // ~366
        { year: '2023', count: Math.round(roomStudents.length * 0.20) },  // ~261
        { year: '2022', count: Math.round(roomStudents.length * 0.12) },  // ~157
        // Remaining go to 2021
    ];

    let pointer = 0;
    const updates = [];
    for (const target of targets) {
        const slice = shuffled.slice(pointer, pointer + target.count);
        for (const s of slice) {
            if (s.academicYear !== target.year) {
                updates.push({
                    updateOne: {
                        filter: { _id: s._id },
                        update: { $set: { academicYear: target.year } }
                    }
                });
            }
        }
        pointer += target.count;
    }
    // Remaining get year 2021
    for (let i = pointer; i < shuffled.length; i++) {
        const s = shuffled[i];
        if (s.academicYear !== '2021') {
            updates.push({
                updateOne: {
                    filter: { _id: s._id },
                    update: { $set: { academicYear: '2021' } }
                }
            });
        }
    }

    if (updates.length > 0) {
        const bulkResult = await StudentCollection.bulkWrite(updates);
        console.log(`  Updated ${bulkResult.modifiedCount} students' academicYear\n`);
    } else {
        console.log('  No updates needed\n');
    }

    // Step 3: Seed new unassigned students with correct distribution for applications/queue
    console.log('Step 3: Seeding new students (for applications + allocation queue)...');
    const PASSWORD_HASH = await bcrypt.hash('Passw0rd!', 10);

    const NEW_DIST = [
        { year: 2025, count: 180 },  // Year 1 - most want to register
        { year: 2024, count: 120 },  // Year 2
        { year: 2023, count: 70 },   // Year 3
        { year: 2022, count: 30 },   // Year 4
        { year: 2021, count: 10 },   // Year 5+
    ];

    let seeded = 0;
    let skipped = 0;

    for (const { year, count } of NEW_DIST) {
        for (let i = 0; i < count; i++) {
            const gender = Math.random() > 0.45 ? 'male' : 'female';
            const name = generateName(gender);
            const suffix = year >= 2024 ? String(randInt(10000, 99999)) : String(randInt(1000, 9999));
            const studentId = `${year}${suffix}`;
            const username = `sv${studentId}`;
            const email = `${studentId}@hust.edu.vn`;

            // Check uniqueness
            const exists = await StudentCollection.findOne({ $or: [{ username }, { studentId }] });
            if (exists) { skipped++; continue; }

            const priorityBase = year === 2025 ? 65 : year === 2024 ? 55 : year === 2023 ? 45 : year === 2022 ? 35 : 25;
            const priorityScore = randInt(priorityBase, priorityBase + 25);

            await StudentCollection.create({
                name,
                username,
                studentId,
                email,
                phone: `09${String(randInt(10000000, 99999999))}`,
                password: PASSWORD_HASH,
                faculty: pick(FACULTIES),
                academicYear: String(year),
                gender,
                role: 'user',
                priorityScore,
                province: pick(PROVINCES),
                emailVerified: true,
                onboardingComplete: year === 2024 || year === 2023 || year === 2025,
                priorityDetails: {
                    yearGroup: year === 2025 ? 'year1' : year >= 2023 ? 'year2_3' : 'year4_plus',
                    distanceFromHome: randInt(0, 1800),
                    province: pick(PROVINCES),
                    financialHardship: Math.random() > (year === 2025 ? 0.4 : 0.6),
                    scholarship: Math.random() > 0.8,
                    violationCount: year <= 2022 ? randInt(0, 1) : 0
                }
            });
            seeded++;
        }
        console.log(`  Year ${year}: seeded ${count} students (skipped some duplicates)`);
    }
    console.log(`  Total seeded: ${seeded}, skipped: ${skipped}\n`);

    // Final count
    const finalDist = await StudentCollection.aggregate([
        { $match: { role: 'user' } },
        { $group: { _id: '$academicYear', count: { $sum: 1 } } },
        { $sort: { _id: -1 } }
    ]);

    console.log('=== FINAL DISTRIBUTION ===');
    let total = 0;
    finalDist.forEach(d => {
        console.log(`  ${d._id || 'null'}: ${d.count}`);
        total += d.count;
    });
    console.log(`  TOTAL: ${total}`);

    process.exit(0);
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
