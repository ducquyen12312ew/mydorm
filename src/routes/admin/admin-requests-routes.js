'use strict';

const express = require('express');
const router = express.Router();
const { isAdmin } = require('../../middleware/auth');
const MaintenanceRequest = require('../../schemas/MaintenanceRequestSchema');
const RoomTransfer = require('../../schemas/RoomTransferSchema');

const PER_PAGE = 25;

router.get('/admin/requests', isAdmin, async (req, res) => {
    try {
        const { type = 'all', status, page = 1 } = req.query;
        const pg = Math.max(1, parseInt(page));

        const mFilter = {};
        const rtFilter = {};
        if (status && status !== 'all') {
            mFilter.status = status;
            rtFilter.status = status;
        }

        let items = [];
        let mStats = { pending: 0, in_progress: 0, completed: 0 };
        let rtStats = { pending: 0, approved: 0, completed: 0, rejected: 0 };

        // Always fetch stats for both types
        const [mAll, rtAll] = await Promise.all([
            MaintenanceRequest.find({}).select('status').lean(),
            RoomTransfer.find({}).select('status').lean()
        ]);
        mAll.forEach(r => { if (mStats[r.status] !== undefined) mStats[r.status]++; });
        rtAll.forEach(r => { if (rtStats[r.status] !== undefined) rtStats[r.status]++; });

        const mPending  = mAll.filter(r => r.status === 'submitted' || r.status === 'assigned' || r.status === 'in_progress').length;
        const rtPending = rtAll.filter(r => r.status === 'pending').length;

        // Fetch items based on type filter
        let total = 0;

        if (type === 'maintenance') {
            total = await MaintenanceRequest.countDocuments(mFilter);
            const raw = await MaintenanceRequest.find(mFilter)
                .sort({ reportedAt: -1 })
                .skip((pg - 1) * PER_PAGE)
                .limit(PER_PAGE)
                .lean();
            items = raw.map(r => ({
                _id: r._id,
                requestType: 'maintenance',
                subject: r.title || r.type,
                studentName: r.reportedBy?.name || '—',
                studentMSSV: r.reportedBy?.studentId || '—',
                status: r.status,
                statusLabel: _maintStatusLabel(r.status),
                meta: r.requestNumber,
                createdAt: r.reportedAt || r.createdAt,
                detailUrl: `/admin/maintenance-requests`,
                priority: r.priority
            }));
        } else if (type === 'room_transfer') {
            total = await RoomTransfer.countDocuments(rtFilter);
            const raw = await RoomTransfer.find(rtFilter)
                .sort({ createdAt: -1 })
                .skip((pg - 1) * PER_PAGE)
                .limit(PER_PAGE)
                .lean();
            items = raw.map(r => ({
                _id: r._id,
                requestType: 'room_transfer',
                subject: r.reason ? r.reason.slice(0, 80) : '—',
                studentName: r.studentName || '—',
                studentMSSV: r.studentMSSV || '—',
                status: r.status,
                statusLabel: _transferStatusLabel(r.status),
                meta: `${r.fromRoomNumber || '?'} → ${r.preferredBuilding || 'bất kỳ'}`,
                createdAt: r.createdAt,
                detailUrl: `/admin/room-transfer/${r._id}`
            }));
        } else {
            // All: fetch both, merge, sort, paginate in-memory (capped at reasonable size)
            const [mRaw, rtRaw] = await Promise.all([
                MaintenanceRequest.find(mFilter).sort({ reportedAt: -1 }).limit(200).lean(),
                RoomTransfer.find(rtFilter).sort({ createdAt: -1 }).limit(200).lean()
            ]);

            const merged = [
                ...mRaw.map(r => ({
                    _id: r._id,
                    requestType: 'maintenance',
                    subject: r.title || r.type,
                    studentName: r.reportedBy?.name || '—',
                    studentMSSV: r.reportedBy?.studentId || '—',
                    status: r.status,
                    statusLabel: _maintStatusLabel(r.status),
                    meta: r.requestNumber,
                    createdAt: r.reportedAt || r.createdAt,
                    detailUrl: `/admin/maintenance-requests`,
                    priority: r.priority
                })),
                ...rtRaw.map(r => ({
                    _id: r._id,
                    requestType: 'room_transfer',
                    subject: r.reason ? r.reason.slice(0, 80) : '—',
                    studentName: r.studentName || '—',
                    studentMSSV: r.studentMSSV || '—',
                    status: r.status,
                    statusLabel: _transferStatusLabel(r.status),
                    meta: `${r.fromRoomNumber || '?'} → ${r.preferredBuilding || 'bất kỳ'}`,
                    createdAt: r.createdAt,
                    detailUrl: `/admin/room-transfer/${r._id}`
                }))
            ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            total = merged.length;
            items = merged.slice((pg - 1) * PER_PAGE, pg * PER_PAGE);
        }

        res.render('admin/requests/index', {
            user: { name: req.session.adminName, role: req.session.adminRole },
            activeNav: 'requests',
            items,
            total,
            page: pg,
            perPage: PER_PAGE,
            totalPages: Math.ceil(total / PER_PAGE),
            typeFilter: type,
            statusFilter: status || 'all',
            mPending,
            rtPending,
            mTotal: mAll.length,
            rtTotal: rtAll.length
        });
    } catch (err) {
        console.error('[AdminRequests]', err);
        res.status(500).send('Server error');
    }
});

function _maintStatusLabel(s) {
    return { submitted: 'Chờ xử lý', assigned: 'Đã phân công', in_progress: 'Đang xử lý', completed: 'Hoàn thành', cancelled: 'Đã huỷ' }[s] || s;
}
function _transferStatusLabel(s) {
    return { pending: 'Chờ duyệt', approved: 'Đã duyệt', completed: 'Hoàn thành', rejected: 'Từ chối', cancelled: 'Đã huỷ' }[s] || s;
}

module.exports = router;
