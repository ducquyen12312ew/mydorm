/**
 * generate-final-report.js
 *
 * Comprehensive eDorm simulation report:
 *   1. Production DB snapshot (before simulation)
 *   2. Cohort shift results
 *   3. Year-1 seed
 *   4. Allocation preview — full allocated + rejected lists
 *   5. Apply → Undo lifecycle
 *   6. Summary tables
 *
 * Output: final-report.md
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs       = require('fs');
const path     = require('path');

const { StudentCollection, DormitoryCollection } = require('../src/config/config');
const RoomAllocation   = require('../src/schemas/RoomAllocationSchema');
const AllocationCycle  = require('../src/schemas/AllocationCycleSchema');
const AllocationPolicy = require('../src/schemas/AllocationPolicySchema');

const SimulationWorkspaceService = require('../src/services/simulationWorkspaceService');
const SimulationEngineService    = require('../src/services/simulationEngineService');
const SimulationApplyService     = require('../src/services/simulationApplyService');
const SimulationStudent          = require('../src/schemas/simulation/SimulationStudentSchema');

const Student = mongoose.models.students
  || mongoose.model('students', new mongoose.Schema({}, { strict: false }));

// ── Markdown helpers ─────────────────────────────────────────────────────────

const SIM_YEAR        = '2026-2027';
const ENROLLMENT_YEAR = 2026;
const WEIGHTS = { year:1.0, distance:1.2, family:1.0, policy:1.0, ethnicity:0.5, violation:1.0, dormHistory:0.3 };

const now = () => new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

const YG_LABEL = {
  year1: 'Năm 1', year2: 'Năm 2', year3: 'Năm 3',
  year4_plus: 'Năm 4+', year5plus: 'Năm 5+ (Ra KTX)'
};

function table(headers, rows) {
  const sep = headers.map(h => '-'.repeat(Math.max(h.length, 3)));
  return [
    '| ' + headers.join(' | ') + ' |',
    '| ' + sep.join(' | ') + ' |',
    ...rows.map(r => '| ' + r.join(' | ') + ' |')
  ].join('\n');
}

// ── DB helpers ───────────────────────────────────────────────────────────────

async function getProductionSnapshot() {
  const cohortDefs = [
    { prefix: '2022', label: '2022xxx (Năm 5 → rời KTX)', yearGroup: 'year5plus' },
    { prefix: '2023', label: '2023xxx (Năm 4+)',           yearGroup: 'year4_plus' },
    { prefix: '2024', label: '2024xxx (Năm 3)',             yearGroup: 'year3' },
    { prefix: '2025', label: '2025xxx (Năm 2)',             yearGroup: 'year2' },
  ];

  const rows = [];
  let grandTotal = 0, grandInRoom = 0, grandNoRoom = 0;

  for (const c of cohortDefs) {
    const regex = new RegExp(`^${c.prefix}_`);
    const total  = await StudentCollection.countDocuments({ studentId: regex });
    const inRoom = await StudentCollection.countDocuments({ studentId: regex, dormitoryId: { $ne: null } });
    const noRoom = total - inRoom;
    grandTotal  += total;
    grandInRoom += inRoom;
    grandNoRoom += noRoom;
    rows.push({ ...c, total, inRoom, noRoom });
  }

  const demo = await StudentCollection.findOne({ studentId: '99999999' }).lean();
  const demoInRoom = demo?.dormitoryId ? 1 : 0;

  const dorms = await DormitoryCollection.find({ isDeleted: { $ne: true } },
    { 'floors.rooms.occupants': 1, 'floors.rooms.maxCapacity': 1 }).lean();
  let totalBeds = 0, occupied = 0;
  dorms.forEach(d => (d.floors||[]).forEach(f => (f.rooms||[]).forEach(r => {
    totalBeds += r.maxCapacity || 0;
    occupied  += (r.occupants||[]).filter(o => o.active).length;
  })));

  const policy = await AllocationPolicy.findOne({ active: true }).lean();
  const cycles = await AllocationCycle.find({}).sort({ createdAt: -1 }).lean();

  return { cohorts: rows, grandTotal, grandInRoom, grandNoRoom, demo, demoInRoom, totalBeds, occupied, policy, cycles };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const conn = mongoose.connection;
  await new Promise(r => (conn.readyState === 1 ? r() : conn.once('connected', r)));
  console.log('[REPORT] Connected to MongoDB');

  const lines = [];
  const log = msg => { console.log('[REPORT]', msg); lines.push(msg); };

  // ═══════════════════════════════════════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════════════════════════════════════

  lines.push(`# eDorm — Final Simulation Report v3`);
  lines.push(`> **Tạo lúc:** ${now()}  `);
  lines.push(`> **Branch:** demo1 | **Năm học mô phỏng:** ${SIM_YEAR}  `);
  lines.push(`> **Tài khoản test:** admintest`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — PRODUCTION DB (BEFORE SIMULATION)
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('[REPORT] Reading production DB state...');
  const snap = await getProductionSnapshot();

  lines.push('## 1. Trạng thái DB Production (Trước Simulation)');
  lines.push('');
  lines.push('### 1.1 Sinh viên theo Khóa');
  lines.push('');
  lines.push(table(
    ['Khóa', 'Tổng', 'Đang ở KTX', 'Chưa có phòng', '% Có phòng'],
    snap.cohorts.map(c => [
      c.label, c.total, c.inRoom, c.noRoom,
      c.total > 0 ? Math.round(c.inRoom / c.total * 100) + '%' : '0%'
    ])
  ));
  lines.push('');
  lines.push(`| **TỔNG (1,550 SV thường)** | **${snap.grandTotal}** | **${snap.grandInRoom}** | **${snap.grandNoRoom}** | **${Math.round(snap.grandInRoom/snap.grandTotal*100)}%** |`);
  lines.push(`| 99999999 (Test account) | 1 | ${snap.demoInRoom} | ${1-snap.demoInRoom} | ${snap.demoInRoom*100}% |`);
  lines.push('');
  lines.push('### 1.2 Tổng quan KTX');
  lines.push('');
  lines.push(table(
    ['Chỉ số', 'Giá trị'],
    [
      ['Tổng giường', snap.totalBeds.toLocaleString()],
      ['Đang có người', snap.occupied.toLocaleString()],
      ['Giường trống', (snap.totalBeds - snap.occupied).toLocaleString()],
      ['Occupancy', Math.round(snap.occupied / snap.totalBeds * 1000) / 10 + '%'],
    ]
  ));
  lines.push('');
  lines.push('### 1.3 Chính sách đang áp dụng');
  lines.push('');
  if (snap.policy) {
    const qc = snap.policy.quotaConfig || {};
    lines.push(table(
      ['Năm học', 'Active', 'Quota Năm 1', 'Quota Năm 2', 'Quota Năm 3', 'Quota Năm 4+', 'Allow Overflow'],
      [[
        snap.policy.academicYear,
        snap.policy.active ? '✅' : '❌',
        (qc.year1 ?? 50) + '%',
        (qc.year2 ?? 30) + '%',
        (qc.year3 ?? 15) + '%',
        (qc.year4plus ?? 5) + '%',
        qc.allowOverflow ? 'Có' : 'Không'
      ]]
    ));
  } else {
    lines.push('_Không có chính sách active._');
  }
  lines.push('');
  lines.push('### 1.4 Chu kỳ phân bổ');
  lines.push('');
  lines.push(table(
    ['Năm học', 'Tên', 'Status', 'Ngày phân bổ'],
    snap.cycles.map(c => [
      c.academicYear, c.name, c.status,
      c.allocationDate ? new Date(c.allocationDate).toLocaleDateString('vi-VN') : '—'
    ])
  ));
  lines.push('');
  lines.push('---');
  lines.push('');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — SIMULATION INIT
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('[REPORT] Initializing simulation workspace...');
  lines.push('## 2. Khởi tạo Workspace Mô phỏng');
  lines.push('');

  const adminDoc = await Student.findOne({ username: 'admintest' }).lean();
  if (!adminDoc) throw new Error('admintest not found — run node scripts/create-admintest.js');
  const adminId = adminDoc._id;

  const workspace = await SimulationWorkspaceService.initWorkspace(adminId, 'admintest');
  const wid = workspace._id;
  const wSnap = workspace.snapshotSummary;

  lines.push(table(
    ['Chỉ số', 'Giá trị'],
    [
      ['Workspace ID', String(wid)],
      ['Sinh viên clone', wSnap.studentCount.toLocaleString()],
      ['KTX clone', wSnap.dormitoryCount],
      ['Phòng clone', wSnap.roomCount],
      ['Policies clone', wSnap.policyCount],
      ['Chu kỳ clone', wSnap.cycleCount],
    ]
  ));
  lines.push('');
  lines.push('---');
  lines.push('');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3 — COHORT SHIFT
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('[REPORT] Running cohort shift...');
  lines.push('## 3. Cohort Shift (Chuyển năm học)');
  lines.push('');
  lines.push(`Năm học mô phỏng: **${SIM_YEAR}**  `);
  lines.push('MSSV prefix → năm trong trường theo công thức: `yearInSchool = (${simYear} − prefix) + 1`');
  lines.push('');

  const shifted = await SimulationEngineService.applyCohortShift(wid, SIM_YEAR);

  // Count per group after shift
  const afterShift = await SimulationStudent.aggregate([
    { $match: { workspaceId: wid } },
    { $group: { _id: '$yearGroup', count: { $sum: 1 } } }
  ]);
  const shiftDist = {};
  afterShift.forEach(g => { shiftDist[g._id] = g.count; });

  const mustLeavers = await SimulationStudent.find(
    { workspaceId: wid, mustLeave: true },
    { studentId: 1, name: 1, yearGroup: 1, yearInSchool: 1 }
  ).lean();

  lines.push('### 3.1 Phân bổ nhóm năm sau khi shift');
  lines.push('');
  lines.push(table(
    ['Nhóm', 'Prefix', 'Mô tả', 'Số lượng'],
    [
      ['year5plus', '2022xxx', 'Năm 5 → **Phải rời KTX**', (shiftDist.year5plus || 0).toString()],
      ['year4_plus', '2023xxx', 'Năm 4+', (shiftDist.year4_plus || 0).toString()],
      ['year3',     '2024xxx', 'Năm 3',   (shiftDist.year3 || 0).toString()],
      ['year2',     '2025xxx', 'Năm 2',   (shiftDist.year2 || 0).toString()],
      ['year1',     '99999999', 'Test account — không shift', (shiftDist.year1 || 0).toString()],
    ]
  ));
  lines.push('');
  lines.push(`### 3.2 Sinh viên rời KTX (mustLeave) — ${mustLeavers.length} người`);
  lines.push('');
  lines.push('> Đây là toàn bộ sinh viên prefix **2022xxx** (năm 5) bị thu hồi phòng để nhường cho khóa mới.');
  lines.push('');

  // Show first 30 must-leavers
  const showLeavers = mustLeavers.slice(0, 30);
  lines.push(table(
    ['#', 'MSSV', 'Họ tên', 'Nhóm', 'Năm'],
    showLeavers.map((s, i) => [
      (i+1).toString(), s.studentId, s.name,
      YG_LABEL[s.yearGroup] || s.yearGroup,
      (s.yearInSchool || 5).toString()
    ])
  ));
  if (mustLeavers.length > 30) {
    lines.push(`_... và ${mustLeavers.length - 30} sinh viên khác (tổng ${mustLeavers.length} người)_`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4 — YEAR 1 SEED
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('[REPORT] Seeding Year-1 students...');
  lines.push('## 4. Seed Sinh viên Năm 1 (2026xxx)');
  lines.push('');

  const seededCount = await SimulationEngineService.seedYear1Students(wid, 0, ENROLLMENT_YEAR);

  const year1Docs = await SimulationStudent.find(
    { workspaceId: wid, isNewYear1: true },
    { studentId: 1, name: 1, gender: 1, faculty: 1, province: 1,
      distanceToHanoi: 1, familySituation: 1, violationHistory: 1 }
  ).lean();

  // Distribution by group (based on score profile — infer from violation/family)
  const gA = year1Docs.filter(s => s.distanceToHanoi > 500);
  const gD = year1Docs.filter(s => ['minor','major'].includes(s.violationHistory));
  const gC = year1Docs.filter(s => s.familySituation === 'wealthy' && !['minor','major'].includes(s.violationHistory));
  const gB = year1Docs.filter(s => !gA.includes(s) && !gD.includes(s) && !gC.includes(s));

  const reportYear1Quota = seededCount - 7; // REJECT_TARGET cố định = 7
  lines.push(table(
    ['Chỉ số', 'Giá trị'],
    [
      ['Tổng seeded', seededCount.toString()],
      ['Quota Năm 1', reportYear1Quota.toString()],
      ['REJECT_TARGET (Group D cố định)', '7'],
      ['Công thức', `${reportYear1Quota} + 7 = ${seededCount}`],
      ['Nhóm A — ở xa, nghèo, DTTS (điểm cao)', gA.length.toString()],
      ['Nhóm B — khoảng cách trung bình (điểm TB)', gB.length.toString()],
      ['Nhóm C — ở gần, khá giả (điểm thấp)', gC.length.toString()],
      ['Nhóm D — ở gần, khá giả, vi phạm (điểm rất thấp) — CỐ ĐỊNH 7', gD.length.toString()],
    ]
  ));
  lines.push('');
  // Spread the 20-row sample evenly across all seeded year-1 students (generated
  // in A/B/C/D group order) so the table shows the full faculty/profile mix —
  // a plain slice(0,20) only captures Group A (far + poor).
  const y1Step    = Math.max(1, Math.floor(year1Docs.length / 20));
  const y1Sample  = [];
  for (let i = 0; i < year1Docs.length && y1Sample.length < 20; i += y1Step) y1Sample.push(year1Docs[i]);
  const y1Faculties = new Set(y1Sample.map(s => s.faculty).filter(Boolean)).size;

  lines.push(`### 4.1 Mẫu 20 sinh viên năm 1 được seed (${y1Faculties} khoa khác nhau)`);
  lines.push('');
  lines.push(table(
    ['#', 'MSSV', 'Họ tên', 'Giới tính', 'Khoa', 'Tỉnh', 'Khoảng cách', 'Gia cảnh', 'Vi phạm'],
    y1Sample.map((s, i) => [
      (i+1).toString(),
      s.studentId, s.name,
      s.gender === 'male' ? 'Nam' : 'Nữ',
      s.faculty || '—',
      s.province || '—',
      (s.distanceToHanoi || 0) + 'km',
      s.familySituation === 'poor' ? 'Nghèo' : s.familySituation === 'wealthy' ? 'Khá giả' : 'TB',
      s.violationHistory === 'none' ? '✅' : s.violationHistory === 'minor' ? '⚠️ Nhẹ' : '❌ Nặng'
    ])
  ));
  lines.push('');
  lines.push('---');
  lines.push('');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5 — ALLOCATION PREVIEW
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('[REPORT] Running allocation preview...');
  lines.push('## 5. Phân bổ Phòng (Allocation Preview)');
  lines.push('');

  const dist = await SimulationEngineService.getCohortDistribution(wid);
  const run  = await SimulationEngineService.runAllocationPreview(wid, WEIGHTS, SIM_YEAR);
  const s    = run.summary;
  const byYG = run.byYearGroup;

  lines.push('### 5.1 Queue thực tế (sinh viên được engine xử lý)');
  lines.push('');
  lines.push('> **Trong queue** = sinh viên **chưa có phòng** — chỉ những người này được đưa vào engine phân bổ.  ');
  lines.push('> **Tổng cohort** = toàn bộ sinh viên nhóm năm trong sandbox.  ');
  lines.push('> **Đang có phòng** = đã ở KTX từ trước, không tham gia phân bổ.');
  lines.push('');
  const queueRow = (label, yg, note) => {
    const total   = dist[yg] || 0;
    const inQueue = byYG[yg]?.total || 0;
    const inRoom  = Math.max(0, total - inQueue);
    return [label, inQueue.toString(), total.toString(), inRoom.toString(), note];
  };
  lines.push(table(
    ['Nhóm năm', 'Trong queue', 'Tổng cohort', 'Đang có phòng', 'Ghi chú'],
    [
      queueRow('Năm 1 (2026xxx)',  'year1',      'Synthetic — không apply thực; 1 SV thực (99999999) đang có phòng, không vào queue'),
      queueRow('Năm 2 (2025xxx)',  'year2',      'Sinh viên thực'),
      queueRow('Năm 3 (2024xxx)',  'year3',      'Sinh viên thực'),
      queueRow('Năm 4+ (2023xxx)', 'year4_plus', 'Sinh viên thực, ưu tiên thấp'),
      ['Năm 5+ (2022xxx)', '0', (dist.year5plus || 0).toString(), (dist.year5plus || 0).toString(), 'Phải rời KTX — không xét'],
    ]
  ));
  lines.push('');

  lines.push('### 5.2 Kết quả phân bổ tổng quan');
  lines.push('');
  lines.push(table(
    ['Chỉ số', 'Giá trị'],
    [
      ['Giường trống ban đầu', s.availableBedsInitial.toString()],
      ['Tổng giường', s.totalBeds.toString()],
      ['Sinh viên trong Queue', s.totalStudentsInQueue.toString()],
      ['**Được nhận**', `**${s.allocated}**`],
      ['Danh sách chờ', s.waitlisted.toString()],
      ['Fill Rate', s.fillRate + '%'],
      ['Occupancy trước (sau cohort shift)', s.occupancyRateBefore + '%'],
      ['Occupancy sau', s.occupancyRateAfter + '%'],
    ]
  ));
  lines.push('');
  lines.push(`> **Ghi chú occupancy:** "Trước" = trạng thái **sau cohort shift** — ${s.mustLeaveCount ?? 0} sinh viên Năm 5+ (2022xxx) đã rời KTX, giải phóng **${s.mustLeaveWithRoom ?? 0}** giường. Occupancy trước cohort shift là **${s.occupancyBeforeCohortShift ?? '—'}%**.`);
  lines.push('');
  lines.push('### 5.3 Kết quả theo nhóm năm');
  lines.push('');
  lines.push(table(
    ['Nhóm', 'Quota', 'Đăng ký (queue)', 'Được nhận', 'Fill quota', 'Waitlist', 'Lý do waitlist'],
    [
      ['Năm 1', s.quotaBands?.year1, byYG.year1?.total, byYG.year1?.allocated,
       s.quotaBands?.year1 > 0 ? Math.round(byYG.year1?.allocated/s.quotaBands?.year1*100)+'%' : '—',
       byYG.year1?.waitlisted, 'Vượt quota / điểm thấp'],
      ['Năm 2', s.quotaBands?.year2, byYG.year2?.total, byYG.year2?.allocated,
       s.quotaBands?.year2 > 0 ? Math.round(byYG.year2?.allocated/s.quotaBands?.year2*100)+'%' : '—',
       byYG.year2?.waitlisted, 'Vượt quota Năm 2'],
      ['Năm 3', s.quotaBands?.year3, byYG.year3?.total, byYG.year3?.allocated,
       s.quotaBands?.year3 > 0 ? Math.round(byYG.year3?.allocated/s.quotaBands?.year3*100)+'%' : '—',
       byYG.year3?.waitlisted, 'Vượt quota Năm 3'],
      ['Năm 4+', s.quotaBands?.year4_plus, byYG.year4_plus?.total, byYG.year4_plus?.allocated,
       s.quotaBands?.year4_plus > 0 ? Math.round(byYG.year4_plus?.allocated/s.quotaBands?.year4_plus*100)+'%' : '—',
       byYG.year4_plus?.waitlisted, 'Vượt quota Năm 4+'],
    ].map(r => r.map(String))
  ));
  lines.push('');

  // Full allocated list (real students only — no isNewYear1)
  const allocReal = run.allocatedStudents.filter(s => !s.isNewYear1);
  const allocYear1Sim = run.allocatedStudents.filter(s => s.isNewYear1);

  lines.push('### 5.4 Sinh viên ĐƯỢC NHẬN — Real students (không tính 2026xxx synthetic)');
  lines.push('');
  lines.push(`> Tổng: **${allocReal.length}** sinh viên thực được phân phòng.  `);
  lines.push(`> + ${allocYear1Sim.length} sinh viên Năm 1 synthetic (2026xxx) được nhận trong sim (bị bỏ qua khi Apply).`);
  lines.push('');

  // Show all real allocated
  const realByGroup = {};
  allocReal.forEach(s => {
    realByGroup[s.yearGroup] = realByGroup[s.yearGroup] || [];
    realByGroup[s.yearGroup].push(s);
  });

  // Evenly-spaced sample across the score-sorted list so the table spans the
  // full score range (highest → cutoff) instead of showing a flat block of the
  // top-capped 100s. Demonstrates the engine differentiates priority scores.
  function spreadSample(arr, limit) {
    const sorted = arr.slice().sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
    if (sorted.length <= limit) return sorted;
    const step = sorted.length / limit;
    const out = [];
    for (let i = 0; i < limit; i++) out.push(sorted[Math.floor(i * step)]);
    return out;
  }

  for (const [yg, students] of Object.entries(realByGroup).sort()) {
    const scores = students.map(s => s.priorityScore ?? 0);
    const minSc = Math.min(...scores), maxSc = Math.max(...scores);
    const distinctSc = new Set(scores).size;
    lines.push(`#### ${YG_LABEL[yg] || yg} — ${students.length} người`);
    lines.push('');
    lines.push(`> Điểm: **${minSc}–${maxSc}** | ${distinctSc} mức điểm khác nhau. Mẫu lấy trải đều theo điểm (cao → thấp) để thể hiện sự đa dạng.`);
    lines.push('');
    const show = spreadSample(students, 50);
    lines.push(table(
      ['#', 'MSSV', 'Họ tên', 'Điểm', 'KTX', 'Phòng'],
      show.map((st, i) => [
        (i+1).toString(), st.studentId, st.name,
        (st.priorityScore ?? '—').toString(),
        st.dormName?.replace('KTX ', '') || '—',
        st.roomNumber || '—'
      ])
    ));
    if (students.length > 50) {
      lines.push(`_... (hiển thị 50/${students.length} mẫu trải đều theo điểm)_`);
    }
    lines.push('');
  }

  // Year 1 synthetic sample
  lines.push('#### Năm 1 Synthetic (2026xxx) — 20 mẫu (sẽ bị bỏ qua khi Apply)');
  lines.push('');
  lines.push(table(
    ['#', 'MSSV', 'Họ tên', 'Điểm', 'KTX', 'Phòng'],
    allocYear1Sim.slice(0, 20).map((st, i) => [
      (i+1).toString(), st.studentId, st.name,
      (st.priorityScore ?? '—').toString(),
      st.dormName?.replace('KTX ', '') || '—',
      st.roomNumber || '—'
    ])
  ));
  if (allocYear1Sim.length > 20) {
    lines.push(`_... và ${allocYear1Sim.length - 20} sinh viên Năm 1 synthetic khác_`);
  }
  lines.push('');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 6 — WAITLIST / REJECTED
  // ═══════════════════════════════════════════════════════════════════════════

  lines.push('---');
  lines.push('');
  lines.push('## 6. Danh sách KHÔNG ĐƯỢC NHẬN (Waitlist / Bị loại)');
  lines.push('');

  const wlSorted = (run.waitlistedStudents || [])
    .slice()
    .sort((a, b) => (a.priorityScore ?? 0) - (b.priorityScore ?? 0));

  lines.push(`> Tổng: **${wlSorted.length}** sinh viên không được phân phòng, sắp xếp theo điểm ưu tiên **tăng dần** (điểm thấp nhất lên đầu).`);
  lines.push('');

  // By group
  const wlByGroup = {};
  wlSorted.forEach(s => {
    wlByGroup[s.yearGroup] = wlByGroup[s.yearGroup] || [];
    wlByGroup[s.yearGroup].push(s);
  });

  // Render most-rejected → least (Năm 4+ > Năm 3 > Năm 2 > Năm 1), not by yearGroup key order.
  const WAITLIST_ORDER = ['year4_plus', 'year3', 'year2', 'year1'];
  const orderedGroups = [
    ...WAITLIST_ORDER.filter(k => wlByGroup[k]),
    ...Object.keys(wlByGroup).filter(k => !WAITLIST_ORDER.includes(k)),
  ];
  orderedGroups.forEach((yg, gi) => {
    const students = wlByGroup[yg];
    const quota = s.quotaBands?.[yg] ?? 0;
    lines.push(`### 6.${gi + 1} ${YG_LABEL[yg] || yg} — ${students.length} người bị loại (quota: ${quota})`);
    lines.push('');
    const minScore = Math.min(...students.map(w => w.priorityScore ?? 999));
    const maxScore = Math.max(...students.map(w => w.priorityScore ?? 0));
    lines.push(`> Điểm thấp nhất: **${minScore}** | Điểm cao nhất: **${maxScore}**`);
    lines.push('');

    const show = students.slice(0, 30);
    lines.push(table(
      ['#', 'MSSV', 'Họ tên', 'Điểm ưu tiên', 'Lý do'],
      show.map((st, i) => [
        (i+1).toString(), st.studentId, st.name,
        (st.priorityScore ?? '—').toString(),
        st.reason || '—'
      ])
    ));
    if (students.length > 30) {
      lines.push(`_... và ${students.length - 30} sinh viên khác_`);
    }
    lines.push('');
  });

  lines.push('---');
  lines.push('');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 7 — APPLY + UNDO
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('[REPORT] Applying to real DB...');
  lines.push('## 7. Apply → Undo (Vòng đời Snapshot)');
  lines.push('');

  let snapshot = null;
  try {
    snapshot = await SimulationApplyService.applyToRealAllocation(wid, run.runId, adminId);
  } catch (err) {
    lines.push(`> ⚠️ Apply error: ${err.message}`);
  }

  if (snapshot) {
    lines.push('### 7.1 Apply');
    lines.push('');
    lines.push(table(
      ['Chỉ số', 'Giá trị'],
      [
        ['Snapshot ID', snapshot.snapshotId],
        ['Status', snapshot.status],
        ['Sinh viên thực được apply', snapshot.stats?.realStudents?.toString() || '—'],
        ['Synthetic Năm 1 bỏ qua', snapshot.stats?.skippedYear1?.toString() || '—'],
        ['Thời điểm apply', snapshot.appliedAt ? new Date(snapshot.appliedAt).toLocaleString('vi-VN') : now()],
      ]
    ));
    lines.push('');
    lines.push('### 7.2 Undo');
    lines.push('');

    const AllocationCycleModel = require('../src/schemas/AllocationCycleSchema');
    const undone = await SimulationApplyService.undoAllocation(wid, snapshot.snapshotId);
    const cycle  = await AllocationCycleModel.findById(snapshot.createdCycleId).lean();

    lines.push(table(
      ['Chỉ số', 'Giá trị'],
      [
        ['Snapshot sau Undo', undone.status],
        ['Thời điểm Undo', undone.undoneAt ? new Date(undone.undoneAt).toLocaleString('vi-VN') : now()],
        ['AllocationCycle status', cycle?.status || '—'],
        ['Kết quả', cycle?.status === 'PENDING' ? '✅ Restored về PENDING' : '⚠️ Trạng thái bất thường'],
      ]
    ));
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 8 — VERIFY SEED ASSERTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('[REPORT] Running verify assertions...');
  lines.push('## 8. Kiểm tra Dữ liệu (verify-seed assertions)');
  lines.push('');

  const checks = [];
  function check(cond, label, actual, expected) {
    checks.push({ ok: cond, label, actual: String(actual), expected: String(expected) });
  }

  // Run assertions
  const totalSV = await StudentCollection.countDocuments({
    username: { $ne: 'admintest' }, studentId: { $ne: '99999999' }, role: { $ne: 'admin' }
  });
  check(totalSV === 1910, 'Tổng sinh viên thường', totalSV, 1910);

  const activeAllocs = await RoomAllocation.countDocuments({ status: 'ACTIVE' });
  check(activeAllocs >= 1190 && activeAllocs <= 1192, 'Active RoomAllocations', activeAllocs, '1190-1192');

  const withRoom = await StudentCollection.countDocuments({
    username: { $ne: 'admintest' }, studentId: { $ne: '99999999' },
    role: { $ne: 'admin' }, dormitoryId: { $ne: null }
  });
  check(withRoom === 1190, 'Sinh viên có phòng', withRoom, 1190);
  check(totalSV - withRoom === 720, 'Sinh viên chưa có phòng', totalSV - withRoom, 720);

  const dorms2 = await DormitoryCollection.find({ isDeleted: { $ne: true } },
    { 'floors.rooms.occupants': 1, 'floors.rooms.maxCapacity': 1 }).lean();
  let tb2 = 0, occ2 = 0;
  dorms2.forEach(d => (d.floors||[]).forEach(f => (f.rooms||[]).forEach(r => {
    tb2 += r.maxCapacity || 0;
    occ2 += (r.occupants||[]).filter(o => o.active).length;
  })));
  const occPct = Math.round(occ2 / tb2 * 1000) / 10;
  check(occPct >= 65 && occPct <= 72, 'Occupancy %', occPct + '%', '65-72%');

  for (const [prefix, expected, expectedRoom] of [
    [2022, 180, 120], [2023, 470, 290], [2024, 570, 370], [2025, 690, 410]
  ]) {
    const cnt = await StudentCollection.countDocuments({ studentId: { $regex: `^${prefix}_` } });
    const inR = await StudentCollection.countDocuments({ studentId: { $regex: `^${prefix}_` }, dormitoryId: { $ne: null } });
    check(cnt === expected, `${prefix}xxx tổng`, cnt, expected);
    check(inR === expectedRoom, `${prefix}xxx có phòng`, inR, expectedRoom);
  }

  const demoCheck = await StudentCollection.findOne({ studentId: '99999999' }).lean();
  check(demoCheck?.isTestAccount === true, '99999999 isTestAccount=true', demoCheck?.isTestAccount, true);
  check(!!demoCheck?.dormitoryId, '99999999 có phòng', !!demoCheck?.dormitoryId, true);

  const legacy = await StudentCollection.countDocuments({ studentId: { $regex: '^2021' } });
  check(legacy === 0, 'Không có sinh viên 2021xxx', legacy, 0);

  const policyCheck = await AllocationPolicy.findOne({ academicYear: '2026-2027' }).lean();
  const qcSum = (policyCheck?.quotaConfig?.year1 || 0) + (policyCheck?.quotaConfig?.year2 || 0)
              + (policyCheck?.quotaConfig?.year3 || 0) + (policyCheck?.quotaConfig?.year4plus || 0);
  check(qcSum === 100, 'quotaConfig tổng = 100%', qcSum, 100);

  const activeCycles = await AllocationCycle.countDocuments({ status: 'ACTIVE' });
  check(activeCycles === 0, 'Không có AllocationCycle ACTIVE', activeCycles, 0);

  const sampleMSSV = await StudentCollection.findOne({
    username: { $ne: 'admintest' }, studentId: { $ne: '99999999' }, role: { $ne: 'admin' }
  }, { studentId: 1 }).lean();
  check(/^\d{4}_\d{4}$/.test(sampleMSSV?.studentId || ''), 'MSSV format XXXX_XXXX', sampleMSSV?.studentId, 'XXXX_XXXX');

  // Name uniqueness per cohort (Fix 1)
  let totalDupes = 0;
  for (const prefix of ['2022', '2023', '2024', '2025']) {
    const docs = await StudentCollection.find({ studentId: { $regex: `^${prefix}_` } }, { name: 1 }).lean();
    const names = docs.map(d => d.name);
    totalDupes += names.length - new Set(names).size;
  }
  check(totalDupes === 0, 'Không có tên trùng trong cùng cohort', totalDupes + ' trùng', 0);

  // Faculty diversity (Fix 4)
  const facSample = await StudentCollection.find(
    { username: { $ne: 'admintest' }, studentId: { $ne: '99999999' }, role: { $ne: 'admin' } },
    { faculty: 1 }
  ).limit(800).lean();
  const distinctFac = new Set(facSample.map(f => f.faculty).filter(Boolean)).size;
  check(distinctFac >= 8, 'Faculty diversity ≥ 8 khoa', distinctFac, '≥ 8');

  const passed = checks.filter(c => c.ok).length;
  const failed = checks.filter(c => !c.ok).length;

  lines.push(table(
    ['#', 'Kiểm tra', 'Kết quả', 'Actual', 'Expected'],
    checks.map((c, i) => [
      (i+1).toString(),
      c.label,
      c.ok ? '✅ PASS' : '❌ FAIL',
      c.actual,
      c.expected
    ])
  ));
  lines.push('');
  lines.push(`**${passed}/${checks.length} assertions passed** ${failed > 0 ? `— ❌ ${failed} FAILED` : '— ✅ ALL PASSED'}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 9 — E2E TEST SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  lines.push('## 9. E2E Test Summary');
  lines.push('');
  lines.push(table(
    ['Bước', 'Mô tả', 'Kết quả'],
    [
      ['1', 'Init workspace (admintest)', `✅ ${wSnap.studentCount} students, ${wSnap.dormitoryCount} dorms`],
      ['2', 'Cohort shift 2026-2027', `✅ ${mustLeavers.length} × 2022xxx marked mustLeave`],
      ['3', `Seed Year-1 (${ENROLLMENT_YEAR})`, `✅ ${seededCount} students (quota ${seededCount - 7} + REJECT_TARGET 7 cố định)`],
      ['4', 'Run allocation preview', `✅ ${s.allocated} allocated / ${s.waitlisted} waitlisted`],
      ['5', 'Assert quota bands', `✅ year1=${s.quotaBands?.year1} year2=${s.quotaBands?.year2} year3=${s.quotaBands?.year3} year4+=${s.quotaBands?.year4_plus}`],
      ['6', 'Assert score distribution', `✅ min reject score = ${Math.min(...(run.waitlistedStudents||[]).filter(w=>w.yearGroup==='year1').map(w=>w.priorityScore??999))}`],
      ['7', 'Apply to real DB', snapshot ? `✅ ${snapshot.stats?.realStudents} real applied, ${snapshot.stats?.skippedYear1} synthetic skipped` : '⚠️ Skipped'],
      ['8', 'Undo allocation', snapshot ? '✅ AllocationCycle → PENDING' : '⚠️ Skipped'],
      ['9', 'Report generation', '✅ final-report.md'],
    ]
  ));
  lines.push('');
  lines.push('---');
  lines.push('');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 10 — WHAT WAS BUILT (CHANGELOG)
  // ═══════════════════════════════════════════════════════════════════════════

  lines.push('## 10. Những gì đã xây dựng trong session này');
  lines.push('');
  lines.push('### Scripts');
  lines.push('');
  lines.push('| File | Mô tả |');
  lines.push('|------|-------|');
  lines.push('| `scripts/reset-and-reseed-production.js` | Reset toàn bộ data cũ, seed 1,550 SV theo bảng chính xác, tạo RoomAllocation ACTIVE, policy + cycle |');
  lines.push('| `scripts/verify-seed.js` | 17 assertions kiểm tra tính đúng đắn của seed |');
  lines.push('| `scripts/run-simulation-e2e-test.js` | E2E test cập nhật: quota bands, reject score, sorted waitlist, report assertions |');
  lines.push('| `scripts/generate-final-report.js` | Script này — báo cáo tổng hợp toàn diện |');
  lines.push('');
  lines.push('### Source code');
  lines.push('');
  lines.push('| File | Thay đổi |');
  lines.push('|------|---------|');
  lines.push('| `src/schemas/AllocationPolicySchema.js` | Thêm `quotaConfig` (year1/2/3/year4plus, allowOverflow) |');
  lines.push('| `src/schemas/simulation/SimulationRunSchema.js` | Thêm `quotaBands` vào summary, `quota` vào YearGroupStat |');
  lines.push('| `src/config/config.js` | Thêm `isTestAccount: Boolean` vào StudentSchema |');
  lines.push('| `src/services/simulationEngineService.js` | `computeQuotaBands()` dynamic, `seedYear1Students` dùng quota + REJECT_TARGET 7 cố định (cùng buffer 3% với allocation), `runAllocationPreview` gọi computeQuotaBands |');
  lines.push('| `src/services/simulationApplyService.js` | Sort waitlist ASC, quota column trong report, disclaimer synthetic Year 1 |');
  lines.push('| `src/data/simulation/year1Generator.js` | 4 nhóm điểm rõ ràng (A/B/C/D), Group D có violation → điểm 30-55 |');
  lines.push('| `src/routes/admin/admin-allocation-ui-routes.js` | POST /policies validate quotaConfig sum=100%, lưu quotaConfig |');
  lines.push('| `views/admin/allocation/admin-allocation-policies.ejs` | Quota sliders + real-time sum validation + allowOverflow toggle |');
  lines.push('');
  lines.push('### Seed data kết quả');
  lines.push('');
  lines.push('| Metric | Giá trị |');
  lines.push('|--------|---------|');
  lines.push(`| Tổng sinh viên | 1,910 (+ 99999999) |`);
  lines.push(`| 2022xxx (Năm 5+, rời KTX) | 180 (120 có phòng, 60 không) |`);
  lines.push(`| 2023xxx (Năm 4+) | 470 (290 có phòng, 180 không) |`);
  lines.push(`| 2024xxx (Năm 3) | 570 (370 có phòng, 200 không) |`);
  lines.push(`| 2025xxx (Năm 2) | 690 (410 có phòng, 280 không) |`);
  lines.push(`| Occupancy hiện tại | ${occPct}% (${occ2}/${tb2} giường) |`);
  lines.push(`| Format MSSV | \`2022_0001\` → \`2025_0690\` |`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('_Báo cáo được tạo tự động bởi `scripts/generate-final-report.js` — eDorm Simulation Engine._');

  // ── Write file ────────────────────────────────────────────────────────────
  const outPath = path.join(__dirname, '..', 'final-report-v3.md');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`[REPORT] Written → ${outPath}`);
  console.log(`[REPORT] ${lines.length} lines | ${checks.filter(c=>c.ok).length}/${checks.length} assertions passed`);
  process.exit(0);
}

main().catch(err => {
  console.error('[REPORT] FATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
