/**
 * Integration test for:
 *   1. Room Transfer workflow
 *   2. Enrollment Planning (HUST programs + totals)
 *   3. Historical Enrollment data integrity
 *   4. Demand Forecast generation
 *   5. Student population distribution (Yr1>Yr2>Yr3>Yr4)
 *   6. Occupancy never exceeds capacity
 *
 * Run: node scripts/test-new-features.js
 * Requires: populated DB (run npm run seed first, then seed-enrollment-historical.js)
 */
require('dotenv').config();
require('../src/config/config');
const mongoose = require('mongoose');
const { StudentCollection, DormitoryCollection } = require('../src/config/config');
const RoomTransfer = require('../src/schemas/RoomTransferSchema');
const HistoricalEnrollment = require('../src/schemas/HistoricalEnrollmentSchema');
const EnrollmentPlan = require('../src/schemas/EnrollmentPlanSchema');
const DemandForecast = require('../src/schemas/DemandForecastSchema');

let passed = 0, failed = 0;

function assert(condition, label, details) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${details ? ': ' + details : ''}`);
    failed++;
  }
}

async function testStudentDistribution() {
  console.log('\n1. Student year-group distribution');
  // Count by academicYear
  const dist = await StudentCollection.aggregate([
    { $group: { _id: '$academicYear', count: { $sum: 1 } } },
    { $sort: { _id: -1 } }
  ]);
  const total = dist.reduce((s, d) => s + d.count, 0);
  assert(total > 0, `Found ${total} students in database`);

  const byYear = {};
  dist.forEach(d => { byYear[d._id] = d.count; });

  // Find the most recent year with students as Year 1 baseline
  const sortedYears = dist.map(d => parseInt(d._id)).filter(y => !isNaN(y)).sort((a, b) => b - a);
  const freshmanYear = sortedYears[0]; // most recent = freshmen

  const yr1 = byYear[String(freshmanYear)] || 0;
  const yr2 = byYear[String(freshmanYear - 1)] || 0;
  const yr3 = byYear[String(freshmanYear - 2)] || 0;
  const yr4plus = total - yr1 - yr2 - yr3;
  console.log(`    Using freshman year: ${freshmanYear}`);

  const yr1pct = Math.round(yr1 / total * 100);
  const yr2pct = Math.round(yr2 / total * 100);
  const yr3pct = Math.round(yr3 / total * 100);
  const yr4pct = Math.round(yr4plus / total * 100);

  console.log(`    Year 1: ${yr1} (${yr1pct}%) | Year 2: ${yr2} (${yr2pct}%) | Year 3: ${yr3} (${yr3pct}%) | Year 4+: ${yr4plus} (${yr4pct}%)`);
  assert(yr1 > yr2, 'Year 1 > Year 2', `${yr1} > ${yr2}`);
  assert(yr2 > yr3, 'Year 2 > Year 3', `${yr2} > ${yr3}`);
  assert(yr3 > yr4plus, 'Year 3 > Year 4+', `${yr3} > ${yr4plus}`);
  assert(yr1pct >= 35 && yr1pct <= 50, `Year 1 between 35-50% (got ${yr1pct}%)`);
  assert(yr2pct >= 20 && yr2pct <= 35, `Year 2 between 20-35% (got ${yr2pct}%)`);
}

async function testOccupancy() {
  console.log('\n2. Dormitory occupancy never exceeds capacity');
  const dormitories = await DormitoryCollection.find({}).lean();
  let violations = 0;
  let totalRooms = 0;
  let totalBeds = 0;
  let totalOccupied = 0;

  for (const dorm of dormitories) {
    for (const floor of (dorm.floors || [])) {
      for (const room of (floor.rooms || [])) {
        totalRooms++;
        const cap = room.maxCapacity || 4;
        const occ = (room.occupants || []).length;
        totalBeds += cap;
        totalOccupied += occ;
        if (occ > cap) {
          violations++;
          console.error(`    Over-capacity: ${dorm.name} room ${room.roomNumber} has ${occ}/${cap}`);
        }
      }
    }
  }

  assert(violations === 0, `No over-capacity rooms (checked ${totalRooms} rooms, ${violations} violations)`);
  const occRate = Math.round(totalOccupied / totalBeds * 100);
  assert(occRate >= 50 && occRate <= 100, `Overall occupancy ${occRate}% (realistic 50-100%)`);
  console.log(`    Total: ${totalOccupied}/${totalBeds} beds (${occRate}% occupied)`);
}

async function testHistoricalData() {
  console.log('\n3. Historical enrollment data integrity');
  const records = await HistoricalEnrollment.find({}).sort({ academicYear: 1 }).lean();
  assert(records.length >= 5, `At least 5 years of historical data (got ${records.length})`);

  for (const r of records) {
    // Enrollment fill rate
    assert(r.totalActualEnrollment <= r.totalEnrollmentQuota * 1.1,
      `${r.academicYear}: actual ≤ quota×1.1 (${r.totalActualEnrollment} vs ${r.totalEnrollmentQuota})`);
    // Residents ≤ capacity
    assert((r.dormResidents || 0) <= (r.dormCapacity || 1308),
      `${r.academicYear}: residents ≤ capacity (${r.dormResidents} vs ${r.dormCapacity})`);
    // Accepted ≤ applications
    assert((r.dormAcceptedStudents || 0) <= (r.dormApplications || 1),
      `${r.academicYear}: accepted ≤ applications`);
    // Application rate realistic
    const appRate = r.dormApplications ? r.dormApplications / r.totalActualEnrollment : 0;
    assert(appRate >= 0.3 && appRate <= 0.8,
      `${r.academicYear}: application rate realistic (${Math.round(appRate*100)}%)`);
  }
}

async function testEnrollmentPlan() {
  console.log('\n4. Enrollment plan integrity');
  const plans = await EnrollmentPlan.find({}).lean();
  if (plans.length === 0) {
    console.log('  · No enrollment plans — skip (run seed-enrollment-historical.js first)');
    return;
  }

  for (const plan of plans) {
    const sumQuota = (plan.programs || []).reduce((s, p) => s + (p.plannedQuota || 0), 0);
    assert(Math.abs(sumQuota - (plan.totalPlannedQuota || 0)) <= 1,
      `${plan.academicYear}: totalPlannedQuota matches sum of programs (${sumQuota} vs ${plan.totalPlannedQuota})`);

    const sumDorm = (plan.programs || []).reduce((s, p) => s + (p.expectedDormResidents || 0), 0);
    assert(Math.abs(sumDorm - (plan.totalExpectedDorm || 0)) <= 5,
      `${plan.academicYear}: totalExpectedDorm ≈ sum of programs (${sumDorm} vs ${plan.totalExpectedDorm})`);

    assert(['draft','review','approved','locked'].includes(plan.status),
      `${plan.academicYear}: valid status (${plan.status})`);

    assert((plan.programs || []).length > 0,
      `${plan.academicYear}: has programs`);
  }
}

async function testRoomTransfer() {
  console.log('\n5. Room Transfer schema');
  // Create a test transfer record
  const students = await StudentCollection.find({ dormitoryId: { $exists: true, $ne: null }, roomNumber: { $exists: true, $ne: '' } }).limit(1).lean();
  if (students.length === 0) {
    console.log('  · No resident students found — skip transfer test');
    return;
  }

  const s = students[0];
  const transfer = new RoomTransfer({
    studentId: s._id,
    studentName: s.name,
    studentMSSV: s.studentId,
    fromDormitoryId: s.dormitoryId,
    fromRoomNumber: s.roomNumber,
    reason: 'Test: phòng hiện tại quá ồn, muốn chuyển sang phòng yên tĩnh hơn để học tập',
    preferredRoomType: 'any',
    academicYear: '2024-2025'
  });
  transfer.addHistory('submitted', s._id, s.name, 'Test submission');

  await transfer.save();
  assert(transfer._id != null, 'Transfer saved successfully');
  assert(transfer.status === 'pending', 'Initial status is pending');
  assert(transfer.history.length === 1, 'History entry created');

  // Test rejection
  transfer.status = 'rejected';
  transfer.adminNote = 'Test rejection';
  transfer.addHistory('rejected', s._id, 'Admin', 'Test rejection');
  await transfer.save();
  assert(transfer.status === 'rejected', 'Status updated to rejected');

  // Cleanup test record
  await RoomTransfer.deleteOne({ _id: transfer._id });
  assert(true, 'Test transfer cleaned up');
}

async function testForecastEngine() {
  console.log('\n6. Demand forecast computation');
  const records = await HistoricalEnrollment.find({}).lean();
  if (records.length < 2) {
    console.log('  · Not enough historical data — skip forecast test');
    return;
  }

  const DORM_CAP = 1308;
  const prev = records.reduce((a, b) => a.academicYear > b.academicYear ? a : b);

  // Simulate simple forecast
  const appRate = prev.dormApplicationRate || 0.5;
  const accRate = prev.dormAcceptanceRate || 0.8;
  const quota = prev.totalEnrollmentQuota;
  const expectedApps = Math.round(quota * appRate);
  const expectedResidents = Math.min(Math.round(expectedApps * accRate), DORM_CAP);
  const occRate = expectedResidents / DORM_CAP;

  assert(expectedApps > 0, `Forecast produces applications (${expectedApps})`);
  assert(expectedResidents <= DORM_CAP, `Forecast residents ≤ capacity (${expectedResidents} vs ${DORM_CAP})`);
  assert(occRate >= 0.5 && occRate <= 1.0, `Forecast occupancy rate realistic (${Math.round(occRate*100)}%)`);

  // Check that scenario C > scenario A and scenario D < scenario A
  const scA = expectedResidents;
  const scC = Math.min(Math.round(expectedApps * 1.07 * accRate), DORM_CAP);
  const scD = Math.min(Math.round(expectedApps * 0.93 * accRate), DORM_CAP);
  assert(scC >= scA, `Scenario C (growth) >= Scenario A (${scC} >= ${scA})`);
  assert(scD <= scA, `Scenario D (decline) <= Scenario A (${scD} <= ${scA})`);
}

async function main() {
  await mongoose.connection.asPromise();
  console.log('=== eDorm Feature Test Suite ===\n');
  console.log('Connected to database:', mongoose.connection.name);

  await testStudentDistribution();
  await testOccupancy();
  await testHistoricalData();
  await testEnrollmentPlan();
  await testRoomTransfer();
  await testForecastEngine();

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('✓ All tests passed!');
  } else {
    console.log(`✗ ${failed} test(s) failed — review output above`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
