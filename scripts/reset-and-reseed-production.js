/**
 * reset-and-reseed-production.js
 *
 * Deletes: students (except admintest + 99999999), roomAllocations,
 *          allocationCycles, allocationPolicies, registrationQueues, sim_*
 * Keeps:   dormitories, rooms, users (admintest, 99999999)
 * Seeds:   1,910 students at 68.3% occupancy (1,190 in room + 720 without)
 *
 * Cohort table (Fix 5 — more no-room students for realistic competition):
 *   2022xxx: 120 in room + 60 without = 180 total
 *   2023xxx: 290 in room + 180 without = 470 total
 *   2024xxx: 370 in room + 200 without = 570 total
 *   2025xxx: 410 in room + 280 without = 690 total
 *
 * MSSV format: 2022_0001, 2022_0002, ...
 * Gender split: ~55% male, ~45% female per cohort
 * Profiles: varied distribution (Fix 2) + globally unique names (Fix 3)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

const { DormitoryCollection, StudentCollection } = require('../src/config/config');
const RoomAllocation   = require('../src/schemas/RoomAllocationSchema');
const AllocationCycle  = require('../src/schemas/AllocationCycleSchema');
const AllocationPolicy = require('../src/schemas/AllocationPolicySchema');

const SIM_COLLECTIONS = [
  'sim_workspaces','sim_students','sim_dormitories','sim_policies',
  'sim_cycles','sim_registrations','sim_runs','sim_applies'
];

// ── Name pools ───────────────────────────────────────────────────────────────
const LAST_NAMES  = ['Nguyễn','Trần','Lê','Phạm','Hoàng','Huỳnh','Phan','Vũ','Võ','Đặng',
  'Bùi','Đỗ','Hồ','Ngô','Dương','Lý','Đinh','Trịnh','Đào','Mai',
  'Trương','Tô','Lưu','Hà','Tạ','Thái','Mạc','Tống','Cao','Vương'];
const MALE_NAMES  = ['Minh','Tuấn','Đức','Hùng','Nam','Khánh','Phúc','Thành','Long','Hải',
  'Dũng','Quân','Bình','Tú','Mạnh','Trung','Khải','Vinh','Tùng','Đạt',
  'Nhân','Bảo','Công','Hữu','Quốc','Văn','Trọng','Anh','Tiến','Kiên'];
const FEMALE_NAMES= ['Lan','Hoa','Mai','Linh','Hương','Thu','Tuyết','Ngọc','Thảo','Nhung',
  'Uyên','Chi','Diệp','Hằng','Loan','Trang','Nhi','Xuân','Yến','Phương',
  'Thanh','Kim','Bích','Nhài','Mỹ','Hà','Vân','Lụa','Thúy','Hiền'];
const MIDDLE_M    = ['Văn','Hữu','Công','Đức','Quốc','Gia','Hoàng','Trung','Minh','Phước',
  'Thanh','Bảo','Duy','Ngọc','Đình','Xuân','Tiến','Hải','Sơn','Tuấn'];               // 20
const MIDDLE_F    = ['Thị','Ngọc','Thanh','Bích','Kim','Thu','Lan','Mỹ','Diễm','Hoàng',
  'Phương','Hương','Linh','Tuyết','Xuân','Mai','Hà','Thùy','Gia','Khánh'];           // 20
const FACULTIES   = [
  'Công nghệ Thông tin','Điện tử Viễn thông','Kỹ thuật Điện','Cơ khí',
  'Kỹ thuật Hóa học','Vật lý Kỹ thuật','Toán Tin ứng dụng','Kỹ thuật Máy tính',
  'Kinh tế Kỹ thuật','Công nghệ Sinh học','Hàng không Vũ trụ','Quản lý Công nghiệp',
];

// Province pools by distance band (Fix 2)
const PROV_NEAR   = [ // ≤ 50km → distScore = -10
  ['Hà Nội', 5], ['Bắc Ninh', 30], ['Hưng Yên', 25], ['Hà Nam', 55], ['Vĩnh Phúc', 52],
];
const PROV_MEDIUM = [ // 51–200km → distScore = +10
  ['Hải Phòng', 102], ['Thái Bình', 110], ['Nam Định', 90], ['Ninh Bình', 93],
  ['Quảng Ninh', 170], ['Thái Nguyên', 80], ['Thanh Hóa', 150], ['Hòa Bình', 74],
  ['Bắc Giang', 50], ['Phú Thọ', 90], ['Hải Dương', 60], ['Bắc Kạn', 160],
];
const PROV_FAR    = [ // 201–500km → distScore = +20
  ['Nghệ An', 295], ['Hà Tĩnh', 340], ['Sơn La', 320], ['Cao Bằng', 272],
  ['Lào Cai', 296], ['Điện Biên', 480], ['Quảng Bình', 450], ['Quảng Trị', 500],
  ['Yên Bái', 185], ['Tuyên Quang', 165], ['Lai Châu', 450], ['Hà Giang', 320],
];
const PROV_VFAR   = [ // > 500km → distScore = +30
  ['Thừa Thiên Huế', 565], ['Đà Nẵng', 763], ['Bình Định', 1065],
  ['Khánh Hòa', 1278], ['Đắk Lắk', 1400], ['TP.HCM', 1730],
  ['Cần Thơ', 1877], ['Kiên Giang', 1900], ['Gia Lai', 1200], ['Kon Tum', 1330],
  ['Đà Lạt', 1530], ['Cà Mau', 2200],
];

// Deterministic hash for varied but reproducible distributions (Fix 2).
// NOTE: the previous form `(a*9301 + b*49297 + 1) % mod` was effectively linear in
// the salt — for a fixed `a`, changing `b` only shifted the result by a constant
// mod `mod`, so every salted field (tier/distance/family/dorm) was perfectly
// correlated and the scores collapsed into 1-2 buckets. This is a proper avalanche
// hash so different salts give genuinely independent values.
function det(a, b, mod) {
  let h = (Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x297a2d39) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) % mod;
}

// ── Globally-unique name generator (Fix 1) ───────────────────────────────────
// A sequential per-gender counter maps each student to a unique name. To avoid a
// monotone prefix (the first 30 all sharing the same middle+first, e.g.
// "X Văn Minh"), we don't walk the radix digits in order. Instead we multiply the
// counter by a stride that is COPRIME to the full name space N = 30×20×30 = 18,000.
// Because gcd(stride, N) = 1, `seq*stride % N` is a bijection over [0, N) — so the
// names stay globally unique (no birthday-paradox collisions, no period-60 repeat)
// while consecutive students get last/middle/first that all change every row.
let _maleNameSeq = 0, _femaleNameSeq = 0;
const NAME_STRIDE = 7919; // prime, coprime to 18,000 (= 2^4·3^2·5^3)
function nextUniqueName(gender) {
  const isF    = gender === 'female';
  const seq    = isF ? _femaleNameSeq++ : _maleNameSeq++;
  const lasts  = LAST_NAMES;                       // 30
  const mids   = isF ? MIDDLE_F : MIDDLE_M;        // 20
  const firsts = isF ? FEMALE_NAMES : MALE_NAMES;  // 30
  const N      = lasts.length * mids.length * firsts.length; // 18,000
  const code   = (seq * NAME_STRIDE) % N;
  const last  = lasts[code % lasts.length];
  const mid   = mids[Math.floor(code / lasts.length) % mids.length];
  const first = firsts[Math.floor(code / (lasts.length * mids.length)) % firsts.length];
  return `${last} ${mid} ${first}`;
}
function detProv(nameIdx) {
  const g = det(nameIdx, 3, 100);
  if (g < 15) return PROV_VFAR[det(nameIdx, 5, PROV_VFAR.length)];
  if (g < 50) return PROV_FAR[det(nameIdx, 5, PROV_FAR.length)];
  if (g < 85) return PROV_MEDIUM[det(nameIdx, 5, PROV_MEDIUM.length)];
  return PROV_NEAR[det(nameIdx, 5, PROV_NEAR.length)];
}

// MSSV format: 2022_0001
function makeMSSV(prefix, idx) {
  return `${prefix}_${String(idx).padStart(4, '0')}`;
}

// ── Tier-based profile generation (Fix 2: avoid flat-100 allocated) ───────────
// Each cohort gets a realistic spread of priority profiles. The 5% / 15% quota
// cohorts (Năm 4+, Năm 3) only seat their very top candidates — so if too many
// students cap at 100 the whole allocated list is flat 100. We give the OLDER
// cohorts a small high-need tail (FAR_POOR) and a large body of medium/low
// profiles, so the seated top spans several distinct scores.
//
// Tiers (high → low):
//   FAR_POOR     — xa, nghèo, chính sách      → caps ~100
//   MEDIUM       — TB/xa, bình thường         → ~68-100 (depends on year base)
//   NEAR_NORMAL  — gần/TB, bình thường        → mid
//   NEAR_COMFORT — gần, khá giả               → low
//   VIOLATION    — gần, khá giả, vi phạm      → very low
//
// Cumulative percentage thresholds per enrollment year.
const TIER_DIST = {
  2025: [15, 50, 80, 95, 100], // Năm 1→2: nhiều người cần KTX
  2024: [12, 45, 75, 92, 100], // Năm 2→3
  2023: [10, 30, 60, 82, 100], // Năm 3→4+: ít người điểm cao → top đa dạng
  2022: [10, 30, 60, 82, 100], // Năm 4+→5+ (rời KTX, không xét điểm)
};

function pickBand(pool, nameIdx) {
  return pool[det(nameIdx, 5, pool.length)];
}

function buildTierProfile(prefix, nameIdx) {
  const pct = det(nameIdx, 41, 100);          // uniform tier percentile (decoupled from room status)
  const sub = det(nameIdx, 43, 100);          // intra-tier variation
  const th  = TIER_DIST[prefix] || TIER_DIST[2023];
  const tier =
      pct < th[0] ? 'FAR_POOR'
    : pct < th[1] ? 'MEDIUM'
    : pct < th[2] ? 'NEAR_NORMAL'
    : pct < th[3] ? 'NEAR_COMFORT'
    :               'VIOLATION';

  const noPolicy = { financialHardship: false, ethnicMinority: false, disabled: false, ruralPolicy: false, scholarship: false };
  let prov, familySituation, priorityPolicies, violationHistory;

  switch (tier) {
    case 'FAR_POOR':
      prov = sub < 45 ? pickBand(PROV_VFAR, nameIdx) : pickBand(PROV_FAR, nameIdx);
      familySituation = 'poor';
      priorityPolicies = {
        financialHardship: true,
        ethnicMinority:    sub < 35,
        disabled:          sub < 6,
        ruralPolicy:       prov[1] > 200,
        scholarship:       sub < 25,
      };
      violationHistory = 'none';
      break;
    case 'MEDIUM':
      // Span THREE distance bands + an independent scholarship bonus so the seated
      // top of a small-quota cohort (Năm 4+/Năm 3) lands on several distinct
      // scores instead of one flat value.
      prov = sub < 25 ? pickBand(PROV_VFAR, nameIdx)
           : sub < 60 ? pickBand(PROV_FAR, nameIdx)
           :            pickBand(PROV_MEDIUM, nameIdx);
      familySituation = 'average';
      priorityPolicies = { ...noPolicy, scholarship: det(nameIdx, 53, 100) < 30 };
      violationHistory = det(nameIdx, 61, 100) < 90 ? 'none' : 'minor';
      break;
    case 'NEAR_NORMAL':
      prov = sub < 50 ? pickBand(PROV_MEDIUM, nameIdx) : pickBand(PROV_NEAR, nameIdx);
      familySituation = 'average';
      priorityPolicies = { ...noPolicy, scholarship: det(nameIdx, 53, 100) < 20 };
      violationHistory = det(nameIdx, 61, 100) < 88 ? 'none' : 'minor';
      break;
    case 'NEAR_COMFORT':
      prov = sub < 60 ? pickBand(PROV_NEAR, nameIdx) : pickBand(PROV_MEDIUM, nameIdx);
      familySituation = 'wealthy';
      priorityPolicies = { ...noPolicy };
      violationHistory = 'none';
      break;
    case 'VIOLATION':
    default:
      prov = sub < 55 ? pickBand(PROV_NEAR, nameIdx) : pickBand(PROV_MEDIUM, nameIdx);
      familySituation = sub < 50 ? 'wealthy' : 'average';
      priorityPolicies = { ...noPolicy };
      violationHistory = sub < 60 ? 'minor' : 'major';
      break;
  }

  return { tier, province: prov[0], distanceToHanoi: prov[1], familySituation, priorityPolicies, violationHistory };
}

// Violation distribution by enrollment year (Fix 2)
const VIOL_BY_YEAR = {
  2025: [92, 8, 0],   // [clean%, minor%, major%] — first time, mostly clean
  2024: [85, 12, 3],
  2023: [78, 17, 5],
  2022: [70, 22, 8],
};

/**
 * makeStudent — Fix 2 (realistic profiles) + Fix 3 (globally unique names)
 * @param {number} prefix      - enrollment year prefix (2022-2025)
 * @param {number} mssvIdx     - per-cohort MSSV counter (resets per cohort)
 * @param {string} gender      - 'male'|'female'
 * @param {number} nameIdx     - global name index (never resets, ensures name variety)
 * @param {boolean} hasRoom    - true if this student currently lives in KTX
 */
