const express = require('express');
const router = express.Router();
const AcademicPolicyModel = require('../../schemas/AcademicPolicySchema');
const { autoAssignFreshmen, getPriorityQueue } = require('../../services/academicYearService');
const { StudentCollection, DormitoryCollection } = require('../../config/config');

// Middleware kiểm tra admin
function isAdmin(req, res, next) {
    if (req.session && req.session.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Không có quyền truy cập' });
}

/**
 * GET /api/admin/academic-policies
 * Lấy danh sách tất cả chính sách năm học
 */
router.get('/admin/academic-policies', isAdmin, async (req, res) => {
    try {
        const policies = await AcademicPolicyModel.find()
            .sort({ academicYear: -1 });
        
        res.json({
            success: true,
            policies: policies,
            total: policies.length
        });
    } catch (error) {
        console.error('Error fetching academic policies:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi khi lấy danh sách chính sách' 
        });
    }
});

/**
 * GET /api/admin/academic-policies/:year
 * Lấy chi tiết chính sách của một năm học
 */
router.get('/admin/academic-policies/:year', isAdmin, async (req, res) => {
    try {
        const academicYear = req.params.year;
        const policy = await AcademicPolicyModel.findOne({ academicYear });
        
        if (!policy) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy chính sách cho năm học này' 
            });
        }
        
        res.json({
            success: true,
            policy: policy
        });
    } catch (error) {
        console.error('Error fetching policy:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi khi lấy chi tiết chính sách' 
        });
    }
});

/**
 * POST /api/admin/academic-policies
 * Tạo chính sách năm học mới
 */
router.post('/admin/academic-policies', isAdmin, async (req, res) => {
    try {
        const { academicYear, active, policies } = req.body;
        
        // Kiểm tra xem đã có chính sách cho năm này chưa
        const existing = await AcademicPolicyModel.findOne({ academicYear });
        if (existing) {
            return res.status(400).json({ 
                success: false, 
                error: 'Đã có chính sách cho năm học này' 
            });
        }
        
        // Tạo chính sách mới
        const newPolicy = await AcademicPolicyModel.create({
            academicYear,
            active: active !== undefined ? active : true,
            policies: policies,
            createdBy: req.session.userId
        });
        
        res.json({
            success: true,
            message: 'Đã tạo chính sách thành công',
            policy: newPolicy
        });
    } catch (error) {
        console.error('Error creating policy:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi khi tạo chính sách: ' + error.message 
        });
    }
});

/**
 * PUT /api/admin/academic-policies/:year
 * Cập nhật chính sách năm học
 */
router.put('/admin/academic-policies/:year', isAdmin, async (req, res) => {
    try {
        const academicYear = req.params.year;
        const updates = req.body;
        
        const policy = await AcademicPolicyModel.findOneAndUpdate(
            { academicYear },
            { ...updates, updatedAt: new Date() },
            { new: true }
        );
        
        if (!policy) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy chính sách' 
            });
        }
        
        res.json({
            success: true,
            message: 'Đã cập nhật chính sách thành công',
            policy: policy
        });
    } catch (error) {
        console.error('Error updating policy:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi khi cập nhật chính sách' 
        });
    }
});

/**
 * DELETE /api/admin/academic-policies/:year
 * Xóa chính sách năm học
 */
router.delete('/admin/academic-policies/:year', isAdmin, async (req, res) => {
    try {
        const academicYear = req.params.year;
        
        const policy = await AcademicPolicyModel.findOneAndDelete({ academicYear });
        
        if (!policy) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy chính sách' 
            });
        }
        
        res.json({
            success: true,
            message: 'Đã xóa chính sách thành công'
        });
    } catch (error) {
        console.error('Error deleting policy:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi khi xóa chính sách' 
        });
    }
});

/**
 * POST /api/admin/auto-assign-freshmen
 * Phân phòng tự động cho sinh viên năm 1
 */
