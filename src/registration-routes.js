const express = require('express');
const router = express.Router();
const { UserCollection, DormitoryCollection } = require('./config');

// Endpoint to get all dormitories for registration
router.get('/dormitories/registration', async (req, res) => {
    try {
        // Get all dormitories with basic info
        const dormitories = await DormitoryCollection.find({}, {
            name: 1,
            address: 1,
            'details.type': 1,
            'details.category': 1,
            'details.available': 1,
            imageUrl: 1
        });
        
        // Filter available dormitories
        const availableDormitories = dormitories.filter(dorm => 
            dorm.details && dorm.details.available === true
        );
        
        res.status(200).json(availableDormitories);
    } catch (error) {
        console.error('Error fetching dormitories for registration:', error);
        res.status(500).json({ error: 'Không thể lấy dữ liệu ký túc xá' });
    }
});

// Endpoint to get room status for a specific dormitory
router.get('/dormitories/:id/room-status', async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id);
        if (!dormitory) {
            return res.status(404).json({ error: 'Không tìm thấy ký túc xá' });
        }
        
        // Process floors and rooms to get occupancy status
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

// Endpoint to register for a dormitory room
router.post('/registration', async (req, res) => {
    try {
        // Extract data from request body
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
        
        // Validate required fields
        if (!studentId || !fullName || !email || !phone || !dormitoryId || !roomNumber) {
            return res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc' });
        }
        
        // Find dormitory
        const dormitory = await DormitoryCollection.findById(dormitoryId);
        if (!dormitory) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy ký túc xá' });
        }
        
        // Find floor and room
        let targetFloor = null;
        let targetRoom = null;
        
        // Loop through floors to find room
        for (const floor of dormitory.floors) {
            const room = floor.rooms.find(r => r.roomNumber === roomNumber);
            if (room) {
                targetFloor = floor;
                targetRoom = room;
                break;
            }
        }
        
        if (!targetRoom) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy phòng' });
        }
        
        // Check if room is full
        const activeOccupants = targetRoom.occupants.filter(o => o.active).length;
        if (activeOccupants >= targetRoom.maxCapacity) {
            return res.status(400).json({ success: false, error: 'Phòng đã đầy' });
        }
        
        // Check if student has already registered
        const existingRegistration = targetRoom.occupants.find(o => o.studentId === studentId && o.active);
        if (existingRegistration) {
            return res.status(400).json({ success: false, error: 'Sinh viên đã đăng ký phòng này' });
        }
        
        // Create new occupant
        const newOccupant = {
            studentId: studentId,
            name: fullName,
            phone: phone,
            email: email,
            checkInDate: new Date(),
            active: true
        };
        
        // Add occupant to room
        targetRoom.occupants.push(newOccupant);
        
        // Save dormitory
        await dormitory.save();
        
        // Return success response
        res.status(200).json({ 
            success: true, 
            message: 'Đăng ký thành công',
            registrationData: {
                studentId,
                fullName,
                dormitoryName: dormitory.name,
                roomNumber,
                registrationDate: new Date()
            }
        });
    } catch (error) {
        console.error('Error registering for dormitory room:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

module.exports = router;