function makeStudent(prefix, mssvIdx, gender, nameIdx, hasRoom) {
  const g     = gender;
  const fullName = nextUniqueName(g); // Fix 1: globally unique, decorrelated
  const mssv  = makeMSSV(prefix, mssvIdx);
  const fac   = FACULTIES[det(nameIdx, 37, FACULTIES.length)];
  const kYear = `K${prefix - 2021 + 66}`;

  // Tier-based profile (Fix 2): cohort-specific spread so the small-quota cohorts
  // don't end up with an all-100 allocated list.
  const p = buildTierProfile(prefix, nameIdx);

  // Dorm history — realistic based on whether they currently have a room
  const dormGroup = det(nameIdx, 23, 100);
  let dormHistory;
  if (prefix === 2025) {
    dormHistory = 'never_stayed'; // first year in university
  } else if (hasRoom) {
    dormHistory = 'good_history'; // currently staying → good record
  } else {
    // Not in KTX this year — might have bad history or never tried
    const badPct = prefix === 2024 ? 10 : prefix === 2023 ? 20 : 30;
    dormHistory = dormGroup < badPct ? 'bad_history' : 'never_stayed';
  }

  return {
    name:      fullName,
    username:  `sv${mssv.replace('_', '')}`,
    studentId: mssv,
    email:     `${mssv.replace('_', '')}@sis.hust.edu.vn`,
    phone:     `096${String(nameIdx).padStart(7, '0')}`,
    gender:    g,
    faculty:   fac,
    role:      'user',
    academicYear:    kYear,
    enrollmentYear:  prefix,
    province:        p.province,
    distanceToHanoi: p.distanceToHanoi,
    familySituation: p.familySituation,
    priorityPolicies: p.priorityPolicies,
    violationHistory: p.violationHistory,
    dormHistory,
    dormitoryId:   null,
    roomNumber:    null,
    isTestAccount: false,
    priorityScore: 0,
  };
}

