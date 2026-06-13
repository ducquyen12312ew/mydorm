const express = require('express');
const router = express.Router();
const { isAdmin } = require('../../middleware/auth');
const { isSimulationAdmin } = require('../../middleware/simulationAuth');
const SimulationWorkspaceService = require('../../services/simulationWorkspaceService');
const { logger } = require('../../config/logger');

// ─── UI Page ──────────────────────────────────────────────────────────────────

router.get('/admin/simulation', isAdmin, isSimulationAdmin, async (req, res) => {
  try {
    const status = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    res.render('admin/simulation/index', {
      user: {
        name: req.session.name,
        role: req.session.role,
        username: req.session.username,
        isSuperAdmin: req.session.isSuperAdmin
      },
      activeNav: 'simulation',
      workspaceStatus: status
    });
  } catch (err) {
    logger.error('Simulation page error', { error: err.message });
    res.status(500).send('Server error');
  }
});

// ─── API: Initialize workspace (clone from production) ────────────────────────

router.post('/api/simulation/workspace/init', isAdmin, isSimulationAdmin, async (req, res) => {
  try {
    const workspace = await SimulationWorkspaceService.initWorkspace(
      req.session.userId,
      req.session.username
    );
    res.json({
      success: true,
      message: 'Workspace khởi tạo thành công',
      workspace: {
        _id: workspace._id,
        status: workspace.status,
        clonedAt: workspace.clonedAt,
        snapshotSummary: workspace.snapshotSummary
      }
    });
  } catch (err) {
    logger.error('Workspace init API error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── API: Reset workspace (archive + re-clone) ────────────────────────────────

router.post('/api/simulation/workspace/reset', isAdmin, isSimulationAdmin, async (req, res) => {
  try {
    const workspace = await SimulationWorkspaceService.resetWorkspace(
      req.session.userId,
      req.session.username
    );
    res.json({
      success: true,
      message: 'Workspace đã được reset và clone lại dữ liệu mới',
      workspace: {
        _id: workspace._id,
        status: workspace.status,
        clonedAt: workspace.clonedAt,
        snapshotSummary: workspace.snapshotSummary
      }
    });
  } catch (err) {
    logger.error('Workspace reset API error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── API: Get workspace status ────────────────────────────────────────────────

router.get('/api/simulation/workspace/status', isAdmin, isSimulationAdmin, async (req, res) => {
  try {
    const status = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    res.json({ success: true, ...status });
  } catch (err) {
    logger.error('Workspace status API error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── API: Get simulated students ──────────────────────────────────────────────

router.get('/api/simulation/workspace/students', isAdmin, isSimulationAdmin, async (req, res) => {
  try {
    const status = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!status.hasWorkspace) {
      return res.status(404).json({ success: false, error: 'Không có workspace đang hoạt động' });
    }
    const result = await SimulationWorkspaceService.getSimStudents(
      status.workspace._id,
      {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        faculty: req.query.faculty,
        yearGroup: req.query.yearGroup
      }
    );
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Simulation students API error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── API: Get simulated dormitories ──────────────────────────────────────────

router.get('/api/simulation/workspace/dormitories', isAdmin, isSimulationAdmin, async (req, res) => {
  try {
    const status = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!status.hasWorkspace) {
      return res.status(404).json({ success: false, error: 'Không có workspace đang hoạt động' });
    }
    const dorms = await SimulationWorkspaceService.getSimDormitories(status.workspace._id);
    res.json({ success: true, dormitories: dorms });
  } catch (err) {
    logger.error('Simulation dormitories API error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── API: Get simulated policies ─────────────────────────────────────────────

router.get('/api/simulation/workspace/policies', isAdmin, isSimulationAdmin, async (req, res) => {
  try {
    const status = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!status.hasWorkspace) {
      return res.status(404).json({ success: false, error: 'Không có workspace đang hoạt động' });
    }
    const policies = await SimulationWorkspaceService.getSimPolicies(status.workspace._id);
    res.json({ success: true, policies });
  } catch (err) {
    logger.error('Simulation policies API error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── API: Get simulated cycles ────────────────────────────────────────────────

router.get('/api/simulation/workspace/cycles', isAdmin, isSimulationAdmin, async (req, res) => {
  try {
    const status = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!status.hasWorkspace) {
      return res.status(404).json({ success: false, error: 'Không có workspace đang hoạt động' });
    }
    const cycles = await SimulationWorkspaceService.getSimCycles(status.workspace._id);
    res.json({ success: true, cycles });
  } catch (err) {
    logger.error('Simulation cycles API error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── API: Get simulated registrations ────────────────────────────────────────

router.get('/api/simulation/workspace/registrations', isAdmin, isSimulationAdmin, async (req, res) => {
  try {
    const status = await SimulationWorkspaceService.getWorkspaceStatus(req.session.userId);
    if (!status.hasWorkspace) {
      return res.status(404).json({ success: false, error: 'Không có workspace đang hoạt động' });
    }
    const registrations = await SimulationWorkspaceService.getSimRegistrations(
      status.workspace._id,
      req.query.cycleId
    );
    res.json({ success: true, registrations });
  } catch (err) {
    logger.error('Simulation registrations API error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
