const express = require('express');
const router = express.Router();
const { DormitoryCollection, PendingApplicationCollection } = require('../../config/config');

// Middleware kiểm tra đăng nhập
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Chưa đăng nhập' });
};

// Route để render trang room-status
router.get('/room-status', isAuthenticated, (req, res) => {
    // Chỉ cho phép sinh viên truy cập
    if (req.session.role === 'admin') {
        return res.redirect('/admin/dormitories');
    }
    
    res.render('room-status', {
        user: {
            name: req.session.name,
            role: req.session.role,
            id: req.session.userId
        }
    });
});

// API để lấy thông tin phòng hiện tại của sinh viên
router.get('/api/student/current-room', isAuthenticated, async (req, res) => {
    try {
        const studentId = req.session.studentId || req.session.userId;
        
        // Tìm phòng mà sinh viên đang ở
        const dormitories = await DormitoryCollection.find();
        let currentRoom = null;
        let dormitoryInfo = null;
        
        for (const dormitory of dormitories) {
            for (const floor of dormitory.floors) {
                for (const room of floor.rooms) {
                    const occupant = room.occupants.find(
                        o => o.studentId === studentId && o.active === true
                    );
                    
                    if (occupant) {
                        // Lấy thông tin bạn cùng phòng
                        const roommates = room.occupants
                            .filter(o => o.active && o.studentId !== studentId)
                            .map(o => ({
                                name: o.name,
                                studentId: o.studentId,
                                email: o.email || ''
                            }));
                        
                        currentRoom = {
                            dormitoryName: dormitory.name,
                            roomNumber: room.roomNumber,
                            maxCapacity: room.maxCapacity,
                            currentOccupants: room.occupants.filter(o => o.active).length,
                            checkInDate: occupant.checkInDate,
                            roommates: roommates,
                            pricePerMonth: room.pricePerMonth || 0,
                            roomType: room.roomType || 'Phòng thường'
                        };
                        break;
                    }
                }
                if (currentRoom) break;
            }
            if (currentRoom) break;
        }
        
        if (currentRoom) {
            res.json({ success: true, room: currentRoom });
        } else {
            res.json({ success: false, message: 'Không tìm thấy phòng hiện tại' });
        }
    } catch (error) {
        console.error('Error getting current room:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// API để lấy lịch sử đăng ký của sinh viên
router.get('/api/student/applications', isAuthenticated, async (req, res) => {
    try {
        const studentId = req.session.studentId || req.session.userId;
        
        // Tìm tất cả đơn đăng ký của sinh viên
        const applications = await PendingApplicationCollection.find({
            studentId: studentId
        }).sort({ createdAt: -1 });
        
        // Lấy thông tin ký túc xá cho mỗi đơn
        const applicationData = await Promise.all(applications.map(async (app) => {
            const dormitory = await DormitoryCollection.findById(app.dormitoryId);
            return {
                _id: app._id,
                studentId: app.studentId,
                fullName: app.fullName,
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
                comments: app.comments
            };
        }));
        
        res.json({ success: true, applications: applicationData });
    } catch (error) {
        console.error('Error getting student applications:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// API để lấy chi tiết một đơn đăng ký
router.get('/api/student/applications/:id', isAuthenticated, async (req, res) => {
    try {
        const studentId = req.session.studentId || req.session.userId;
        const applicationId = req.params.id;
        
        const application = await PendingApplicationCollection.findOne({
            _id: applicationId,
            studentId: studentId
        });
        
        if (!application) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy đơn đăng ký' 
            });
        }
        
        const dormitory = await DormitoryCollection.findById(application.dormitoryId);
        
        const applicationData = {
            _id: application._id,
            studentId: application.studentId,
            fullName: application.fullName,
            email: application.email,
            phone: application.phone,
            faculty: application.faculty,
            academicYear: application.academicYear,
            gender: application.gender,
            dormitoryId: application.dormitoryId,
            dormitoryName: dormitory ? dormitory.name : 'Không xác định',
            roomNumber: application.roomNumber,
            status: application.status,
            createdAt: application.createdAt,
            comments: application.comments
        };
        
        res.json({ success: true, application: applicationData });
    } catch (error) {
        console.error('Error getting application details:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

module.exports = router;