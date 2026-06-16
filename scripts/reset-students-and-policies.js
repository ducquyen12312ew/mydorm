/**
 * Reset & Re-seed script
 * Clears: students (except admintest), roomAllocations, allocationCycles,
 *         allocationPolicies, registrationQueues, all sim_* collections,
 *         dormitory room occupants
 * Seeds:  new students with MSSV prefixes 2022-2025, special 99999999
 *         AllocationPolicy + AllocationCycle for 2026-2027
 * KEEPS:  dormitories & room structure
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const { DormitoryCollection, StudentCollection } = require('../src/config/config');
const RoomAllocation  = require('../src/schemas/RoomAllocationSchema');
const AllocationCycle = require('../src/schemas/AllocationCycleSchema');
const AllocationPolicy = require('../src/schemas/AllocationPolicySchema');

// Sim collections (safe to drop entirely)
const SIM_COLLECTIONS = [
  'sim_workspaces','sim_students','sim_dormitories','sim_policies',
  'sim_cycles','sim_registrations','sim_runs','sim_applies'
];

// ── Name pools ────────────────────────────────────────────────────────────────
const LAST_NAMES = ['Nguyễn','Trần','Lê','Phạm','Hoàng','Huỳnh','Phan','Vũ','Võ','Đặng',
  'Bùi','Đỗ','Hồ','Ngô','Dương','Lý','Đinh','Trịnh','Đào','Mai',
  'Trương','Tô','Đinh','Lưu','Hà','Tạ','Thái','Khúc','Mạc','Tống'];
const MALE_NAMES   = ['Minh','Tuấn','Đức','Hùng','Nam','Khánh','Phúc','Thành','Long','Hải',
  'Dũng','Quân','Bình','Tú','Mạnh','Trung','Khải','Vinh','Tùng','Đạt',
  'Nhân','Bảo','Công','Hữu','Quốc','Văn','Trọng','Anh','Tiến','Kiên'];
const FEMALE_NAMES = ['Lan','Hoa','Mai','Linh','Hương','Thu','Tuyết','Ngọc','Thảo','Nhung',
  'Uyên','Chi','Diệp','Hằng','Loan','Trang','Nhi','Xuân','Yến','Phương',
  'Thanh','Kim','Bích','Nhài','Mỹ','Hà','Vân','Lụa','Thúy','Hiền'];
const MIDDLE_M = ['Văn','Hữu','Trung','Công','Quốc','Đức','Minh','Gia','Hoàng','Phước'];
const MIDDLE_F = ['Thị','Ngọc','Thanh','Bích','Kim','Lan','Thu','Mỹ','Hoàng','Diễm'];
const FACULTIES = ['Công nghệ thông tin','Điện-Điện tử','Cơ khí','Xây dựng','Hóa học',
  'Vật lý kỹ thuật','Toán-Tin học','Quản lý công nghiệp','Môi trường','Khoa học ứng dụng'];
const PROVINCES_KM = [
  ['Hà Nội',5],['Hà Tây cũ',20],['Bắc Ninh',30],['Hưng Yên',25],['Vĩnh Phúc',50],
  ['Hải Dương',60],['Hải Phòng',100],['Quảng Ninh',150],['Nam Định',90],['Thái Bình',110],
  ['Thanh Hóa',160],['Nghệ An',295],['Hà Tĩnh',340],['Quảng Bình',500],['Huế',660],
  ['Đà Nẵng',760],['Quảng Nam',800],['Quảng Ngãi',880],['Bình Định',1000],['Phú Yên',1100],
  ['Khánh Hòa',1280],['Đắk Lắk',1450],['Lâm Đồng',1500],['TP.HCM',1730],['Cần Thơ',1870],
  ['An Giang',1950],['Kiên Giang',2050],['Cà Mau',2200],['Sơn La',320],['Điện Biên',480],
];

let _nameIdx = 0;
function makeStudent(prefix, idx, gender) {
  const g = gender || (idx % 2 === 0 ? 'male' : 'female');
  const last  = LAST_NAMES[idx % LAST_NAMES.length];
  const mid   = (g === 'male' ? MIDDLE_M : MIDDLE_F)[Math.floor(idx / 2) % 10];
  const first = (g === 'male' ? MALE_NAMES : FEMALE_NAMES)[(idx * 7 + 3) % 30];
  const num   = String(1000 + (idx % 9000)).padStart(4, '0');
  const mssv  = `${prefix}${num}`;
  const prov  = PROVINCES_KM[(idx * 3 + 5) % PROVINCES_KM.length];
  const fac   = FACULTIES[idx % FACULTIES.length];
  const poor  = prov[1] > 300 && idx % 4 === 0;
  return {
    name:      `${last} ${mid} ${first}`,
    username:  `sv${mssv}`,
    studentId: mssv,
    email:     `${mssv}@sis.hust.edu.vn`,
    phone:     `09${String(10000000 + idx).slice(1)}`,
    gender:    g,
    faculty:   fac,
    role:      'user',
    academicYear: `K${60 + (prefix - 2021)}`,
    enrollmentYear: prefix,
    province:   prov[0],
    distanceToHanoi: prov[1],
    familySituation: poor ? 'poor' : idx % 5 === 0 ? 'wealthy' : 'average',
    priorityPolicies: {
      financialHardship: poor,
      ethnicMinority:    idx % 15 === 0,
      disabled:          idx % 50 === 0,
      ruralPolicy:       prov[1] > 100,
      scholarship:       idx % 20 === 0
    },
    violationHistory: idx % 25 === 0 ? 'minor' : 'none',
    dormHistory:      idx % 3 === 0 ? 'good_history' : 'never_stayed',
    dormitoryId:   null,
    roomNumber:    null,
    isTestAccount: false,
    priorityScore: 50
  };
}

async function run() {
  const conn = mongoose.connection;
  await new Promise(r => (conn.readyState === 1 ? r() : conn.once('connected', r)));

  console.log('\n=== PHASE 1: READ DB STATE ===');
  const dorms = await DormitoryCollection.find({ isDeleted: { $ne: true } }).lean();
  let totalBeds = 0;
  const allRoomSlots = []; // { dormId, dormName, floorNum, roomId, roomNum, cap, gender }
  dorms.forEach(d => {
    (d.floors || []).forEach(f => {
      (f.rooms || []).forEach(r => {
        totalBeds += r.maxCapacity || 0;
        for (let i = 0; i < (r.maxCapacity || 0); i++) {
          allRoomSlots.push({
            dormId: d._id, dormName: d.name,
            floorNum: f.floorNumber, roomId: r._id,
            roomNum: r.roomNumber, cap: r.maxCapacity,
            gender: d.gender || 'mixed'
          });
        }
      });
    });
  });
  const targetOccupied = Math.floor(totalBeds * 0.82);
  console.log(`Beds: ${totalBeds} | Target occupied: ${targetOccupied} (82%)`);

  // Shuffle slots with seeded order (deterministic)
  const shuffled = allRoomSlots.slice().sort((a, b) =>
    (a.dormName + a.floorNum + a.roomNum).localeCompare(b.dormName + b.floorNum + b.roomNum)
  );

  // Distribute occupied slots by year group
  const dist = {
    2022: Math.floor(targetOccupied * 0.10),
    2023: Math.floor(targetOccupied * 0.25),
    2024: Math.floor(targetOccupied * 0.45),
    2025: Math.floor(targetOccupied * 0.20),
  };
  // Adjust rounding
  const allocated = Object.values(dist).reduce((a, b) => a + b, 0);
  dist[2024] += targetOccupied - allocated - 1; // -1 for 99999999
  console.log('Distribution:', JSON.stringify(dist));

  console.log('\n=== PHASE 2: CLEARING OLD DATA ===');

  // Clear occupants from dormitory rooms
  await DormitoryCollection.updateMany({}, {
    $set: { 'floors.$[].rooms.$[].occupants': [], 'floors.$[].rooms.$[].currentOccupancy': 0 }
  });
  console.log('Cleared dormitory occupants');

  // Delete students (keep admintest)
  const admintest = await StudentCollection.findOne({ username: 'admintest' }).lean();
  const delSt = await StudentCollection.deleteMany({ username: { $nin: ['admintest'] }, role: { $ne: 'admin' } });
  console.log(`Deleted ${delSt.deletedCount} students`);

  // Delete allocations, cycles, policies
  const db = mongoose.connection.db;
  const colls = await db.listCollections().toArray();
  const collNames = colls.map(c => c.name);

  await RoomAllocation.deleteMany({});
  console.log('Deleted RoomAllocations');
  await AllocationCycle.deleteMany({});
  console.log('Deleted AllocationCycles');
  await AllocationPolicy.deleteMany({});
  console.log('Deleted AllocationPolicies');

  if (collNames.includes('registrationQueues')) {
    await db.collection('registrationQueues').deleteMany({});
    console.log('Deleted registrationQueues');
  }

  // Drop sim_* collections
  for (const name of SIM_COLLECTIONS) {
    if (collNames.includes(name)) {
      await db.collection(name).deleteMany({});
      console.log(`Cleared ${name}`);
    }
  }

  console.log('\n=== PHASE 3: SEEDING STUDENTS ===');

  const hashedPw = await bcrypt.hash('Dquyen12@', 10);
  let slotIdx = 0;
  let studentIdx = 0;
  const allStudents = [];
  const dormOccupantUpdates = {}; // dormId → { floorNum → { roomNum → [occupants] } }

  function initDormMap(dormId, floorNum, roomNum) {
    dormOccupantUpdates[dormId] = dormOccupantUpdates[dormId] || {};
    dormOccupantUpdates[dormId][floorNum] = dormOccupantUpdates[dormId][floorNum] || {};
    dormOccupantUpdates[dormId][floorNum][roomNum] = dormOccupantUpdates[dormId][floorNum][roomNum] || [];
  }

  function assignSlot(student) {
    if (slotIdx >= shuffled.length) return null;
    const slot = shuffled[slotIdx++];
    student.dormitoryId  = slot.dormId;
    student.roomNumber   = slot.roomNum;
    initDormMap(String(slot.dormId), slot.floorNum, slot.roomNum);
    dormOccupantUpdates[String(slot.dormId)][slot.floorNum][slot.roomNum].push({
      studentId:   student.studentId,
      name:        student.name,
      checkInDate: new Date(),
      active:      true
    });
    return slot;
  }

  // Seed 2022-2025 with rooms
  for (const [prefixStr, count] of Object.entries(dist)) {
    const prefix = parseInt(prefixStr);
    for (let i = 0; i < count; i++) {
      const st = makeStudent(prefix, studentIdx++);
      st.password = hashedPw;
      assignSlot(st);
      allStudents.push(st);
    }
    console.log(`  Created ${count} × ${prefix}xxx (with room)`);
  }

  // Extra 2025 without room (waitlist)
  for (let i = 0; i < 150; i++) {
    const st = makeStudent(2025, studentIdx++);
    st.password = hashedPw;
    allStudents.push(st); // no room assigned
  }
  console.log('  Created 150 × 2025xxx (no room / waitlist)');

  // Special 99999999
  const special = {
    name:          'Sinh Viên Demo',
    username:      'sinhviendemo',
    studentId:     '99999999',
    email:         '99999999@sis.hust.edu.vn',
    phone:         '0987654321',
    gender:        'male',
    faculty:       'Công nghệ thông tin',
    role:          'user',
    academicYear:  'K65',
    enrollmentYear: 2025,
    password:      hashedPw,
    isTestAccount: true,
    dormitoryId:   null,
    roomNumber:    null,
    familySituation:   'poor',
    distanceToHanoi:   450,
    province:          'Nghệ An',
    violationHistory:  'none',
    dormHistory:       'never_stayed',
    priorityPolicies:  { financialHardship: true, ruralPolicy: true },
    priorityScore:     75
  };
  assignSlot(special);
  allStudents.push(special);
  console.log('  Created 99999999 (demo, with room)');

  // Bulk insert
  await StudentCollection.insertMany(allStudents, { ordered: false });
  console.log(`Inserted ${allStudents.length} students total`);

  console.log('\n=== PHASE 4: UPDATING DORMITORY OCCUPANTS ===');
  let roomsUpdated = 0;
  for (const dorm of dorms) {
    const dormMap = dormOccupantUpdates[String(dorm._id)];
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
              'floors.$[fl].rooms.$[rm].occupants':         occupants,
              'floors.$[fl].rooms.$[rm].currentOccupancy':  occupants.length
            }
          },
          { arrayFilters: [{ 'fl.floorNumber': floor.floorNumber }, { 'rm.roomNumber': room.roomNumber }] }
        );
        roomsUpdated++;
      }
    }
  }
  console.log(`Updated ${roomsUpdated} rooms with occupants`);

  console.log('\n=== PHASE 5: SEEDING POLICY & CYCLE ===');
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
    notes: 'Chính sách phân bổ 2026-2027 — seed tự động'
  });
  console.log('Created AllocationPolicy:', policy._id);

  const now = new Date();
  const cycle = await AllocationCycle.create({
    academicYear: '2026-2027',
    name: 'Main Registration',
    policyId: policy._id,
    registrationStart: now,
    registrationEnd:   new Date(now.getTime() + 30 * 86400000),
    allocationDate:    new Date(now.getTime() + 35 * 86400000),
    status: 'PENDING',
    capacitySnapshot: { totalRooms: 265, totalBeds: totalBeds },
    notes: 'Chu kỳ mở đăng ký 2026-2027 — seed tự động'
  });
  console.log('Created AllocationCycle:', cycle._id, '| status: PENDING');

  console.log('\n=== DONE ===');
  const finalSt = await StudentCollection.countDocuments({ role: { $ne: 'admin' } });
  const finalOcc = await countCurrentOccupancy();
  console.log(`Students: ${finalSt} | Occupied beds: ${finalOcc} / ${totalBeds} (${Math.round(finalOcc/totalBeds*100)}%)`);
  process.exit(0);
}

async function countCurrentOccupancy() {
  const dorms = await DormitoryCollection.find({ isDeleted: { $ne: true } }, { 'floors.rooms.occupants': 1 }).lean();
  let occ = 0;
  dorms.forEach(d => (d.floors||[]).forEach(f => (f.rooms||[]).forEach(r => {
    occ += (r.occupants||[]).filter(o => o.active).length;
  })));
  return occ;
}

run().catch(err => { console.error('FAILED:', err.message, err.stack); process.exit(1); });
