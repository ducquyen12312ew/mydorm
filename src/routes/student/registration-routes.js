const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { 
    DormitoryCollection, 
    PendingApplicationCollection, 
    StudentCollection, 
    ActivityLogCollection,
    AcademicWindowCollection 
} = require('../../config/config');
const { logger } = require('../../config/logger');
const { calculatePriorityScore } = require('../../utils/priorityCalculator');
const { sendNotificationOnEvent } = require('../../utils/notificationHelper');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../uploads/priority-claims');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /pdf|jpg|jpeg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận file PDF, JPG, JPEG, PNG'));
        }
    }
});

// Helper: derive academic year from studentId (4-digit admission year)
function deriveAcademicYear(studentId) {
    const currentYear = new Date().getFullYear();
    let admissionYear = parseInt((studentId || '').substring(0, 4));

    if (isNaN(admissionYear)) {
        // Fallback to 2-digit year code
        const code2 = parseInt((studentId || '').substring(0, 2));
        admissionYear = code2 >= 50 ? 1900 + code2 : 2000 + code2;
    }

    let derived = currentYear - admissionYear;
    if (derived < 1) derived = 1; // new intakes
    if (derived > 6) derived = 6; // cap
    return derived.toString();
}

// Middleware kiểm tra đăng nhập
const requireLogin = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.status(403).json({ error: 'Vui lòng đăng nhập' });
};

// API lấy thông tin profile sinh viên (để auto-fill form)
router.get('/student/profile', requireLogin, async (req, res) => {
    try {
        const student = await StudentCollection.findById(req.session.userId).lean();
        
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy thông tin sinh viên' 
            });
        }

        res.json({
            success: true,
            student: {
                studentId: student.studentId,
                name: student.name,
                email: student.email,
                phone: student.phone,
                faculty: student.faculty || '',
                class: student.class || '',
                academicYear: deriveAcademicYear(student.studentId) || ''
            }
        });
    } catch (error) {
        console.error('Error fetching student profile:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi hệ thống' 
        });
    }
});

// API kiểm tra đơn đăng ký hiện tại của sinh viên
router.get('/registration/my-application', requireLogin, async (req, res) => {
    try {
        const application = await PendingApplicationCollection.findOne({
            studentId: req.session.userId,
            status: { $in: ['pending', 'approved'] }
        }).lean();

        res.json({
            success: true,
            hasApplication: !!application,
            application: application || null
        });
    } catch (error) {
        console.error('Error checking application:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi hệ thống' 
        });
    }
});

