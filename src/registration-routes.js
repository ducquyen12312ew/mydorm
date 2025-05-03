const express = require('express');
const router = express.Router();
const { DormitoryCollection, PendingApplicationCollection } = require('./config');

router.get('/dormitories/registration', async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find({}, {
            name: 1,
            address: 1,
            'details.type': 1,
            'details.category': 1,
            'details.available': 1,
            imageUrl: 1
        });
        const availableDormitories = dormitories.filter(dorm => 
            dorm.details && dorm.details.available === true
        );

        console.log(`Fetched ${availableDormitories.length} available dormitories for registration`);
        
        res.status(200).json(availableDormitories);
    } catch (error) {
        console.error('Error fetching dormitories for registration:', error);
        res.status(500).json({ error: 'Không thể lấy dữ liệu ký túc xá' });
    }
});

router.get('/dormitories/:id/room-status', async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id);
        if (!dormitory) {
            return res.status(404).json({ error: 'Không tìm thấy ký túc xá' });
        }

        const result = dormitory.floors.map(floor => {
            return {
                floorNumber: floor.floorNumber,
                rooms: floor.rooms.map(room => {
                    const activeOccupants = room.occupants.filter(o => o.active).length;
                    return {
                        roomNumber: room.roomNumber,
                        maxCapacity: room.maxCapacity,
                        currentOccupants: activeOccupants,
                        available: activeOccupants < room.maxCapacity,
                        roomType: room.roomType,
                        pricePerMonth: room.pricePerMonth
                    };
                })
            };
        });
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching room status:', error);
        res.status(500).json({ error: 'Không thể lấy dữ liệu phòng' });
    }
});

router.post('/registration', async (req, res) => {
    try {
        const {
            studentId,
            fullName,
            email,
            phone,
            faculty,
            academicYear,
            gender,
            dormitoryId,
            roomNumber
        } = req.body;
        if (!studentId || !fullName || !email || !phone || !dormitoryId || !roomNumber) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc' });
        }
        const dormitory = await DormitoryCollection.findById(dormitoryId);
        if (!dormitory) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy ký túc xá' });
        }

        let roomExists = false;
        let roomIsFull = true;

        for (const floor of dormitory.floors) {
            const room = floor.rooms.find(r => r.roomNumber === roomNumber);
            if (room) {
                roomExists = true;
                const activeOccupants = room.occupants.filter(o => o.active).length;
                roomIsFull = activeOccupants >= room.maxCapacity;
                break;
            }
        }
        
        if (!roomExists) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy phòng' });
        }
        
        if (roomIsFull) {
            return res.status(400).json({ success: false, error: 'Phòng đã đầy' });
        }

        const existingPendingApplication = await PendingApplicationCollection.findOne({
            studentId: studentId,
            dormitoryId: dormitoryId,
            roomNumber: roomNumber,
            status: 'pending'
        });
        
        if (existingPendingApplication) {
            return res.status(400).json({ 
                success: false, 
                error: 'Bạn đã đăng ký phòng này và đang chờ xét duyệt' 
            });
        }
 
        const newApplication = await PendingApplicationCollection.create({
            studentId,
            fullName,
            email,
            phone,
            faculty,
            academicYear,
            gender,
            dormitoryId,
            roomNumber,
            status: 'pending',
            createdAt: new Date()
        });

        res.status(200).json({ 
            success: true, 
            message: 'Đăng ký thành công! Đơn của bạn đang chờ xét duyệt.',
            applicationId: newApplication._id,
            registrationData: {
                studentId,
                fullName,
                dormitoryName: dormitory.name,
                roomNumber,
                registrationDate: new Date()
            }
        });
    } catch (error) {
        console.error('Error submitting registration:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

router.get('/registration/status/:studentId', async (req, res) => {
    try {
        const applications = await PendingApplicationCollection.find({
            studentId: req.params.studentId
        }).sort({ createdAt: -1 });
        
        if (applications.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy đơn đăng ký nào' 
            });
        }

        const applicationData = await Promise.all(applications.map(async (app) => {
            const dormitory = await DormitoryCollection.findById(app.dormitoryId);
            return {
                _id: app._id,
                studentId: app.studentId,
                fullName: app.fullName,
                dormitoryName: dormitory ? dormitory.name : 'Không xác định',
                roomNumber: app.roomNumber,
                status: app.status,
                createdAt: app.createdAt,
                comments: app.comments
            };
        }));
        
        res.status(200).json({ 
            success: true, 
            applications: applicationData 
        });
    } catch (error) {
        console.error('Error checking application status:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

module.exports = router;