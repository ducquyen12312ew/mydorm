const express = require('express');
const router = express.Router();
const { DormitoryCollection, StudentCollection, PendingApplicationCollection } = require('../../config/config');
const { sendNotificationOnEvent, createActivityLog } = require('../../utils/notificationHelper');
const { logger } = require('../../config/logger');
const { EVENT_TYPES } = require('../../events/domain-events');
const { publishDomainEvent } = require('../../events/durable-event-publisher');
const { isAdmin, isAuthenticated } = require('../../middleware/auth');

// ============================================
// ADMIN PAGE RENDERS
// ============================================

router.get('/admin/dashboard', isAdmin, (req, res) => {
    res.render('admin/dashboard', {
        user: { name: req.session.name, role: req.session.role }
    });
});

router.get('/admin/logs', isAdmin, (req, res) => {
    res.render('admin/logs', {
        user: { name: req.session.name, role: req.session.role }
    });
});

router.get('/admin/dormitories', isAdmin, async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find({
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
        });
        res.render('admin/dormitory/admin-dormitories', {
            dormitories,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        logger.error('Error fetching dormitories', { error: error.message });
        res.render('admin/dormitory/admin-dormitories', {
            dormitories: [],
            error: 'Không thể lấy dữ liệu ký túc xá',
            user: { name: req.session.name, role: req.session.role }
        });
    }
});

router.get('/admin/application', isAdmin, (req, res) => {
    res.type('html');
    res.render('admin/application/admin-application', {
        user: { name: req.session.name, role: req.session.role }
    });
});

router.get('/admin/dormitories/trash', isAdmin, async (req, res) => {
    try {
        const deletedDormitories = await DormitoryCollection.find({ isDeleted: true });
        res.render('admin/dormitory/admin-trash', {
            deletedDormitories,
            message: req.query.message || null,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        logger.error('Error fetching trash', { error: error.message });
        res.render('admin/dormitory/admin-trash', {
            deletedDormitories: [],
            error: 'Không thể lấy dữ liệu',
            user: { name: req.session.name, role: req.session.role }
        });
    }
});

router.get('/admin/dormitories/add', isAdmin, (req, res) => {
    res.render('admin/dormitory/admin-dormitory-form', {
        action: 'add', dormitory: null,
        user: { name: req.session.name, role: req.session.role }
    });
});

router.get('/admin/dormitories/edit/:id', isAdmin, async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id);
        if (!dormitory) return res.redirect('/admin/dormitories');
        res.render('admin/dormitory/admin-dormitory-form', {
            action: 'edit', dormitory,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        logger.error('Error fetching dormitory for edit', { error: error.message });
        res.redirect('/admin/dormitories');
    }
});

router.get('/admin/dormitories/view/:id', isAdmin, async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id);
        if (!dormitory) return res.redirect('/admin/dormitories');
        res.render('admin/dormitory/admin-dormitory-view', {
            dormitory,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        logger.error('Error fetching dormitory details', { error: error.message });
        res.redirect('/admin/dormitories');
    }
});

router.get('/admin/dormitories/:dormId/rooms/:floorNumber/:roomNumber', isAdmin, (req, res) => {
    res.render('admin/dormitory/room-detail', {
        user: { name: req.session.name, role: req.session.role }
    });
});

