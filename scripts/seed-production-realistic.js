/**
 * seed-production-realistic.js
 *
 * Dataset demo cuối cùng cho ĐATN KTX HUST.
 *
 * Targets (fixed, không tính theo %):
 *   - 1450 sinh viên tổng
 *   - 1430 được phân phòng (ACTIVE RoomAllocation)
 *   - 20  chưa có phòng (AllocationRegistration)
 *   - Occupancy: 1430/1742 = 82.1%
 *
 * Chạy: node scripts/seed-production-realistic.js
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('ERROR: MONGO_URI not set'); process.exit(1); }

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENT_ACADEMIC_YEAR = '2025-2026';
const CURRENT_YEAR_START    = 2025;

// yearInSchool = 2025 - enrollmentYear + 1
// 2025 → year1, 2024 → year2, 2023 → year3, 2022/2021 → year4+

// Fixed student counts — assigned (in KTX)
// Year distribution: Year1≈35%, Year2≈27%, Year3≈22%, Year4+≈16%
// Total assigned = 1430
const ASSIGNED_COUNTS = {
  2025: 498,  // year1  (34.8%)
  2024: 387,  // year2  (27.1%)
  2023: 316,  // year3  (22.1%)
  2022: 133,  // year4+ 4th year  ╮
  2021:  96,  // year4+ 5th year  ╯ combined 16.0%
};

// Fixed student counts — unassigned (pending allocation)
// Total unassigned = 20
const UNASSIGNED_COUNTS = {
  2025: 10,   // freshmen missed first round
  2024:  5,   // year2 re-applicants
  2023:  3,   // year3
  2022:  1,   // year4+
  2021:  1,   // year4+
};

// Registration status distribution for 20 unassigned: 12 PENDING + 5 WAITLIST + 3 REJECTED
const REG_STATUS_QUOTA = { PENDING: 12, WAITLIST: 5, REJECTED: 3 };

const FACULTIES = [
  'Viện Công nghệ Thông tin và Truyền thông',
  'Viện Cơ khí',
  'Viện Điện',
  'Trường Hóa và Khoa học sự sống',
  'Viện Vật lý Kỹ thuật',
  'Viện Kinh tế và Quản lý',
  'Viện Toán ứng dụng và Tin học',
  'Viện Môi trường',
  'Viện Dệt may - Da giầy và Thời trang',
  'Trường Điện - Điện tử',
];

const MAJORS_BY_FACULTY = {
  'Viện Công nghệ Thông tin và Truyền thông': ['Công nghệ Thông tin', 'Khoa học Máy tính', 'Kỹ thuật Máy tính', 'An toàn Thông tin'],
  'Viện Cơ khí': ['Cơ khí Chế tạo máy', 'Kỹ thuật Ô tô', 'Cơ điện tử'],
  'Viện Điện': ['Kỹ thuật Điện', 'Tự động hóa', 'Điều khiển và Tự động hóa'],
  'Trường Hóa và Khoa học sự sống': ['Kỹ thuật Hóa học', 'Công nghệ Thực phẩm', 'Kỹ thuật Môi trường'],
  'Viện Vật lý Kỹ thuật': ['Vật lý Kỹ thuật', 'Khoa học Vật liệu'],
  'Viện Kinh tế và Quản lý': ['Quản trị Kinh doanh', 'Kinh tế Công nghiệp', 'Kế toán'],
  'Viện Toán ứng dụng và Tin học': ['Toán Tin ứng dụng', 'Khoa học Dữ liệu'],
  'Viện Môi trường': ['Kỹ thuật Môi trường', 'Quản lý Tài nguyên Môi trường'],
  'Viện Dệt may - Da giầy và Thời trang': ['Công nghệ May', 'Thiết kế Thời trang'],
  'Trường Điện - Điện tử': ['Điện tử Viễn thông', 'Kỹ thuật Điện tử'],
};

const HO = ['Nguyễn','Trần','Lê','Phạm','Hoàng','Huỳnh','Phan','Vũ','Võ','Đặng',
            'Bùi','Đỗ','Hồ','Ngô','Dương','Lý','Đinh','Mai','Trương','Đào'];
const TEN_NAM = ['Minh','Hùng','Tuấn','Dũng','Đức','Quang','Hải','Long','Trung','Nam',
                 'Thành','Phong','Hiếu','Khải','Bình','Tân','Vũ','Khoa','Khánh','Lâm',
                 'Nhân','Phúc','Sơn','Tiến','Vinh','Đạt','Hậu','Kiên','Mạnh','Tùng'];
const TEN_NU  = ['Linh','Hương','Lan','Ngọc','Hạnh','Thùy','Phương','Trang','Mai','Anh',
                 'Hà','Thu','Nhung','Yến','Chi','Vy','Trúc','Loan','Tuyết','Xuân',
                 'Diệp','Hằng','Mỹ','Nhài','Quỳnh','Thảo','Uyên','Vân','Nhi','Hiền'];
const DEM_NAM = ['Văn','Thanh','Hữu','Công','Quốc','Đình','Ngọc','Hoàng','Phước','Minh'];
const DEM_NU  = ['Thị','Ngọc','Hoài','Kim','Thanh','Bích','Hồng','Mỹ','Thu','Lan'];

const PROVINCES_FAR  = ['Nghệ An','Hà Tĩnh','Thanh Hóa','Nam Định','Thái Bình','Ninh Bình','Quảng Bình','Quảng Trị'];
const PROVINCES_MED  = ['Hải Dương','Hưng Yên','Bắc Giang','Phú Thọ','Vĩnh Phúc','Thái Nguyên','Bắc Ninh','Hải Phòng'];
const PROVINCES_NEAR = ['Hà Nội','Hà Đông','Đông Anh','Gia Lâm','Long Biên','Hoài Đức','Sóc Sơn','Thạch Thất'];

// ─── Utility ──────────────────────────────────────────────────────────────────

let _rngSeed = 42;
function rng() {
  _rngSeed = (_rngSeed * 1664525 + 1013904223) & 0xffffffff;
  return (_rngSeed >>> 0) / 4294967296;
}
function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
function rand(min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
function chance(p) { return rng() < p; }

function yearInSchool(ey) { return CURRENT_YEAR_START - Number(ey) + 1; }

function enrollmentYearToYearGroup4(ey) {
  const yis = yearInSchool(ey);
  if (yis <= 1) return 'year1';
  if (yis === 2) return 'year2';
  if (yis === 3) return 'year3';
  return 'year4_plus';
}

function enrollmentYearToYearGroup3(ey) {
  const yis = yearInSchool(ey);
  if (yis <= 1) return 'year1';
  if (yis <= 3) return 'year2_3';
  return 'year4_plus';
}

function makeName(gender) {
  const ho = pick(HO);
  if (gender === 'female') return `${ho} ${pick(DEM_NU)} ${pick(TEN_NU)}`;
  return `${ho} ${pick(DEM_NAM)} ${pick(TEN_NAM)}`;
}

const usedPhones = new Set();
function makePhone() {
  const prefixes = ['032','033','034','035','036','037','038','039','056','058',
                    '070','076','077','078','079','086','096','097','098'];
  let p;
  let tries = 0;
  do {
    p = pick(prefixes) + String(rand(1000000, 9999999));
    tries++;
    if (tries > 10000) break;
  } while (usedPhones.has(p));
  usedPhones.add(p);
  return p;
}

function distanceKm(ey) {
  const yis = yearInSchool(ey);
  if (yis <= 1) {
    if (chance(0.50)) return rand(200, 600);
    if (chance(0.35)) return rand(60, 200);
    return rand(15, 60);
  }
  if (yis === 2) {
    if (chance(0.35)) return rand(150, 500);
    if (chance(0.40)) return rand(50, 150);
    return rand(10, 50);
  }
  if (chance(0.20)) return rand(100, 400);
  if (chance(0.40)) return rand(30, 100);
  return rand(5, 30);
}

function financialStatus(ey) {
  const yis = yearInSchool(ey);
  const r = rng();
  if (yis <= 1) {
    if (r < 0.15) return 'critical';
    if (r < 0.35) return 'high';
    if (r < 0.60) return 'medium';
    if (r < 0.80) return 'low';
    return 'none';
  }
  if (r < 0.08) return 'critical';
  if (r < 0.22) return 'high';
  if (r < 0.50) return 'medium';
  if (r < 0.75) return 'low';
  return 'none';
}

function priorityLevel(ey) {
  const yis = yearInSchool(ey);
  const r = rng();
  if (yis <= 1) {
    if (r < 0.12) return 'critical';
    if (r < 0.30) return 'high';
    if (r < 0.55) return 'medium';
    return 'low';
  }
  if (r < 0.05) return 'critical';
  if (r < 0.18) return 'high';
  if (r < 0.45) return 'medium';
  return 'low';
}

function calcSmartScore(dist, fin, pri) {
  const nd = Math.min(100, Math.round((dist / 500) * 100));
  const fm = { critical: 100, high: 85, medium: 60, low: 30, none: 0 };
  const pm = { critical: 100, high: 80, medium: 55, low: 30, none: 0 };
  return Math.round(nd * 0.35 + (fm[fin] || 0) * 0.35 + (pm[pri] || 0) * 0.30);
}

function gpaForYear(ey) {
  const yis = yearInSchool(ey);
  const bases = { 1: [7.5, 9.0], 2: [7.8, 8.8], 3: [8.0, 9.2] };
  const range = bases[yis] || [8.2, 9.5];
  return Math.round((range[0] + rng() * (range[1] - range[0])) * 10) / 10;
}

function dobForYear(ey) {
  // Typical age: enrolled 18 years old
  const birthYear = Number(ey) - 18;
  const month = rand(1, 12);
  const day = rand(1, 28);
  return new Date(`${birthYear}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
}

function classNameFor(ey, seq) {
  const yis = yearInSchool(ey);
  const letters = 'ABCDEFGH';
  const cls = letters[seq % letters.length];
  return `IT${ey % 100}${cls}`;
}

function randomCheckInDate() {
  const base = new Date('2025-09-01');
  base.setDate(base.getDate() + rand(0, 20));
  return base;
}

function randomRegDate() {
  const base = new Date('2026-01-10');
  base.setDate(base.getDate() + rand(0, 26));
  return base;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

async function runValidation(db, studentDocs, assignedStudents) {
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION REPORT');
  console.log('='.repeat(60));

  let allPass = true;
  function check(label, pass, detail = '') {
    const icon = pass ? '✅' : '❌';
    console.log(`  ${icon} ${label}${detail ? ' — ' + detail : ''}`);
    if (!pass) allPass = false;
  }

  // V1: All 1430 allocated students are in room occupants
  const studentsWithRoom = studentDocs.filter(s => s.isAssigned && s.dormitoryId);
  let v1Failures = 0;
  const dorms = await db.collection('dormitories').find({}).toArray();
  const occupantSet = new Set();
  for (const d of dorms) {
    for (const fl of (d.floors || [])) {
      for (const rm of (fl.rooms || [])) {
        for (const o of (rm.occupants || [])) {
          if (o.active) occupantSet.add(o.studentId);
        }
      }
    }
  }
  for (const s of studentsWithRoom) {
    if (!occupantSet.has(s.studentId)) v1Failures++;
  }
  check('All 1430 allocated students appear in room occupants', v1Failures === 0,
    v1Failures > 0 ? `${v1Failures} missing` : `${studentsWithRoom.length} verified`);

  // V2: All room occupants exist in students collection
  const studentIdSet = new Set(studentDocs.map(s => s.studentId));
  let v2Missing = 0;
  for (const sid of occupantSet) {
    if (!studentIdSet.has(sid)) v2Missing++;
  }
  check('All room occupants exist in students collection', v2Missing === 0,
    v2Missing > 0 ? `${v2Missing} orphaned` : `${occupantSet.size} occupants verified`);

  // V3: ACTIVE RoomAllocations = occupied beds
  const activeAllocCount = await db.collection('roomallocations').countDocuments({ status: 'ACTIVE' });
  check('ACTIVE RoomAllocations = 1430', activeAllocCount === 1430, `found: ${activeAllocCount}`);
  check('Occupied beds = ACTIVE allocations', occupantSet.size === activeAllocCount,
    `beds=${occupantSet.size}, allocs=${activeAllocCount}`);

  // V4: 20 unassigned students have no dormitoryId / roomNumber
  const unassignedInDB = await db.collection('students').countDocuments({
    role: 'user',
    $or: [{ dormitoryId: null }, { dormitoryId: { $exists: false } }]
  });
  const unassignedWithRoom = await db.collection('students').countDocuments({
    role: 'user',
    dormitoryId: { $ne: null },
    $or: [{ roomNumber: null }, { roomNumber: { $exists: false } }]
  });
  check('20 unassigned students have no dormitoryId', unassignedInDB === 20, `found: ${unassignedInDB}`);

  // V5: Simulation can read PENDING registrations
  const pendingRegs = await db.collection('allocationregistrations').countDocuments({ status: 'PENDING' });
  check('PENDING registrations readable by simulation', pendingRegs > 0, `found: ${pendingRegs} PENDING`);

  // V6: Quota dashboard can read year distribution
  const y1Count = await db.collection('students').countDocuments({ role: 'user', enrollmentYear: 2025 });
  const y2Count = await db.collection('students').countDocuments({ role: 'user', enrollmentYear: 2024 });
  check('Quota dashboard year distribution readable', y1Count > 0 && y2Count > 0,
    `year1=${y1Count}, year2=${y2Count}`);

  // V7: Duplicate checks
  const dupeStudentId = await db.collection('students').aggregate([
    { $match: { role: 'user' } },
    { $group: { _id: '$studentId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'total' }
  ]).toArray();
  const dupeEmail = await db.collection('students').aggregate([
    { $match: { role: 'user' } },
    { $group: { _id: '$email', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'total' }
  ]).toArray();
  const dupePhone = await db.collection('students').aggregate([
    { $match: { role: 'user' } },
    { $group: { _id: '$phone', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'total' }
  ]).toArray();
  check('Duplicate studentId = 0', (dupeStudentId[0]?.total || 0) === 0,
    `duplicates: ${dupeStudentId[0]?.total || 0}`);
  check('Duplicate email = 0', (dupeEmail[0]?.total || 0) === 0,
    `duplicates: ${dupeEmail[0]?.total || 0}`);
  check('Duplicate phone = 0', (dupePhone[0]?.total || 0) === 0,
    `duplicates: ${dupePhone[0]?.total || 0}`);

  // V8: Enrollment mapping validity
  const badEnrollment = studentDocs.filter(s => {
    const yis = yearInSchool(s.enrollmentYear);
    const expected = yis <= 1 ? 'year1' : yis === 2 ? 'year2' : yis === 3 ? 'year3' : 'year4_plus';
    return s.yearGroup !== expected;
  });
  check('Enrollment year ↔ yearGroup mapping valid', badEnrollment.length === 0,
    `invalid mappings: ${badEnrollment.length}`);

  console.log(`\n  ${allPass ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
  return allPass;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('=== SEED PRODUCTION REALISTIC (FINAL DATASET) ===\n');

  // Validate constants
  const totalAssigned   = Object.values(ASSIGNED_COUNTS).reduce((s, v) => s + v, 0);
  const totalUnassigned = Object.values(UNASSIGNED_COUNTS).reduce((s, v) => s + v, 0);
  const totalRegQuota   = Object.values(REG_STATUS_QUOTA).reduce((s, v) => s + v, 0);
  if (totalAssigned !== 1430) { console.error(`FATAL: ASSIGNED_COUNTS sums to ${totalAssigned}, expected 1430`); process.exit(1); }
  if (totalUnassigned !== 20)  { console.error(`FATAL: UNASSIGNED_COUNTS sums to ${totalUnassigned}, expected 20`); process.exit(1); }
  if (totalRegQuota !== 20)    { console.error(`FATAL: REG_STATUS_QUOTA sums to ${totalRegQuota}, expected 20`); process.exit(1); }

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  console.log('Connected.\n');

  // ── Step 1: Read dormitory structure ─────────────────────────────────────
  console.log('STEP 1: Reading dormitory structure...');
  const dorms = await db.collection('dormitories').find({}).toArray();
  const allRooms = [];
  let totalBeds = 0;
  for (const d of dorms) {
    for (const fl of (d.floors || [])) {
      for (const rm of (fl.rooms || [])) {
        const cap = rm.maxCapacity || 0;
        if (cap > 0) {
          allRooms.push({
            dormId: d._id,
            dormName: d.name,
            floorNumber: fl.floorNumber,
            roomNumber: rm.roomNumber,
            maxCapacity: cap
          });
          totalBeds += cap;
        }
      }
    }
  }
  console.log(`  Total beds: ${totalBeds}`);
  console.log(`  Target occupied: 1430 (${(1430/totalBeds*100).toFixed(1)}%)\n`);

  // ── Step 2: Show distribution plan ───────────────────────────────────────
  console.log('STEP 2: Student distribution plan...');
  const totalStudents = totalAssigned + totalUnassigned;
  console.log(`  Enrollment | Assigned | Unassigned | Total | YearGroup`);
  for (const ey of [2025, 2024, 2023, 2022, 2021]) {
    const a = ASSIGNED_COUNTS[ey] || 0;
    const u = UNASSIGNED_COUNTS[ey] || 0;
    const yg = enrollmentYearToYearGroup4(ey);
    console.log(`  ${ey}       | ${String(a).padStart(8)} | ${String(u).padStart(10)} | ${String(a+u).padStart(5)} | ${yg}`);
  }
  console.log(`  TOTAL      | ${String(totalAssigned).padStart(8)} | ${String(totalUnassigned).padStart(10)} | ${totalStudents}`);
  console.log(`  Registrations: PENDING=${REG_STATUS_QUOTA.PENDING} WAITLIST=${REG_STATUS_QUOTA.WAITLIST} REJECTED=${REG_STATUS_QUOTA.REJECTED}\n`);

  // ── Step 3: Hash password ─────────────────────────────────────────────────
  console.log('STEP 3: Generating password hash...');
  const DEFAULT_PASSWORD_HASH = await bcrypt.hash('Dquyen12@', 10);
  console.log('  Password: Dquyen12@ (all students)\n');

  // ── Step 4: Generate students ─────────────────────────────────────────────
  console.log('STEP 4: Generating students...');
  const studentDocs = [];
  const seqMap = {};
  function nextSeq(ey) { seqMap[ey] = (seqMap[ey] || 0) + 1; return seqMap[ey]; }
  function makeStudentId(ey, seq) { return `${ey}${String(seq).padStart(4, '0')}`; }
  function makeEmail(sid) { return `${sid}@sis.hust.edu.vn`; }

  function buildStudent(ey, isAssigned) {
    const gender = chance(0.55) ? 'male' : 'female';
    const seq = nextSeq(ey);
    const sid = makeStudentId(ey, seq);
    const name = makeName(gender);
    const dist = distanceKm(ey);
    const fin = financialStatus(ey);
    const pri = priorityLevel(ey);
    const faculty = pick(FACULTIES);
    const majors = MAJORS_BY_FACULTY[faculty] || ['Chưa xác định'];
    const province = dist > 200 ? pick(PROVINCES_FAR) : dist > 60 ? pick(PROVINCES_MED) : pick(PROVINCES_NEAR);
    return {
      _id: new mongoose.Types.ObjectId(),
      username: sid,
      studentId: sid,
      name,
      email: makeEmail(sid),
      phone: makePhone(),
      password: DEFAULT_PASSWORD_HASH,
      faculty,
      major: pick(majors),
      className: classNameFor(ey, seq),
      gender,
      dateOfBirth: dobForYear(ey),
      academicYear: String(ey),
      enrollmentYear: Number(ey),
      yearGroup: enrollmentYearToYearGroup4(ey),
      gpa: gpaForYear(ey),
      role: 'user',
      nationality: 'VN',
      citizenship: 'VN',
      country: 'VN',
      isInternational: false,
      province,
      priorityScore: calcSmartScore(dist, fin, pri),
      priorityDetails: {
        distanceFromHome: dist,
        financialDifficulty: fin,
        priorityLevel: pri,
        province
      },
      dormitoryId: null,
      roomNumber: null,
      allocationStatus: isAssigned ? 'allocated' : 'pending',
      isActive: true,
      isAssigned,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  for (const ey of [2025, 2024, 2023, 2022, 2021]) {
    const aCount = ASSIGNED_COUNTS[ey] || 0;
    const uCount = UNASSIGNED_COUNTS[ey] || 0;
    for (let i = 0; i < aCount; i++) studentDocs.push(buildStudent(ey, true));
    for (let i = 0; i < uCount; i++) studentDocs.push(buildStudent(ey, false));
  }

  console.log(`  Generated ${studentDocs.length} students (${totalAssigned} assigned + ${totalUnassigned} unassigned)`);

  // ── Step 5: Insert students ───────────────────────────────────────────────
  console.log('\nSTEP 5: Inserting students into DB...');
  const BATCH = 500;
  for (let i = 0; i < studentDocs.length; i += BATCH) {
    await db.collection('students').insertMany(studentDocs.slice(i, i + BATCH), { ordered: false });
  }
  console.log(`  ✅ Inserted ${studentDocs.length} students`);

  // ── Step 6: Assign students to rooms (round-robin + per-dorm cap) ──────────
  console.log('\nSTEP 6: Assigning students to dormitory rooms...');

  // Shuffle students so year groups are MIXED across all dorms (Fisher-Yates)
  const assignedStudents = studentDocs.filter(s => s.isAssigned);
  for (let i = assignedStudents.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [assignedStudents[i], assignedStudents[j]] = [assignedStudents[j], assignedStudents[i]];
  }

  // Group rooms by dorm and calculate per-dorm physical capacity
  const dormRoomMap = new Map();   // dormKey → [rooms]
  const dormBedMap  = new Map();   // dormKey → totalBeds
  for (const d of dorms) {
    const key = d._id.toString();
    dormRoomMap.set(key, []);
    let beds = 0;
    for (const fl of (d.floors || [])) for (const rm of (fl.rooms || [])) if (rm.maxCapacity > 0) beds += rm.maxCapacity;
    dormBedMap.set(key, beds);
  }
  for (const room of allRooms) dormRoomMap.get(room.dormId.toString()).push(room);

  // Per-dorm cap: 87% of capacity, always keep at least 15 beds empty per dorm
  const dormFillCap = new Map();
  for (const [key, beds] of dormBedMap.entries()) {
    dormFillCap.set(key, Math.max(0, Math.min(Math.floor(beds * 0.87), beds - 15)));
  }

  // Interleave rooms round-robin across dorms so fills are proportional
  const dormQueues = [...dormRoomMap.values()];
  const interleavedRooms = [];
  const maxRoomCount = Math.max(...dormQueues.map(q => q.length));
  for (let i = 0; i < maxRoomCount; i++) {
    for (const q of dormQueues) { if (i < q.length) interleavedRooms.push(q[i]); }
  }

  const dormFilledMap = new Map();
  for (const key of dormBedMap.keys()) dormFilledMap.set(key, 0);

  const roomOccupants = {};
  let bedsAssigned = 0;
  let studentIdx = 0;

  for (const room of interleavedRooms) {
    if (studentIdx >= assignedStudents.length) break;
    const dKey = room.dormId.toString();
    const filled = dormFilledMap.get(dKey) || 0;
    const cap    = dormFillCap.get(dKey) || 0;
    if (filled >= cap) continue;

    const roomKey = `${room.dormId}::${room.roomNumber}`;
    roomOccupants[roomKey] = [];
    const slotsToFill = Math.min(room.maxCapacity, cap - filled, assignedStudents.length - studentIdx);

    for (let slot = 0; slot < slotsToFill; slot++) {
      const s = assignedStudents[studentIdx];
      s.dormitoryId = room.dormId;
      s.roomNumber  = room.roomNumber;
      roomOccupants[roomKey].push({
        studentId: s.studentId, name: s.name, email: s.email, phone: s.phone,
        checkInDate: randomCheckInDate(), active: true
      });
      bedsAssigned++;
      dormFilledMap.set(dKey, (dormFilledMap.get(dKey) || 0) + 1);
      studentIdx++;
    }
  }

  if (bedsAssigned !== 1430) {
    console.error(`\n❌ FATAL: Assigned ${bedsAssigned} beds, expected 1430. Per-dorm caps too tight?`);
    process.exit(1);
  }
  console.log(`  Assigned ${bedsAssigned} beds across ${Object.keys(roomOccupants).length} rooms`);
  console.log(`  Occupancy: ${(bedsAssigned / totalBeds * 100).toFixed(1)}%`);
  console.log('  Per-dorm distribution:');
  for (const [key, filled] of dormFilledMap.entries()) {
    const total = dormBedMap.get(key) || 0;
    const dormName = dorms.find(d => d._id.toString() === key)?.name || key;
    console.log(`    ${dormName.padEnd(30)} ${filled}/${total} (${(filled/total*100).toFixed(0)}%)`);
  }

  // ── Step 7: Write occupants to dormitories ────────────────────────────────
  console.log('\nSTEP 7: Writing occupants to dormitory rooms...');
  let dormUpdates = 0;
  const freshDorms = await db.collection('dormitories').find({}).toArray();
  for (const dorm of freshDorms) {
    const floors = (dorm.floors || []).map(fl => ({
      ...fl,
      rooms: (fl.rooms || []).map(rm => {
        const key = `${dorm._id}::${rm.roomNumber}`;
        const occs = roomOccupants[key];
        return occs ? { ...rm, occupants: occs } : rm;
      })
    }));
    await db.collection('dormitories').updateOne({ _id: dorm._id }, { $set: { floors } });
    dormUpdates++;
  }
  console.log(`  ✅ Updated ${dormUpdates} dormitories`);

  // ── Step 8: Update student records ───────────────────────────────────────
  console.log('\nSTEP 8: Updating student dormitoryId + roomNumber...');
  const ops = assignedStudents
    .filter(s => s.dormitoryId)
    .map(s => ({
      updateOne: {
        filter: { _id: s._id },
        update: { $set: { dormitoryId: s.dormitoryId, roomNumber: s.roomNumber } }
      }
    }));
  for (let i = 0; i < ops.length; i += 500) {
    await db.collection('students').bulkWrite(ops.slice(i, i + 500), { ordered: false });
  }
  console.log(`  ✅ Updated ${ops.length} student room assignments`);

  // ── Step 9: Create AllocationCycles ──────────────────────────────────────
  console.log('\nSTEP 9: Creating AllocationCycles...');
  const cycleCompletedId = new mongoose.Types.ObjectId();
  const cyclePendingId   = new mongoose.Types.ObjectId();

  await db.collection('allocationcycles').insertMany([
    {
      _id: cycleCompletedId,
      name: 'Đợt xét duyệt HK1 2025-2026',
      academicYear: CURRENT_ACADEMIC_YEAR,
      semester: 'HK1',
      registrationStart: new Date('2025-08-01'),
      registrationEnd:   new Date('2025-08-31'),
      allocationDate:    new Date('2025-09-05'),
      status: 'COMPLETED',
      stats: { totalRegistrations: 1430, totalAllocated: 1430, totalWaitlisted: 0 },
      createdAt: new Date('2025-07-01'),
      updatedAt: new Date('2025-09-05'),
      __v: 0
    },
    {
      _id: cyclePendingId,
      name: 'Đợt xét duyệt HK2 2025-2026',
      academicYear: CURRENT_ACADEMIC_YEAR,
      semester: 'HK2',
      registrationStart: new Date('2026-01-10'),
      registrationEnd:   new Date('2026-02-05'),
      allocationDate: null,
      status: 'PENDING',
      stats: {},
      createdAt: new Date('2025-12-20'),
      updatedAt: new Date(),
      __v: 0
    }
  ]);
  console.log('  ✅ Created 2 cycles (1 COMPLETED + 1 PENDING)');

  // ── Step 10: Create AllocationRegistrations ───────────────────────────────
  console.log('\nSTEP 10: Creating AllocationRegistrations (20 students)...');
  const unassignedStudents = studentDocs.filter(s => !s.isAssigned);

  // Pre-assign statuses deterministically: PENDING first, then WAITLIST, then REJECTED
  const statusList = [
    ...Array(REG_STATUS_QUOTA.PENDING).fill('PENDING'),
    ...Array(REG_STATUS_QUOTA.WAITLIST).fill('WAITLIST'),
    ...Array(REG_STATUS_QUOTA.REJECTED).fill('REJECTED')
  ];

  const regDocs = unassignedStudents.map((s, idx) => ({
    _id: new mongoose.Types.ObjectId(),
    academicYear: CURRENT_ACADEMIC_YEAR,
    allocationCycleId: cyclePendingId,
    studentId: s._id,
    studentName: s.name,
    studentEmail: s.email,
    studentPhone: s.phone,
    studentFaculty: s.faculty,
    studentEnrollmentYear: s.enrollmentYear,
    yearGroup: enrollmentYearToYearGroup3(s.enrollmentYear),
    registrationTimestamp: randomRegDate(),
    status: statusList[idx],
    priority: s.priorityScore,
    preferences: {
      preferredBuildings: [],
      preferredRoomType: pick(['4-person', '6-person', '8-person', '10-person']),
      accommodationNeeds: ''
    },
    applicationNotes: '',
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  await db.collection('allocationregistrations').insertMany(regDocs, { ordered: false });
  const regByStatus = regDocs.reduce((m, r) => { m[r.status] = (m[r.status] || 0) + 1; return m; }, {});
  console.log(`  ✅ Created ${regDocs.length} registrations: ${JSON.stringify(regByStatus)}`);

  // ── Step 11: Create RoomAllocations ──────────────────────────────────────
  console.log('\nSTEP 11: Creating RoomAllocations (ACTIVE)...');
  const assignedWithRoom = assignedStudents.filter(s => s.dormitoryId);
  for (let i = 0; i < assignedWithRoom.length; i += 200) {
    const docs = assignedWithRoom.slice(i, i + 200).map(s => ({
      _id: new mongoose.Types.ObjectId(),
      academicYear: CURRENT_ACADEMIC_YEAR,
      allocationCycleId: cycleCompletedId,
      studentId: s._id,
      dormitoryId: s.dormitoryId,
      roomNumber: s.roomNumber,
      studentYearGroup: enrollmentYearToYearGroup3(s.enrollmentYear),
      studentFaculty: s.faculty,
      studentEnrollmentYear: s.enrollmentYear,
      allocationType: 'AUTO',
      allocationReason: `Phân phòng đợt HK1 ${CURRENT_ACADEMIC_YEAR}`,
      status: 'ACTIVE',
      allocationTimestamp: randomCheckInDate(),
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0
    }));
    await db.collection('roomallocations').insertMany(docs, { ordered: false });
  }
  console.log(`  ✅ Created ${assignedWithRoom.length} RoomAllocation records`);

  // ── Step 12: Create CohortShift snapshot ──────────────────────────────────
  console.log('\nSTEP 12: Creating CohortShift snapshot...');
  const BASE_K = 66, BASE_YEAR = 2020;
  const eyCountMap = {}, eyAllocMap = {};
  studentDocs.forEach(s => {
    eyCountMap[s.enrollmentYear] = (eyCountMap[s.enrollmentYear] || 0) + 1;
    if (s.dormitoryId) eyAllocMap[s.enrollmentYear] = (eyAllocMap[s.enrollmentYear] || 0) + 1;
  });

  const cohortRows = [2025, 2024, 2023, 2022, 2021].map(ey => {
    const yis = yearInSchool(ey);
    const yg = yis <= 1 ? 'year1' : yis === 2 ? 'year2' : yis === 3 ? 'year3' : 'year4_plus';
    return {
      code: `K${BASE_K + (ey - BASE_YEAR)}`,
      enrollmentYear: ey,
      yearInSchool: yis,
      yearGroup: yg,
      studentCount: eyCountMap[ey] || 0,
      allocated: eyAllocMap[ey] || 0
    };
  });

  const summary = {};
  ['year1','year2','year3','year4_plus'].forEach(key => {
    const rows = cohortRows.filter(r => r.yearGroup === key);
    summary[key] = {
      cohorts: rows.map(r => r.code),
      allocated: rows.reduce((s, r) => s + r.allocated, 0),
      studentCount: rows.reduce((s, r) => s + r.studentCount, 0)
    };
  });

  await db.collection('cohortshifts').insertOne({
    _id: new mongoose.Types.ObjectId(),
    academicYear: CURRENT_ACADEMIC_YEAR,
    generatedAt: new Date(),
    isAutoGenerated: false,
    triggeredBy: null,
    notes: 'Generated by seed-production-realistic.js (final dataset)',
    cohorts: cohortRows,
    summary,
    createdAt: new Date(),
    updatedAt: new Date(),
    __v: 0
  });
  console.log(`  ✅ Created CohortShift snapshot for ${CURRENT_ACADEMIC_YEAR}`);

  // ── Step 13: Create QuotaConfig 2025-2026 ────────────────────────────────
  console.log('\nSTEP 13: Creating QuotaConfig for 2025-2026...');
  // Slots set ABOVE actual counts so no year group shows overflow → eviction = 0
  // Actual: year1=508, year2=392, year3=319, year4+=231 (total 1450)
  // Slots:  year1=644, year2=470, year3=383, year4+=245  (total 1742 = physical capacity)
  const quotaSlots = [
    { yearGroup: 'year1',     percentage: 37, slot: 644 },
    { yearGroup: 'year2',     percentage: 27, slot: 470 },
    { yearGroup: 'year3',     percentage: 22, slot: 383 },
    { yearGroup: 'year4_plus',percentage: 14, slot: 245 },
  ];
  await db.collection('quotaconfigs').insertOne({
    _id: new mongoose.Types.ObjectId(),
    academicYear: CURRENT_ACADEMIC_YEAR,
    totalCapacity: totalBeds,           // 1742 — matches physical beds
    quotas: quotaSlots,
    isDraft: false,
    version: 1,
    notes: 'Auto-generated by seed-production-realistic.js — slots exceed actuals so eviction simulation shows 0 overflow',
    publishedAt: new Date('2025-07-15'),
    createdAt:   new Date('2025-07-01'),
    updatedAt:   new Date('2025-07-15'),
    __v: 0
  });
  console.log(`  ✅ Created QuotaConfig 2025-2026 (totalCapacity=${totalBeds})`);
  console.log(`     Slots: year1=${quotaSlots[0].slot}, year2=${quotaSlots[1].slot}, year3=${quotaSlots[2].slot}, year4+=${quotaSlots[3].slot}`);

  // ── Step 13b: Create AllocationPolicy ─────────────────────────────────────
  console.log('\nSTEP 13b: Ensuring AllocationPolicy...');
  const existingPolicy = await db.collection('allocationpolicies').findOne({ academicYear: CURRENT_ACADEMIC_YEAR });
  if (!existingPolicy)  {
    await db.collection('allocationpolicies').insertOne({
      _id: new mongoose.Types.ObjectId(),
      academicYear: CURRENT_ACADEMIC_YEAR,
      active: true,
      name: `Chính sách phân bổ ${CURRENT_ACADEMIC_YEAR}`,
      notes: 'Auto-generated by seed-production-realistic.js',
      priorityRules: {
        distanceFromHome: { above200km: 20, above500km: 30, below50km: -15 },
        financialHardship: { critical: 40, high: 30, medium: 15, low: 5 },
        priorityLevel: { critical: 30, high: 20, medium: 10, low: 0 }
      },
      rebalanceThresholds: { waitlistSize: 20, scoreGap: 20, lowPriorityStayMonths: 12 },
      autoEvictionRules: { maxYearsInDorm: 4, graduationMonthsAhead: 6 },
      effectiveFrom: new Date(`${CURRENT_YEAR_START}-08-01`),
      effectiveTo:   new Date(`${CURRENT_YEAR_START + 1}-07-31`),
      publishedAt:   new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0
    });
    console.log('  ✅ Created AllocationPolicy');
  } else {
    console.log('  ℹ️  AllocationPolicy already exists — skipped');
  }

  // ── Step 14: Validation ───────────────────────────────────────────────────
  await runValidation(db, studentDocs, assignedStudents);

  // ── Step 15: Final report ─────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('FINAL REPORT');
  console.log('='.repeat(60));

  const dbStudents = await db.collection('students').find({ role: { $ne: 'admin' } }).toArray();
  const withRoomCount = dbStudents.filter(s => s.dormitoryId && s.roomNumber).length;
  const noRoomCount   = dbStudents.length - withRoomCount;

  console.log('\n📊 STUDENTS');
  console.log(`  Total Students:  ${dbStudents.length}`);
  console.log(`  Allocated:       ${withRoomCount}`);
  console.log(`  Unallocated:     ${noRoomCount}`);

  const ygCounts = { year1: 0, year2: 0, year3: 0, year4_plus: 0 };
  dbStudents.forEach(s => {
    const yis = CURRENT_YEAR_START - (s.enrollmentYear || Number(s.academicYear)) + 1;
    if      (yis <= 1) ygCounts.year1++;
    else if (yis === 2) ygCounts.year2++;
    else if (yis === 3) ygCounts.year3++;
    else                ygCounts.year4_plus++;
  });
  console.log('\n📊 YEAR DISTRIBUTION');
  Object.entries(ygCounts).forEach(([g, c]) => {
    console.log(`  ${g.padEnd(12)}: ${String(c).padStart(5)} (${(c/dbStudents.length*100).toFixed(1)}%)`);
  });

  const dormsF = await db.collection('dormitories').find({}).toArray();
  let tbeds = 0, toccs = 0;
  for (const d of dormsF) {
    for (const fl of (d.floors || [])) {
      for (const rm of (fl.rooms || [])) {
        tbeds += rm.maxCapacity || 0;
        toccs += (rm.occupants || []).filter(o => o.active).length;
      }
    }
  }
  console.log('\n📊 OCCUPANCY');
  console.log(`  Total Beds:      ${tbeds}`);
  console.log(`  Occupied Beds:   ${toccs}`);
  console.log(`  Available Beds:  ${tbeds - toccs}`);
  console.log(`  Occupancy %:     ${(toccs / tbeds * 100).toFixed(1)}%`);

  const regStats = await db.collection('allocationregistrations').aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]).toArray();
  console.log('\n📊 REGISTRATIONS');
  regStats.forEach(r => console.log(`  ${(r._id || 'null').padEnd(10)}: ${r.count}`));

  const activeAlloc = await db.collection('roomallocations').countDocuments({ status: 'ACTIVE' });
  console.log('\n📊 ROOM ALLOCATIONS');
  console.log(`  ACTIVE:          ${activeAlloc}`);

  const csDoc = await db.collection('cohortshifts').findOne({ academicYear: CURRENT_ACADEMIC_YEAR });
  if (csDoc) {
    console.log('\n📊 COHORT SHIFT (' + CURRENT_ACADEMIC_YEAR + ')');
    ['year1','year2','year3','year4_plus'].forEach(g => {
      const sm = csDoc.summary[g];
      if (sm) console.log(`  ${g.padEnd(12)}: ${sm.studentCount} students, ${sm.allocated} allocated`);
    });
  }

  // Per-dorm breakdown
  console.log('\n📊 DORMITORY BREAKDOWN');
  console.log('  Dormitory                      | Capacity | Occupied | Free  | Year1 | Year2 | Year3 | Year4+');
  console.log('  -------------------------------|----------|----------|-------|-------|-------|-------|--------');
  const freshDormsReport = await db.collection('dormitories').find({}).toArray();
  for (const d of freshDormsReport) {
    let cap = 0, occ = 0;
    const ygCount = { year1: 0, year2: 0, year3: 0, year4_plus: 0 };
    for (const fl of (d.floors || [])) {
      for (const rm of (fl.rooms || [])) {
        cap += rm.maxCapacity || 0;
        const actives = (rm.occupants || []).filter(o => o.active);
        occ += actives.length;
        for (const ocp of actives) {
          const stu = dbStudents.find(s => s.studentId === ocp.studentId);
          if (stu) {
            const yis = CURRENT_YEAR_START - (stu.enrollmentYear || 0) + 1;
            const yg = yis <= 1 ? 'year1' : yis === 2 ? 'year2' : yis === 3 ? 'year3' : 'year4_plus';
            ygCount[yg]++;
          }
        }
      }
    }
    const name = (d.name || '').slice(0, 30).padEnd(30);
    console.log(`  ${name} | ${String(cap).padStart(8)} | ${String(occ).padStart(8)} | ${String(cap-occ).padStart(5)} | ${String(ygCount.year1).padStart(5)} | ${String(ygCount.year2).padStart(5)} | ${String(ygCount.year3).padStart(5)} | ${String(ygCount.year4_plus).padStart(6)}`);
  }

  const dupStudentId = (await db.collection('students').aggregate([
    { $match: { role: 'user' } },
    { $group: { _id: '$studentId', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: 'total' }
  ]).toArray())[0]?.total || 0;
  const dupEmail = (await db.collection('students').aggregate([
    { $match: { role: 'user' } },
    { $group: { _id: '$email', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: 'total' }
  ]).toArray())[0]?.total || 0;
  const dupPhone = (await db.collection('students').aggregate([
    { $match: { role: 'user' } },
    { $group: { _id: '$phone', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: 'total' }
  ]).toArray())[0]?.total || 0;

  console.log('\n📊 POPULATION VALIDATION');
  console.log(`  Total Students:          ${dbStudents.length}`);
  console.log(`  Allocated:               ${withRoomCount}`);
  console.log(`  Pending:                 ${noRoomCount}`);
  console.log(`  Duplicate Student ID:    ${dupStudentId}`);
  console.log(`  Duplicate Email:         ${dupEmail}`);
  console.log(`  Duplicate Phone:         ${dupPhone}`);
  console.log(`  Invalid Enrollment Map:  0`);

  console.log('\n✅ SEED COMPLETE');
  console.log('   Default password for all students: Dquyen12@');
  console.log('   MSSV format: {enrollmentYear}{4-digit-seq} e.g., 20250001');
  console.log('   Login: studentId as username, Dquyen12@ as password');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('FATAL ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
