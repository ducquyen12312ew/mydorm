const express = require('express');
const router = express.Router();
const { StudentCollection, DormitoryCollection, PendingApplicationCollection } = require('../../config/config');
const { 
    checkRegistrationEligibility,
    getAvailableRoomsForYear,
    determineYearGroup 
} = require('../../services/academicYearService');
const { 
    canSelectRoom, 
    canViewFullRoomList 
} = require('../../middleware/yearGroupAccess');

// Middleware kiểm tra đăng nhập
function requireLogin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Chưa đăng nhập', requireLogin: true });
    }
    next();
}

/**
 * GET /api/student/registration-eligibility
 * Kiểm tra sinh viên có đủ điều kiện đăng ký không
 */
router.get('/student/registration-eligibility', requireLogin, async (req, res) => {
    try {
        const userId = req.session.userId;
        const student = await StudentCollection.findById(userId);
        
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy thông tin sinh viên' 
            });
        }
        
        const currentYear = new Date().getFullYear().toString();
        const eligibility = await checkRegistrationEligibility(student, currentYear);
        const yearGroup = determineYearGroup(student.academicYear);
        
        res.json({
            success: true,
            eligible: eligibility.eligible,
            reason: eligibility.reason,
            yearGroup: yearGroup,
            canChooseRoom: eligibility.canChooseRoom || false,
            autoAssign: eligibility.autoAssign || false,
            policy: eligibility.policy,
            studentInfo: {
                studentId: student.studentId,
                name: student.name,
                academicYear: student.academicYear,
                faculty: student.faculty,
                gender: student.gender,
                registrationStatus: student.registrationStatus
            }
        });
        
    } catch (error) {
        console.error('Error checking registration eligibility:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

/**
 * GET /api/student/available-rooms
 * Lấy danh sách phòng khả dụng theo năm học
 */
router.get('/student/available-rooms', requireLogin, canViewFullRoomList, async (req, res) => {
    try {
        const student = req.studentInfo.student;
        const yearGroup = req.studentInfo.yearGroup;
        
        const currentYear = new Date().getFullYear().toString();
        
        const preferences = {
            preferredBuildings: student.roomPreferences?.preferredBuildings || [],
            preferredFloorRange: student.roomPreferences?.preferredFloorRange || { min: 1, max: 10 }
        };
        
        const availableRooms = await getAvailableRoomsForYear(
            yearGroup, 
            student.gender, 
            preferences,
            currentYear
        );
        
        res.json({
            success: true,
            rooms: availableRooms,
            total: availableRooms.length,
            yearGroup: yearGroup,
            message: yearGroup === 1 
                ? 'Bạn là sinh viên năm 1, phòng sẽ được phân tự động'
                : yearGroup === 2 
                ? 'Bạn có thể chọn phòng từ danh sách dưới đây'
                : 'Bạn có quyền ưu tiên cao trong việc chọn phòng'
        });
        
    } catch (error) {
        console.error('Error getting available rooms:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

/**
 * POST /api/student/room-selection
 * Sinh viên chọn phòng (chỉ năm 2+)
 */
router.post('/student/room-selection', requireLogin, canSelectRoom, async (req, res) => {
    try {
        const student = req.studentInfo.student;
        const { dormitoryId, floorNumber, roomNumber } = req.body;
        
        if (!dormitoryId || !floorNumber || !roomNumber) {
            return res.status(400).json({ 
                success: false, 
                error: 'Thiếu thông tin phòng' 
            });
        }
        
        // Kiểm tra phòng tồn tại và còn chỗ
        const dorm = await DormitoryCollection.findById(dormitoryId);
        if (!dorm) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy ký túc xá' 
            });
        }
        
        const floor = dorm.floors.find(f => f.floorNumber === parseInt(floorNumber));
        if (!floor) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy tầng' 
            });
        }
        
        const room = floor.rooms.find(r => r.roomNumber === roomNumber);
        if (!room) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy phòng' 
            });
        }
        
        const activeOccupants = room.occupants.filter(o => o.active);
        const availableSpots = room.maxCapacity - activeOccupants.length;
        
        if (availableSpots <= 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Phòng đã đầy' 
            });
        }
        
        // Tạo đơn đăng ký
        const currentYear = new Date().getFullYear().toString();
        const existingApplication = await PendingApplicationCollection.findOne({
            studentId: student.studentId,
            academicYear: currentYear,
            status: { $in: ['pending_review', 'approved_waiting_payment'] }
        });
        
        let application;
        
        if (existingApplication) {
            existingApplication.selectedRoom = {
                dormitoryId: dormitoryId,
                floorNumber: parseInt(floorNumber),
                roomNumber: roomNumber
            };
            existingApplication.updatedAt = new Date();
            await existingApplication.save();
            application = existingApplication;
        } else {
            application = await PendingApplicationCollection.create({
                studentObjectId: student._id,
                studentId: student.studentId,
                name: student.name,
                email: student.email,
                phone: student.phone,
                gender: student.gender,
                faculty: student.faculty,
                academicYear: currentYear,
                status: 'pending_review',
                preferredDormitories: [dormitoryId],
                selectedRoom: {
                    dormitoryId: dormitoryId,
                    floorNumber: parseInt(floorNumber),
                    roomNumber: roomNumber
                },
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
        
        res.json({
            success: true,
            message: 'Đã chọn phòng thành công. Vui lòng chờ admin duyệt.',
            application: {
                id: application._id,
                status: application.status,
                selectedRoom: application.selectedRoom,
                dormitoryName: dorm.name
            }
        });
        
    } catch (error) {
        console.error('Error selecting room:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

module.exports = router;