router.get('/admin/students', isAdmin, async (req, res) => {
    try {
        const students = await StudentCollection.find({ role: 'user' })
            .sort({ name: 1 })
            .limit(200)
            .lean();
        res.render('admin/student/admin-student-list', {
            students,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        logger.error('Error fetching students', { error: error.message });
        res.redirect('/admin/dormitories');
    }
});

router.get('/admin/students/:id', isAdmin, async (req, res) => {
    try {
        const student = await StudentCollection.findById(req.params.id).lean();
        if (!student) return res.status(404).render('404', { user: { name: req.session.name, role: req.session.role } });

        let dormitory = null;
        let roomInfo = null;
        if (student.dormitoryId) {
            dormitory = await DormitoryCollection.findById(student.dormitoryId, { name: 1, address: 1, floors: 1 }).lean();
            if (dormitory && student.roomNumber) {
                for (const floor of (dormitory.floors || [])) {
                    const room = (floor.rooms || []).find(r => r.roomNumber === student.roomNumber);
                    if (room) { roomInfo = { ...room, floorNumber: floor.floorNumber }; break; }
                }
            }
        }

        res.render('admin/student/admin-student-profile', {
            student,
            dormitory,
            roomInfo,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        logger.error('Error fetching student profile', { error: error.message });
        res.redirect('/admin/dormitories');
    }
});

router.get('/admin/cleanup', isAdmin, (req, res) => {
    res.render('admin/cleanup', {
        user: { name: req.session.name, role: req.session.role }
    });
});

router.get('/admin/violations', isAdmin, (req, res) => {
    res.render('admin/violations/admin-violations', {
        user: { name: req.session.name, role: req.session.role }
    });
});

router.get('/admin/priority-claims-review', isAuthenticated, (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).send('Chỉ admin có thể truy cập');
    res.render('admin/priority-claims-review', {
        user: { name: req.session.name, role: req.session.role, id: req.session.userId }
    });
});

// ============================================
// STUDENT PAGE RENDERS
// ============================================

router.get('/student/registration-portal', isAuthenticated, (req, res) => {
    res.render('student/student-registration-portal', {
        user: { name: req.session.name, role: req.session.role, id: req.session.userId }
    });
});

router.get('/student/priority-claims', isAuthenticated, (req, res) => {
    res.render('student/priority-claims', {
        user: { name: req.session.name, role: req.session.role, id: req.session.userId }
    });
});

// ============================================
// APPLICATION STATS API
// ============================================

router.get('/admin/applications/stats', isAdmin, async (req, res) => {
    try {
        const stats = await PendingApplicationCollection.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const result = { pending: 0, approved: 0, rejected: 0, total: 0 };
        stats.forEach(stat => {
            result[stat._id] = stat.count;
            result.total += stat.count;
        });

        res.json({ success: true, stats: result });
    } catch (error) {
        logger.error('Error fetching application stats', { error: error.message });
        res.status(500).json({ success: false, message: 'Lỗi khi lấy thống kê đơn đăng ký' });
    }
});

// ============================================
// APPLICATION APPROVAL (legacy form POST)
// ============================================

async function checkStudentExistsInSystem(studentId, fullName) {
    try {
        const dormitories = await DormitoryCollection.find(
            {},
            { name: 1, 'floors.floorNumber': 1, 'floors.rooms.roomNumber': 1, 'floors.rooms.occupants': 1 }
        ).lean();

        for (const dorm of dormitories) {
            for (const floor of dorm.floors) {
                for (const room of floor.rooms) {
                    const occupant = room.occupants.find(o =>
                        o.active && (o.studentId === studentId || o.name === fullName)
                    );
                    if (occupant) {
                        return {
                            exists: true,
                            type: occupant.studentId === studentId ? 'studentId' : 'name',
                            location: {
                                dormitoryName: dorm.name,
                                floorNumber: floor.floorNumber,
                                roomNumber: room.roomNumber
                            }
                        };
                    }
                }
            }
        }
        return { exists: false };
    } catch (error) {
        logger.error('Error checking student exists', { error: error.message });
        return { exists: false };
    }
}

router.post('/admin/approve-application', isAdmin, async (req, res) => {
    try {
        const { applicationId, action, rejectionReason } = req.body;
        const adminId = req.session.userId;

        logger.info(`Admin ${adminId} processing application ${applicationId} with action: ${action}`);

        const application = await PendingApplicationCollection.findById(applicationId);
        if (!application) {
            logger.warn(`Application ${applicationId} not found`);
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đăng ký' });
        }

        logger.info('Found application', {
            id: application._id,
            studentId: application.studentId,
            status: application.status,
            roomNumber: application.roomNumber,
            fullName: application.fullName
        });

        if (application.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Đơn đăng ký đã được xử lý (${application.status})`
            });
        }

        if (action === 'approve') {
            logger.info('Checking if student already exists in system');

            const existingStudent = await checkStudentExistsInSystem(application.studentId, application.fullName);
            if (existingStudent.exists) {
                const location = existingStudent.location;
                const fieldType = existingStudent.type === 'studentId' ? 'Mã sinh viên' : 'Tên sinh viên';
                const fieldValue = existingStudent.type === 'studentId' ? application.studentId : application.fullName;
                logger.warn('Student already exists', location);
                return res.status(400).json({
                    success: false,
                    message: `${fieldType} "${fieldValue}" đã được đăng ký tại ${location.dormitoryName} - Tầng ${location.floorNumber} - Phòng ${location.roomNumber}. Không thể duyệt đơn đăng ký này!`
                });
            }

            const dormitory = await DormitoryCollection.findById(application.dormitoryId);
            if (!dormitory) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy ký túc xá' });
            }

            let targetRoom = null;
            for (const floor of dormitory.floors) {
                const room = floor.rooms.find(r => r.roomNumber === application.roomNumber);
                if (room) { targetRoom = room; break; }
            }

            if (!targetRoom) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy phòng ${application.roomNumber} trong ký túc xá`
                });
            }

            const activeOccupants = targetRoom.occupants.filter(o => o.active);
            if (activeOccupants.length >= targetRoom.maxCapacity) {
                return res.status(400).json({
                    success: false,
                    message: `Phòng ${application.roomNumber} đã đầy (${activeOccupants.length}/${targetRoom.maxCapacity}). Không thể duyệt đơn đăng ký!`
                });
            }

            logger.info('All validation passed, approving application');

            const updatedApplication = await PendingApplicationCollection.findByIdAndUpdate(
                applicationId,
                { status: 'approved', approvedBy: adminId, approvedAt: new Date(), updatedAt: new Date() },
                { new: true }
            );
            logger.info('Application updated', { status: updatedApplication.status });

            const student = await StudentCollection.findOne({ studentId: application.studentId });
            if (!student) {
                logger.warn(`Student not found for studentId: ${application.studentId}`);
                return res.status(404).json({ success: false, message: 'Không tìm thấy sinh viên trong hệ thống' });
            }

            await StudentCollection.findByIdAndUpdate(student._id, {
                dormitoryId: application.dormitoryId,
                roomNumber: application.roomNumber,
                updatedAt: new Date()
            });

            targetRoom.occupants.push({
                studentId: application.studentId,
                name: application.fullName,
                phone: application.phone || '',
                email: application.email || '',
                checkInDate: new Date(),
                active: true
            });

            if (!dormitory.details.totalFloors) dormitory.details.totalFloors = dormitory.floors.length;
            await dormitory.save();

            logger.info(`Student room assigned: ${application.roomNumber}`);

            const notificationResult = await sendNotificationOnEvent('registration_approved', student._id, {
                roomNumber: application.roomNumber,
                dormitoryName: application.dormitoryName || dormitory.name,
                applicationId
            });

            await publishDomainEvent(EVENT_TYPES.STUDENT_ASSIGNED, {
                studentId: String(student._id),
                allocationType: 'ADMIN_APPROVAL',
                roomNumber: application.roomNumber,
                dormitoryId: String(application.dormitoryId || ''),
                applicationId: String(applicationId)
            });

            await publishDomainEvent(EVENT_TYPES.APPLICATION_UPDATED, {
                studentId: String(student._id),
                applicationId: String(applicationId),
                status: 'approved'
            });

            logger.info('Notification result', { result: notificationResult ? 'SUCCESS' : 'FAILED' });

            await createActivityLog(student._id, 'application_approved',
                `Đơn đăng ký phòng ${application.roomNumber} đã được duyệt`,
                { applicationId, approvedBy: adminId }
            );

            return res.json({
                success: true,
                message: 'Đã duyệt đơn đăng ký thành công!',
                data: {
                    applicationId,
                    studentName: student.name,
                    roomNumber: application.roomNumber,
                    dormitoryName: dormitory.name,
                    notificationSent: !!notificationResult
                }
            });

        } else if (action === 'reject') {
            await PendingApplicationCollection.findByIdAndUpdate(applicationId, {
                status: 'rejected',
                rejectedBy: adminId,
                rejectedAt: new Date(),
                rejectionReason: rejectionReason || 'Không đáp ứng yêu cầu',
                updatedAt: new Date()
            });

            const student = await StudentCollection.findOne({ studentId: application.studentId });
            if (student) {
                await sendNotificationOnEvent('registration_rejected', student._id, {
                    roomNumber: application.roomNumber,
                    reason: rejectionReason || 'Không đáp ứng yêu cầu',
                    applicationId
                });

                await publishDomainEvent(EVENT_TYPES.APPLICATION_UPDATED, {
                    studentId: String(student._id),
                    applicationId: String(applicationId),
                    status: 'rejected'
                });

                await createActivityLog(student._id, 'application_rejected',
                    `Đơn đăng ký phòng ${application.roomNumber} đã bị từ chối`,
                    { applicationId, rejectedBy: adminId, reason: rejectionReason }
                );
            }

            return res.json({ success: true, message: 'Đã từ chối đơn đăng ký!' });

        } else {
            return res.status(400).json({
                success: false,
                message: "Hành động không hợp lệ (phải là 'approve' hoặc 'reject')"
            });
        }
    } catch (error) {
        logger.error('Error processing application', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Lỗi hệ thống khi xử lý đơn đăng ký',
            error: error.message
        });
    }
});

