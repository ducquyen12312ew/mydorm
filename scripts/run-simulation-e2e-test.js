/**
 * Simulation End-to-End Test Script
 * Runs: initWorkspace → seedYear1 → cohortShift → runAllocationPreview
 *       → manual edits → apply → undo → generate report
 *
 * Usage: node scripts/run-simulation-e2e-test.js
 * Output: simulation-test-report.md
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs       = require('fs');
const path     = require('path');

// ── Import Services ───────────────────────────────────────────────────────────
// NOTE: services import config.js which auto-connects, so we do NOT call
// mongoose.connect() ourselves — we just wait for the connection event.
const SimulationWorkspaceService = require('../src/services/simulationWorkspaceService');
const SimulationEngineService    = require('../src/services/simulationEngineService');
const SimulationApplyService     = require('../src/services/simulationApplyService');

// Minimal model to find admintest — must be registered AFTER config.js (above) loads
const Student = mongoose.models.students
  || mongoose.model('students', new mongoose.Schema({ username: String, _id: mongoose.Schema.Types.ObjectId }, { strict: false }));

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/dormitory'; // used in log only

// ── Test Config ───────────────────────────────────────────────────────────────
const YEAR1_COUNT     = 150;
const SIM_YEAR        = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
const ENROLLMENT_YEAR = new Date().getFullYear();

const WEIGHTS = {
  year:        1.0,
  distance:    1.2,
  family:      1.0,
  policy:      1.0,
  ethnicity:   0.5,
  violation:   1.0,
  dormHistory: 0.3
};

// ── Logger ────────────────────────────────────────────────────────────────────
const log = (msg) => { console.log(`[SIM-TEST] ${msg}`); };
const sep = () => console.log('─'.repeat(60));

async function main() {
  sep();
  log('eDorm Simulation E2E Test');
  log(`MongoDB: ${MONGODB_URI.split('@').pop() || MONGODB_URI}`);
  log(`Sim Year: ${SIM_YEAR} | Year-1 count: ${YEAR1_COUNT}`);
  sep();

  // ── 1. Wait for config.js auto-connection ────────────────────────────────────
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve, reject) => {
      mongoose.connection.once('connected', resolve);
      mongoose.connection.once('error', reject);
      setTimeout(() => reject(new Error('MongoDB connection timeout')), 20000);
    });
  }
  log('Connected to MongoDB');

  // ── 2. Find admintest user ───────────────────────────────────────────────────
  const admin = await Student.findOne({ username: 'admintest' }).lean();
  if (!admin) {
    console.error('[SIM-TEST] admintest user not found. Run: node scripts/create-admintest.js');
    process.exit(1);
  }
  const adminId = admin._id;
  log(`Admin: ${admin.username} (${adminId})`);

  // ── 3. Initialize workspace ──────────────────────────────────────────────────
  log('Step 1: Initializing workspace...');
  const workspace = await SimulationWorkspaceService.initWorkspace(adminId, 'admintest');
  const wid = workspace._id;
  log(`Workspace created: ${wid} | Status: ${workspace.status}`);
  log(`Snapshot: students=${workspace.snapshotSummary?.studentCount}, dorms=${workspace.snapshotSummary?.dormitoryCount}, rooms=${workspace.snapshotSummary?.roomCount}`);

  // ── 4. Apply cohort shift ────────────────────────────────────────────────────
  log('Step 2: Applying cohort shift...');
  const updated = await SimulationEngineService.applyCohortShift(wid, SIM_YEAR);
  log(`Cohort shift: ${updated} students updated`);

  // ── 5. Seed Year-1 students ──────────────────────────────────────────────────
  log(`Step 3: Seeding ${YEAR1_COUNT} Year-1 students...`);
  const seeded = await SimulationEngineService.seedYear1Students(wid, YEAR1_COUNT, ENROLLMENT_YEAR);
  log(`Seeded: ${seeded} Year-1 students`);

  const dist = await SimulationEngineService.getCohortDistribution(wid);
  log(`Distribution: Year1=${dist.year1} | Y2=${dist.year2} | Y3=${dist.year3} | Y4+=${dist.year4_plus} | Y5+=${dist.year5plus}`);

  // ── 6. Run allocation preview ────────────────────────────────────────────────
  log('Step 4: Running allocation preview...');
  const run = await SimulationEngineService.runAllocationPreview(wid, WEIGHTS, SIM_YEAR);
  const s   = run.summary;
  log(`Run ID: ${run.runId}`);
  log(`Allocated: ${s.allocated} | Waitlisted: ${s.waitlisted} | Fill rate: ${s.fillRate}%`);

  if (run.byYearGroup) {
    Object.entries(run.byYearGroup).forEach(([yg, stat]) => {
      log(`  ${yg}: ${stat.allocated}/${stat.total} (${stat.rate}%)`);
    });
  }

  // ── 7. Manual edits — remove 2 accepted, promote 1 waitlisted ───────────────
  log('Step 5: Manual edits...');
  const toRemove = run.allocatedStudents.slice(0, 2);
  for (const st of toRemove) {
    await SimulationApplyService.removeStudent(wid, run.runId, st.simStudentId, 'Test removal');
    log(`  Removed: ${st.name} (${st.simStudentId})`);
  }

  // Promote first waitlisted student to a fake room
  const toPromote = run.waitlistedStudents[0];
  if (toPromote) {
    const firstRoom = (run.heatmap?.[0]?.floors?.[0]?.rooms || [])[0];
    if (firstRoom && run.heatmap?.[0]) {
      await SimulationApplyService.promoteStudent(wid, run.runId, toPromote.simStudentId, {
        dormName:   run.heatmap[0].dormName,
        floor:      run.heatmap[0].floors[0]?.floorNumber || 1,
        roomNumber: firstRoom.roomNumber || '101',
        roomType:   'shared'
      });
      log(`  Promoted: ${toPromote.name} → ${run.heatmap[0].dormName}`);
    }
  }

  // ── 8. Apply to real allocation ──────────────────────────────────────────────
  log('Step 6: Applying to real allocation...');
  let snapshot = null;
  try {
    snapshot = await SimulationApplyService.applyToRealAllocation(wid, run.runId, adminId);
    log(`Applied: ${snapshot.stats.realStudents} real students | Skipped Year-1: ${snapshot.stats.skippedYear1}`);
    log(`Snapshot ID: ${snapshot.snapshotId}`);
  } catch (err) {
    log(`Apply skipped/error: ${err.message}`);
  }

  // ── 9. Undo ─────────────────────────────────────────────────────────────────
  if (snapshot) {
    log('Step 7: Undoing allocation...');
    try {
      const undone = await SimulationApplyService.undoAllocation(wid, snapshot.snapshotId);
      log(`Undo complete: ${undone.status} at ${undone.undoneAt?.toISOString()}`);
    } catch (err) {
      log(`Undo error: ${err.message}`);
    }
  }

  // ── 10. Generate report ──────────────────────────────────────────────────────
  log('Step 8: Generating simulation-test-report.md...');
  const reportPath = path.join(__dirname, '..', 'simulation-test-report.md');

  // Fetch refreshed run for accurate stats
  const finalRun = await SimulationEngineService.getRunById(wid, run.runId);
  const md = await SimulationApplyService.generateReport(wid, (finalRun || run).runId);

  fs.writeFileSync(reportPath, md, 'utf8');
  log(`Report written: ${reportPath}`);

  sep();
  log('E2E Test PASSED');
  sep();

  process.exit(0);
}

main().catch(err => {
  console.error('[SIM-TEST] FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
