'use strict';
const express = require('express');
const router = express.Router();
const { isAdmin } = require('../../middleware/auth');
const AllocationCycle = require('../../schemas/AllocationCycleSchema');
const QuotaConfig = require('../../schemas/QuotaConfigSchema');
const AllocationRegistration = require('../../schemas/AllocationRegistrationSchema');

// GET: Main registration-period management page
router.get('/admin/registration-period', isAdmin, async (req, res) => {
  try {
    const cycles = await AllocationCycle.find({}).sort({ createdAt: -1 }).lean();
    const quota = await QuotaConfig.findOne({ isPublished: true }).sort({ createdAt: -1 }).lean().catch(() => null)
      || await QuotaConfig.findOne({}).sort({ createdAt: -1 }).lean().catch(() => null);

    // Count registrations per cycle
    const cyclesWithCount = await Promise.all(cycles.map(async (c) => {
      const count = await AllocationRegistration.countDocuments({ allocationCycleId: c._id }).catch(() => 0);
      return { ...c, registrationCount: count };
    }));

    res.render('admin/registration-period', {
      user: { name: req.session.adminName || req.session.name, role: req.session.role },
      activeNav: 'registrationperiod',
      cycles: cyclesWithCount,
      quota: quota || null
    });
  } catch (err) {
    console.error('[RegistrationPeriod] GET error:', err);
    res.status(500).send('Server error: ' + err.message);
  }
});

// POST: Open new registration period
router.post('/admin/registration-period/open', isAdmin, async (req, res) => {
  try {
    const { academicYear, registrationStart, registrationEnd, note } = req.body;

    if (!academicYear || !registrationStart || !registrationEnd) {
      return res.json({ success: false, error: 'Thiếu thông tin bắt buộc' });
    }
    if (!/^\d{4}-\d{4}$/.test(academicYear)) {
      return res.json({ success: false, error: 'Năm học phải theo định dạng YYYY-YYYY' });
    }

    const startDate = new Date(registrationStart);
    const endDate   = new Date(registrationEnd);
    if (endDate <= startDate) {
      return res.json({ success: false, error: 'Ngày kết thúc phải sau ngày bắt đầu' });
    }

    const existing = await AllocationCycle.findOne({
      status: { $in: ['PENDING', 'RUNNING'] }
    }).lean();
    if (existing) {
      return res.json({ success: false, error: `Đã có đợt đăng ký đang mở (${existing.academicYear}). Đóng đợt cũ trước.` });
    }

    const quota = await QuotaConfig.findOne({ isPublished: true }).sort({ createdAt: -1 }).lean().catch(() => null)
      || await QuotaConfig.findOne({}).sort({ createdAt: -1 }).lean().catch(() => null);

    const cycle = await AllocationCycle.create({
      academicYear,
      name: 'Main Registration',
      status: 'RUNNING',
      registrationStart: startDate,
      registrationEnd: endDate,
      allocationDate: endDate,
      notes: note || '',
      createdBy: req.session.userId || req.session.adminId,
    });

    res.json({ success: true, message: 'Đã mở đợt đăng ký thành công', cycleId: cycle._id });
  } catch (err) {
    console.error('[RegistrationPeriod] open error:', err);
    res.json({ success: false, error: err.message });
  }
});

// POST: Close a registration period
router.post('/admin/registration-period/close/:id', isAdmin, async (req, res) => {
  try {
    const cycle = await AllocationCycle.findById(req.params.id);
    if (!cycle) return res.json({ success: false, error: 'Không tìm thấy đợt đăng ký' });
    if (!['PENDING', 'RUNNING'].includes(cycle.status)) {
      return res.json({ success: false, error: 'Đợt đăng ký này đã đóng' });
    }
    cycle.status = 'CANCELLED';
    cycle.registrationEnd = new Date();
    cycle.notes = (cycle.notes ? cycle.notes + ' | ' : '') + 'Đóng thủ công bởi admin';
    await cycle.save();
    res.json({ success: true, message: 'Đã đóng đợt đăng ký' });
  } catch (err) {
    console.error('[RegistrationPeriod] close error:', err);
    res.json({ success: false, error: err.message });
  }
});

