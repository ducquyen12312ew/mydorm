const express = require('express');
const router = express.Router();
const { 
    DormitoryCollection, 
    PendingApplicationCollection, 
    StudentCollection, 
    ActivityLogCollection,
    AcademicWindowCollection 
} = require('./config');
const { isValidObjectId } = require('mongoose');

const isAdmin = (req, res, next) => {
    if (req.session && req.session.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Không có quyền truy cập' });
};

// Middleware kiểm tra ObjectId hợp lệ
const validateObjectId = (req, res, next) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ 
            success: false, 
            error: "ID không hợp lệ" 
        });
    }
    next();
};

// Helper function kiểm tra sinh viên đã tồn tại trong hệ thống chưa
async function checkStudentExistsInSystem(studentId, name) {
    try {
        // Sử dụng MongoDB aggregation để tìm kiếm hiệu quả hơn
        const result = await DormitoryCollection.aggregate([
            { $unwind: "$floors" },
            { $unwind: "$floors.rooms" },
            { $unwind: "$floors.rooms.occupants" },
            {
                $match: {
                    "floors.rooms.occupants.active": true,
                    $or: [
                        { "floors.rooms.occupants.studentId": studentId },
                        { "floors.rooms.occupants.name": name }
                    ]
                }
            },
            {
                $project: {
                    dormitoryName: "$name",
                    floorNumber: "$floors.floorNumber",
                    roomNumber: "$floors.rooms.roomNumber",
                    occupant: "$floors.rooms.occupants"
                }
            },
            { $limit: 1 } // Chỉ cần tìm 1 kết quả để kiểm tra
        ]);

        if (result.length > 0) {
            const found = result[0];
            return {
                exists: true,
                location: {
                    dormitoryName: found.dormitoryName,
                    floorNumber: found.floorNumber,
                    roomNumber: found.roomNumber,
                    studentId: found.occupant.studentId,
                    name: found.occupant.name
                },
                type: found.occupant.studentId === studentId ? 'studentId' : 'name'
            };
        }

        return { exists: false };
    } catch (error) {
        console.error('Error checking student existence:', error);
        throw error;
    }
}

// Tìm phòng phù hợp dựa trên tiêu chí
async function findEligibleRoom(dorm, gender, genderPolicy, roomType) {
    for (const floor of dorm.floors) {
        for (const room of floor.rooms) {
            // Kiểm tra trạng thái phòng
            if (room.status !== 'available') continue;
            
            // Kiểm tra chính sách giới tính
            if (genderPolicy === 'male' && room.genderPolicy === 'female') continue;
            if (genderPolicy === 'female' && room.genderPolicy === 'male') continue;
            
            // Kiểm tra loại phòng
            if (roomType !== 'any' && room.type !== roomType) continue;
            
            // Kiểm tra số lượng chỗ trống
            const occupied = room.occupants.filter(o => o.active).length;
            if (occupied < room.maxCapacity) {
                return { floorNumber: floor.floorNumber, roomNumber: room.roomNumber };
            }
        }
    }
    return null;
}

