const express = require('express');
const router = express.Router();
const { ViolationModel } = require('../../schemas/ViolationSchema');
const { StudentCollection } = require('../../config/config');
const { validate, validationRules } = require('../../middleware/security');
const { body } = require('express-validator');
const notificationService = require('../../services/notificationService');
const { logger, logSecurityEvent } = require('../../config/logger');

// Middleware kiểm tra admin
const isAdmin = (req, res, next) => {
    if (req.session && req.session.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Không có quyền truy cập' });
};

// ============================================
// GET ALL VIOLATIONS (with filters)
// ============================================
router.get('/admin/violations', isAdmin, async (req, res) => {
    try {
        const { 
            status, 
            severity, 
            type, 
            studentId, 
            dormitoryId,
            page = 1, 
            limit = 20,
            sortBy = 'reportedAt',
            sortOrder = 'desc'
        } = req.query;
        
        // Build query
        const query = {};
        if (status) query.status = status;
        if (severity) query.severity = severity;
        if (type) query.type = type;
        if (studentId) query.studentId = studentId;
        if (dormitoryId) query.dormitoryId = dormitoryId;
        
        // Execute query with pagination
        const violations = await ViolationModel
            .find(query)
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();
        
        const total = await ViolationModel.countDocuments(query);
        
        res.json({
            success: true,
            violations,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching violations:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// ============================================
// GET SINGLE VIOLATION
// ============================================
router.get('/admin/violations/:id', isAdmin, async (req, res) => {
    try {
        const violation = await ViolationModel.findById(req.params.id);
        
        if (!violation) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy vi phạm' 
            });
        }
        
        res.json({ success: true, violation });
    } catch (error) {
        console.error('Error fetching violation:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// ============================================
// CREATE VIOLATION
// ============================================
router.post('/admin/violations', 
    isAdmin,
    [
        body('studentId').notEmpty().withMessage('Mã sinh viên không được trống'),
        body('type').isIn([
            'noise', 'alcohol', 'smoking', 'late_return', 
            'unauthorized_guest', 'damage', 'hygiene', 'theft', 
            'violence', 'other'
        ]).withMessage('Loại vi phạm không hợp lệ'),
        body('description').isLength({ min: 10, max: 2000 })
            .withMessage('Mô tả phải từ 10-2000 ký tự'),
        body('severity').isIn(['low', 'medium', 'high', 'critical'])
            .withMessage('Mức độ nghiêm trọng không hợp lệ'),
        validate
    ],
    async (req, res) => {
        try {
            const { 
                studentId, 
                type, 
                description, 
                severity, 
                evidenceUrls,
                dormitoryId,
                dormitoryName,
                roomNumber
            } = req.body;
            
            // Verify student exists
            const student = await StudentCollection.findOne({ studentId });
            if (!student) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Không tìm thấy sinh viên' 
                });
            }
            
            // Create violation
            const violation = await ViolationModel.create({
                studentId,
                studentObjectId: student._id,
                studentName: student.name,
                dormitoryId: dormitoryId || student.dormitoryId,
                dormitoryName,
                roomNumber: roomNumber || student.roomNumber,
                type,
                description,
                severity,
                evidenceUrls: evidenceUrls || [],
                reportedBy: {
                    userId: req.session.userId,
                    name: req.session.name,
                    role: 'admin'
                },
                status: 'pending'
            });

            // ✅ Send violation notification email
            try {
                const violationTypes = {
                    'noise': 'Vi phạm về tiếng ồn',
                    'alcohol': 'Sử dụng chất cồn',
                    'smoking': 'Hút thuốc',
                    'late_return': 'Quay lại muộn',
                    'unauthorized_guest': 'Khách lạ trái phép',
                    'damage': 'Gây hư hỏng',
                    'hygiene': 'Vệ sinh kém',
                    'theft': 'Trộm cắp',
                    'violence': 'Bạo lực',
                    'other': 'Vi phạm khác'
                };

                const severityLabels = {
                    'low': 'Thấp',
                    'medium': 'Trung bình',
                    'high': 'Cao',
                    'critical': 'Rất nghiêm trọng'
                };

                const violationData = {
                    studentName: student.name,
                    studentId: student.studentId,
                    type: violationTypes[type] || type,
                    severity: severityLabels[severity] || severity,
                    description: description,
                    dormitory: dormitoryName,
                    room: roomNumber,
                    reportedAt: new Date().toLocaleString('vi-VN'),
                    reportedBy: req.session.name
                };

                await notificationService.sendViolationNotification(student.email, violationData);
                logSecurityEvent(student._id, 'VIOLATION_NOTIFICATION_SENT', { 
                    violationId: violation._id,
                    ip: req.ip
                });
            } catch (emailError) {
                logger.error('Failed to send violation notification', { 
                    violationId: violation._id, 
                    error: emailError.message 
                });
            }
            
            res.status(201).json({ 
                success: true, 
                message: 'Đã tạo báo cáo vi phạm và gửi thông báo cho sinh viên',
                violation 
            });
        } catch (error) {
            console.error('Error creating violation:', error);
            res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
        }
    }
);

// ============================================
// UPDATE VIOLATION STATUS
// ============================================
router.patch('/admin/violations/:id/status', 
    isAdmin,
    [
        body('status').isIn(['pending', 'resolved', 'dismissed'])
            .withMessage('Trạng thái không hợp lệ'),
        validate
    ],
    async (req, res) => {
        try {
            const { status } = req.body;
            
            logger.info(`Updating violation ${req.params.id} status`, { status });
            
            const violation = await ViolationModel.findByIdAndUpdate(
                req.params.id,
                { 
                    status,
                    updatedAt: new Date()
                },
                { new: true }
            );
            
            if (!violation) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Không tìm thấy vi phạm' 
                });
            }
            
            logger.info(`Successfully updated violation status`, { status: violation.status, violationId: req.params.id });
            
            res.json({ 
                success: true, 
                message: 'Đã cập nhật trạng thái',
                violation 
            });
        } catch (error) {
            console.error('Error updating violation status:', error);
            res.status(500).json({ success: false, error: 'Lỗi hệ thống', details: error.message });
        }
    }
);

// ============================================
// RESOLVE VIOLATION
// ============================================
router.patch('/admin/violations/:id/resolve',
    isAdmin,
    [
        body('action').isIn(['warning', 'fine', 'suspension', 'expulsion', 'dismissed'])
            .withMessage('Hành động không hợp lệ'),
        body('notes').optional().isLength({ max: 1000 })
            .withMessage('Ghi chú không được quá 1000 ký tự'),
        body('fineAmount').optional().isNumeric()
            .withMessage('Số tiền phạt phải là số'),
        validate
    ],
    async (req, res) => {
        try {
            const { action, notes, fineAmount } = req.body;
            
            const violation = await ViolationModel.findByIdAndUpdate(
                req.params.id,
                {
                    status: 'resolved',
                    resolvedBy: {
                        userId: req.session.userId,
                        name: req.session.name
                    },
                    resolvedAt: new Date(),
                    resolution: {
                        action,
                        notes,
                        fineAmount: fineAmount || 0
                    },
                    updatedAt: new Date()
                },
                { new: true }
            );
            
            if (!violation) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Không tìm thấy vi phạm' 
                });
            }
            
            res.json({ 
                success: true, 
                message: 'Đã xử lý vi phạm',
                violation 
            });
        } catch (error) {
            console.error('Error resolving violation:', error);
            res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
        }
    }
);

