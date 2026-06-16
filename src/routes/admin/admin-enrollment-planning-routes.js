const express = require('express');
const router = express.Router();
const { isAdmin } = require('../../middleware/auth');
const EnrollmentPlan = require('../../schemas/EnrollmentPlanSchema');
const HistoricalEnrollment = require('../../schemas/HistoricalEnrollmentSchema');
const RoomTransfer = require('../../schemas/RoomTransferSchema');

/**
 * Thống kê đơn đổi phòng theo năm + dự kiến cho năm mới (Task 4).
 * Dự kiến = trung bình số đơn các năm trước (làm tròn). Lịch sử mỏng → đánh dấu lowConfidence.
 */
async function getTransferStats() {
  const byYear = await RoomTransfer.aggregate([
    { $group: {
        _id: { $ifNull: ['$academicYear', 'Không rõ'] },
        total: { $sum: 1 },
        approved: { $sum: { $cond: [{ $in: ['$status', ['approved', 'completed']] }, 1, 0] } }
    } },
    { $sort: { _id: -1 } }
  ]);

  const yearsWithData = byYear.filter(y => y._id && y._id !== 'Không rõ');
  const totalAll = byYear.reduce((s, y) => s + y.total, 0);
  const avgPerYear = yearsWithData.length > 0
    ? Math.round(totalAll / yearsWithData.length)
    : 0;

  return {
    byYear,
    avgPerYear,
    projectedNextYear: avgPerYear,
    yearsCount: yearsWithData.length,
    totalAll,
    lowConfidence: yearsWithData.length < 2 // ít hơn 2 năm → ước lượng kém tin cậy
  };
}

// HUST programs master list
const HUST_PROGRAMS = [
  { code: 'CH', name: 'Công nghệ Hoá học', faculty: 'Hoá & Thực phẩm', type: 'standard', defaultQuota: 200 },
  { code: 'TP', name: 'Công nghệ Thực phẩm', faculty: 'Hoá & Thực phẩm', type: 'standard', defaultQuota: 180 },
  { code: 'CNTT', name: 'Công nghệ Thông tin', faculty: 'Công nghệ thông tin', type: 'standard', defaultQuota: 380 },
  { code: 'KHMT', name: 'Khoa học Máy tính', faculty: 'Công nghệ thông tin', type: 'standard', defaultQuota: 250 },
  { code: 'DSAI', name: 'Khoa học Dữ liệu & Trí tuệ nhân tạo', faculty: 'Công nghệ thông tin', type: 'standard', defaultQuota: 200 },
  { code: 'KTDT', name: 'Kỹ thuật Điện tử', faculty: 'Điện tử - Viễn thông', type: 'standard', defaultQuota: 280 },
  { code: 'VT', name: 'Kỹ thuật Viễn thông', faculty: 'Điện tử - Viễn thông', type: 'standard', defaultQuota: 200 },
  { code: 'KTD', name: 'Kỹ thuật Điều khiển - Tự động hoá', faculty: 'Điện', type: 'standard', defaultQuota: 260 },
  { code: 'HT', name: 'Hệ thống Điện', faculty: 'Điện', type: 'standard', defaultQuota: 180 },
  { code: 'KTCK', name: 'Kỹ thuật Cơ khí', faculty: 'Cơ khí', type: 'standard', defaultQuota: 310 },
  { code: 'CKCT', name: 'Cơ khí Chính xác', faculty: 'Cơ khí', type: 'standard', defaultQuota: 150 },
  { code: 'CDIO', name: 'Chương trình tiên tiến Cơ điện tử', faculty: 'Cơ khí', type: 'advanced', defaultQuota: 80 },
  { code: 'QTKD', name: 'Quản trị Kinh doanh', faculty: 'Kinh tế & Quản lý', type: 'standard', defaultQuota: 240 },
  { code: 'KTXD', name: 'Kỹ thuật Xây dựng', faculty: 'Xây dựng & Môi trường', type: 'standard', defaultQuota: 200 },
  { code: 'MT', name: 'Kỹ thuật Môi trường', faculty: 'Xây dựng & Môi trường', type: 'standard', defaultQuota: 120 },
  { code: 'VLKT', name: 'Vật liệu Kỹ thuật', faculty: 'Khoa học & Kỹ thuật Vật liệu', type: 'standard', defaultQuota: 130 },
  { code: 'ELITECH', name: 'Elitech (Chương trình chất lượng cao)', faculty: 'Liên khoa', type: 'advanced', defaultQuota: 200 },
  { code: 'INTL_IT', name: 'Công nghệ thông tin (Chương trình quốc tế)', faculty: 'Quốc tế', type: 'international', defaultQuota: 60 },
  { code: 'INTL_EM', name: 'Quản trị Kỹ thuật (Quốc tế)', faculty: 'Quốc tế', type: 'international', defaultQuota: 50 }
];

