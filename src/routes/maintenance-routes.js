// src/routes/maintenance-routes.js
const express = require('express');
const router = express.Router();
const { MaintenanceRequestModel } = require('../schemas/ViolationSchema');
const { StudentCollection, DormitoryCollection } = require('../config/config');
const { validate } = require('../middleware/security');
const { body } = require('express-validator');

// Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Chưa đăng nhập' });
};

const isAdmin = (req, res, next) => {
    if (req.session && req.session.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Không có quyền truy cập' });
};

// ============================================
// STUDENT: CREATE MAINTENANCE REQUEST
// ============================================
router.post('/api/student/maintenance-requests',
    isAuthenticated,
    [
        body('title').isLength({ min: 5, max: 200 })
            .withMessage('Tiêu đề phải từ 5-200 ký tự'),
        body('description').isLength({ min: 10, max: 2000 })
            .withMessage('Mô tả phải từ 10-2000 ký tự'),
        body('type').isIn([
            'electrical', 'plumbing', 'hvac', 'furniture', 
            'door_lock', 'window', 'internet', 'cleaning', 
            'pest_control', 'other'
        ]).withMessage('Loại yêu cầu không hợp lệ'),
        body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
            .withMessage('Độ ưu tiên không hợp lệ'),
        validate
    ],
    async (req, res) => {
        try {
            const { title, description, type, priority, imageUrls } = req.body;
            
            // Get student info
            const student = await StudentCollection.findById(req.session.userId);
            if (!student) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Không tìm thấy thông tin sinh viên' 
                });
            }
            
            // Check if student has dormitory
            if (!student.dormitoryId || !student.roomNumber) {
                return res.status(400).json({
                    success: false,
                    error: 'Bạn chưa được phân phòng'
                });
            }
            
            // Get dormitory info
            const dormitory = await DormitoryCollection.findById(student.dormitoryId);
            if (!dormitory) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy thông tin ký túc xá'
                });
            }
            
            // Find floor number
            let floorNumber = 1;
            for (const floor of dormitory.floors) {
                const room = floor.rooms.find(r => r.roomNumber === student.roomNumber);
                if (room) {
                    floorNumber = floor.floorNumber;
                    break;
                }
            }
            
            // Create maintenance request
            const request = await MaintenanceRequestModel.create({
                dormitoryId: student.dormitoryId,
                dormitoryName: dormitory.name,
                floorNumber,
                roomNumber: student.roomNumber,
                type,
                title,
                description,
                priority: priority || 'medium',
                imageUrls: imageUrls || [],
                reportedBy: {
                    userId: student._id,
                    name: student.name,
                    studentId: student.studentId,
                    phone: student.phone
                },
                status: 'submitted'
            });
            
            res.status(201).json({
                success: true,
                message: 'Đã gửi yêu cầu bảo trì',
                request
            });
        } catch (error) {
            console.error('Error creating maintenance request:', error);
            res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
        }
    }
);

