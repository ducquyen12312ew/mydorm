/**
 * YEAR GROUP ACCESS MIDDLEWARE
 * Middleware kiểm tra quyền truy cập theo nhóm năm học
 */

const { StudentCollection } = require('../config/config');
const { determineYearGroup, checkRegistrationEligibility } = require('../services/academicYearService');

/**
 * Middleware: Kiểm tra sinh viên có quyền chọn phòng không
 * Chỉ năm 2+ mới được tự chọn phòng
 */
async function canSelectRoom(req, res, next) {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Chưa đăng nhập' 
            });
        }
        
        const student = await StudentCollection.findById(req.session.userId);
        
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy thông tin sinh viên' 
            });
        }
        
        const yearGroup = determineYearGroup(student.academicYear);
        
        // Năm 1 không được tự chọn phòng
        if (yearGroup === 1) {
            return res.status(403).json({ 
                success: false, 
                error: 'Sinh viên năm 1 không được tự chọn phòng. Phòng sẽ được phân tự động.' 
            });
        }
        
        // Kiểm tra điều kiện đăng ký
        const currentYear = new Date().getFullYear().toString();
        const eligibility = await checkRegistrationEligibility(student, currentYear);
        
        if (!eligibility.eligible) {
            return res.status(403).json({ 
                success: false, 
                error: eligibility.reason 
            });
        }
        
        if (!eligibility.canChooseRoom) {
            return res.status(403).json({ 
                success: false, 
                error: 'Chính sách hiện tại không cho phép bạn tự chọn phòng' 
            });
        }
        
        // Lưu thông tin vào request để sử dụng ở route handler
        req.studentInfo = {
            student: student,
            yearGroup: yearGroup,
            eligibility: eligibility
        };
        
        next();
        
    } catch (error) {
        console.error('Error in canSelectRoom middleware:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi hệ thống' 
        });
    }
}

/**
 * Middleware: Kiểm tra sinh viên có quyền đổi phòng không
 * Chỉ năm 4+ mới được đổi phòng
 */
async function canChangeRoom(req, res, next) {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Chưa đăng nhập' 
            });
        }
        
        const student = await StudentCollection.findById(req.session.userId);
        
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy thông tin sinh viên' 
            });
        }
        
        const yearGroup = determineYearGroup(student.academicYear);
        
        // Chỉ năm 4+ mới được đổi phòng
        if (yearGroup !== 3) {
            return res.status(403).json({ 
                success: false, 
                error: 'Chỉ sinh viên năm 4 trở lên mới được đổi phòng' 
            });
        }
        
        // Kiểm tra sinh viên đã có phòng chưa
        if (!student.dormitoryId || !student.roomNumber) {
            return res.status(400).json({ 
                success: false, 
                error: 'Bạn chưa được phân phòng nên không thể đổi phòng' 
            });
        }
        
        // Lưu thông tin vào request
        req.studentInfo = {
            student: student,
            yearGroup: yearGroup
        };
        
        next();
        
    } catch (error) {
        console.error('Error in canChangeRoom middleware:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi hệ thống' 
        });
    }
}

/**
 * Middleware: Kiểm tra sinh viên có quyền xem danh sách phòng đầy đủ không
 * Năm 1 không xem được, năm 2-3 xem giới hạn, năm 4+ xem tất cả
 */
async function canViewFullRoomList(req, res, next) {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Chưa đăng nhập' 
            });
        }
        
        const student = await StudentCollection.findById(req.session.userId);
        
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy thông tin sinh viên' 
            });
        }
        
        const yearGroup = determineYearGroup(student.academicYear);
        
        // Năm 1 không được xem danh sách phòng
        if (yearGroup === 1) {
            return res.status(403).json({ 
                success: false, 
                error: 'Sinh viên năm 1 không có quyền xem danh sách phòng. Phòng sẽ được phân tự động.' 
            });
        }
        
        // Lưu thông tin vào request
        req.studentInfo = {
            student: student,
            yearGroup: yearGroup
        };
        
        next();
        
    } catch (error) {
        console.error('Error in canViewFullRoomList middleware:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi hệ thống' 
        });
    }
}

/**
 * Middleware: Load thông tin sinh viên và year group
 * Sử dụng cho các route cần thông tin này
 */
async function loadStudentYearGroup(req, res, next) {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Chưa đăng nhập' 
            });
        }
        
        const student = await StudentCollection.findById(req.session.userId);
        
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy thông tin sinh viên' 
            });
        }
        
        const yearGroup = determineYearGroup(student.academicYear);
        
        req.studentInfo = {
            student: student,
            yearGroup: yearGroup
        };
        
        next();
        
    } catch (error) {
        console.error('Error in loadStudentYearGroup middleware:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi hệ thống' 
        });
    }
}

module.exports = {
    canSelectRoom,
    canChangeRoom,
    canViewFullRoomList,
    loadStudentYearGroup
};