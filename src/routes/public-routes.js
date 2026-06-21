const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { DormitoryCollection, StudentCollection } = require('../config/config');
const { logger } = require('../config/logger');
const { isAuthenticated } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');

// ─── QR token verification (mirrors qr.routes.js) ───────────────────────────
const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET || 'fallback-qr-secret-change-me';

function verifyToken(token) {
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx === -1) throw new Error('Malformed token');
    const dataPart = token.slice(0, dotIdx);
    const sigPart  = token.slice(dotIdx + 1);
    const expectedSig = crypto.createHmac('sha256', QR_SECRET)
        .update(Buffer.from(dataPart, 'base64url').toString())
        .digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sigPart, 'hex'), Buffer.from(expectedSig, 'hex'))) {
        throw new Error('Invalid signature');
    }
    const payload = JSON.parse(Buffer.from(dataPart, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
    return payload;
}

// ============================================
// PUBLIC PAGE RENDERS
// ============================================

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

router.get('/vr-tour', (req, res) => {
    res.render('student/vr-tour');
});

router.get('/vr-tour2', (req, res) => {
    res.render('student/vr-tour2');
});

router.get('/vr-tour/b2-explore', (req, res) => {
    res.render('student/b2-explore');
});

router.get('/notifications', isAuthenticated, async (req, res) => {
    try {
        const student = await StudentCollection.findById(req.session.userId).lean();
        res.render('student/notifications', {
            student,
            user: { name: req.session.name, role: req.session.role, id: req.session.userId }
        });
    } catch (error) {
        logger.error('Error loading notifications page', { error: error.message });
        res.render('student/notifications', {
            student: null,
            user: { name: req.session.name, role: req.session.role, id: req.session.userId }
        });
    }
});

router.get('/student/maintenance-requests', isAuthenticated, (req, res) => {
    res.redirect('/student/service-requests?tab=maintenance');
});

router.get('/student/notifications', isAuthenticated, (req, res) => {
    res.redirect('/notifications');
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

        let dormName = null;
        if (student.dormitoryId) {
            const dorm = await DormitoryCollection.findById(student.dormitoryId).select('name').lean();
            if (dorm) dormName = dorm.name;
        }

        res.json({
            success: true,
            student: {
                studentId: student.studentId,
                name: student.name,
                major: student.major,
                cohort: student.cohort,
                email: student.email,
                phone: student.phone,
                avatar: student.avatar || null,
                roomNumber: student.roomNumber || null,
                dormName: dormName,
                enrollmentYear: student.enrollmentYear || null,
                createdAt: student.createdAt || null
            }
        });
    } catch (error) {
        logger.error('Error fetching student profile', { error: error.message });
        res.status(500).json({ success: false, error: 'Không thể lấy thông tin sinh viên' });
    }
});

router.post('/api/student/avatar', isAuthenticated, uploadAvatar.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'Không có file ảnh' });
        const avatarUrl = req.file.path || req.file.secure_url;
        await StudentCollection.findByIdAndUpdate(req.session.userId, { avatar: avatarUrl });
        res.json({ success: true, avatarUrl });
    } catch (error) {
        logger.error('Error uploading avatar', { error: error.message });
        res.status(500).json({ success: false, error: 'Không thể tải lên ảnh đại diện' });
    }
});

// ============================================
// PUBLIC QR VERIFICATION PAGE
// ============================================
router.get('/verify/:token', async (req, res) => {
    let payload;
    try {
        payload = verifyToken(req.params.token);
    } catch (e) {
        const reason = e.message === 'Token expired' ? 'expired' : 'invalid';
        return res.render('public/verify-card', { valid: false, reason, student: null, dormName: null, payload: null, scannedAt: null });
    }

    try {
        const student = await StudentCollection.findById(payload.sub)
            .select('name studentId dormitoryId roomNumber faculty academicYear phone email gender nationality enrollmentYear')
            .lean();

        if (!student) {
            return res.render('public/verify-card', { valid: false, reason: 'invalid', student: null, dormName: null, payload: null, scannedAt: null });
        }

        let dormName = null;
        if (student.dormitoryId) {
            const dorm = await DormitoryCollection.findById(student.dormitoryId).select('name').lean();
            if (dorm) dormName = dorm.name;
        }

        return res.render('public/verify-card', {
            valid: true,
            student,
            dormName,
            payload,
            scannedAt: new Date(),
            reason: null
        });
    } catch (err) {
        logger.error('Verify page error', { error: err.message });
        return res.render('public/verify-card', { valid: false, reason: 'invalid', student: null, dormName: null, payload: null, scannedAt: null });
    }
});

module.exports = router;