// API endpoint thống kê (đặt trước các route có pattern)
router.get('/admin/applications/statistics', isAdmin, async (req, res) => {
    try {
        const pendingCount = await PendingApplicationCollection.countDocuments({ status: 'pending' });
        const approvedCount = await PendingApplicationCollection.countDocuments({ status: 'approved' });
        const rejectedCount = await PendingApplicationCollection.countDocuments({ status: 'rejected' });
        const waitlistCount = await PendingApplicationCollection.countDocuments({ status: 'waitlist' });
        const totalCount = await PendingApplicationCollection.countDocuments({});
        
        const stats = {
            pending: pendingCount,
            approved: approvedCount,
            rejected: rejectedCount,
            waitlist: waitlistCount,
            total: totalCount
        };
        
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching application statistics:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// API lấy danh sách đơn đăng ký
router.get('/admin/applications', isAdmin, async (req, res) => {
    try {
        const { status, academicYear } = req.query;

        const filter = {};
        if (status) {
            filter.status = status;
        }
        if (academicYear) {
            filter.academicYear = academicYear;
        }

        const applications = await PendingApplicationCollection.find(filter)
            .sort({ createdAt: -1 });
            
        const applicationData = await Promise.all(applications.map(async (app) => {
            const dormitory = await DormitoryCollection.findById(app.dormitoryId);
            
            // Xác định phòng và tầng
            let roomInfo = { capacity: 0, occupants: 0 };
            if (dormitory && app.roomNumber) {
                for (const floor of dormitory.floors) {
                    const room = floor.rooms.find(r => r.roomNumber === app.roomNumber);
                    if (room) {
                        roomInfo.capacity = room.maxCapacity;
                        roomInfo.occupants = room.occupants.filter(o => o.active).length;
                        break;
                    }
                }
            }
            
            return {
                _id: app._id,
                studentId: app.studentId,
                fullName: app.fullName || app.name,
                email: app.email,
                phone: app.phone,
                faculty: app.faculty,
                academicYear: app.academicYear,
                gender: app.gender,
                dormitoryId: app.dormitoryId,
                dormitoryName: dormitory ? dormitory.name : 'Không xác định',
                roomNumber: app.roomNumber,
                status: app.status,
                createdAt: app.createdAt,
                comments: app.comments,
                payment: app.payment || { paid: false },
                roomCapacity: roomInfo.capacity,
                currentOccupants: roomInfo.occupants
            };
        }));
        
        res.status(200).json({ 
            success: true, 
            applications: applicationData 
        });
    } catch (error) {
        console.error('Error getting applications:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// API lấy chi tiết đơn đăng ký
router.get('/admin/applications/:id', isAdmin, validateObjectId, async (req, res) => {
    try {
        const application = await PendingApplicationCollection.findById(req.params.id);
        
        if (!application) {
            return res.status(404).json({ 
                success: false, 
                error: "Không tìm thấy đơn đăng ký" 
            });
        }
        
        const dormitory = await DormitoryCollection.findById(application.dormitoryId);
        let room = null;
        let floor = null;
        
        if (dormitory) {
            for (const f of dormitory.floors) {
                const r = f.rooms.find(r => r.roomNumber === application.roomNumber);
                if (r) {
                    room = r;
                    floor = f;
                    break;
                }
            }
        }
 
        let roomCapacity = 0;
        let currentOccupants = 0;
        
        if (room) {
            roomCapacity = room.maxCapacity;
            currentOccupants = room.occupants.filter(o => o.active).length;
        }

        // Kiểm tra sinh viên đã tồn tại trong hệ thống chưa
        let studentExistsInfo = null;
        try {
            const existingStudent = await checkStudentExistsInSystem(application.studentId, application.fullName || application.name);
            if (existingStudent.exists) {
                studentExistsInfo = existingStudent.location;
            }
        } catch (error) {
            console.error('Error checking student existence:', error);
        }
        
        const applicationDetails = {
            _id: application._id,
            studentId: application.studentId,
            fullName: application.fullName || application.name,
            email: application.email,
            phone: application.phone,
            faculty: application.faculty,
            academicYear: application.academicYear,
            gender: application.gender,
            dormitoryId: application.dormitoryId,
            dormitoryName: dormitory ? dormitory.name : 'Không xác định',
            roomNumber: application.roomNumber,
            roomCapacity: roomCapacity,
            currentOccupants: currentOccupants,
            isRoomFull: currentOccupants >= roomCapacity,
            status: application.status,
            createdAt: application.createdAt,
            comments: application.comments,
            payment: application.payment || { paid: false },
            preferredDormitories: application.preferredDormitories || [],
            preferredGenderPolicy: application.preferredGenderPolicy || 'any',
            roomType: application.roomType || 'any',
            studentExistsInfo: studentExistsInfo,
            canApprove: !studentExistsInfo && currentOccupants < roomCapacity
        };
        
        res.status(200).json({ 
            success: true, 
            application: applicationDetails 
        });
    } catch (error) {
        console.error('Error getting application details:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// API duyệt/từ chối đơn đăng ký
router.post('/admin/applications/:id/approve', isAdmin, validateObjectId, async (req, res) => {
    try {
        const appDoc = await PendingApplicationCollection.findById(req.params.id);
        if (!appDoc) return res.status(404).json({ error: 'Not found' });
        
        if (!['pending_review', 'waitlist'].includes(appDoc.status)) 
            return res.status(400).json({ error: 'Invalid state' });
        
        // Kiểm tra sinh viên đã tồn tại trong hệ thống chưa
        const existingStudent = await checkStudentExistsInSystem(appDoc.studentId, appDoc.name || appDoc.fullName);
        if (existingStudent.exists) {
            const location = existingStudent.location;
            const fieldType = existingStudent.type === 'studentId' ? 'Mã sinh viên' : 'Tên sinh viên';
            const fieldValue = existingStudent.type === 'studentId' ? appDoc.studentId : (appDoc.name || appDoc.fullName);
            
            return res.status(400).json({ 
                success: false, 
                error: `${fieldType} "${fieldValue}" đã được đăng ký tại ${location.dormitoryName} - Tầng ${location.floorNumber} - Phòng ${location.roomNumber}. Không thể duyệt đơn đăng ký này!` 
            });
        }
        
        // Cập nhật trạng thái đơn
        appDoc.status = 'approved_waiting_payment';
        appDoc.approvedBy = req.session.userId;
        appDoc.approvedAt = new Date();
        appDoc.updatedAt = new Date();
        await appDoc.save();
        
        // Cập nhật trạng thái sinh viên
        const student = await StudentCollection.findOne({ studentId: appDoc.studentId });
        if (student) {
            student.registrationStatus = 'approved_waiting_payment';
            await student.save();
        }
        
        // Ghi log hoạt động
        await ActivityLogCollection.create({ 
            actorId: req.session.userId || null, 
            actorRole: 'admin', 
            action: 'application_approved', 
            meta: { applicationId: appDoc._id } 
        });
        
        // Gửi thông báo cho sinh viên (nếu có)
        if (typeof global.sendNotificationOnEvent === 'function') {
            await global.sendNotificationOnEvent('registration_approved', student._id, {
                applicationId: appDoc._id
            });
        }
        
        res.json({ ok: true, application: appDoc });
    } catch (error) {
        console.error('Error approving application:', error);
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

// API từ chối đơn đăng ký
router.post('/admin/applications/:id/reject', isAdmin, validateObjectId, async (req, res) => {
    try {
        const appDoc = await PendingApplicationCollection.findById(req.params.id);
        if (!appDoc) return res.status(404).json({ error: 'Not found' });
        
        if (!['pending_review', 'waitlist', 'approved_waiting_payment'].includes(appDoc.status)) 
            return res.status(400).json({ error: 'Invalid state' });
        
        // Cập nhật trạng thái đơn
        appDoc.status = 'rejected';
        appDoc.rejectedBy = req.session.userId;
        appDoc.rejectedAt = new Date();
        appDoc.rejectionReason = req.body.reason || 'Không đáp ứng điều kiện';
        appDoc.updatedAt = new Date();
        await appDoc.save();
        
        // Cập nhật trạng thái sinh viên
        const student = await StudentCollection.findOne({ studentId: appDoc.studentId });
        if (student) {
            student.registrationStatus = 'rejected';
            await student.save();
        }
        
        // Ghi log hoạt động
        await ActivityLogCollection.create({ 
            actorId: req.session.userId || null, 
            actorRole: 'admin', 
            action: 'application_rejected', 
            meta: { applicationId: appDoc._id, reason: req.body.reason } 
        });
        
        // Gửi thông báo cho sinh viên (nếu có)
        if (student && typeof global.sendNotificationOnEvent === 'function') {
            await global.sendNotificationOnEvent('registration_rejected', student._id, {
                reason: req.body.reason || 'Không đáp ứng điều kiện',
                applicationId: appDoc._id
            });
        }
        
        res.json({ ok: true, application: appDoc });
    } catch (error) {
        console.error('Error rejecting application:', error);
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

// API xác nhận thanh toán
router.post('/admin/applications/:id/confirm-payment', isAdmin, validateObjectId, async (req, res) => {
    try {
        const appDoc = await PendingApplicationCollection.findById(req.params.id);
        if (!appDoc) return res.status(404).json({ error: 'Not found' });
        
        if (appDoc.status !== 'approved_waiting_payment') 
            return res.status(400).json({ error: 'Invalid state' });
        
        // Cập nhật thông tin thanh toán
        appDoc.payment = {
            paid: true,
            amount: req.body.amount || 0,
            method: req.body.method || 'admin',
            transactionId: req.body.transactionId || '',
            confirmedBy: req.session.userId,
            confirmedAt: new Date()
        };
        
        await appDoc.save();
        
        // Ghi log hoạt động
        await ActivityLogCollection.create({ 
            actorId: req.session.userId || null, 
            actorRole: 'admin', 
            action: 'payment_confirmed', 
            meta: { applicationId: appDoc._id, amount: req.body.amount } 
        });
        
        res.json({ ok: true, application: appDoc });
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

// API gán phòng cho sinh viên
router.post('/admin/applications/:id/assign', isAdmin, validateObjectId, async (req, res) => {
    try {
        const appDoc = await PendingApplicationCollection.findById(req.params.id);
        if (!appDoc) return res.status(404).json({ error: 'Not found' });
        
        // Kiểm tra đã thanh toán chưa
        if (!appDoc.payment || !appDoc.payment.paid) 
            return res.status(400).json({ error: 'Payment not confirmed' });
        
        // Kiểm tra trạng thái hợp lệ
        if (!['approved_waiting_payment', 'waitlist'].includes(appDoc.status)) 
            return res.status(400).json({ error: 'Invalid state' });
        
        // 1. Nếu có chỉ định phòng cụ thể từ Admin
        if (req.body.manualAssignment) {
            const { dormitoryId, floorNumber, roomNumber } = req.body;
            
            // Kiểm tra KTX tồn tại
            const dorm = await DormitoryCollection.findById(dormitoryId);
            if (!dorm) return res.status(404).json({ error: 'Dormitory not found' });
            
            // Tìm tầng và phòng chỉ định
            const floor = dorm.floors.find(f => f.floorNumber === floorNumber);
            if (!floor) return res.status(404).json({ error: 'Floor not found' });
            
            const room = floor.rooms.find(r => r.roomNumber === roomNumber);
            if (!room) return res.status(404).json({ error: 'Room not found' });
            
            // Kiểm tra phòng còn chỗ không
            const occupied = room.occupants.filter(o => o.active).length;
            if (occupied >= room.maxCapacity) {
                return res.status(400).json({ error: 'Room is full' });
            }
            
            // Gán sinh viên vào phòng
            const assigned = {
                dormitoryId: dorm._id,
                dormitoryName: dorm.name,
                floorNumber: floor.floorNumber,
                roomNumber: room.roomNumber
            };
            
            // Thêm sinh viên vào phòng
            const student = await StudentCollection.findOne({ studentId: appDoc.studentId });
            room.occupants.push({
                studentObjectId: student ? student._id : null,
                studentId: appDoc.studentId,
                name: appDoc.name || appDoc.fullName,
                email: appDoc.email || '',
                phone: appDoc.phone || '',
                active: true,
                since: new Date()
            });
            
            // Lưu thông tin KTX
            await dorm.save();
            
            // Cập nhật đơn đăng ký
            appDoc.status = 'assigned_room';
            appDoc.assigned = assigned;
            await appDoc.save();
            
            // Cập nhật thông tin sinh viên
            if (student) {
                student.registrationStatus = 'assigned_room';
                student.allocated = assigned;
                await student.save();
            }
            
            // Ghi log hoạt động
            await ActivityLogCollection.create({
                actorId: req.session.userId || null,
                actorRole: 'admin',
                action: 'room_manually_assigned',
                meta: { applicationId: appDoc._id, assigned }
            });
            
            return res.json({ ok: true, assigned });
        }
        
        // 2. Tìm phòng phù hợp tự động
        
        // Lấy danh sách KTX ưu tiên của sinh viên (nếu có)
        const preferred = appDoc.preferredDormitories && appDoc.preferredDormitories.length 
            ? appDoc.preferredDormitories : [];
        
        // Lấy các KTX phù hợp
        let candidateDorms = [];
        if (preferred.length) {
            candidateDorms = await DormitoryCollection.find({ 
                'details.available': true, 
                _id: { $in: preferred } 
            });
        }
        
        // Nếu không tìm thấy KTX ưu tiên, lấy tất cả KTX khả dụng
        if (!candidateDorms.length) {
            candidateDorms = await DormitoryCollection.find({ 'details.available': true });
        }
        
        // Lấy thông tin niên học để áp dụng chính sách phân bổ phòng
        const academicInfo = await AcademicWindowCollection.findOne({ year: appDoc.academicYear });
        
        // Nếu có thông tin niên học và có chính sách ưu tiên, sắp xếp KTX theo ưu tiên
        if (academicInfo && academicInfo.defaultPriority && academicInfo.defaultPriority.length) {
            // Tạo map để tra cứu nhanh điểm ưu tiên
            const priorityMap = {};
            academicInfo.defaultPriority.forEach(p => {
                priorityMap[p.dormitoryId.toString()] = p.score;
            });
            
            // Sắp xếp KTX theo điểm ưu tiên giảm dần
            candidateDorms.sort((a, b) => {
                const scoreA = priorityMap[a._id.toString()] || 0;
                const scoreB = priorityMap[b._id.toString()] || 0;
                return scoreB - scoreA;
            });
        }
        
        // Tìm phòng phù hợp từ danh sách KTX đã sắp xếp
        let assigned = null;
        for (const dorm of candidateDorms) {
            const pick = await findEligibleRoom(
                dorm, 
                appDoc.gender, 
                appDoc.preferredGenderPolicy || 'any', 
                appDoc.roomType || 'any'
            );
            
            if (pick) {
                assigned = { 
                    dormitoryId: dorm._id, 
                    dormitoryName: dorm.name, 
                    floorNumber: pick.floorNumber, 
                    roomNumber: pick.roomNumber 
                };
                break;
            }
        }
        
        // Nếu không tìm thấy phòng phù hợp, chuyển sang waitlist
        if (!assigned) {
            appDoc.status = 'waitlist';
            await appDoc.save();
            
            const student = await StudentCollection.findOne({ studentId: appDoc.studentId });
            if (student) {
                student.registrationStatus = 'waitlist';
                await student.save();
            }
            
            await ActivityLogCollection.create({
                actorId: req.session.userId || null,
                actorRole: 'admin',
                action: 'application_waitlisted',
                meta: { applicationId: appDoc._id }
            });
            
            return res.json({ ok: true, waitlist: true });
        }
        
        // Lấy thông tin phòng và tầng để thêm sinh viên
        const dorm = await DormitoryCollection.findById(assigned.dormitoryId);
        const floor = dorm.floors.find(f => f.floorNumber === assigned.floorNumber);
        const room = floor.rooms.find(r => r.roomNumber === assigned.roomNumber);
        
        // Lấy thông tin sinh viên
        const student = await StudentCollection.findOne({ studentId: appDoc.studentId });
        
        // Thêm sinh viên vào phòng
        room.occupants.push({
            studentObjectId: student ? student._id : null,
            studentId: appDoc.studentId,
            name: appDoc.name || appDoc.fullName,
            email: appDoc.email || '',
            phone: appDoc.phone || '',
            active: true,
            since: new Date()
        });
        
        // Lưu thông tin KTX
        await dorm.save();
        
        // Cập nhật đơn đăng ký
        appDoc.status = 'assigned_room';
        appDoc.assigned = assigned;
        await appDoc.save();
        
        // Cập nhật thông tin sinh viên
        if (student) {
            student.registrationStatus = 'assigned_room';
            student.allocated = assigned;
            await student.save();
        }
        
        // Ghi log hoạt động
        await ActivityLogCollection.create({
            actorId: req.session.userId || null,
            actorRole: 'admin',
            action: 'room_assigned',
            meta: { applicationId: appDoc._id, assigned }
        });
        
        res.json({ ok: true, assigned });
    } catch (error) {
        console.error('Error assigning room:', error);
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

// API check-in sinh viên
router.post('/admin/applications/:id/check-in', isAdmin, validateObjectId, async (req, res) => {
    try {
        const appDoc = await PendingApplicationCollection.findById(req.params.id);
        if (!appDoc) return res.status(404).json({ error: 'Not found' });
        
        if (appDoc.status !== 'assigned_room') 
            return res.status(400).json({ error: 'Invalid state' });
        
        // Cập nhật trạng thái đơn đăng ký
        appDoc.status = 'checked_in';
        appDoc.checkInDate = new Date();
        appDoc.updatedAt = new Date();
        await appDoc.save();
        
        // Cập nhật trạng thái sinh viên
        const student = await StudentCollection.findOne({ studentId: appDoc.studentId });
        if (student) {
            student.registrationStatus = 'checked_in';
            student.checkInDate = new Date();
            await student.save();
        }
        
        // Ghi log hoạt động
        await ActivityLogCollection.create({
            actorId: req.session.userId || null,
            actorRole: 'admin',
            action: 'checked_in',
            meta: { applicationId: appDoc._id }
        });
        
        res.json({ ok: true });
    } catch (error) {
        console.error('Error checking in:', error);
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

// API check-out sinh viên
router.post('/admin/applications/:id/check-out', isAdmin, validateObjectId, async (req, res) => {
    try {
        const appDoc = await PendingApplicationCollection.findById(req.params.id);
        if (!appDoc) return res.status(404).json({ error: 'Not found' });
        
        if (!['checked_in', 'assigned_room'].includes(appDoc.status)) 
            return res.status(400).json({ error: 'Invalid state' });
        
        const student = await StudentCollection.findOne({ studentId: appDoc.studentId });
        if (!student) return res.status(404).json({ error: 'Student not found' });
        
        // Nếu sinh viên đã được gán phòng, cập nhật trạng thái occupant
        const alloc = appDoc.assigned || student.allocated;
        if (alloc && alloc.dormitoryId) {
            const dorm = await DormitoryCollection.findById(alloc.dormitoryId);
            if (dorm) {
                const floor = dorm.floors.find(f => f.floorNumber === alloc.floorNumber);
                if (floor) {
                    const room = floor.rooms.find(r => r.roomNumber === alloc.roomNumber);
                    if (room) {
                        // Tìm và cập nhật trạng thái active của sinh viên
                        room.occupants = room.occupants.map(o => {
                            if (o.studentId === appDoc.studentId) {
                                return { ...o.toObject(), active: false };
                            }
                            return o;
                        });
                        await dorm.save();
                    }
                }
            }
        }
        
        // Cập nhật trạng thái đơn đăng ký
        appDoc.status = 'checked_out';
        appDoc.checkOutDate = new Date();
        appDoc.updatedAt = new Date();
        await appDoc.save();
        
        // Cập nhật trạng thái sinh viên
        student.registrationStatus = 'checked_out';
        student.checkOutDate = new Date();
        student.allocated = null;
        await student.save();
        
        // Ghi log hoạt động
        await ActivityLogCollection.create({
            actorId: req.session.userId || null,
            actorRole: 'admin',
            action: 'checked_out',
            meta: { applicationId: appDoc._id }
        });
        
        res.json({ ok: true });
    } catch (error) {
        console.error('Error checking out:', error);
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

// API quản lý niên học
router.get('/admin/academic-windows', isAdmin, async (req, res) => {
    try {
        const items = await AcademicWindowCollection.find({}).sort({ year: -1 });
        res.json(items);
    } catch (error) {
        console.error('Error fetching academic windows:', error);
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

// API tạo/cập nhật niên học
router.post('/admin/academic-windows/upsert', isAdmin, async (req, res) => {
    try {
        const { 
            year, 
            registerOpenAt, 
            registerCloseAt, 
            autoExpireAt, 
            defaultPriority = [] 
        } = req.body;
        
        const doc = await AcademicWindowCollection.findOneAndUpdate(
            { year },
            { 
                year, 
                registerOpenAt: new Date(registerOpenAt), 
                registerCloseAt: new Date(registerCloseAt), 
                autoExpireAt: new Date(autoExpireAt), 
                defaultPriority 
            },
            { upsert: true, new: true }
        );
        
        res.json(doc);
    } catch (error) {
        console.error('Error upserting academic window:', error);
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

// API hết hạn đơn đăng ký theo năm học
router.post('/admin/applications/expire', isAdmin, async (req, res) => {
    try {
        const { year } = req.body;
        
        const win = await AcademicWindowCollection.findOne({ year });
        if (!win) return res.status(404).json({ error: 'Academic window not found' });
        
        // Cập nhật tất cả đơn đăng ký chưa hoàn thành sang trạng thái expired
        const apps = await PendingApplicationCollection.updateMany(
            { 
                academicYear: year, 
                status: { $in: ['pending_review', 'approved_waiting_payment', 'waitlist'] } 
            }, 
            { 
                $set: { 
                    status: 'expired', 
                    updatedAt: new Date() 
                } 
            }
        );
        
        // Cập nhật trạng thái sinh viên
        await StudentCollection.updateMany(
            { 
                academicYear: year, 
                registrationStatus: { $in: ['pending_review', 'approved_waiting_payment', 'waitlist'] } 
            }, 
            { 
                $set: { registrationStatus: 'expired' } 
            }
        );
        
        // Ghi log hoạt động
        await ActivityLogCollection.create({
            actorId: req.session.userId || null,
            actorRole: 'admin',
            action: 'applications_expired',
            meta: { year, matched: apps.modifiedCount }
        });
        
        res.json({ ok: true, modified: apps.modifiedCount });
    } catch (error) {
        console.error('Error expiring applications:', error);
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

// API cập nhật thông tin phòng
router.patch('/admin/dormitories/:dormId/floors/:floorNumber/rooms/:roomNumber', isAdmin, async (req, res) => {
    try {
        const { dormId, floorNumber, roomNumber } = req.params;
        const { pricePerMonth, status, genderPolicy, maxCapacity, type } = req.body;
        
        const dorm = await DormitoryCollection.findById(dormId);
        if (!dorm) return res.status(404).json({ error: 'Dormitory not found' });
        
        const floor = dorm.floors.find(f => f.floorNumber === parseInt(floorNumber));
        if (!floor) return res.status(404).json({ error: 'Floor not found' });
        
        const room = floor.rooms.find(r => r.roomNumber === roomNumber);
        if (!room) return res.status(404).json({ error: 'Room not found' });
        
        // Cập nhật các trường được chỉ định
        if (pricePerMonth !== undefined) room.pricePerMonth = pricePerMonth;
        if (status !== undefined) room.status = status;
        if (genderPolicy !== undefined) room.genderPolicy = genderPolicy;
        if (maxCapacity !== undefined) room.maxCapacity = maxCapacity;
        if (type !== undefined) room.type = type;
        
        // Tính lại giá phòng min/max của KTX
        const prices = dorm.floors.flatMap(f => f.rooms.map(r => r.pricePerMonth));
        dorm.details.priceRange = {
            min: Math.min(...prices),
            max: Math.max(...prices)
        };
        
        // Lưu thay đổi
        await dorm.save();
        
        // Ghi log hoạt động
        await ActivityLogCollection.create({
            actorId: req.session.userId || null,
            actorRole: 'admin',
            action: 'room_updated',
            meta: { dormId, floorNumber, roomNumber, updates: req.body }
        });
        
        res.json({ ok: true, room });
    } catch (error) {
        console.error('Error updating room:', error);
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

// API thêm phòng mới
router.post('/admin/dormitories/:dormId/floors/:floorNumber/rooms', isAdmin, async (req, res) => {
    try {
        const { dormId, floorNumber } = req.params;
        const { 
            roomNumber, 
            type, 
            genderPolicy, 
            maxCapacity, 
            pricePerMonth, 
            status = 'available' 
        } = req.body;
        
        if (!roomNumber || !type || !genderPolicy || !maxCapacity || !pricePerMonth) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const dorm = await DormitoryCollection.findById(dormId);
        if (!dorm) return res.status(404).json({ error: 'Dormitory not found' });
        
        let floor = dorm.floors.find(f => f.floorNumber === parseInt(floorNumber));
        
        // Nếu tầng không tồn tại, tạo mới
        if (!floor) {
            floor = { floorNumber: parseInt(floorNumber), rooms: [] };
            dorm.floors.push(floor);
        } else {
            // Kiểm tra phòng đã tồn tại chưa
            const roomExists = floor.rooms.some(r => r.roomNumber === roomNumber);
            if (roomExists) {
                return res.status(400).json({ error: 'Room already exists' });
            }
        }
        
        // Tạo phòng mới
        const newRoom = {
            roomNumber,
            type,
            genderPolicy,
            maxCapacity: parseInt(maxCapacity),
            pricePerMonth: parseFloat(pricePerMonth),
            status,
            occupants: []
        };
        
        // Thêm phòng vào tầng
        floor = dorm.floors.find(f => f.floorNumber === parseInt(floorNumber));
        floor.rooms.push(newRoom);
        
        // Cập nhật thông tin KTX
        dorm.details.totalFloors = dorm.floors.length;
        
        // Tính lại giá phòng min/max của KTX
        const prices = dorm.floors.flatMap(f => f.rooms.map(r => r.pricePerMonth));
        dorm.details.priceRange = {
            min: Math.min(...prices),
            max: Math.max(...prices)
        };
        
        // Lưu thay đổi
        await dorm.save();
        
        // Ghi log hoạt động
        await ActivityLogCollection.create({
            actorId: req.session.userId || null,
            actorRole: 'admin',
            action: 'room_created',
            meta: { dormId, floorNumber, roomNumber }
        });
        
        res.json({ ok: true, room: newRoom });
    } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

// API lấy danh sách phòng theo tầng
router.get('/admin/dormitories/:dormId/floors/:floorNumber/rooms', isAdmin, async (req, res) => {
    try {
        const { dormId, floorNumber } = req.params;
        
        const dorm = await DormitoryCollection.findById(dormId);
        if (!dorm) return res.status(404).json({ error: 'Dormitory not found' });
        
        const floor = dorm.floors.find(f => f.floorNumber === parseInt(floorNumber));
        if (!floor) return res.status(404).json({ error: 'Floor not found' });
        
        const rooms = floor.rooms.map(r => {
            const activeOccupants = r.occupants.filter(o => o.active).length;
            return {
                roomNumber: r.roomNumber,
                type: r.type,
                genderPolicy: r.genderPolicy,
                maxCapacity: r.maxCapacity,
                currentOccupants: activeOccupants,
                pricePerMonth: r.pricePerMonth,
                status: r.status,
                occupants: r.occupants.filter(o => o.active).map(o => ({
                    studentId: o.studentId,
                    name: o.name,
                    email: o.email,
                    phone: o.phone,
                    since: o.since
                }))
            };
        });
        
        res.json(rooms);
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

// API lấy danh sách sinh viên trong KTX
router.get('/admin/dormitories/:dormId/students', isAdmin, async (req, res) => {
    try {
        const { dormId } = req.params;
        const { status = 'active' } = req.query;
        
        const dorm = await DormitoryCollection.findById(dormId);
        if (!dorm) return res.status(404).json({ error: 'Dormitory not found' });
        
        // Tìm tất cả sinh viên trong KTX
        const students = [];
        
        dorm.floors.forEach(floor => {
            floor.rooms.forEach(room => {
                const filteredOccupants = status === 'all' 
                    ? room.occupants 
                    : room.occupants.filter(o => status === 'active' ? o.active : !o.active);
                
                filteredOccupants.forEach(occupant => {
                    students.push({
                        studentId: occupant.studentId,
                        name: occupant.name,
                        email: occupant.email,
                        phone: occupant.phone,
                        floorNumber: floor.floorNumber,
                        roomNumber: room.roomNumber,
                        checkInDate: occupant.since,
                        active: occupant.active
                    });
                });
            });
        });
        
        res.json(students);
    } catch (error) {
        console.error('Error fetching dormitory students:', error);
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

module.exports = router;