// ============================================
// ADD INVESTIGATION NOTE
// ============================================
router.post('/admin/violations/:id/notes',
    isAdmin,
    [
        body('note').isLength({ min: 5, max: 1000 })
            .withMessage('Ghi chú phải từ 5-1000 ký tự'),
        validate
    ],
    async (req, res) => {
        try {
            const { note } = req.body;
            
            const violation = await ViolationModel.findByIdAndUpdate(
                req.params.id,
                {
                    $push: {
                        investigationNotes: {
                            addedBy: {
                                userId: req.session.userId,
                                name: req.session.name
                            },
                            note,
                            addedAt: new Date()
                        }
                    },
                    updatedAt: new Date()
                },
                { new: true }
            );
            
            if (!violation) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Không tìm thấy vi phạm' 
                });
            }
            
            res.json({ 
                success: true, 
                message: 'Đã thêm ghi chú',
                violation 
            });
        } catch (error) {
            console.error('Error adding note:', error);
            res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
        }
    }
);

// ============================================
// GET VIOLATION STATISTICS
// ============================================
router.get('/admin/violations/stats/summary', isAdmin, async (req, res) => {
    try {
        const { dormitoryId } = req.query;
        const match = dormitoryId ? { dormitoryId } : {};
        
        const stats = await ViolationModel.aggregate([
            { $match: match },
            {
                $facet: {
                    byStatus: [
                        { $group: { _id: '$status', count: { $sum: 1 } } }
                    ],
                    bySeverity: [
                        { $group: { _id: '$severity', count: { $sum: 1 } } }
                    ],
                    byType: [
                        { $group: { _id: '$type', count: { $sum: 1 } } }
                    ],
                    total: [
                        { $count: 'count' }
                    ]
                }
            }
        ]);
        
        res.json({ success: true, stats: stats[0] });
    } catch (error) {
        console.error('Error fetching violation stats:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// ============================================
// DELETE VIOLATION
// ============================================
router.delete('/admin/violations/:id', isAdmin, async (req, res) => {
    try {
        const violationId = req.params.id;
        
        logger.info(`Deleting violation ${violationId}`);
        
        const violation = await ViolationModel.findByIdAndDelete(violationId);
        
        if (!violation) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy vi phạm' 
            });
        }
        
        logger.info(`Successfully deleted violation ${violationId}`);
        
        logSecurityEvent(req.session.userId, 'DELETE_VIOLATION', {
            violationId: violationId,
            studentId: violation.studentId,
            type: violation.type,
            severity: violation.severity,
            ip: req.ip
        });
        
        res.json({ 
            success: true, 
            message: 'Đã xóa vi phạm' 
        });
    } catch (error) {
        console.error('Error deleting violation:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống', details: error.message });
    }
});

module.exports = router;