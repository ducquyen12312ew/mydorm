/**
 * seed-demo-applications.js
 * Creates 200 Vietnamese students + 100 AllocationRegistrations + 100 PendingApplications
 * Run: node scripts/seed-demo-applications.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const { StudentCollection, DormitoryCollection, PendingApplicationCollection } = require('../src/config/config');
const AllocationRegistration = require('../src/schemas/AllocationRegistrationSchema');
const AllocationCycle = require('../src/schemas/AllocationCycleSchema');
const AllocationPolicy = require('../src/schemas/AllocationPolicySchema');

// ============================================================
// VIETNAMESE NAME POOLS
// ============================================================
const lastNames = ['Nguyễn','Trần','Lê','Phạm','Hoàng','Huỳnh','Phan','Vũ','Đặng','Bùi','Đỗ','Hồ','Ngô','Dương','Lý'];
const midNames = ['Minh','Hoàng','Thu','Khánh','Quốc','Thị','Văn','Xuân','Đức','Thành','Hải','Bảo','Tiến','Phương','Tuấn','Ngọc','Quang','Thanh','Nhật','Mỹ'];
const firstNamesMale = ['Đức','Long','Hùng','Nam','Dũng','Kiệt','Vinh','Trung','Anh','Huy','Khoa','Tùng','Cường','Bình','Phúc','Đạt','Khang','Hưng','Thắng','Lộc','Giang','Tân','Quân','Hào','Thịnh'];
const firstNamesFemale = ['Trang','Linh','Mai','Hoa','Yến','Châu','Thảo','Vân','Hà','Duyên','Như','Nhi','Quỳnh','Oanh','Hiền','Nhung','Lan','Phúc','Vy','Ngân','Trúc','Diệu','Bích','Thủy','Thanh'];

const faculties = [
  'Cơ khí','Điện-Điện tử','Công nghệ Thông tin','Vật liệu','Hóa học','Toán-Tin',
  'Vật lý','Kỹ thuật Hàng không','Dệt may-Thời trang','Kinh tế','Môi trường','Điện tử Viễn thông'
];

const provinces = [
  { name: 'Nghệ An', dist: 290 }, { name: 'Thanh Hóa', dist: 160 },
  { name: 'Hà Tĩnh', dist: 340 }, { name: 'Quảng Bình', dist: 490 },
  { name: 'Hải Phòng', dist: 120 }, { name: 'Nam Định', dist: 90 },
  { name: 'Thái Bình', dist: 110 }, { name: 'Ninh Bình', dist: 95 },
  { name: 'Bắc Ninh', dist: 30 }, { name: 'Hưng Yên', dist: 50 },
  { name: 'Hòa Bình', dist: 75 }, { name: 'Phú Thọ', dist: 85 },
  { name: 'Quảng Ngãi', dist: 890 }, { name: 'Đà Nẵng', dist: 770 },
  { name: 'Huế', dist: 650 }, { name: 'Hồ Chí Minh', dist: 1740 },
  { name: 'Cần Thơ', dist: 1870 }, { name: 'Lạng Sơn', dist: 150 },
  { name: 'Sơn La', dist: 310 }, { name: 'Điện Biên', dist: 480 }
];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function chance(pct) { return Math.random() < pct / 100; }

function generateVietnameseName(gender) {
  const last = rand(lastNames);
  const mid = rand(midNames);
  const first = gender === 'male' ? rand(firstNamesMale) : rand(firstNamesFemale);
  return `${last} ${mid} ${first}`;
}

function generateStudentId(enrollYear, idx) {
  const suffix = String(idx).padStart(6, '0');
  return `${enrollYear}${suffix}`;
}

function generatePhone() {
  const prefixes = ['032','033','034','035','036','037','038','039','096','097','098','086','089','090','091','092','093','094'];
  const prefix = rand(prefixes);
  const digits = String(randInt(1000000, 9999999));
  return prefix + digits;
}

// ============================================================
// MAIN SEED
// ============================================================
async function seed() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/dormitory_graduation';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  // 1. Ensure active AllocationPolicy for current year
  const currentYear = new Date().getFullYear();
  const academicYear = `${currentYear}-${currentYear + 1}`;
  let policy = await AllocationPolicy.findOne({ active: true });
  if (!policy) {
    policy = await AllocationPolicy.create({
      academicYear,
      active: true,
      priorityRules: {
        yearGroupWeights: { year1: 30, year2_3: 10, year4_plus: -10 },
        financialHardship: { verified: 30, notVerified: 0 },
        distanceFromHome: { above500km: 30, above200km: 20, below50km: -15 },
        scholarship: 10,
        violations: { none: 10, minor: -5, major: -20, critical: -40 },
        familyWealth: { poor: 10, average: 0, wealthy: -10 }
      }
    });
    console.log('✅ Created AllocationPolicy for', academicYear);
  } else {
    console.log('✅ AllocationPolicy already exists:', policy.academicYear);
  }

  // 2. Ensure active AllocationCycle
  let cycle = await AllocationCycle.findOne({ status: 'PENDING' }).sort({ createdAt: -1 });
  if (!cycle) {
    const now = new Date();
    const regEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    cycle = await AllocationCycle.create({
      academicYear,
      name: 'Main Registration',
      policyId: policy._id,
      registrationStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      registrationEnd: regEnd,
      status: 'PENDING',
      description: `Chu kỳ đăng ký chính năm học ${academicYear}`
    });
    console.log('✅ Created AllocationCycle:', cycle._id.toString());
  } else {
    console.log('✅ AllocationCycle already exists:', cycle._id.toString(), cycle.status);
  }

  // 3. Get existing dormitories for preferences
  const dorms = await DormitoryCollection.find({
    $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
  }).lean();
  const dormIds = dorms.map(d => d._id.toString());
  const dormNames = dorms.map(d => d.name);

  // 4. Create 200 demo students
  const enrollYears = [currentYear - 3, currentYear - 2, currentYear - 1, currentYear];
  const genders = ['male', 'female', 'male', 'female', 'male', 'male', 'female', 'female'];
  const passwordHash = await bcrypt.hash('Demo@2024', 10);

  const newStudents = [];
  let counter = 1;

  for (let i = 0; i < 200; i++) {
    const gender = genders[i % genders.length];
    const name = generateVietnameseName(gender);
    const enrollYear = rand(enrollYears);
    const faculty = rand(faculties);
    const province = rand(provinces);
    const sid = generateStudentId(enrollYear, 100 + i);
    const emailLocal = sid.toLowerCase();
    const email = `${emailLocal}@sis.hust.edu.vn`;

    // Skip if student already exists
    const exists = await StudentCollection.findOne({ $or: [{ studentId: sid }, { email }] }).lean();
    if (exists) { counter++; continue; }

    const yearsSinceEnroll = currentYear - enrollYear;
    let academicYearLabel = 'K' + (enrollYear % 100);

    newStudents.push({
      studentId: sid,
      username: email,
      email,
      name,
      password: passwordHash,
      phone: generatePhone(),
      gender,
      faculty,
      academicYear: academicYearLabel,
      enrollmentYear: enrollYear,
      address: `${province.name}`,
      role: 'user',
      emailVerified: true,
      onboardingComplete: true,
      oauthProvider: null,
      priorityScore: randInt(20, 95),
      priorityDetails: {
        distanceFromHome: province.dist,
        financialHardship: chance(40),
        scholarship: chance(20),
        familyWealth: rand(['poor', 'average', 'wealthy'])
      }
    });
    counter++;
  }

  if (newStudents.length > 0) {
    await StudentCollection.insertMany(newStudents, { ordered: false }).catch(e => {
      console.warn('Some students skipped (duplicate):', e.message.substring(0, 80));
    });
    console.log(`✅ Created ${newStudents.length} demo students`);
  } else {
    console.log('ℹ️  No new students to create (all exist)');
  }

  // 5. Load students for registrations
  const allStudents = await StudentCollection.find({ role: 'user' })
    .sort({ createdAt: -1 }).limit(200).lean();
  console.log(`Found ${allStudents.length} students for registrations`);

  if (allStudents.length === 0) {
    console.error('No students found, aborting registrations');
    await mongoose.disconnect();
    return;
  }

  // 6. Clear existing demo registrations for this cycle
  const existingRegs = await AllocationRegistration.countDocuments({ allocationCycleId: cycle._id });
  if (existingRegs > 0) {
    console.log(`ℹ️  ${existingRegs} registrations already exist for this cycle, skipping registration seed`);
  } else {
    // Create 100 AllocationRegistrations
    // Distribution: 30 PENDING, 30 ALLOCATED, 20 WAITLIST, 20 REJECTED
    const statusPlan = [
      ...Array(30).fill('PENDING'),
      ...Array(30).fill('ALLOCATED'),
      ...Array(20).fill('WAITLIST'),
      ...Array(20).fill('REJECTED')
    ];

    const roomTypes = ['8-person', '4-person-service', '5-person', '10-person'];
    const registrations = [];

    for (let i = 0; i < Math.min(100, allStudents.length); i++) {
      const student = allStudents[i];
      const status = statusPlan[i] || 'PENDING';
      const enrollYear = student.enrollmentYear || currentYear;
      const yearsIn = currentYear - parseInt(enrollYear);
      let yearGroup = 'year1';
      if (yearsIn >= 4) yearGroup = 'year4_plus';
      else if (yearsIn >= 1) yearGroup = 'year2_3';

      const province = rand(provinces);
      const distanceKm = province.dist + randInt(-20, 20);
      const hasFinancialHardship = chance(40);
      const hasScholarship = chance(20);
      const familyWealth = rand(['poor', 'average', 'wealthy']);

      // Compute estimated priority score
      let score = 50;
      const rules = policy.priorityRules;
      score += (rules.yearGroupWeights[yearGroup] || 0);
      if (hasFinancialHardship) score += (rules.financialHardship.verified || 0);
      if (distanceKm > 500) score += (rules.distanceFromHome.above500km || 0);
      else if (distanceKm > 200) score += (rules.distanceFromHome.above200km || 0);
      else if (distanceKm < 50) score += (rules.distanceFromHome.below50km || 0);
      if (hasScholarship) score += (rules.scholarship || 0);
      score += (rules.violations.none || 0);
      score += (rules.familyWealth[familyWealth] || 0);
      score = Math.max(0, Math.min(100, score));

      // Pick existing registration time spread over past 2 weeks
      const msAgo = randInt(0, 14 * 24 * 60 * 60 * 1000);
      const createdAt = new Date(Date.now() - msAgo);

      registrations.push({
        academicYear,
        allocationCycleId: cycle._id,
        studentId: student._id,
        studentName: student.name,
        studentEmail: student.email,
        studentPhone: student.phone || '',
        studentFaculty: student.faculty || '',
        studentEnrollmentYear: enrollYear,
        yearGroup,
        status,
        priority: Math.round(score),
        preferences: {
          preferredBuildings: dormIds.length > 0 ? [rand(dormIds)] : [],
          preferredRoomType: rand(roomTypes),
          accommodationNeeds: '',
          distanceFromHome: distanceKm,
          financialHardship: hasFinancialHardship,
          scholarship: hasScholarship,
          familyWealth
        },
        registrationTimestamp: createdAt,
        createdAt,
        updatedAt: createdAt
      });
    }

    await AllocationRegistration.insertMany(registrations, { ordered: false }).catch(e => {
      console.warn('Some registrations skipped:', e.message.substring(0, 80));
    });
    console.log(`✅ Created ${registrations.length} AllocationRegistrations`);
  }

  // 7. Create PendingApplications for legacy dashboard stats
  const existingApps = await PendingApplicationCollection.countDocuments({
    academicYear: { $regex: String(currentYear) }
  });

  if (existingApps >= 50) {
    console.log(`ℹ️  ${existingApps} PendingApplications already exist, skipping`);
  } else {
    const studentsForApps = await StudentCollection.find({ role: 'user' })
      .sort({ createdAt: -1 }).limit(100).lean();

    const appStatusPlan = [
      ...Array(30).fill('approved'),
      ...Array(20).fill('rejected'),
      ...Array(30).fill('pending'),
      ...Array(20).fill('approved') // extra approved for ALLOCATED equivalent
    ];

    const apps = [];
    for (let i = 0; i < Math.min(100, studentsForApps.length); i++) {
      const student = studentsForApps[i];
      const status = appStatusPlan[i] || 'pending';

      // Pick a random dormitory
      const dorm = dorms.length > 0 ? rand(dorms) : null;
      const dormId = dorm ? dorm._id : null;

      // Pick a random room
      let roomNumber = null;
      if (dorm && dorm.floors && dorm.floors.length > 0) {
        const floor = rand(dorm.floors);
        if (floor && floor.rooms && floor.rooms.length > 0) {
          roomNumber = rand(floor.rooms).roomNumber || 'A101';
        }
      }

      const msAgo = randInt(0, 30 * 24 * 60 * 60 * 1000);
      const createdAt = new Date(Date.now() - msAgo);

      apps.push({
        studentId: student._id,
        fullName: student.name,
        email: student.email,
        phone: student.phone || generatePhone(),
        faculty: student.faculty || rand(faculties),
        academicYear,
        gender: student.gender || 'male',
        dormitoryId: dormId,
        roomNumber,
        status,
        priorityScore: randInt(20, 95),
        createdAt,
        updatedAt: createdAt
      });
    }

    await PendingApplicationCollection.insertMany(apps, { ordered: false }).catch(e => {
      console.warn('Some apps skipped:', e.message.substring(0, 80));
    });
    console.log(`✅ Created ${apps.length} PendingApplications`);
  }

  // Summary
  const finalStudents = await StudentCollection.countDocuments({ role: 'user' });
  const finalRegs = await AllocationRegistration.countDocuments();
  const finalApps = await PendingApplicationCollection.countDocuments();

  console.log('\n📊 SEED SUMMARY');
  console.log('─────────────────────────────────');
  console.log(`Students (role=user): ${finalStudents}`);
  console.log(`AllocationRegistrations: ${finalRegs}`);
  console.log(`PendingApplications: ${finalApps}`);
  console.log(`AllocationCycle: ${cycle._id} (${cycle.status})`);
  console.log(`AllocationPolicy: ${policy._id} (${policy.academicYear})`);
  console.log('─────────────────────────────────');

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