// API lấy danh sách KTX cho đăng ký
router.get('/dormitories/registration', async (req, res) => {
    try {
        // Kiểm tra cửa sổ đăng ký mở
        const now = new Date();
        const academicWindows = await AcademicWindowCollection.find({
            startDate: { $lte: now },
            endDate: { $gte: now },
            status: 'active'
        });

        logger.info('Student registration checking academic windows', { now });
        logger.info('Student registration active windows found', { count: academicWindows.length });

        // Nếu không có cửa sổ đăng ký nào đang mở
        if (academicWindows.length === 0) {
            logger.info('Student registration no open windows');
            return res.status(200).json({
                openForRegistration: false,
                dormitories: [],
                message: 'Hiện tại không có đợt đăng ký KTX nào đang mở'
            });
        }

        const currentWindow = academicWindows[0];
        const currentAcademicYears = academicWindows.map(aw => aw.academicYear);
        logger.info('Student registration active academic years', { currentAcademicYears });

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

        logger.info(`Fetched ${dormitories.length} available dormitories for registration`);
        
        res.status(200).json({
            openForRegistration: true,
            academicYears: currentAcademicYears,
            window: {
                _id: currentWindow._id,
                academicYear: currentWindow.academicYear,
                startDate: currentWindow.startDate,
                endDate: currentWindow.endDate,
                allowedAcademicYears: currentWindow.allowedAcademicYears || ['1', '2', '3', '4', '5', '6']
            },
            dormitories: dormitories,
            allowedAcademicYears: currentWindow.allowedAcademicYears || ['1', '2', '3', '4', '5', '6']
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

        // Lấy tất cả pending applications cho KTX này
        const pendingApps = await PendingApplicationCollection.find({
            dormitoryId: req.params.id,
            status: 'pending'
        }).lean();

        // Đếm số đơn pending cho mỗi phòng
        const pendingCountByRoom = {};
        pendingApps.forEach(app => {
            if (!pendingCountByRoom[app.roomNumber]) {
                pendingCountByRoom[app.roomNumber] = 0;
            }
            pendingCountByRoom[app.roomNumber]++;
        });

        const result = dormitory.floors.map(floor => {
            return {
                floorNumber: floor.floorNumber,
                rooms: floor.rooms.map(room => {
                    const activeOccupants = room.occupants.filter(o => o.active).length;
                    const pendingCount = pendingCountByRoom[room.roomNumber] || 0;
                    return {
                        roomNumber: room.roomNumber,
                        roomType: room.roomType,
                        maxCapacity: room.maxCapacity,
                        currentOccupants: activeOccupants,
                        pendingApplications: pendingCount,
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

// API đăng ký phòng KTX (với file uploads)
router.post('/registration', requireLogin, upload.fields([
    { name: 'fileEthnic', maxCount: 1 },
    { name: 'filePoor', maxCount: 1 },
    { name: 'fileDisability', maxCount: 1 },
    { name: 'fileOrphan', maxCount: 1 }
]), async (req, res) => {
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
            studentId,
            fullName,
            email,
            phone,
            faculty,
            class: studentClass,
            dormitoryId,
            roomNumber,
            priorityPolicies
        } = req.body;

        const academicYear = deriveAcademicYear(studentId || student.studentId);
        
        // Kiểm tra dữ liệu bắt buộc
        if (!studentId || !fullName || !email || !phone || !dormitoryId || !roomNumber || !academicYear) {
            return res.status(400).json({ 
                success: false, 
                error: 'Thiếu thông tin bắt buộc' 
            });
        }
        
        // Kiểm tra cửa sổ đăng ký
        const now = new Date();
        const academicWindow = await AcademicWindowCollection.findOne({
            startDate: { $lte: now },
            endDate: { $gte: now },
            status: 'active'
        });
        
        if (!academicWindow) {
            return res.status(400).json({ 
                success: false, 
                error: 'Hiện tại không có đợt đăng ký KTX nào đang mở' 
            });
        }

        // Kiểm tra xem năm học hiện tại có được phép đăng ký không
        const studentAcademicYear = deriveAcademicYear(req.body.studentId || student.studentId);
        const allowedYears = academicWindow.allowedAcademicYears || ['1', '2', '3', '4', '5', '6'];
        
        const isAllowedYear = allowedYears.includes('all') || allowedYears.includes(studentAcademicYear);
        
        if (!isAllowedYear) {
            return res.status(400).json({ 
                success: false, 
                error: `Đợt đăng ký này không mở cho sinh viên năm ${studentAcademicYear}. Chỉ mở cho: ${allowedYears.includes('all') ? 'Tất cả sinh viên' : 'Sinh viên năm ' + allowedYears.join(', ')}` 
            });
        }
        
        // Kiểm tra đơn đăng ký hiện tại
        const existingApplication = await PendingApplicationCollection.findOne({
            studentId: student.studentId,
            status: { $nin: ['rejected', 'expired', 'checked_out'] }
        });
        
        // Parse priority policies
        let parsedPolicies = [];
        try {
            parsedPolicies = priorityPolicies ? JSON.parse(priorityPolicies) : [];
        } catch (e) {
            parsedPolicies = [];
        }
        
        // Add file paths to policies
        if (req.files) {
            parsedPolicies.forEach(policy => {
                const fileFieldName = `file${policy.type.charAt(0).toUpperCase() + policy.type.slice(1)}`;
                if (req.files[fileFieldName] && req.files[fileFieldName][0]) {
                    policy.proofDocument = req.files[fileFieldName][0].filename;
                }
            });
        }
        
        if (existingApplication) {
            // Nếu đã có đơn pending, cho phép cập nhật
            if (existingApplication.status === 'pending') {
                // AUTO-CALCULATE PRIORITY SCORE
                const currentYear = new Date().getFullYear();
                const enrollmentYear = parseInt((studentId || '').substring(0, 4)) || currentYear;
                const yearsSinceEnrollment = currentYear - enrollmentYear;
                
                let yearGroup = 'year1';
                if (yearsSinceEnrollment >= 4) yearGroup = 'year4_plus';
                else if (yearsSinceEnrollment >= 2) yearGroup = 'year2_3';
                
                const studentData = {
                    priorityPolicies: parsedPolicies,
                    yearGroup: yearGroup,
                    gpa: student.gpa || 0,
                    violations: [],
                    distanceFromHome: student.distanceFromHome || 0,
                    familyWealth: student.familyWealth || 'average'
                };
                
                const priorityResult = calculatePriorityScore(studentData);
                
                const updatedApplication = await PendingApplicationCollection.findByIdAndUpdate(
                    existingApplication._id,
                    {
                        fullName: fullName,
                        email: email,
                        phone: phone,
                        faculty: faculty || '',
                        class: studentClass || '',
                        academicYear: academicYear,
                        dormitoryId: dormitoryId,
                        roomNumber: roomNumber,
                        priorityPolicies: parsedPolicies,
                        priorityScore: priorityResult.totalScore,
                        priorityBreakdown: priorityResult.breakdown,
                        updatedAt: new Date()
                    },
                    { new: true }
                );
                
                res.status(200).json({ 
                    success: true, 
                    message: 'Cập nhật đơn đăng ký thành công!',
                    applicationId: updatedApplication._id,
                    status: 'pending',
                    isUpdate: true
                });
                return;
            } else {
                // Nếu đơn ở trạng thái khác (approved, etc), không cho phép
                return res.status(400).json({ 
                    success: false, 
                    error: `Bạn đã có đơn đăng ký ở trạng thái '${existingApplication.status}'. Không thể đăng ký lại.` 
                });
            }
        }
        
        // AUTO-CALCULATE PRIORITY SCORE
        const currentYear = new Date().getFullYear();
        const enrollmentYear = parseInt((studentId || '').substring(0, 4)) || currentYear;
        const yearsSinceEnrollment = currentYear - enrollmentYear;
        
        let yearGroup = 'year1';
        if (yearsSinceEnrollment >= 4) yearGroup = 'year4_plus';
        else if (yearsSinceEnrollment >= 2) yearGroup = 'year2_3';
        
        const studentData = {
            priorityPolicies: parsedPolicies,
            yearGroup: yearGroup,
            gpa: student.gpa || 0,
            violations: [],
            distanceFromHome: student.distanceFromHome || 0,
            familyWealth: student.familyWealth || 'average'
        };
        
        const priorityResult = calculatePriorityScore(studentData);
        
        // Tạo đơn đăng ký mới
        const newApplication = await PendingApplicationCollection.create({
            studentId: studentId,
            fullName: fullName,
            email: email,
            phone: phone,
            faculty: faculty || '',
            class: studentClass || '',
            academicYear: academicYear,
            dormitoryId: dormitoryId,
            roomNumber: roomNumber,
            priorityPolicies: parsedPolicies,
            priorityScore: priorityResult.totalScore,
            priorityBreakdown: priorityResult.breakdown,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        // Cập nhật trạng thái sinh viên
        student.registrationStatus = 'pending';
        student.academicYear = academicYear;
        await student.save();
        
        // Tạo log hoạt động
        await ActivityLogCollection.create({
            userId: student._id,
            action: 'register_success',
            description: `Student registered for room ${roomNumber} in dormitory ${dormitoryId} for academic year ${academicYear}`,
            details: { 
                applicationId: newApplication._id,
                dormitoryId: dormitoryId,
                roomNumber: roomNumber,
                academicYear: academicYear
            }
        });
        
        
        res.status(200).json({ 
            success: true, 
            message: 'Đăng ký thành công! Đơn của bạn đang chờ xét duyệt.',
            applicationId: newApplication._id,
            status: 'pending'
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

// API kiểm tra đơn đăng ký hiện tại
router.get('/my-application', requireLogin, async (req, res) => {
    try {
        const userId = req.session.userId;
        const student = await StudentCollection.findById(userId);
        
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy thông tin sinh viên' 
            });
        }
        
        const application = await PendingApplicationCollection.findOne({
            studentId: student.studentId,
            status: { $nin: ['rejected', 'expired', 'checked_out'] }
        });
        
        if (!application) {
            return res.status(200).json({ 
                success: true,
                hasApplication: false,
                message: 'Bạn chưa có đơn đăng ký nào'
            });
        }
        
        res.status(200).json({ 
            success: true,
            hasApplication: true,
            application: {
                _id: application._id,
                academicYear: application.academicYear,
                dormitoryId: application.dormitoryId,
                roomNumber: application.roomNumber,
                status: application.status,
                fullName: application.fullName,
                email: application.email,
                phone: application.phone,
                faculty: application.faculty,
                gender: application.gender,
                createdAt: application.createdAt,
                updatedAt: application.updatedAt
            }
        });
    } catch (error) {
        console.error('Error fetching application:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// API cập nhật đơn đăng ký hiện tại
router.put('/my-application', requireLogin, async (req, res) => {
    try {
        const userId = req.session.userId;
        const student = await StudentCollection.findById(userId);
        
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy thông tin sinh viên' 
            });
        }
        
        const {
            dormitoryId,
            roomNumber,
            fullName,
            email,
            phone,
            faculty,
            gender
        } = req.body;
        
        // Kiểm tra đơn đăng ký hiện tại
        const existingApplication = await PendingApplicationCollection.findOne({
            studentId: student.studentId,
            status: { $nin: ['rejected', 'expired', 'checked_out', 'approved'] }
        });
        
        if (!existingApplication) {
            return res.status(404).json({ 
                success: false, 
                error: 'Bạn không có đơn đăng ký để cập nhật' 
            });
        }
        
        // Cập nhật đơn đăng ký
        const updatedApplication = await PendingApplicationCollection.findByIdAndUpdate(
            existingApplication._id,
            {
                dormitoryId: dormitoryId || existingApplication.dormitoryId,
                roomNumber: roomNumber || existingApplication.roomNumber,
                fullName: fullName || existingApplication.fullName,
                email: email || existingApplication.email,
                phone: phone || existingApplication.phone,
                faculty: faculty || existingApplication.faculty,
                gender: gender || existingApplication.gender,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        res.status(200).json({ 
            success: true, 
            message: 'Cập nhật đơn đăng ký thành công',
            application: updatedApplication
        });
    } catch (error) {
        console.error('Error updating application:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// API xóa đơn đăng ký hiện tại
router.delete('/my-application', requireLogin, async (req, res) => {
    try {
        const userId = req.session.userId;
        const student = await StudentCollection.findById(userId);
        
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy thông tin sinh viên' 
            });
        }
        
        const existingApplication = await PendingApplicationCollection.findOne({
            studentId: student.studentId,
            status: { $nin: ['rejected', 'expired', 'checked_out', 'approved'] }
        });
        
        if (!existingApplication) {
            return res.status(404).json({ 
                success: false, 
                error: 'Bạn không có đơn đăng ký để xóa' 
            });
        }
        
        // Chỉ cho phép xóa đơn ở trạng thái 'pending' hoặc 'rejected'
        if (existingApplication.status !== 'pending') {
            return res.status(400).json({ 
                success: false, 
                error: `Không thể xóa đơn ở trạng thái '${existingApplication.status}'` 
            });
        }
        
        await PendingApplicationCollection.findByIdAndDelete(existingApplication._id);
        
        // Cập nhật trạng thái sinh viên
        student.registrationStatus = null;
        await student.save();
        
        res.status(200).json({ 
            success: true, 
            message: 'Xóa đơn đăng ký thành công'
        });
    } catch (error) {
        console.error('Error deleting application:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

module.exports = router;