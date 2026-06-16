/**
 * verify-seed.js — Assert production seed state is correct
 *
 * Checks:
 *   1. Total regular students: 1,910
 *   2. Students with ACTIVE RoomAllocation: 1,190
 *   3. Students without room: 720
 *   4. DB occupancy: 1,191 / 1,742 ≈ 68%
 *   5. Per-cohort counts match seed table (Fix 5 values)
 *   6. 99999999 exists, isTestAccount=true, has room, ACTIVE alloc
 *   7. No 2021xxx students
 *   8. AllocationPolicy with quotaConfig summing to 100%
 *   9. No AllocationCycle with status ACTIVE
 *  10. MSSV format is prefix_XXXX
 *  11. Province diversity: ≥ 5 distinct provinces across students
 *  12. Family diversity: ≥ 2 distinct family situations
 *  13. Some students have violations
 *
 * Usage: node scripts/verify-seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { DormitoryCollection, StudentCollection } = require('../src/config/config');
const RoomAllocation   = require('../src/schemas/RoomAllocationSchema');
const AllocationCycle  = require('../src/schemas/AllocationCycleSchema');
const AllocationPolicy = require('../src/schemas/AllocationPolicySchema');

const PASS = '✓';
const FAIL = '✗';
let failures = 0;

function assert(cond, msg, extra = '') {
  if (cond) {
    console.log(`  ${PASS} ${msg}`);
  } else {
    console.log(`  ${FAIL} FAIL: ${msg}${extra ? ' — ' + extra : ''}`);
    failures++;
  }
}

function assertEq(actual, expected, label) {
  assert(actual === expected, `${label}: ${actual} === ${expected}`, actual !== expected ? `got ${actual}` : '');
}

function assertRange(actual, min, max, label) {
  assert(actual >= min && actual <= max, `${label}: ${actual} ∈ [${min}, ${max}]`);
}

async function run() {
  const conn = mongoose.connection;
  await new Promise(r => (conn.readyState === 1 ? r() : conn.once('connected', r)));
  console.log('Connected to MongoDB\n');

  // ── 1. Total regular students ─────────────────────────────────────────────
  console.log('=== 1. Student counts ===');
  const totalStudents = await StudentCollection.countDocuments({
    username: { $ne: 'admintest' },
    studentId: { $ne: '99999999' },
    role: { $ne: 'admin' }
  });
  assertEq(totalStudents, 1910, 'Regular students (excl admintest + 99999999)');

  // ── 2. Active RoomAllocations (excluding 99999999) ────────────────────────
  console.log('\n=== 2. Room allocations ===');
  const activeAllocs = await RoomAllocation.countDocuments({ status: 'ACTIVE' });
  assertRange(activeAllocs, 1190, 1192, 'Active RoomAllocations (1190 students + 99999999)');

  // Count students with dormitoryId set (from the 1,550 regular students)
  const withRoom = await StudentCollection.countDocuments({
    username: { $ne: 'admintest' },
    studentId: { $ne: '99999999' },
    role: { $ne: 'admin' },
    dormitoryId: { $ne: null }
  });
  assertEq(withRoom, 1190, 'Regular students with dormitoryId (in room)');

  const withoutRoom = totalStudents - withRoom;
  assertEq(withoutRoom, 720, 'Regular students without room');

  // ── 3. DB occupancy ───────────────────────────────────────────────────────
  console.log('\n=== 3. Dorm occupancy ===');
  const dorms = await DormitoryCollection.find({ isDeleted: { $ne: true } },
    { 'floors.rooms.occupants': 1, 'floors.rooms.maxCapacity': 1 }).lean();
  let totalBeds = 0, totalOccupied = 0;
  dorms.forEach(d => (d.floors||[]).forEach(f => (f.rooms||[]).forEach(r => {
    totalBeds    += r.maxCapacity || 0;
    totalOccupied += (r.occupants||[]).filter(o => o.active).length;
  })));
  const occupancyPct = Math.round(totalOccupied / totalBeds * 1000) / 10;
  console.log(`  Beds: ${totalBeds} | Occupied: ${totalOccupied} | Rate: ${occupancyPct}%`);
  assert(totalBeds > 0, 'Dormitories have beds');
  assertRange(totalOccupied, 1185, 1200, 'Occupied beds');
  assertRange(occupancyPct, 65, 72, 'Occupancy % in range [65%, 72%]');

  // ── 4. Per-cohort counts ──────────────────────────────────────────────────
  console.log('\n=== 4. Per-cohort counts ===');
  const COHORTS = [
    { prefix: 2022, total: 180, inRoom: 120, noRoom: 60  },
    { prefix: 2023, total: 470, inRoom: 290, noRoom: 180 }, // Fix 5
    { prefix: 2024, total: 570, inRoom: 370, noRoom: 200 }, // Fix 5
    { prefix: 2025, total: 690, inRoom: 410, noRoom: 280 }  // Fix 5
  ];
  for (const c of COHORTS) {
    const regex = `^${c.prefix}_`;
    const count   = await StudentCollection.countDocuments({ studentId: { $regex: regex } });
    const inRoom  = await StudentCollection.countDocuments({
      studentId: { $regex: regex }, dormitoryId: { $ne: null }
    });
    assertEq(count,  c.total,  `${c.prefix}xxx total`);
    assertEq(inRoom, c.inRoom, `${c.prefix}xxx in room`);
  }

  // ── 5. 99999999 account ───────────────────────────────────────────────────
  console.log('\n=== 5. 99999999 test account ===');
  const demo = await StudentCollection.findOne({ studentId: '99999999' }).lean();
  assert(demo !== null, '99999999 student exists');
  if (demo) {
    assert(demo.isTestAccount === true, '99999999 isTestAccount=true');
    assert(demo.dormitoryId != null,    '99999999 has dormitoryId');
    assert(demo.roomNumber  != null,    '99999999 has roomNumber');
    const demoAlloc = await RoomAllocation.findOne({
      studentId: demo._id, status: 'ACTIVE'
    }).lean();
    assert(demoAlloc !== null, '99999999 has ACTIVE RoomAllocation');
  }

  // ── 6. No 2021xxx students ────────────────────────────────────────────────
  console.log('\n=== 6. No legacy students ===');
  const legacy2021 = await StudentCollection.countDocuments({ studentId: { $regex: '^2021_' } });
  assertEq(legacy2021, 0, 'No 2021_xxx students');
  const legacy2021old = await StudentCollection.countDocuments({ studentId: { $regex: '^2021[0-9]' } });
  assertEq(legacy2021old, 0, 'No 2021XXXX (old format) students');

  // ── 7. MSSV format ────────────────────────────────────────────────────────
  console.log('\n=== 7. MSSV format ===');
  const sampleStudents = await StudentCollection.find(
    { username: { $ne: 'admintest' }, studentId: { $ne: '99999999' }, role: { $ne: 'admin' } },
    { studentId: 1 }
  ).limit(20).lean();
  const mssvPattern = /^\d{4}_\d{4}$/;
  const validFormat = sampleStudents.every(s => mssvPattern.test(s.studentId));
  assert(validFormat, `MSSV format is XXXX_XXXX (sample: ${sampleStudents[0]?.studentId})`);

  // ── 8. AllocationPolicy with quotaConfig ─────────────────────────────────
  console.log('\n=== 8. AllocationPolicy ===');
  const policy = await AllocationPolicy.findOne({ academicYear: '2026-2027' }).lean();
  assert(policy !== null, 'AllocationPolicy 2026-2027 exists');
  if (policy) {
    assert(policy.active === true, 'Policy 2026-2027 is active');
    const qc = policy.quotaConfig;
    assert(qc != null, 'Policy has quotaConfig');
    if (qc) {
      const total = (qc.year1||0) + (qc.year2||0) + (qc.year3||0) + (qc.year4plus||0);
      assertEq(total, 100, 'quotaConfig percentages sum to 100');
      console.log(`    year1=${qc.year1}% year2=${qc.year2}% year3=${qc.year3}% year4plus=${qc.year4plus}%`);
    }
  }

  // ── 9. No ACTIVE AllocationCycle ─────────────────────────────────────────
  console.log('\n=== 9. AllocationCycles ===');
  const activeCycles = await AllocationCycle.countDocuments({ status: 'ACTIVE' });
  assertEq(activeCycles, 0, 'No AllocationCycle with status ACTIVE');
  const pendingCycles = await AllocationCycle.countDocuments({ status: 'PENDING' });
  assert(pendingCycles > 0, `At least one PENDING cycle exists (found ${pendingCycles})`);

  // ── 10. Province diversity (Fix 2 check) ─────────────────────────────────
  console.log('\n=== 10. Profile diversity ===');
  const sampleProfiles = await StudentCollection.find(
    { username: { $ne: 'admintest' }, studentId: { $ne: '99999999' }, role: { $ne: 'admin' } },
    { province: 1, familySituation: 1, violationHistory: 1, faculty: 1 }
  ).limit(500).lean();

  const distinctProvinces = new Set(sampleProfiles.map(s => s.province).filter(Boolean));
  const distinctFamily    = new Set(sampleProfiles.map(s => s.familySituation).filter(Boolean));
  const distinctFaculty   = new Set(sampleProfiles.map(s => s.faculty).filter(Boolean));
  const withViolation     = sampleProfiles.filter(s => s.violationHistory && s.violationHistory !== 'none').length;

  assert(distinctProvinces.size >= 5,  `Province diversity: ${distinctProvinces.size} distinct provinces (need ≥ 5)`);
  assert(distinctFamily.size >= 2,     `Family diversity: ${distinctFamily.size} distinct statuses (need ≥ 2)`);
  assert(distinctFaculty.size >= 8,    `Faculty diversity: ${distinctFaculty.size} distinct faculties (need ≥ 8)`);
  assert(withViolation > 0,            `Some students have violations (found ${withViolation})`);
  console.log(`  Provinces: ${distinctProvinces.size} | Family statuses: ${distinctFamily.size} | Faculties: ${distinctFaculty.size} | With violations: ${withViolation}`);

  // ── 11. No duplicate names within a cohort (Fix 1) ───────────────────────
  console.log('\n=== 11. Name uniqueness per cohort ===');
  for (const c of COHORTS) {
    const regex = `^${c.prefix}_`;
    const docs = await StudentCollection.find(
      { studentId: { $regex: regex } }, { name: 1 }
    ).lean();
    const names = docs.map(d => d.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    const uniqueDupes = [...new Set(dupes)];
    assert(uniqueDupes.length === 0,
      `${c.prefix}xxx has no duplicate names (${names.length} students)`,
      uniqueDupes.length ? `dupes: ${uniqueDupes.slice(0, 3).join(', ')} (+${Math.max(0, uniqueDupes.length - 3)})` : '');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  if (failures === 0) {
    console.log(`ALL ASSERTIONS PASSED ✓`);
  } else {
    console.log(`${failures} ASSERTION(S) FAILED ✗`);
  }
  process.exit(failures > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
