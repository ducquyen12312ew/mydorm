const express = require('express');
const router = express.Router();
const { 
    DormitoryCollection, 
    PendingApplicationCollection, 
    StudentCollection, 
    ActivityLogCollection,
    AcademicWindowCollection 
} = require('./config');

// Middleware kiểm tra đăng nhập
const requireLogin = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.status(403).json({ error: 'Vui lòng đăng nhập' });
};

// API lấy danh sách KTX cho đăng ký
router.get('/dormitories/registration', async (req, res) => {
    try {
        // Kiểm tra cửa sổ đăng ký mở
        const now = new Date();
        const academicWindows = await AcademicWindowCollection.find({
            registerOpenAt: { $lte: now },
            registerCloseAt: { $gte: now }
        });

        // Nếu không có cửa sổ đăng ký nào đang mở
        if (academicWindows.length === 0) {
            return res.status(200).json({
                openForRegistration: false,
                dormitories: [],
                message: 'Hiện tại không có đợt đăng ký KTX nào đang mở'
            });
        }

        const currentAcademicYears = academicWindows.map(aw => aw.year);

        // Lấy danh sách KTX có sẵn
        const dormitories = await DormitoryCollection.find({
            'details.available': true
        }, {
            name: 1,
            address: 1,
            'details.type': 1,
            'details.category': 1,
            'details.priceRange': 1,
            'details.description': 1,
            'details.amenities': 1,
            imageUrl: 1
        });

        console.log(`Fetched ${dormitories.length} available dormitories for registration`);
        
        res.status(200).json({
            openForRegistration: true,
            academicYears: currentAcademicYears,
            dormitories: dormitories
        });
    } catch (error) {
        console.error('Error fetching dormitories for registration:', error);
        res.status(500).json({ error: 'Không thể lấy dữ liệu ký túc xá' });
    }
});

// API lấy trạng thái phòng của KTX
router.get('/dormitories/:id/room-status', async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id);
        if (!dormitory) {
            return res.status(404).json({ error: 'Không tìm thấy ký túc xá' });
        }

        const result = dormitory.floors.map(floor => {
            return {
                floorNumber: floor.floorNumber,
                rooms: floor.rooms.map(room => {
                    const activeOccupants = room.occupants.filter(o => o.active).length;
                    return {
                        roomNumber: room.roomNumber,
                        maxCapacity: room.maxCapacity,
                        currentOccupants: activeOccupants,
                        available: room.status === 'available' && (activeOccupants < room.maxCapacity),
                        type: room.type,
                        genderPolicy: room.genderPolicy,
                        pricePerMonth: room.pricePerMonth,
                        status: room.status
                    };
                }).sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))
            };
        }).sort((a, b) => a.floorNumber - b.floorNumber);
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching room status:', error);
        res.status(500).json({ error: 'Không thể lấy dữ liệu phòng' });
    }
});