// List all plans
router.get('/admin/enrollment-planning', isAdmin, async (req, res) => {
  try {
    const plans = await EnrollmentPlan.find({}).sort({ createdAt: -1 }).lean();
    const transferStats = await getTransferStats();
    res.render('admin/enrollment-planning/index', {
      user: { name: req.session.adminName, role: req.session.adminRole },
      activeNav: 'enrollmentplanning',
      plans,
      transferStats
    });
  } catch (err) {
    console.error('[EnrollmentPlanning] list error:', err);
    res.status(500).send('Server error');
  }
});

// New plan page
router.get('/admin/enrollment-planning/new', isAdmin, async (req, res) => {
  try {
    const previousPlans = await EnrollmentPlan.find({ status: { $in: ['approved', 'locked'] } })
      .select('academicYear planName totalPlannedQuota').sort({ academicYear: -1 }).lean();
    res.render('admin/enrollment-planning/new', {
      user: { name: req.session.adminName, role: req.session.adminRole },
      activeNav: 'enrollmentplanning',
      programs: HUST_PROGRAMS,
      previousPlans
    });
  } catch (err) {
    console.error('[EnrollmentPlanning] new page error:', err);
    res.status(500).send('Server error');
  }
});

// Create plan
router.post('/admin/enrollment-planning', isAdmin, async (req, res) => {
  try {
    const { academicYear, planName, description, programs } = req.body;
    if (!academicYear || !planName) return res.status(400).json({ error: 'academicYear and planName required' });

    const parsedPrograms = (programs || []).map(p => ({
      programCode: p.programCode,
      programName: p.programName,
      faculty: p.faculty,
      programType: p.programType || 'standard',
      plannedQuota: parseInt(p.plannedQuota) || 0,
      actualEnrollment: parseInt(p.actualEnrollment) || 0,
      dormApplicationRate: parseFloat(p.dormApplicationRate) || 0.45,
      expectedDormResidents: Math.round((parseInt(p.plannedQuota) || 0) * (parseFloat(p.dormApplicationRate) || 0.45))
    }));

    const plan = new EnrollmentPlan({
      academicYear,
      planName,
      description,
      programs: parsedPrograms,
      createdBy: req.session.adminId
    });
    plan.workflowHistory.push({
      step: 'created',
      actor: req.session.adminId,
      actorName: req.session.adminName,
      note: 'Kế hoạch được tạo'
    });
    await plan.save();
    res.json({ success: true, id: plan._id });
  } catch (err) {
    console.error('[EnrollmentPlanning] create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Detail / edit
router.get('/admin/enrollment-planning/:id', isAdmin, async (req, res) => {
  try {
    const plan = await EnrollmentPlan.findById(req.params.id).lean();
    if (!plan) return res.status(404).send('Not found');
    res.render('admin/enrollment-planning/detail', {
      user: { name: req.session.adminName, role: req.session.adminRole },
      activeNav: 'enrollmentplanning',
      plan,
      programs: HUST_PROGRAMS
    });
  } catch (err) {
    console.error('[EnrollmentPlanning] detail error:', err);
    res.status(500).send('Server error');
  }
});

// Update plan programs
router.put('/admin/enrollment-planning/:id', isAdmin, async (req, res) => {
  try {
    const plan = await EnrollmentPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Not found' });
    if (plan.status === 'locked') return res.status(400).json({ error: 'Cannot edit a locked plan' });

    const { planName, description, programs } = req.body;
    if (planName) plan.planName = planName;
    if (description !== undefined) plan.description = description;
    if (programs) {
      plan.programs = programs.map(p => ({
        programCode: p.programCode,
        programName: p.programName,
        faculty: p.faculty,
        programType: p.programType || 'standard',
        plannedQuota: parseInt(p.plannedQuota) || 0,
        actualEnrollment: parseInt(p.actualEnrollment) || 0,
        dormApplicationRate: parseFloat(p.dormApplicationRate) || 0.45,
        expectedDormResidents: Math.round((parseInt(p.plannedQuota) || 0) * (parseFloat(p.dormApplicationRate) || 0.45))
      }));
    }
    await plan.save();
    res.json({ success: true });
  } catch (err) {
    console.error('[EnrollmentPlanning] update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Workflow transition
router.post('/admin/enrollment-planning/:id/workflow', isAdmin, async (req, res) => {
  try {
    const { action, note } = req.body;
    const validTransitions = { draft: 'submitted', review: 'approved', approved: 'locked' };
    const plan = await EnrollmentPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Not found' });

    const transitions = { draft: ['submitted'], review: ['approved'], approved: ['locked'] };
    if (!transitions[plan.status] || !transitions[plan.status].includes(action)) {
      return res.status(400).json({ error: `Cannot transition from ${plan.status} with action ${action}` });
    }

    plan.addWorkflowStep(action, req.session.adminId, req.session.adminName, note);
    if (action === 'locked') {
      plan.lockedAt = new Date();
      plan.lockedBy = req.session.adminId;
    }
    await plan.save();
    res.json({ success: true, newStatus: plan.status });
  } catch (err) {
    console.error('[EnrollmentPlanning] workflow error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Copy from previous plan
router.post('/admin/enrollment-planning/:id/copy', isAdmin, async (req, res) => {
  try {
    const { newAcademicYear, newPlanName } = req.body;
    const source = await EnrollmentPlan.findById(req.params.id).lean();
    if (!source) return res.status(404).json({ error: 'Not found' });

    const newPlan = new EnrollmentPlan({
      academicYear: newAcademicYear,
      planName: newPlanName || `Kế hoạch ${newAcademicYear} (sao chép)`,
      description: source.description,
      programs: source.programs,
      dormCapacity: source.dormCapacity,
      copiedFrom: source._id,
      createdBy: req.session.adminId
    });
    newPlan.workflowHistory.push({
      step: 'created',
      actor: req.session.adminId,
      actorName: req.session.adminName,
      note: `Sao chép từ kế hoạch ${source.academicYear}`
    });
    await newPlan.save();
    res.json({ success: true, id: newPlan._id });
  } catch (err) {
    console.error('[EnrollmentPlanning] copy error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete draft
router.delete('/admin/enrollment-planning/:id', isAdmin, async (req, res) => {
  try {
    const plan = await EnrollmentPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Not found' });
    if (plan.status !== 'draft') return res.status(400).json({ error: 'Only drafts can be deleted' });
    await plan.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error('[EnrollmentPlanning] delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// JSON: HUST programs reference list
router.get('/admin/api/enrollment-planning/programs', isAdmin, (req, res) => {
  res.json({ programs: HUST_PROGRAMS });
});

// JSON: historical summary
router.get('/admin/api/enrollment-planning/historical', isAdmin, async (req, res) => {
  try {
    const records = await HistoricalEnrollment.find({}).sort({ academicYear: -1 }).lean();
    res.json({ records });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.HUST_PROGRAMS = HUST_PROGRAMS;
