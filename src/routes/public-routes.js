const express = require('express');
const router = express.Router();
const { DormitoryCollection, StudentCollection } = require('../config/config');
const { logger } = require('../config/logger');
const { isAuthenticated } = require('../middleware/auth');

// ============================================
// PUBLIC PAGE RENDERS
// ============================================

router.get('/map', async (req, res) => {
    if (req.session && req.session.userId && req.session.role !== 'admin') {
        return res.render('student/list', {
            user: { name: req.session.name, role: req.session.role, id: req.session.userId }
        });
    }
    try {
        const dormitories = await DormitoryCollection.find({
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
        });
        res.render('public/map', { dormitories: JSON.stringify(dormitories) });
    } catch (error) {
        logger.error('Error fetching dormitories for map', { error: error.message });
        res.render('public/map', { dormitories: '[]' });
    }
});

router.get('/room/:dormId/:roomId', (req, res) => {
    res.render('public/room-detail', { user: req.session.user });
});

router.get('/dormitory/:id', async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id);
        if (!dormitory) return res.status(404).render('404', { message: 'Ký túc xá không tìm thấy' });
        res.render('public/dormitory-detail', { dormitory });
    } catch (error) {
        logger.error('Error fetching dormitory detail', { error: error.message });
        res.status(500).render('404', { message: 'Lỗi khi tải thông tin ký túc xá' });
    }
});

router.get('/student/maintenance-requests', isAuthenticated, async (req, res) => {
    try {
        const student = await StudentCollection.findById(req.session.userId).lean();
        res.render('student/maintenance-requests', {
            student,
            user: { name: req.session.name, role: req.session.role, id: req.session.userId }
        });
    } catch (error) {
        logger.error('Error loading student maintenance page', { error: error.message });
        res.render('student/maintenance-requests', {
            student: null,
            user: { name: req.session.name, role: req.session.role, id: req.session.userId }
        });
    }
});

// ============================================
// PUBLIC API ENDPOINTS
// ============================================

router.get('/api/featured-dormitories', async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find().limit(5);
        res.json(dormitories);
    } catch (error) {
        logger.error('Error fetching featured dormitories', { error: error.message });
        res.status(500).json({ error: 'Không thể lấy dữ liệu ký túc xá nổi bật' });
    }
});

router.get('/api/dormitories', async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find({
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
        }).lean();
        logger.info(`Found ${dormitories.length} dormitories`);
        res.json({ success: true, dormitories });
    } catch (error) {
        logger.error('Error fetching dormitories', { error: error.message });
        res.status(500).json({ success: false, error: 'Không thể lấy dữ liệu ký túc xá' });
    }
});

router.get('/api/map-data', async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find({
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
        }).lean();
        res.json({ success: true, dormitories });
    } catch (error) {
        logger.error('Error fetching map data', { error: error.message });
        res.status(500).json({ success: false, error: 'Không thể lấy dữ liệu bản đồ' });
    }
});

router.get('/api/dormitories/:id', async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id).lean();
        if (!dormitory) return res.status(404).json({ success: false, error: 'Ký túc xá không tìm thấy' });
        res.json({ success: true, dormitory });
    } catch (error) {
        logger.error('Error fetching dormitory', { error: error.message });
        res.status(500).json({ success: false, error: 'Không thể lấy dữ liệu ký túc xá' });
    }
});

router.get('/api/dormitories/:id/rooms', async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id).lean();
        if (!dormitory) return res.status(404).json({ success: false, error: 'Ký túc xá không tìm thấy' });

        let allRooms = [];
        if (dormitory.floors && Array.isArray(dormitory.floors)) {
            dormitory.floors.forEach(floor => {
                if (floor.rooms && Array.isArray(floor.rooms)) {
                    allRooms = allRooms.concat(floor.rooms);
                }
            });
        }

        logger.info(`Dormitory ${req.params.id} (${dormitory.name}) has ${allRooms.length} rooms total`);
        res.json({ success: true, rooms: allRooms });
    } catch (error) {
        logger.error('Error fetching rooms', { error: error.message });
        res.status(500).json({ success: false, error: 'Không thể lấy dữ liệu phòng' });
    }
});

router.get('/api/student/profile', isAuthenticated, async (req, res) => {
    try {
        const student = await StudentCollection.findById(req.session.userId).lean();
        if (!student) return res.status(404).json({ success: false, error: 'Sinh viên không tìm thấy' });
        res.json({
            success: true,
            student: {
                studentId: student.studentId,
                name: student.name,
                major: student.major,
                cohort: student.cohort,
                email: student.email,
                phone: student.phone
            }
        });
    } catch (error) {
        logger.error('Error fetching student profile', { error: error.message });
        res.status(500).json({ success: false, error: 'Không thể lấy thông tin sinh viên' });
    }
});

module.exports = router;