router.post('/admin/auto-assign-freshmen', isAdmin, async (req, res) => {
    try {
        const { academicYear, dormitoryIds } = req.body;
        
        if (!academicYear) {
            return res.status(400).json({ 
                success: false, 
                error: 'Thiếu tham số academicYear' 
            });
        }
        
        const result = await autoAssignFreshmen(academicYear, dormitoryIds);
        
        res.json(result);
    } catch (error) {
        console.error('Error auto-assigning freshmen:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi khi phân phòng tự động: ' + error.message 
        });
    }
});

/**
 * GET /api/admin/priority-queue
 * Lấy hàng đợi ưu tiên sinh viên
 */
router.get('/admin/priority-queue', isAdmin, async (req, res) => {
    try {
        const { academicYear, yearGroup, faculty, gender } = req.query;
        
        const currentYear = academicYear || new Date().getFullYear().toString();
        
        const filters = {};
        if (yearGroup) filters.yearGroup = yearGroup;
        if (faculty) filters.faculty = faculty;
        if (gender) filters.gender = gender;
        
        const queue = await getPriorityQueue(currentYear, filters);
        
        res.json({
            success: true,
            queue: queue,
            total: queue.length,
            filters: filters
        });
    } catch (error) {
        console.error('Error getting priority queue:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi khi lấy hàng đợi ưu tiên' 
        });
    }
});

/**
 * POST /api/admin/bulk-room-assignment
 * Phân phòng hàng loạt theo hàng đợi ưu tiên
 */
router.post('/admin/bulk-room-assignment', isAdmin, async (req, res) => {
    try {
        const { studentIds, dormitoryId, autoDistribute } = req.body;
        
        if (!studentIds || studentIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Không có sinh viên nào được chọn' 
            });
        }
        
        let assignedCount = 0;
        const results = [];
        
        // Nếu autoDistribute, tự động phân bổ đều
        if (autoDistribute) {
            // Logic tương tự autoAssignFreshmen nhưng cho list studentIds
            // Tạm thời chưa implement đầy đủ
            return res.json({
                success: true,
                message: 'Tính năng đang được phát triển',
                assigned: 0
            });
        }
        
        // Nếu chỉ định dormitoryId cụ thể
        if (dormitoryId) {
            const dormitory = await DormitoryCollection.findById(dormitoryId);
            if (!dormitory) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Không tìm thấy ký túc xá' 
                });
            }
            
            // Phân phòng từng sinh viên
            for (const studentId of studentIds) {
                const student = await StudentCollection.findById(studentId);
                if (!student) continue;
                
                // Tìm phòng trống phù hợp
                let assigned = false;
                for (const floor of dormitory.floors) {
                    for (const room of floor.rooms) {
                        const activeOccupants = room.occupants.filter(o => o.active);
                        if (activeOccupants.length < room.maxCapacity) {
                            // Phân phòng
                            await StudentCollection.findByIdAndUpdate(studentId, {
                                dormitoryId: dormitoryId,
                                roomNumber: room.roomNumber,
                                registrationStatus: 'assigned_room'
                            });
                            
                            room.occupants.push({
                                studentId: student.studentId,
                                name: student.name,
                                phone: student.phone || '',
                                email: student.email || '',
                                checkInDate: new Date(),
                                active: true
                            });
                            
                            assignedCount++;
                            results.push({
                                studentId: student.studentId,
                                name: student.name,
                                room: `${dormitory.name} - Tầng ${floor.floorNumber} - Phòng ${room.roomNumber}`
                            });
                            
                            assigned = true;
                            break;
                        }
                    }
                    if (assigned) break;
                }
            }
            
            await dormitory.save();
        }
        
        res.json({
            success: true,
            message: `Đã phân phòng cho ${assignedCount}/${studentIds.length} sinh viên`,
            assigned: assignedCount,
            total: studentIds.length,
            results: results
        });
        
    } catch (error) {
        console.error('Error bulk assigning rooms:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi khi phân phòng hàng loạt' 
        });
    }
});

module.exports = router;