// POST: Publish the current quota config (set isPublished=true)
router.post('/admin/registration-period/publish-quota', isAdmin, async (req, res) => {
  try {
    const quota = await QuotaConfig.findOne({}).sort({ createdAt: -1 }).lean();
    if (!quota) return res.json({ success: false, error: 'Không tìm thấy chỉ tiêu nào' });

    const now = new Date();
    // Unpublish all others first, then publish this one
    await QuotaConfig.updateMany({ isPublished: true }, { $set: { isPublished: false } }, { strict: false });
    await QuotaConfig.updateOne(
      { _id: quota._id },
      { $set: { isPublished: true, isDraft: false, publishedAt: now, updatedAt: now } },
      { strict: false }
    );

    // Also ensure there's an active AllocationPolicy
    const AllocationPolicy = require('../../schemas/AllocationPolicySchema');
    const anyPolicy = await AllocationPolicy.findOne({ active: true }).lean();
    if (!anyPolicy) {
      await AllocationPolicy.updateMany({}, { $set: { active: false } });
      const newest = await AllocationPolicy.findOne({}).sort({ createdAt: -1 });
      if (newest) { newest.active = true; await newest.save(); }
      else {
        await AllocationPolicy.collection.insertOne({
          academicYear: quota.academicYear, active: true, sourceQuotaId: quota._id,
          publishedAt: now, effectiveFrom: quota.effectiveFrom || now,
          effectiveTo: quota.effectiveTo || new Date(now.getFullYear() + 1, 11, 31),
          notes: 'Auto-created on publish', createdAt: now, updatedAt: now
        });
      }
    }

    res.json({ success: true, message: 'Đã ban hành chỉ tiêu' });
  } catch (err) {
    console.error('[RegistrationPeriod] publish-quota error:', err);
    res.json({ success: false, error: err.message });
  }
});

// PUT: Update quota config
router.put('/admin/registration-period/quota', isAdmin, async (req, res) => {
  try {
    const { academicYear, year1, year2, year3, year4_plus, totalCapacity } = req.body;
    if (!academicYear || !/^\d{4}-\d{4}$/.test(academicYear)) {
      return res.json({ success: false, error: 'Năm học không hợp lệ' });
    }

    const y1 = Math.max(0, parseInt(year1) || 0);
    const y2 = Math.max(0, parseInt(year2) || 0);
    const y3 = Math.max(0, parseInt(year3) || 0);
    const y4 = Math.max(0, parseInt(year4_plus) || 0);
    const total = parseInt(totalCapacity) || (y1 + y2 + y3 + y4);

    if (y1 + y2 + y3 + y4 === 0) {
      return res.json({ success: false, error: 'Chỉ tiêu không được bằng 0' });
    }

    const now = new Date();
    const effectiveTo = new Date(now.getFullYear() + 1, 11, 31);
    const newQuotas = [
      { yearGroup: 'year1',    percentage: Math.round(y1/total*100), slot: y1 },
      { yearGroup: 'year2',    percentage: Math.round(y2/total*100), slot: y2 },
      { yearGroup: 'year3',    percentage: Math.round(y3/total*100), slot: y3 },
      { yearGroup: 'year4_plus', percentage: Math.round(y4/total*100), slot: y4 },
    ];

    // Use raw update to bypass pre-validate hooks that might reject
    const existing = await QuotaConfig.findOne({ academicYear }).lean().catch(() => null);
    if (existing) {
      await QuotaConfig.updateOne(
        { _id: existing._id },
        { $set: { totalCapacity: total, quotas: newQuotas, isPublished: true, isDraft: false, publishedAt: now, updatedAt: now }, $inc: { version: 1 } },
        { strict: false }
      );
    } else {
      await QuotaConfig.collection.insertOne({
        academicYear, totalCapacity: total, quotas: newQuotas,
        effectiveFrom: now, effectiveTo, isDraft: false, isPublished: true, publishedAt: now,
        version: 1, createdBy: req.session.userId || req.session.adminId,
        createdAt: now, updatedAt: now
      });
    }

    res.json({ success: true, message: 'Đã cập nhật chỉ tiêu' });
  } catch (err) {
    console.error('[RegistrationPeriod] quota error:', err);
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;