router.put('/api/admin/applications/:id/update-status', isAdmin, async (req, res) => {
    try {
        const { status, comments } = req.body;
        const applicationId = req.params.id;
        const adminId = req.session.userId;

        if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Trạng thái không hợp lệ' });
        }

        const application = await PendingApplicationCollection.findById(applicationId);
        if (!application) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy đơn đăng ký' });
        }

        const student = await StudentCollection.findOne({ studentId: application.studentId });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy sinh viên' });
        }

        if (status === 'approved') {
            await PendingApplicationCollection.findByIdAndUpdate(applicationId, {
                status: 'approved', approvedBy: adminId, approvedAt: new Date(),
                comments: comments || '', updatedAt: new Date()
            });

            await StudentCollection.findByIdAndUpdate(student._id, {
                dormitoryId: application.dormitoryId,
                roomNumber: application.roomNumber,
                updatedAt: new Date()
            });

            await sendNotificationOnEvent('registration_approved', student._id, {
                roomNumber: application.roomNumber,
                dormitoryName: application.dormitoryName || 'KTX HUST',
                applicationId
            });

            await publishDomainEvent(EVENT_TYPES.STUDENT_ASSIGNED, {
                studentId: String(student._id),
                allocationType: 'ADMIN_STATUS_UPDATE',
                roomNumber: application.roomNumber,
                dormitoryId: String(application.dormitoryId || ''),
                applicationId: String(applicationId)
            });

            await publishDomainEvent(EVENT_TYPES.APPLICATION_UPDATED, {
                studentId: String(student._id),
                applicationId: String(applicationId),
                status: 'approved'
            });

            return res.json({ success: true, message: 'Đã duyệt đơn đăng ký thành công!' });

        } else if (status === 'rejected') {
            await PendingApplicationCollection.findByIdAndUpdate(applicationId, {
                status: 'rejected', rejectedBy: adminId, rejectedAt: new Date(),
                rejectionReason: comments || 'Không đáp ứng yêu cầu',
                comments: comments || '', updatedAt: new Date()
            });

            await sendNotificationOnEvent('registration_rejected', student._id, {
                roomNumber: application.roomNumber,
                reason: comments || 'Không đáp ứng yêu cầu',
                applicationId
            });

            await publishDomainEvent(EVENT_TYPES.APPLICATION_UPDATED, {
                studentId: String(student._id),
                applicationId: String(applicationId),
                status: 'rejected'
            });

            return res.json({ success: true, message: 'Đã từ chối đơn đăng ký!' });

        } else {
            await PendingApplicationCollection.findByIdAndUpdate(applicationId, {
                status: 'pending', comments: comments || '', updatedAt: new Date()
            });
            return res.json({ success: true, message: 'Đã cập nhật trạng thái thành công!' });
        }
    } catch (error) {
        logger.error('Error updating application status', { error: error.message });
        res.status(500).json({ success: false, error: 'Lỗi hệ thống khi cập nhật trạng thái' });
    }
});

module.exports = router;