// API đăng ký phòng KTX
router.post('/registration', requireLogin, async (req, res) => {
    try {
        // Lấy thông tin từ session
        const userId = req.session.userId;
        const student = await StudentCollection.findById(userId);
        
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy thông tin sinh viên' 
            });
        }
        
        // Lấy thông tin từ body request
        const {
            academicYear,
            preferredDormitories = [],
            preferredGenderPolicy = 'any',
            roomType = 'any'
        } = req.body;
        
        // Kiểm tra dữ liệu đầu vào
        if (!academicYear) {
            return res.status(400).json({ 
                success: false, 
                error: 'Thiếu thông tin năm học' 
            });
        }
        
        // Kiểm tra cửa sổ đăng ký
        const now = new Date();
        const academicWindow = await AcademicWindowCollection.findOne({
            year: academicYear,
            registerOpenAt: { $lte: now },
            registerCloseAt: { $gte: now }
        });
        
        if (!academicWindow) {
            return res.status(400).json({ 
                success: false, 
                error: `Đợt đăng ký cho năm học ${academicYear} chưa mở hoặc đã kết thúc` 
            });
        }
        
        // Kiểm tra đơn đăng ký hiện tại
        const existingApplication = await PendingApplicationCollection.findOne({
            studentId: student.studentId,
            academicYear,
            status: { $nin: ['rejected', 'expired', 'checked_out'] }
        });
        
        if (existingApplication) {
            return res.status(400).json({ 
                success: false, 
                error: 'Bạn đã có đơn đăng ký cho năm học này' 
            });
        }
        
        // Tạo đơn đăng ký mới
        const newApplication = await PendingApplicationCollection.create({
            studentObjectId: student._id,
            studentId: student.studentId,
            name: student.name,
            email: student.email,
            phone: student.phone,
            gender: student.gender,
            academicYear,
            preferredDormitories,
            preferredGenderPolicy,
            roomType,
            status: 'pending_review',
            payment: { paid: false },
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        // Cập nhật trạng thái sinh viên
        student.registrationStatus = 'pending_review';
        student.academicYear = academicYear;
        await student.save();
        
        // Tạo log hoạt động
        await ActivityLogCollection.create({
            actorId: student._id,
            actorRole: 'student',
            action: 'registration_submitted',
            meta: { applicationId: newApplication._id }
        });
        
        // Gửi thông báo cho admin (nếu có)
        if (typeof global.sendNotificationOnEvent === 'function') {
            await global.sendNotificationOnEvent('admin_new_registration', null, {
                studentName: student.name,
                studentId: student.studentId,
                applicationId: newApplication._id
            }, 'admin');
        }
        
        res.status(200).json({ 
            success: true, 
            message: 'Đăng ký thành công! Đơn của bạn đang chờ xét duyệt.',
            applicationId: newApplication._id,
            status: 'pending_review'
        });
    } catch (error) {
        console.error('Error submitting registration:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// API xác nhận thanh toán
router.post('/registration/payment/confirm', requireLogin, async (req, res) => {
    try {
        // Lấy thông tin từ session
        const userId = req.session.userId;
        const student = await StudentCollection.findById(userId);
        
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy thông tin sinh viên' 
            });
        }
        
        // Tìm đơn đăng ký đang chờ thanh toán
        const application = await PendingApplicationCollection.findOne({
            studentId: student.studentId,
            status: 'approved_waiting_payment'
        });
        
        if (!application) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy đơn đăng ký đang chờ thanh toán' 
            });
        }
        
        // Lấy thông tin từ body request
        const { txnRef, method } = req.body;
        
        if (!txnRef || !method) {
            return res.status(400).json({ 
                success: false, 
                error: 'Thiếu thông tin thanh toán' 
            });
        }
        
        // Cập nhật thông tin thanh toán
        application.payment = {
            paid: true,
            txnRef,
            method,
            amount: application.paymentAmount || 0,
            confirmedAt: new Date(),
            payerNote: req.body.note || ''
        };
        
        await application.save();
        
        // Tạo log hoạt động
        await ActivityLogCollection.create({
            actorId: student._id,
            actorRole: 'student',
            action: 'payment_submitted',
            meta: { 
                applicationId: application._id,
                txnRef,
                method
            }
        });
        
        // Gửi thông báo cho admin (nếu có)
        if (typeof global.sendNotificationOnEvent === 'function') {
            await global.sendNotificationOnEvent('admin_payment_submitted', null, {
                studentName: student.name,
                studentId: student.studentId,
                applicationId: application._id,
                txnRef,
                method
            }, 'admin');
        }
        
        res.status(200).json({ 
            success: true, 
            message: 'Xác nhận thanh toán thành công! Chúng tôi sẽ kiểm tra và phản hồi sớm.'
        });
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// API kiểm tra trạng thái đăng ký
router.get('/registration/status', requireLogin, async (req, res) => {
    try {
        // Lấy thông tin từ session
        const userId = req.session.userId;
        const student = await StudentCollection.findById(userId);
        
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy thông tin sinh viên' 
            });
        }
        
        // Tìm tất cả đơn đăng ký của sinh viên
        const applications = await PendingApplicationCollection.find({
            studentId: student.studentId
        }).sort({ createdAt: -1 });
        
        // Xây dựng thông tin chi tiết cho từng đơn
        const applicationDetails = await Promise.all(applications.map(async (app) => {
            let dormitoryName = '';
            let roomInfo = null;
            
            // Nếu có thông tin KTX được gán
            if (app.assigned && app.assigned.dormitoryId) {
                const dorm = await DormitoryCollection.findById(app.assigned.dormitoryId);
                if (dorm) {
                    dormitoryName = dorm.name;
                    
                    // Tìm thông tin phòng
                    const floor = dorm.floors.find(f => f.floorNumber === app.assigned.floorNumber);
                    if (floor) {
                        const room = floor.rooms.find(r => r.roomNumber === app.assigned.roomNumber);
                        if (room) {
                            roomInfo = {
                                floorNumber: floor.floorNumber,
                                roomNumber: room.roomNumber,
                                maxCapacity: room.maxCapacity,
                                currentOccupants: room.occupants.filter(o => o.active).length,
                                pricePerMonth: room.pricePerMonth,
                                type: room.type,
                                genderPolicy: room.genderPolicy
                            };
                        }
                    }
                }
            } 
            // Nếu là đơn đăng ký với KTX và phòng cụ thể
            else if (app.dormitoryId && app.roomNumber) {
                const dorm = await DormitoryCollection.findById(app.dormitoryId);
                if (dorm) {
                    dormitoryName = dorm.name;
                }
            }
            
            return {
                _id: app._id,
                academicYear: app.academicYear,
                status: app.status,
                createdAt: app.createdAt,
                updatedAt: app.updatedAt,
                dormitoryName: app.assigned ? app.assigned.dormitoryName : dormitoryName,
                roomInfo: roomInfo,
                payment: app.payment || { paid: false },
                approvedAt: app.approvedAt,
                checkInDate: app.checkInDate,
                checkOutDate: app.checkOutDate,
                preferredDormitories: app.preferredDormitories,
                preferredGenderPolicy: app.preferredGenderPolicy,
                roomType: app.roomType
            };
        }));
        
        // Lấy thông tin đơn hiện tại
        const currentApplication = applications.length > 0 ? 
            applications.find(a => !['rejected', 'expired', 'checked_out'].includes(a.status)) : null;
            
        // Lấy thông tin bạn cùng phòng nếu đã được gán phòng
        let roommates = [];
        if (currentApplication && currentApplication.assigned) {
            const { dormitoryId, floorNumber, roomNumber } = currentApplication.assigned;
            const dorm = await DormitoryCollection.findById(dormitoryId);
            
            if (dorm) {
                const floor = dorm.floors.find(f => f.floorNumber === floorNumber);
                if (floor) {
                    const room = floor.rooms.find(r => r.roomNumber === roomNumber);
                    if (room) {
                        roommates = room.occupants
                            .filter(o => o.active && o.studentId !== student.studentId)
                            .map(o => ({
                                studentId: o.studentId,
                                name: o.name,
                                email: o.email || '',
                                phone: o.phone || '',
                                since: o.since
                            }));
                    }
                }
            }
        }
        
        // Kiểm tra các đợt đăng ký đang mở
        const now = new Date();
        const openWindows = await AcademicWindowCollection.find({
            registerOpenAt: { $lte: now },
            registerCloseAt: { $gte: now }
        });
        
        res.status(200).json({
            success: true,
            student: {
                studentId: student.studentId,
                name: student.name,
                email: student.email,
                phone: student.phone,
                gender: student.gender,
                registrationStatus: student.registrationStatus
            },
            currentRegistration: currentApplication ? {
                _id: currentApplication._id,
                academicYear: currentApplication.academicYear,
                status: currentApplication.status,
                roommates
            } : null,
            applications: applicationDetails,
            openRegistrationWindows: openWindows.map(w => ({
                year: w.year,
                openUntil: w.registerCloseAt
            }))
        });
    } catch (error) {
        console.error('Error checking registration status:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// API hủy đơn đăng ký
router.post('/registration/:id/cancel', requireLogin, async (req, res) => {
    try {
        // Lấy thông tin từ session
        const userId = req.session.userId;
        const student = await StudentCollection.findById(userId);
        
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy thông tin sinh viên' 
            });
        }
        
        // Tìm đơn đăng ký
        const application = await PendingApplicationCollection.findById(req.params.id);
        
        if (!application) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy đơn đăng ký' 
            });
        }
        
        // Kiểm tra quyền hủy đơn
        if (application.studentId !== student.studentId) {
            return res.status(403).json({ 
                success: false, 
                error: 'Bạn không có quyền hủy đơn này' 
            });
        }
        
        // Kiểm tra trạng thái đơn
        const allowedStatuses = ['pending_review', 'approved_waiting_payment', 'waitlist'];
        if (!allowedStatuses.includes(application.status)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Không thể hủy đơn ở trạng thái hiện tại' 
            });
        }
        
        // Cập nhật trạng thái đơn
        application.status = 'cancelled';
        application.cancelledBy = student._id;
        application.cancelledAt = new Date();
        application.updatedAt = new Date();
        application.cancellationReason = req.body.reason || 'Hủy bởi sinh viên';
        await application.save();
        
        // Cập nhật trạng thái sinh viên
        if (student.registrationStatus !== 'checked_in') {
            student.registrationStatus = 'not_registered';
            await student.save();
        }
        
        // Tạo log hoạt động
        await ActivityLogCollection.create({
            actorId: student._id,
            actorRole: 'student',
            action: 'registration_cancelled',
            meta: { 
                applicationId: application._id,
                reason: req.body.reason 
            }
        });
        
        // Gửi thông báo cho admin (nếu có)
        if (typeof global.sendNotificationOnEvent === 'function') {
            await global.sendNotificationOnEvent('admin_registration_cancelled', null, {
                studentName: student.name,
                studentId: student.studentId,
                applicationId: application._id,
                reason: req.body.reason || 'Hủy bởi sinh viên'
            }, 'admin');
        }
        
        res.status(200).json({ 
            success: true, 
            message: 'Hủy đơn đăng ký thành công'
        });
    } catch (error) {
        console.error('Error cancelling registration:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// API yêu cầu check-out
router.post('/registration/:id/request-checkout', requireLogin, async (req, res) => {
    try {
        // Lấy thông tin từ session
        const userId = req.session.userId;
        const student = await StudentCollection.findById(userId);
        
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy thông tin sinh viên' 
            });
        }
        
        // Tìm đơn đăng ký
        const application = await PendingApplicationCollection.findById(req.params.id);
        
        if (!application) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy đơn đăng ký' 
            });
        }
        
        // Kiểm tra quyền yêu cầu check-out
        if (application.studentId !== student.studentId) {
            return res.status(403).json({ 
                success: false, 
                error: 'Bạn không có quyền yêu cầu check-out cho đơn này' 
            });
        }
        
        // Kiểm tra trạng thái đơn
        if (!['checked_in', 'assigned_room'].includes(application.status)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Không thể yêu cầu check-out ở trạng thái hiện tại' 
            });
        }
        
        // Thêm yêu cầu check-out
        application.checkoutRequest = {
            requestedAt: new Date(),
            reason: req.body.reason || 'Yêu cầu trả phòng',
            scheduledDate: req.body.scheduledDate ? new Date(req.body.scheduledDate) : null,
            status: 'pending'
        };
        
        application.updatedAt = new Date();
        await application.save();
        
        // Tạo log hoạt động
        await ActivityLogCollection.create({
            actorId: student._id,
            actorRole: 'student',
            action: 'checkout_requested',
            meta: { 
                applicationId: application._id,
                reason: req.body.reason,
                scheduledDate: req.body.scheduledDate
            }
        });
        
        // Gửi thông báo cho admin (nếu có)
        if (typeof global.sendNotificationOnEvent === 'function') {
            await global.sendNotificationOnEvent('admin_checkout_requested', null, {
                studentName: student.name,
                studentId: student.studentId,
                applicationId: application._id,
                reason: req.body.reason || 'Yêu cầu trả phòng',
                scheduledDate: req.body.scheduledDate
            }, 'admin');
        }
        
        res.status(200).json({ 
            success: true, 
            message: 'Yêu cầu check-out đã được gửi. Vui lòng chờ phản hồi từ quản lý KTX.'
        });
    } catch (error) {
        console.error('Error requesting checkout:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// API cập nhật thông tin liên hệ
router.put('/profile/contact', requireLogin, async (req, res) => {
    try {
        // Lấy thông tin từ session
        const userId = req.session.userId;
        const student = await StudentCollection.findById(userId);
        
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy thông tin sinh viên' 
            });
        }
        
        // Cập nhật thông tin liên hệ
        const { email, phone } = req.body;
        
        if (email) student.email = email;
        if (phone) student.phone = phone;
        
        student.updatedAt = new Date();
        await student.save();
        
        // Tạo log hoạt động
        await ActivityLogCollection.create({
            actorId: student._id,
            actorRole: 'student',
            action: 'contact_updated',
            meta: { 
                previousEmail: student.email,
                previousPhone: student.phone,
                newEmail: email,
                newPhone: phone
            }
        });
        
        res.status(200).json({ 
            success: true, 
            message: 'Cập nhật thông tin liên hệ thành công'
        });
    } catch (error) {
        console.error('Error updating contact information:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

module.exports = router;