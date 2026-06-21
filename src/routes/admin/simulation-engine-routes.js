const express = require('express');
const router  = express.Router();
const { isAdmin }           = require('../../middleware/auth');
const { isSimulationAdmin } = require('../../middleware/simulationAuth');
const SimulationEngineService    = require('../../services/simulationEngineService');
const SimulationWorkspaceService = require('../../services/simulationWorkspaceService');
const SimulationApplyService     = require('../../services/simulationApplyService');
const SimulationResult           = require('../../schemas/simulation/SimulationResultSchema');
const { logger } = require('../../config/logger');

const SIM_ACADEMIC_YEAR = '2026-2027';
const SIM_ENROLL_YEAR   = 2026;

// Guard: all engine routes require admintest
router.use('/api/simulation/engine', isAdmin, isSimulationAdmin);
router.use('/admin/simulation/engine', isAdmin, isSimulationAdmin);

// ── UI page ───────────────────────────────────────────────────────────────────

router.get('/admin/simulation/engine', async (req, res) => {
  try {
    const wsStatus = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);

    if (!wsStatus.hasWorkspace) {
      return res.redirect('/admin/simulation');
    }

    const wid = wsStatus.workspace._id;

    // Auto cohort shift on every load (idempotent)
    await SimulationEngineService.applyCohortShift(wid, SIM_ACADEMIC_YEAR);

    // Get distribution; auto-seed year1 if none exist yet
    let dist = await SimulationEngineService.getCohortDistribution(wid);
    if (dist.year1 === 0) {
      const year1Count = Math.floor(Math.random() * 101) + 280;
      await SimulationEngineService.seedYear1Students(wid, year1Count, SIM_ENROLL_YEAR);
      dist = await SimulationEngineService.getCohortDistribution(wid);
    }

    const [latestRun, latestApplied] = await Promise.all([
      SimulationEngineService.getLatestRun(wid),
      SimulationResult.findOne({ workspaceId: wid, status: 'APPLIED' }).sort({ appliedAt: -1 }).lean()
    ]);

    res.render('admin/simulation/engine', {
      user: {
        name:       req.session.name,
        role:       req.session.role,
        username:   req.session.username,
        isSuperAdmin: req.session.isSuperAdmin
      },
      activeNav:    'simulation',
      workspace:    wsStatus.workspace,
      distribution: dist,
      latestRun:    latestRun || null,
      simState: latestApplied ? {
        applied:    true,
        snapshotId: latestApplied.snapshotId,
        appliedAt:  latestApplied.appliedAt,
        stats:      latestApplied.stats
      } : null
    });
  } catch (err) {
    logger.error('Engine page error', { error: err.message });
    res.status(500).send('Server error: ' + err.message);
  }
});

// ── POST /api/simulation/engine/seed-year1 ────────────────────────────────────