// ============================================
// STUDENT: GET MY MAINTENANCE REQUESTS
// ============================================
router.get('/api/student/maintenance-requests', isAuthenticated, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        
        const query = { 'reportedBy.userId': req.session.userId };
        if (status) query.status = status;
        
        const requests = await MaintenanceRequestModel
            .find(query)
            .sort({ reportedAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();
        
        const total = await MaintenanceRequestModel.countDocuments(query);
        
        res.json({
            success: true,
            requests,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching maintenance requests:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// ============================================
// STUDENT: SUBMIT FEEDBACK
// ============================================
router.post('/api/student/maintenance-requests/:id/feedback',
    isAuthenticated,
    [
        body('rating').isInt({ min: 1, max: 5 })
            .withMessage('Đánh giá phải từ 1-5 sao'),
        body('comment').optional().isLength({ max: 500 })
            .withMessage('Bình luận không được quá 500 ký tự'),
        validate
    ],
    async (req, res) => {
        try {
            const { rating, comment } = req.body;
            
            const request = await MaintenanceRequestModel.findOne({
                _id: req.params.id,
                'reportedBy.userId': req.session.userId,
                status: 'completed'
            });
            
            if (!request) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy yêu cầu hoặc chưa hoàn thành'
                });
            }
            
            request.feedbackRating = rating;
            request.feedbackComment = comment;
            await request.save();
            
            res.json({
                success: true,
                message: 'Cảm ơn bạn đã đánh giá'
            });
        } catch (error) {
            console.error('Error submitting feedback:', error);
            res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
        }
    }
);

// ============================================
// ADMIN: GET ALL MAINTENANCE REQUESTS
// ============================================
router.get('/admin/maintenance-requests', isAdmin, async (req, res) => {
    try {
        const {
            status,
            priority,
            type,
            dormitoryId,
            page = 1,
            limit = 20,
            sortBy = 'reportedAt',
            sortOrder = 'desc'
        } = req.query;
        
        const query = {};
        if (status) query.status = status;
        if (priority) query.priority = priority;
        if (type) query.type = type;
        if (dormitoryId) query.dormitoryId = dormitoryId;
        
        const requests = await MaintenanceRequestModel
            .find(query)
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();
        
        const total = await MaintenanceRequestModel.countDocuments(query);
        
        res.json({
            success: true,
            requests,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching maintenance requests:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// ============================================
// ADMIN: GET SINGLE REQUEST
// ============================================
router.get('/admin/maintenance-requests/:id', isAdmin, async (req, res) => {
    try {
        const request = await MaintenanceRequestModel.findById(req.params.id);
        
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Không tìm thấy yêu cầu'
            });
        }
        
        res.json({ success: true, request });
    } catch (error) {
        console.error('Error fetching maintenance request:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// ============================================
// ADMIN: ASSIGN STAFF TO REQUEST
// ============================================
router.patch('/admin/maintenance-requests/:id/assign',
    isAdmin,
    [
        body('staffId').notEmpty().withMessage('Phải chọn nhân viên'),
        body('staffName').notEmpty().withMessage('Tên nhân viên không được trống'),
        body('staffPhone').optional(),
        validate
    ],
    async (req, res) => {
        try {
            const { staffId, staffName, staffPhone } = req.body;
            
            const request = await MaintenanceRequestModel.findByIdAndUpdate(
                req.params.id,
                {
                    status: 'assigned',
                    assignedTo: {
                        staffId,
                        name: staffName,
                        phone: staffPhone
                    },
                    assignedBy: {
                        adminId: req.session.userId,
                        name: req.session.name
                    },
                    assignedAt: new Date(),
                    updatedAt: new Date()
                },
                { new: true }
            );
            
            if (!request) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy yêu cầu'
                });
            }
            
            res.json({
                success: true,
                message: 'Đã phân công nhân viên',
                request
            });
        } catch (error) {
            console.error('Error assigning staff:', error);
            res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
        }
    }
);

// ============================================
// ADMIN: UPDATE REQUEST STATUS
// ============================================
router.patch('/admin/maintenance-requests/:id/status',
    isAdmin,
    [
        body('status').isIn(['submitted', 'assigned', 'in_progress', 'completed', 'cancelled'])
            .withMessage('Trạng thái không hợp lệ'),
        validate
    ],
    async (req, res) => {
        try {
            const { status } = req.body;
            
            const updateData = {
                status,
                updatedAt: new Date()
            };
            
            if (status === 'in_progress' && !req.body.noTimestamp) {
                updateData.startedAt = new Date();
            }
            
            if (status === 'completed') {
                updateData.completedAt = new Date();
            }
            
            const request = await MaintenanceRequestModel.findByIdAndUpdate(
                req.params.id,
                updateData,
                { new: true }
            );
            
            if (!request) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy yêu cầu'
                });
            }
            
            res.json({
                success: true,
                message: 'Đã cập nhật trạng thái',
                request
            });
        } catch (error) {
            console.error('Error updating status:', error);
            res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
        }
    }
);

// ============================================
// ADMIN: COMPLETE REQUEST
// ============================================
router.patch('/admin/maintenance-requests/:id/complete',
    isAdmin,
    [
        body('completionNotes').optional().isLength({ max: 1000 })
            .withMessage('Ghi chú không được quá 1000 ký tự'),
        body('actualCost').optional().isNumeric()
            .withMessage('Chi phí phải là số'),
        validate
    ],
    async (req, res) => {
        try {
            const { completionNotes, actualCost } = req.body;
            
            const request = await MaintenanceRequestModel.findByIdAndUpdate(
                req.params.id,
                {
                    status: 'completed',
                    completedAt: new Date(),
                    completionNotes,
                    actualCost: actualCost || 0,
                    updatedAt: new Date()
                },
                { new: true }
            );
            
            if (!request) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy yêu cầu'
                });
            }
            
            res.json({
                success: true,
                message: 'Đã hoàn thành yêu cầu',
                request
            });
        } catch (error) {
            console.error('Error completing request:', error);
            res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
        }
    }
);

// ============================================
// ADD UPDATE TO REQUEST
// ============================================
router.post('/admin/maintenance-requests/:id/updates',
    isAdmin,
    [
        body('message').isLength({ min: 5, max: 500 })
            .withMessage('Tin nhắn phải từ 5-500 ký tự'),
        validate
    ],
    async (req, res) => {
        try {
            const { message, imageUrls } = req.body;
            
            const request = await MaintenanceRequestModel.findByIdAndUpdate(
                req.params.id,
                {
                    $push: {
                        updates: {
                            addedBy: {
                                userId: req.session.userId,
                                name: req.session.name,
                                role: 'admin'
                            },
                            message,
                            imageUrls: imageUrls || [],
                            addedAt: new Date()
                        }
                    },
                    updatedAt: new Date()
                },
                { new: true }
            );
            
            if (!request) {
                return res.status(404).json({
                    success: false,
                    error: 'Không tìm thấy yêu cầu'
                });
            }
            
            res.json({
                success: true,
                message: 'Đã thêm cập nhật',
                request
            });
        } catch (error) {
            console.error('Error adding update:', error);
            res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
        }
    }
);

// ============================================
// GET MAINTENANCE STATISTICS
// ============================================
router.get('/admin/maintenance-requests/stats/summary', isAdmin, async (req, res) => {
    try {
        const { dormitoryId } = req.query;
        const match = dormitoryId ? { dormitoryId } : {};
        
        const stats = await MaintenanceRequestModel.aggregate([
            { $match: match },
            {
                $facet: {
                    byStatus: [
                        { $group: { _id: '$status', count: { $sum: 1 } } }
                    ],
                    byPriority: [
                        { $group: { _id: '$priority', count: { $sum: 1 } } }
                    ],
                    byType: [
                        { $group: { _id: '$type', count: { $sum: 1 } } }
                    ],
                    avgCost: [
                        { 
                            $group: { 
                                _id: null, 
                                avg: { $avg: '$actualCost' },
                                total: { $sum: '$actualCost' }
                            } 
                        }
                    ],
                    avgRating: [
                        {
                            $match: { feedbackRating: { $exists: true } }
                        },
                        {
                            $group: {
                                _id: null,
                                avg: { $avg: '$feedbackRating' }
                            }
                        }
                    ]
                }
            }
        ]);
        
        res.json({ success: true, stats: stats[0] });
    } catch (error) {
        console.error('Error fetching maintenance stats:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

module.exports = router;