// yearGroup for RoomAllocationSchema enum: 'year1','year2_3','year4_plus'
function yearGroupForAlloc(prefix) {
  if (prefix <= 2022) return 'year4_plus';
  if (prefix === 2023) return 'year4_plus';
  if (prefix === 2024) return 'year2_3';
  return 'year1';
}

async function run() {
  const conn = mongoose.connection;
  await new Promise(r => (conn.readyState === 1 ? r() : conn.once('connected', r)));
  console.log('Connected to MongoDB\n');

  // Fix 1: reset name counters so re-runs stay deterministic
  _maleNameSeq = 0; _femaleNameSeq = 0;

  // ── PHASE 1: Read dorm layout ─────────────────────────────────────────────
  console.log('=== PHASE 1: READ DORM LAYOUT ===');
  const dorms = await DormitoryCollection.find({ isDeleted: { $ne: true } }).lean();
  let totalBeds = 0;

  // Build gender-separated bed slot pools
  const maleSlots   = []; // { dormId, dormName, floorNum, roomId, roomNum, cap }
  const femaleSlots = [];
  const mixedSlots  = [];

  dorms.forEach(d => {
    (d.floors || []).forEach(f => {
      (f.rooms || []).forEach(r => {
        const cap = r.maxCapacity || 0;
        totalBeds += cap;
        const slot = {
          dormId: d._id, dormName: d.name, dormGender: d.gender || 'mixed',
          floorNum: f.floorNumber, roomId: r._id, roomNum: r.roomNumber, cap
        };
        const pool = d.gender === 'male' ? maleSlots
                   : d.gender === 'female' ? femaleSlots
                   : mixedSlots;
        // Push one entry per bed
        for (let i = 0; i < cap; i++) pool.push(slot);
      });
    });
  });

  console.log(`Dorms: ${dorms.length} | Total beds: ${totalBeds}`);
  console.log(`Male bed slots: ${maleSlots.length} | Female: ${femaleSlots.length} | Mixed: ${mixedSlots.length}`);

  // Sort for deterministic order
  const sortSlots = arr => arr.sort((a, b) =>
    (a.dormName + a.floorNum + a.roomNum).localeCompare(b.dormName + b.floorNum + b.roomNum)
  );
  sortSlots(maleSlots);
  sortSlots(femaleSlots);
  sortSlots(mixedSlots);

  // If all dorms are mixed (gender-neutral), split mixedSlots evenly
  // so male and female students can share the same pool
  const allMixed = maleSlots.length === 0 && femaleSlots.length === 0;
  if (allMixed) {
    // Use a single unified slot counter for mixed dorms
    console.log('All dorms are mixed — using unified slot pool');
  }

  // ── PHASE 2: Clear old data ───────────────────────────────────────────────
  console.log('\n=== PHASE 2: CLEARING OLD DATA ===');

  // Clear occupants in dorm rooms
  await DormitoryCollection.updateMany({}, {
    $set: { 'floors.$[].rooms.$[].occupants': [], 'floors.$[].rooms.$[].currentOccupancy': 0 }
  });
  console.log('Cleared dormitory room occupants');

  // Clear dormitoryId/roomNumber from protected students
  await StudentCollection.updateMany(
    { $or: [{ username: 'admintest' }, { studentId: '99999999' }] },
    { $set: { dormitoryId: null, roomNumber: null } }
  );

  // Delete all regular students
  const delResult = await StudentCollection.deleteMany({
    username: { $nin: ['admintest'] },
    studentId: { $nin: ['99999999'] },
    role: { $ne: 'admin' }
  });
  console.log(`Deleted ${delResult.deletedCount} students`);

  // Delete allocation data
  const [raResult, acResult, apResult] = await Promise.all([
    RoomAllocation.deleteMany({}),
    AllocationCycle.deleteMany({}),
    AllocationPolicy.deleteMany({})
  ]);
  console.log(`Deleted ${raResult.deletedCount} RoomAllocations, ${acResult.deletedCount} Cycles, ${apResult.deletedCount} Policies`);

  // Delete queues + sim collections
  const db = mongoose.connection.db;
  const colls = await db.listCollections().toArray();
  const collNames = new Set(colls.map(c => c.name));

  if (collNames.has('registrationQueues')) {
    await db.collection('registrationQueues').deleteMany({});
    console.log('Cleared registrationQueues');
  }
  for (const name of SIM_COLLECTIONS) {
    if (collNames.has(name)) {
      await db.collection(name).deleteMany({});
      console.log(`Cleared ${name}`);
    }
  }

  // ── PHASE 3: Seed students ────────────────────────────────────────────────
  console.log('\n=== PHASE 3: SEEDING STUDENTS ===');

  const hashedPw = await bcrypt.hash('Dquyen12@', 10);

  // Slot index trackers
  let maleIdx = 0, femaleIdx = 0, mixedIdx = 0;

  // dormOccupantUpdates: dormId → { floorNum → { roomNum → occupants[] } }
  const dormOccupants = {};
  // roomAllocDocs to bulk-insert later
  const roomAllocDocs = [];

  function ensureMap(dormId, floorNum, roomNum) {
    dormOccupants[dormId] = dormOccupants[dormId] || {};
    dormOccupants[dormId][floorNum] = dormOccupants[dormId][floorNum] || {};
    dormOccupants[dormId][floorNum][roomNum] = dormOccupants[dormId][floorNum][roomNum] || [];
  }

  function assignRoom(student, studentMongoId, cycleId) {
    // Pick from gender-matched pool; fall back to mixed then any
    let slot = null;
    if (student.gender === 'male') {
      if (maleIdx < maleSlots.length)         slot = maleSlots[maleIdx++];
      else if (mixedIdx < mixedSlots.length)  slot = mixedSlots[mixedIdx++];
      else if (femaleIdx < femaleSlots.length) slot = femaleSlots[femaleIdx++];
    } else {
      if (femaleIdx < femaleSlots.length)     slot = femaleSlots[femaleIdx++];
      else if (mixedIdx < mixedSlots.length)  slot = mixedSlots[mixedIdx++];
      else if (maleIdx < maleSlots.length)    slot = maleSlots[maleIdx++];
    }
    if (!slot) return; // no beds left

    student.dormitoryId = slot.dormId;
    student.roomNumber  = slot.roomNum;

    const dormKey = String(slot.dormId);
    ensureMap(dormKey, slot.floorNum, slot.roomNum);
    dormOccupants[dormKey][slot.floorNum][slot.roomNum].push({
      studentId:   student.studentId,
      name:        student.name,
      checkInDate: new Date('2025-09-01'),
      active:      true
    });

    roomAllocDocs.push({
      academicYear:         '2025-2026',
      allocationCycleId:    cycleId,
      studentId:            studentMongoId,
      roomId:               slot.roomId,
      studentYearGroup:     yearGroupForAlloc(student.enrollmentYear),
      studentFaculty:       student.faculty,
      studentEnrollmentYear: student.enrollmentYear,
      dormitoryId:          slot.dormId,
      roomNumber:           slot.roomNum,
      buildingCode:         slot.dormName,
      roomCapacity:         slot.cap,
      allocationType:       'AUTO',
      allocationReason:     'Seed — phân bổ ban đầu 2025-2026',
      status:               'ACTIVE',
      startDate:            new Date('2025-09-01')
    });
  }

  // Cohort config: [prefix, inRoom, noRoom] — Fix 5: more no-room students for realistic queue competition
  const COHORTS = [
    [2022, 120, 60],   // total 180 — năm 5 (sắp ra trường)
    [2023, 290, 180],  // total 470 — năm 4+ (was 370)
    [2024, 370, 200],  // total 570 — năm 3  (was 460)
    [2025, 410, 280],  // total 690 — năm 2  (was 540)
  ];

  // Create a placeholder cycle ID — will replace after actual cycle insert
  // We insert cycle first, then use its _id
  console.log('Creating AllocationCycle for 2025-2026 (historical, COMPLETED)...');
  const now = new Date();
  const historicalCycle = await AllocationCycle.create({
    academicYear: '2025-2026',
    name: 'Main Registration',
    registrationStart: new Date('2025-08-01'),
    registrationEnd:   new Date('2025-08-31'),
    allocationDate:    new Date('2025-09-01'),
    status: 'COMPLETED',
    capacitySnapshot: { totalRooms: 265, totalBeds: totalBeds },
    notes: 'Chu kỳ lịch sử — seed tự động'
  });
  console.log('Historical cycle:', historicalCycle._id);

  const allNewStudents = [];
  let GLOBAL_NAME_IDX = 1; // Fix 3: never resets — ensures unique names across all cohorts

  for (const [prefix, inRoomCount, noRoomCount] of COHORTS) {
    const total = inRoomCount + noRoomCount;
    const maleTotal  = Math.ceil(total * 0.55);
    const femaleTotal = total - maleTotal;
    const maleInRoom  = Math.ceil(inRoomCount * 0.55);
    const femaleInRoom = inRoomCount - maleInRoom;

    let mssvIdx = 1; // per-cohort MSSV counter — resets per cohort

    // Male students
    for (let i = 0; i < maleTotal; i++) {
      const hasRoom = i < maleInRoom;
      const st = makeStudent(prefix, mssvIdx++, 'male', GLOBAL_NAME_IDX++, hasRoom);
      st.password = hashedPw;
      if (hasRoom) st._needsRoom = true;
      allNewStudents.push(st);
    }

    // Female students
    for (let i = 0; i < femaleTotal; i++) {
      const hasRoom = i < femaleInRoom;
      const st = makeStudent(prefix, mssvIdx++, 'female', GLOBAL_NAME_IDX++, hasRoom);
      st.password = hashedPw;
      if (hasRoom) st._needsRoom = true;
      allNewStudents.push(st);
    }
    console.log(`  Planned ${total} × ${prefix}xxx (${inRoomCount} in room, ${noRoomCount} without)`);
  }

  // Insert students in bulk, then assign rooms by iterating inserted docs
  // Remove _needsRoom flag before insert (not a schema field)
  const needsRoomFlags = allNewStudents.map(s => s._needsRoom || false);
  allNewStudents.forEach(s => delete s._needsRoom);

  const inserted = await StudentCollection.insertMany(allNewStudents, { ordered: true });
  console.log(`Inserted ${inserted.length} students`);

  // Assign rooms to students that need them
  for (let i = 0; i < inserted.length; i++) {
    if (!needsRoomFlags[i]) continue;
    const doc = inserted[i];
    const st  = allNewStudents[i];
    st.dormitoryId = null;
    st.roomNumber  = null;
    assignRoom(st, doc._id, historicalCycle._id);
    if (st.dormitoryId) {
      // Update student doc with room
      await StudentCollection.updateOne(
        { _id: doc._id },
        { $set: { dormitoryId: st.dormitoryId, roomNumber: st.roomNumber } }
      );
    }
  }

  // Handle 99999999 — re-assign its room
  console.log('\nRe-assigning room for 99999999...');
  const demo = await StudentCollection.findOne({ studentId: '99999999' }).lean();
  if (demo) {
    const demoSt = {
      studentId: '99999999',
      name: demo.name || 'Sinh Viên Demo',
      gender: demo.gender || 'male',
      faculty: demo.faculty || 'Công nghệ thông tin',
      enrollmentYear: 2025,
      dormitoryId: null, roomNumber: null
    };
    assignRoom(demoSt, demo._id, historicalCycle._id);
    if (demoSt.dormitoryId) {
      await StudentCollection.updateOne(
        { _id: demo._id },
        { $set: { dormitoryId: demoSt.dormitoryId, roomNumber: demoSt.roomNumber, isTestAccount: true } }
      );
      console.log(`  99999999 → ${demoSt.roomNumber} (dorm ${demoSt.dormitoryId})`);
    }
  } else {
    console.log('  99999999 not found (skipped)');
  }

  // ── PHASE 4: Update dormitory occupants ───────────────────────────────────
  console.log('\n=== PHASE 4: UPDATING DORMITORY OCCUPANTS ===');
  let roomsUpdated = 0;
  for (const dorm of dorms) {
    const dormMap = dormOccupants[String(dorm._id)];
    if (!dormMap) continue;
    for (const floor of dorm.floors || []) {
      const floorMap = dormMap[floor.floorNumber];
      if (!floorMap) continue;
      for (const room of floor.rooms || []) {
        const occupants = floorMap[room.roomNumber];
        if (!occupants || !occupants.length) continue;
        await DormitoryCollection.updateOne(
          { _id: dorm._id },
          {
            $set: {
              [`floors.$[fl].rooms.$[rm].occupants`]:        occupants,
              [`floors.$[fl].rooms.$[rm].currentOccupancy`]: occupants.length
            }
          },
          { arrayFilters: [{ 'fl.floorNumber': floor.floorNumber }, { 'rm.roomNumber': room.roomNumber }] }
        );
        roomsUpdated++;
      }
    }
  }
  console.log(`Updated ${roomsUpdated} rooms with occupants`);

  // ── PHASE 5: Insert RoomAllocations ──────────────────────────────────────
  console.log('\n=== PHASE 5: INSERTING ROOM ALLOCATIONS ===');
  if (roomAllocDocs.length) {
    await RoomAllocation.insertMany(roomAllocDocs, { ordered: false });
    console.log(`Inserted ${roomAllocDocs.length} RoomAllocation records`);
  }

  // ── PHASE 6: Seed Policy + Pending Cycle for 2026-2027 ───────────────────
  console.log('\n=== PHASE 6: SEEDING POLICY & CYCLE 2026-2027 ===');

  const policy = await AllocationPolicy.create({
    academicYear: '2026-2027',
    active: true,
    priorityRules: {
      yearGroupWeights: { year1: 30, year2_3: 10, year4_plus: -10 },
      financialHardship: { verified: 20, notVerified: 0 },
      distanceFromHome: { above500km: 30, above200km: 20, below50km: -10 },
      scholarship: 10,
      violations: { none: 5, minor: -10, major: -25, critical: -40 },
      familyWealth: { poor: 25, average: 0, wealthy: -10 }
    },
    quotaConfig: {
      year1:     50,
      year2:     30,
      year3:     15,
      year4plus:  5,
      allowOverflow: false
    },
    notes: 'Chính sách 2026-2027 — quota động, seed tự động'
  });
  console.log('Created AllocationPolicy:', policy._id);

  const pendingCycle = await AllocationCycle.create({
    academicYear: '2026-2027',
    name: 'Main Registration',
    registrationStart: new Date(now.getTime() + 7 * 86400000),
    registrationEnd:   new Date(now.getTime() + 37 * 86400000),
    allocationDate:    new Date(now.getTime() + 42 * 86400000),
    status: 'PENDING',
    capacitySnapshot: { totalRooms: 265, totalBeds: totalBeds },
    notes: 'Chu kỳ chờ phân bổ 2026-2027 — seed tự động'
  });
  console.log('Created AllocationCycle (PENDING):', pendingCycle._id);

  // ── PHASE 7: Final verification ───────────────────────────────────────────
  console.log('\n=== FINAL VERIFICATION ===');
  const totalStudents = await StudentCollection.countDocuments({
    username: { $ne: 'admintest' },
    studentId: { $ne: '99999999' },
    role: { $ne: 'admin' }
  });
  const activeAllocs = await RoomAllocation.countDocuments({ status: 'ACTIVE' });
  const occupied = await countOccupied();

  console.log(`Regular students:  ${totalStudents} (expected 1,910)`);
  console.log(`Active allocations: ${activeAllocs} (expected ~1,191)`);
  console.log(`Occupied beds:      ${occupied} / ${totalBeds} (${Math.round(occupied/totalBeds*100)}%, target 68.3%)`);

  for (const [prefix, inRoom, noRoom] of COHORTS) {
    const prefix4 = `${prefix}_`;
    const count = await StudentCollection.countDocuments({
      studentId: { $regex: `^${prefix4}` }
    });
    const withRoom = await StudentCollection.countDocuments({
      studentId: { $regex: `^${prefix4}` }, dormitoryId: { $ne: null }
    });
    console.log(`  ${prefix}xxx: ${count} total, ${withRoom} in room (expected ${inRoom+noRoom}, ${inRoom} in room)`);
  }

  process.exit(0);
}

async function countOccupied() {
  const dorms = await DormitoryCollection.find(
    { isDeleted: { $ne: true } },
    { 'floors.rooms.occupants': 1 }
  ).lean();
  let occ = 0;
  dorms.forEach(d => (d.floors||[]).forEach(f => (f.rooms||[]).forEach(r => {
    occ += (r.occupants||[]).filter(o => o.active).length;
  })));
  return occ;
}

run().catch(err => {
  console.error('FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