router.post('/api/simulation/engine/seed-year1', async (req, res) => {
  try {
    const wsStatus = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!wsStatus.hasWorkspace) {
      return res.status(400).json({ success: false, error: 'Chưa có workspace. Khởi tạo workspace trước.' });
    }

    const count          = Math.min(500, Math.max(50, parseInt(req.body.count) || 200));
    const enrollmentYear = parseInt(req.body.enrollmentYear) || new Date().getFullYear();
    const simAcademicYear = req.body.simAcademicYear || `${enrollmentYear}-${enrollmentYear + 1}`;

    const wid = wsStatus.workspace._id;

    // Apply cohort shift first
    await SimulationEngineService.applyCohortShift(wid, simAcademicYear);

    // Seed new Year-1 students
    const seeded = await SimulationEngineService.seedYear1Students(wid, count, enrollmentYear);

    const dist = await SimulationEngineService.getCohortDistribution(wid);

    res.json({
      success: true,
      message: `Đã tạo ${seeded} sinh viên năm nhất (${enrollmentYear}) và áp dụng Cohort Shift`,
      distribution: dist,
      enrollmentYear,
      seeded
    });
  } catch (err) {
    logger.error('Seed Year-1 error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/simulation/engine/cohort-shift ──────────────────────────────────

router.post('/api/simulation/engine/cohort-shift', async (req, res) => {
  try {
    const wsStatus = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!wsStatus.hasWorkspace) {
      return res.status(400).json({ success: false, error: 'Chưa có workspace.' });
    }

    const simAcademicYear = req.body.simAcademicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    const wid = wsStatus.workspace._id;

    const updated = await SimulationEngineService.applyCohortShift(wid, simAcademicYear);
    const dist    = await SimulationEngineService.getCohortDistribution(wid);

    res.json({ success: true, updated, distribution: dist });
  } catch (err) {
    logger.error('Cohort shift error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/simulation/engine/run ───────────────────────────────────────────

router.post('/api/simulation/engine/run', async (req, res) => {
  try {
    const wsStatus = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!wsStatus.hasWorkspace) {
      return res.status(400).json({ success: false, error: 'Chưa có workspace.' });
    }

    const wid = wsStatus.workspace._id;
    const simAcademicYear = req.body.simAcademicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

    const weights = {
      year:        parseFloat(req.body.weightYear)        || 1.0,
      distance:    parseFloat(req.body.weightDistance)    || 1.0,
      family:      parseFloat(req.body.weightFamily)      || 1.0,
      policy:      parseFloat(req.body.weightPolicy)      || 1.0,
      ethnicity:   parseFloat(req.body.weightEthnicity)   || 0.5,
      violation:   parseFloat(req.body.weightViolation)   || 1.0,
      dormHistory: parseFloat(req.body.weightDormHistory) || 0.3
    };

    const run = await SimulationEngineService.runAllocationPreview(wid, weights, simAcademicYear);

    // Return lightweight response (full run is fetched separately)
    res.json({
      success: true,
      runId:   run.runId,
      summary: run.summary,
      byYearGroup: run.byYearGroup,
      message: `Simulation hoàn thành: ${run.summary.allocated} sinh viên được phân phòng, ${run.summary.waitlisted} chờ.`
    });
  } catch (err) {
    logger.error('Simulation run error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/simulation/engine/results ────────────────────────────────────────

router.get('/api/simulation/engine/results', async (req, res) => {
  try {
    const wsStatus = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!wsStatus.hasWorkspace) {
      return res.status(404).json({ success: false, error: 'Không có workspace.' });
    }

    const run = await SimulationEngineService.getLatestRun(wsStatus.workspace._id);
    if (!run) return res.json({ success: true, run: null });

    res.json({ success: true, run });
  } catch (err) {
    logger.error('Get results error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/simulation/engine/results/:runId ─────────────────────────────────

router.get('/api/simulation/engine/results/:runId', async (req, res) => {
  try {
    const wsStatus = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!wsStatus.hasWorkspace) {
      return res.status(404).json({ success: false, error: 'Không có workspace.' });
    }

    const run = await SimulationEngineService.getRunById(wsStatus.workspace._id, req.params.runId);
    if (!run) return res.status(404).json({ success: false, error: 'Run không tồn tại.' });

    res.json({ success: true, run });
  } catch (err) {
    logger.error('Get run by id error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/simulation/engine/distribution ───────────────────────────────────

router.get('/api/simulation/engine/distribution', async (req, res) => {
  try {
    const wsStatus = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!wsStatus.hasWorkspace) {
      return res.status(404).json({ success: false, error: 'Không có workspace.' });
    }

    const dist = await SimulationEngineService.getCohortDistribution(wsStatus.workspace._id);
    res.json({ success: true, distribution: dist });
  } catch (err) {
    logger.error('Distribution error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/simulation/engine/results/:runId/move-room ────────────────────

router.patch('/api/simulation/engine/results/:runId/move-room', async (req, res) => {
  try {
    const wsStatus = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!wsStatus.hasWorkspace) return res.status(400).json({ success: false, error: 'Không có workspace.' });

    const { simStudentId, dormName, floor, roomNumber, roomType } = req.body;
    if (!simStudentId || !dormName || !floor || !roomNumber) {
      return res.status(400).json({ success: false, error: 'Thiếu tham số: simStudentId, dormName, floor, roomNumber' });
    }

    await SimulationApplyService.moveRoom(wsStatus.workspace._id, req.params.runId, simStudentId, { dormName, floor, roomNumber, roomType });
    res.json({ success: true, message: 'Đã chuyển phòng thành công' });
  } catch (err) {
    logger.error('Move room error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/simulation/engine/results/:runId/remove-student ───────────────

router.patch('/api/simulation/engine/results/:runId/remove-student', async (req, res) => {
  try {
    const wsStatus = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!wsStatus.hasWorkspace) return res.status(400).json({ success: false, error: 'Không có workspace.' });

    const { simStudentId, reason } = req.body;
    if (!simStudentId) return res.status(400).json({ success: false, error: 'Thiếu simStudentId' });

    await SimulationApplyService.removeStudent(wsStatus.workspace._id, req.params.runId, simStudentId, reason);
    res.json({ success: true, message: 'Đã chuyển sinh viên vào danh sách chờ' });
  } catch (err) {
    logger.error('Remove student error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/simulation/engine/results/:runId/promote-student ──────────────

router.patch('/api/simulation/engine/results/:runId/promote-student', async (req, res) => {
  try {
    const wsStatus = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!wsStatus.hasWorkspace) return res.status(400).json({ success: false, error: 'Không có workspace.' });

    const { simStudentId, dormName, floor, roomNumber, roomType } = req.body;
    if (!simStudentId || !dormName || !floor || !roomNumber) {
      return res.status(400).json({ success: false, error: 'Thiếu tham số: simStudentId, dormName, floor, roomNumber' });
    }

    await SimulationApplyService.promoteStudent(wsStatus.workspace._id, req.params.runId, simStudentId, { dormName, floor, roomNumber, roomType });
    res.json({ success: true, message: 'Đã phân phòng thủ công thành công' });
  } catch (err) {
    logger.error('Promote student error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/simulation/engine/rooms ─────────────────────────────────────────

router.get('/api/simulation/engine/rooms', async (req, res) => {
  try {
    const wsStatus = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!wsStatus.hasWorkspace) return res.status(400).json({ success: false, error: 'Không có workspace.' });

    const rooms = await SimulationApplyService.getSimRoomList(wsStatus.workspace._id);
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/simulation/engine/apply ────────────────────────────────────────

router.post('/api/simulation/engine/apply', async (req, res) => {
  try {
    const wsStatus = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!wsStatus.hasWorkspace) return res.status(400).json({ success: false, error: 'Không có workspace.' });

    const { runId } = req.body;
    if (!runId) return res.status(400).json({ success: false, error: 'Thiếu runId' });

    // admintest: chỉ lưu SimulationResult, không động DB thật
    if (req.session.username === 'admintest') {
      const run = await SimulationEngineService.getRunById(wsStatus.workspace._id, runId);
      let realStudents = 0, skippedYear1 = 0;
      if (run) {
        (run.allocatedStudents || []).forEach(s => {
          if (s.isNewYear1) skippedYear1++;
          else realStudents++;
        });
      }
      const snapshotId = `DEMO-${Date.now()}`;
      // Mark any previous APPLIED result as UNDONE before creating new one
      await SimulationResult.updateMany(
        { workspaceId: wsStatus.workspace._id, status: 'APPLIED' },
        { $set: { status: 'UNDONE', undoneAt: new Date() } }
      );
      await SimulationResult.create({
        workspaceId: wsStatus.workspace._id,
        runId,
        snapshotId,
        status: 'APPLIED',
        appliedBy: req.session.userId,
        stats: {
          total:       run?.summary?.totalStudentsInQueue || 0,
          allocated:   run?.summary?.allocated || 0,
          waitlisted:  run?.summary?.waitlisted || 0,
          skippedYear1
        }
      });
      return res.json({
        success: true,
        snapshotId,
        stats: { realStudents, skippedYear1 },
        message: 'Đã lưu kết quả mô phỏng'
      });
    }

    const snapshot = await SimulationApplyService.applyToRealAllocation(
      wsStatus.workspace._id,
      runId,
      req.session.userId
    );

    res.json({
      success: true,
      snapshotId: snapshot.snapshotId,
      stats:      snapshot.stats,
      message:    `Apply thành công: ${snapshot.stats.realStudents} sinh viên thực được phân phòng. ${snapshot.stats.skippedYear1} sinh viên năm 1 mô phỏng bị bỏ qua.`
    });
  } catch (err) {
    logger.error('Apply to real allocation error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/simulation/engine/undo/:snapshotId ─────────────────────────────

router.post('/api/simulation/engine/undo/:snapshotId', async (req, res) => {
  try {
    const wsStatus = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!wsStatus.hasWorkspace) return res.status(400).json({ success: false, error: 'Không có workspace.' });

    const snapshot = await SimulationApplyService.undoAllocation(wsStatus.workspace._id, req.params.snapshotId);

    res.json({
      success: true,
      snapshotId: snapshot.snapshotId,
      status:     snapshot.status,
      undoneAt:   snapshot.undoneAt,
      message:    'Undo thành công. Dữ liệu thật đã được khôi phục về trạng thái trước apply.'
    });
  } catch (err) {
    logger.error('Undo allocation error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/simulation/engine/snapshot ──────────────────────────────────────

router.get('/api/simulation/engine/snapshot', async (req, res) => {
  try {
    const wsStatus = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!wsStatus.hasWorkspace) return res.json({ success: true, snapshot: null });

    const snapshot = await SimulationApplyService.getLatestSnapshot(wsStatus.workspace._id);
    res.json({ success: true, snapshot });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/simulation/engine/report ────────────────────────────────────────

router.get('/api/simulation/engine/report', async (req, res) => {
  try {
    const wsStatus = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!wsStatus.hasWorkspace) return res.status(400).json({ success: false, error: 'Không có workspace.' });

    const run = await SimulationEngineService.getLatestRun(wsStatus.workspace._id);
    if (!run) return res.status(404).json({ success: false, error: 'Chưa có simulation run.' });

    const md = await SimulationApplyService.generateReport(wsStatus.workspace._id, run.runId);

    if (req.query.download === '1') {
      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="BaoCao_MoPhong_${dateStr}.xlsx"`);
      return res.send(md);
    }

    res.json({ success: true, runId: run.runId });
  } catch (err) {
    logger.error('Generate report error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/simulation/engine/undo-demo ────────────────────────────────────

router.post('/api/simulation/engine/undo-demo', async (req, res) => {
  try {
    const SimulationWorkspace = require('../../schemas/simulation/SimulationWorkspaceSchema');
    const allWs = await SimulationWorkspace.find({ adminUserId: req.session.userId }).lean();
    if (!allWs.length) return res.status(400).json({ success: false, error: 'Không có workspace.' });

    const wsIds = allWs.map(w => w._id);
    const result = await SimulationResult.updateMany(
      { workspaceId: { $in: wsIds }, status: 'APPLIED' },
      { $set: { status: 'UNDONE', undoneAt: new Date() } }
    );

    res.json({ success: true, undone: result.modifiedCount, message: 'Đã hoàn tác kết quả mô phỏng' });
  } catch (err) {
    logger.error('Undo demo error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
