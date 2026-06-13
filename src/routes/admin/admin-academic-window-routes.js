const express = require('express');
const router = express.Router();
const AllocationCycleModel = require('../../schemas/AllocationCycleSchema');
const AllocationPolicyModel = require('../../schemas/AllocationPolicySchema');
const { getPublishedQuotaAndPolicy } = require('../../services/quotaPublishService');
const { PendingApplicationCollection } = require('../../config/config');
const { logger } = require('../../config/logger');

const isAdmin = (req, res, next) => {
    if (req.session && req.session.role === 'admin') return next();
    res.redirect('/login');
};

// ============================================
// ADMIN PAGE RENDERS
// ============================================

router.get('/admin/academic/policies', isAdmin, (req, res) => {
    res.render('admin/academic/admin-academic-policies', {
        user: { name: req.session.name, role: req.session.role }
    });
});

router.get('/admin/academic/priority-queue', isAdmin, (req, res) => {
    res.render('admin/academic/admin-priority-queue', {
        user: { name: req.session.name, role: req.session.role }
    });
});

router.get('/admin/academic-windows', isAdmin, (req, res) => {
    logger.info('Rendering admin/registration-cycles');
    res.render('admin/registration-cycles', {
        user: { name: req.session.name, role: req.session.role }
    });
});

// ============================================
// PUBLISHED QUOTA / ACTIVE POLICY INFO
// ============================================

