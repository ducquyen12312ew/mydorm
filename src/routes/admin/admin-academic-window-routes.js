const express = require('express');
const router = express.Router();
const AllocationCycleModel = require('../../schemas/AllocationCycleSchema');
const AllocationPolicyModel = require('../../schemas/AllocationPolicySchema');
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
// ACADEMIC WINDOWS (AllocationCycle) CRUD
// ============================================

router.get('/api/admin/academic-windows', isAdmin, async (req, res) => {
    try {
        const windows = await AllocationCycleModel.find({})
            .sort({ academicYear: -1 })
            .lean();

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

            return { ...window, priorityStats };
        }));

        res.json(windowsWithStats);
    } catch (error) {
        logger.error('Error fetching academic windows', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch academic windows' });
    }
});

router.post('/api/admin/academic-windows', isAdmin, async (req, res) => {
    try {
        const { academicYear, policyId, startDate, endDate, status, description, allowedAcademicYears } = req.body;

        const newCycle = await AllocationCycleModel.create({
            academicYear,
            policyId,
            name: 'Main Registration',
            registrationStart: new Date(startDate),
            registrationEnd: new Date(endDate),
            status: status || 'PENDING',
            description,
            allowedAcademicYears
        });

        res.json({ success: true, cycle: newCycle });
    } catch (error) {
        logger.error('Error creating academic window', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to create window' });
    }
});

router.put('/api/admin/academic-windows/:id', isAdmin, async (req, res) => {
    try {
        const { academicYear, policyId, startDate, endDate, status, description, allowedAcademicYears } = req.body;

        const updatedCycle = await AllocationCycleModel.findByIdAndUpdate(
            req.params.id,
            {
                academicYear,
                policyId,
                registrationStart: new Date(startDate),
                registrationEnd: new Date(endDate),
                status,
                description,
                allowedAcademicYears,
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
        const updatedCycle = await AllocationCycleModel.findByIdAndUpdate(
            req.params.id,
            { status: 'active', updatedAt: new Date() },
            { new: true }
        );

        if (!updatedCycle) {
            return res.status(404).json({ success: false, error: 'Window not found' });
        }

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
            { status: 'closed', updatedAt: new Date() },
            { new: true }
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

// ============================================
// ALLOCATION POLICIES CRUD
// ============================================

router.get('/api/admin/allocation-policies', isAdmin, async (req, res) => {
    try {
        const policies = await AllocationPolicyModel.find({})
            .sort({ academicYear: -1, createdAt: -1 })
            .lean();

        res.json({ success: true, policies });
    } catch (error) {
        logger.error('Error fetching allocation policies', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to fetch policies' });
    }
});

router.post('/api/admin/allocation-policies', isAdmin, async (req, res) => {
    try {
        const { academicYear, name, priorityRules, rebalanceThresholds, status } = req.body;

        const existing = await AllocationPolicyModel.findOne({ academicYear, name });
        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'Chính sách với năm học và tên này đã tồn tại'
            });
        }

        const newPolicy = await AllocationPolicyModel.create({
            academicYear,
            name,
            priorityRules,
            rebalanceThresholds,
            status: status || 'ACTIVE',
            createdBy: req.session.userId
        });

        res.json({ success: true, policy: newPolicy });
    } catch (error) {
        logger.error('Error creating allocation policy', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to create policy' });
    }
});

router.put('/api/admin/allocation-policies/:id', isAdmin, async (req, res) => {
    try {
        const { academicYear, name, priorityRules, rebalanceThresholds, status } = req.body;

        const updatedPolicy = await AllocationPolicyModel.findByIdAndUpdate(
            req.params.id,
            { academicYear, name, priorityRules, rebalanceThresholds, status, updatedAt: new Date() },
            { new: true }
        );

        if (!updatedPolicy) {
            return res.status(404).json({ success: false, error: 'Policy not found' });
        }

        res.json({ success: true, policy: updatedPolicy });
    } catch (error) {
        logger.error('Error updating allocation policy', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to update policy' });
    }
});

router.delete('/api/admin/allocation-policies/:id', isAdmin, async (req, res) => {
    try {
        const cyclesUsingPolicy = await AllocationCycleModel.countDocuments({ policyId: req.params.id });
        if (cyclesUsingPolicy > 0) {
            return res.status(400).json({
                success: false,
                error: 'Không thể xóa chính sách đang được sử dụng bởi chu kỳ phân bổ'
            });
        }

        const deletedPolicy = await AllocationPolicyModel.findByIdAndDelete(req.params.id);

        if (!deletedPolicy) {
            return res.status(404).json({ success: false, error: 'Policy not found' });
        }

        res.json({ success: true, message: 'Policy deleted successfully' });
    } catch (error) {
        logger.error('Error deleting allocation policy', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to delete policy' });
    }
});

module.exports = router;
