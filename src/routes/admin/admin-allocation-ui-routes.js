const express = require('express');
const router = express.Router();
const AllocationPolicy = require('../../schemas/AllocationPolicySchema');
const AllocationCycle = require('../../schemas/AllocationCycleSchema');
const AllocationService = require('../../services/allocationService');
const RebalancingService = require('../../services/rebalancingService');

// Middleware: Require admin role
function requireAdmin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login');
    }
    if (req.session.role !== 'admin') {
        return res.status(403).send('Access denied: Admin only');
    }
    next();
}

// ===============================
// POLICIES — REMOVED
// ===============================
router.get('/policies', requireAdmin, (req, res) => res.redirect('/admin/registration-period'));
router.post('/policies', requireAdmin, (req, res) => res.status(404).json({ error: 'Removed' }));
router.post('/policies/:academicYear/activate', requireAdmin, (req, res) => res.status(404).json({ error: 'Removed' }));

// ===============================
// CYCLES MANAGEMENT
// ===============================

// GET: Get cycles for a year (API)
router.get('/cycles/:academicYear', requireAdmin, async (req, res) => {
    try {
        const { academicYear } = req.params;
        const cycles = await AllocationCycle.find({ academicYear })
            .sort({ createdAt: -1 });

        res.json({ success: true, cycles });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST: Create new cycle
router.post('/cycles', requireAdmin, async (req, res) => {
    try {
        const {
            academicYear,
            cycleName,
            registrationStart,
            registrationEnd,
            allocationDate
        } = req.body;

        // Get active policy
        const policy = await AllocationPolicy.getActivePolicy(academicYear);
        if (!policy) {
            return res.redirect('/admin/allocation/policies?message=' + 
                encodeURIComponent('Chưa có chính sách hoạt động cho năm học này') + 
                '&type=error');
        }

        // Capture capacity snapshot at creation time
        const capacity = await AllocationService.getCapacitySnapshot();

        // Create cycle
        const cycle = new AllocationCycle({
            academicYear,
            name: cycleName,
            registrationStart: new Date(registrationStart),
            registrationEnd: new Date(registrationEnd),
            allocationDate: allocationDate ? new Date(allocationDate) : new Date(registrationEnd),
            status: 'PENDING',
            policyId: policy._id,
            capacitySnapshot: {
                totalRooms: capacity.totalRooms,
                totalBeds: capacity.totalBeds,
                availableBeds: capacity.availableBeds,
                capturedAt: new Date()
            },
            createdBy: req.session.username
        });

        await cycle.save();

        res.redirect('/admin/allocation/policies?message=' + 
            encodeURIComponent('Tạo chu kỳ thành công!') + 
            '&type=success');
    } catch (error) {
        console.error('Error creating cycle:', error);
        res.redirect('/admin/allocation/policies?message=' + 
            encodeURIComponent('Lỗi: ' + error.message) + 
            '&type=error');
    }
});

// POST: Execute allocation for a cycle
router.post('/cycles/:cycleId/execute', requireAdmin, async (req, res) => {
    try {
        const { cycleId } = req.params;
        
        const result = await AllocationService.executeAllocation(
            cycleId,
            req.session.username
        );

        res.json({
            success: true,
            message: 'Phân bổ thành công',
            results: result
        });
    } catch (error) {
        console.error('Error executing allocation:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET: View cycle results
router.get('/cycles/:cycleId/results', requireAdmin, async (req, res) => {
    try {
        const { cycleId } = req.params;
        
        const cycle = await AllocationCycle.findById(cycleId)
            .populate('policyId');
        
        if (!cycle) {
            return res.status(404).send('Cycle not found');
        }

        const status = await AllocationService.getCycleAllocationStatus(cycleId);

        res.render('admin/allocation/cycle-results', {
            cycle,
            status
        });
    } catch (error) {
        console.error('Error loading cycle results:', error);
        res.status(500).send('Server error');
    }
});

// ===============================
// DASHBOARD
// ===============================

// GET: Redirect /dashboard → current academic year
router.get('/dashboard', requireAdmin, (req, res) => {
    const y = new Date().getFullYear();
    res.redirect(`/admin/allocation/dashboard/${y}-${y + 1}`);
});

// GET: Dashboard for a year
router.get('/dashboard/:academicYear', requireAdmin, async (req, res) => {
    try {
        const { academicYear } = req.params;
        const yearGroup = req.query.yearGroup;

        const dashboard = await AllocationService.getDashboardData(
            academicYear,
            yearGroup
        );

        // Get rebalancing status if there are active cycles
        const cycles = await AllocationCycle.find({
            academicYear,
            status: { $in: ['RUNNING', 'COMPLETED'] }
        });

        const selectedCycle = await AllocationCycle.findOne({
            academicYear,
            status: { $in: ['PENDING', 'RUNNING'] }
        }).sort({ createdAt: -1 });

        let rebalancingNeeded = false;
        if (cycles.length > 0) {
            rebalancingNeeded = await RebalancingService.isRebalancingNeeded(
                cycles[0]._id
            );
        }

        res.render('admin/allocation/dashboard', {
            academicYear,
            dashboard,
            rebalancingNeeded,
            selectedYearGroup: yearGroup,
            selectedCycle: selectedCycle ? {
                _id: selectedCycle._id,
                name: selectedCycle.name,
                status: selectedCycle.status
            } : null
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).send('Server error');
    }
});

// ===============================
// REBALANCING
// ===============================

// GET: Rebalancing suggestions
router.get('/rebalance/suggestions/:cycleId', requireAdmin, async (req, res) => {
    try {
        const { cycleId } = req.params;
        
        const suggestions = await RebalancingService.generateSuggestions(cycleId);

        res.json({
            success: true,
            suggestions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST: Execute rebalancing
router.post('/rebalance/execute', requireAdmin, async (req, res) => {
    try {
        const { cycleId, mode } = req.body;
        
        if (!['SUGGESTION', 'ENFORCED'].includes(mode)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid mode'
            });
        }

        const result = await RebalancingService.executeRebalancing(
            cycleId,
            req.session.username,
            { mode }
        );

        res.json({
            success: true,
            message: 'Tái cân bằng thành công',
            result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