router.get('/api/admin/published-quota', isAdmin, async (req, res) => {
    try {
        const { quota, policy } = await getPublishedQuotaAndPolicy();
        res.json({ success: true, quota, policy });
    } catch (error) {
        logger.error('Error fetching published quota', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// ALLOCATION POLICIES — READ-ONLY VIEW
// ============================================

router.get('/api/admin/allocation-policies', isAdmin, async (req, res) => {
    try {
        const { quota, policy } = await getPublishedQuotaAndPolicy();
        const policies = policy ? [policy] : [];
        res.json({ success: true, policies, currentPolicy: policy, sourceQuota: quota });
    } catch (error) {
        logger.error('Error fetching allocation policies', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to fetch policies' });
    }
});

// Blocked — policies are now auto-generated from published quotas
router.post('/api/admin/allocation-policies', isAdmin, (req, res) => {
    res.status(403).json({
        success: false,
        error: 'Chính sách phân bổ được tạo tự động khi ban hành Quota. Không thể tạo thủ công.'
    });
});

router.put('/api/admin/allocation-policies/:id', isAdmin, (req, res) => {
    res.status(403).json({
        success: false,
        error: 'Chính sách phân bổ không thể chỉnh sửa trực tiếp. Hãy ban hành Quota mới tại /admin/quotas.'
    });
});

router.delete('/api/admin/allocation-policies/:id', isAdmin, (req, res) => {
    res.status(403).json({
        success: false,
        error: 'Chính sách phân bổ không thể xóa trực tiếp. Hãy ban hành Quota mới để thay thế.'
    });
});

// ============================================
// ACADEMIC WINDOWS (AllocationCycle) CRUD
// ============================================

router.get('/api/admin/academic-windows', isAdmin, async (req, res) => {
    try {
        const windows = await AllocationCycleModel.find({})
            .sort({ academicYear: -1 })
            .lean();

        const { policy } = await getPublishedQuotaAndPolicy();

        const windowsWithStats = await Promise.all(windows.map(async (window) => {
            const priorityStats = { dantoc: 0, hongho: 0, khuyettat: 0, mocoi: 0, total: 0 };

            const applicationStats = await PendingApplicationCollection.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: window.registrationStart || new Date(0),
                            $lte: window.registrationEnd || new Date()
                        }
                    }
                },
                { $unwind: '$priorityPolicies' },
                { $group: { _id: '$priorityPolicies.type', count: { $sum: 1 } } }
            ]);

            applicationStats.forEach(stat => {
                if (stat._id === 'ethnic') priorityStats.dantoc = stat.count;
                else if (stat._id === 'poor') priorityStats.hongho = stat.count;
                else if (stat._id === 'disability') priorityStats.khuyettat = stat.count;
                else if (stat._id === 'orphan') priorityStats.mocoi = stat.count;
                priorityStats.total += stat.count;
            });

            return { ...window, priorityStats, currentPolicy: policy || null };
        }));

        res.json(windowsWithStats);
    } catch (error) {
        logger.error('Error fetching academic windows', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch academic windows' });
    }
});

router.post('/api/admin/academic-windows', isAdmin, async (req, res) => {
    try {
        const { academicYear, startDate, endDate, status, description, allowedAcademicYears } = req.body;

        // Auto-pick the active AllocationPolicy from published quota
        const activePolicy = await AllocationPolicyModel.findOne({ active: true }).lean();
        const policyId = activePolicy ? activePolicy._id : null;

        if (!policyId) {
            logger.warn('Creating academic window without an active AllocationPolicy — quota may not be published yet');
        }

        const newCycle = await AllocationCycleModel.create({
            academicYear,
            policyId,
            name: 'Main Registration',
            registrationStart: new Date(startDate),
            registrationEnd: new Date(endDate),
            status: status || 'PENDING',
            description,
            allowedAcademicYears: allowedAcademicYears || ['1', '2', '3', '4', '5', '6'],
            createdBy: req.session.userId
        });

        res.json({ success: true, cycle: newCycle, policyAutoAssigned: !!policyId });
    } catch (error) {
        logger.error('Error creating academic window', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/api/admin/academic-windows/:id', isAdmin, async (req, res) => {
    try {
        const { academicYear, startDate, endDate, status, description, allowedAcademicYears } = req.body;

        // Re-resolve the active policy (may have changed since creation)
        const activePolicy = await AllocationPolicyModel.findOne({ active: true }).lean();
        const policyId = activePolicy ? activePolicy._id : null;

        const updatedCycle = await AllocationCycleModel.findByIdAndUpdate(
            req.params.id,
            {
                academicYear,
                policyId,
                registrationStart: new Date(startDate),
                registrationEnd: new Date(endDate),
                status,
                description,
                allowedAcademicYears: allowedAcademicYears || ['1', '2', '3', '4', '5', '6'],
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!updatedCycle) {
            return res.status(404).json({ success: false, error: 'Window not found' });
        }

        res.json({ success: true, cycle: updatedCycle });
    } catch (error) {
        logger.error('Error updating academic window', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to update window' });
    }
});

router.post('/api/admin/academic-windows/:id/activate', isAdmin, async (req, res) => {
    try {
        // Re-resolve active policy so the cycle always points to latest
        const activePolicy = await AllocationPolicyModel.findOne({ active: true }).lean();

        const updatedCycle = await AllocationCycleModel.findByIdAndUpdate(
            req.params.id,
            {
                status: 'RUNNING',
                policyId: activePolicy ? activePolicy._id : null,
                updatedAt: new Date()
            },
            { new: true, runValidators: false }
        );

        if (!updatedCycle) {
            return res.status(404).json({ success: false, error: 'Window not found' });
        }

        logger.info('Academic window activated', {
            cycleId: updatedCycle._id,
            academicYear: updatedCycle.academicYear,
            policyId: updatedCycle.policyId
        });

        res.json({ success: true, cycle: updatedCycle });
    } catch (error) {
        logger.error('Error activating window', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to activate window' });
    }
});

router.post('/api/admin/academic-windows/:id/deactivate', isAdmin, async (req, res) => {
    try {
        const updatedCycle = await AllocationCycleModel.findByIdAndUpdate(
            req.params.id,
            { status: 'COMPLETED', updatedAt: new Date() },
            { new: true, runValidators: false }
        );

        if (!updatedCycle) {
            return res.status(404).json({ success: false, error: 'Window not found' });
        }

        res.json({ success: true, cycle: updatedCycle });
    } catch (error) {
        logger.error('Error deactivating window', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to deactivate window' });
    }
});

router.delete('/api/admin/academic-windows/:id', isAdmin, async (req, res) => {
    try {
        const deletedCycle = await AllocationCycleModel.findByIdAndDelete(req.params.id);

        if (!deletedCycle) {
            return res.status(404).json({ success: false, error: 'Window not found' });
        }

        res.json({ success: true, message: 'Window deleted successfully' });
    } catch (error) {
        logger.error('Error deleting window', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to delete window' });
    }
});

module.exports = router;
