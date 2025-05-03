const express = require('express');
const router = express.Router();
const { DormitoryCollection } = require('./config');
const isAdmin = (req, res, next) => {
    if (req.session && req.session.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Không có quyền truy cập' });
};

router.get('/dormitories', async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find();
        res.json(dormitories);
    } catch (error) {
        console.error('Error fetching dormitories:', error);
        res.status(500).json({ error: 'Không thể lấy dữ liệu ký túc xá' });
    }
});

router.get('/dormitories/filter', async (req, res) => {
    try {
        const filter = {};
        if (req.query.category) {
            filter['details.category'] = req.query.category;
        }
        const roomTypeFilter = req.query.roomType;
        if (req.query.available === 'true') {
            filter['details.available'] = true;
        }
        let dormitories = await DormitoryCollection.find(filter);
        if (roomTypeFilter) {
            dormitories = dormitories.filter(dorm => {
                if (!dorm.floors || dorm.floors.length === 0) return false;
                return dorm.floors.some(floor => {
                    if (!floor.rooms || floor.rooms.length === 0) return false;
                    return floor.rooms.some(room => room.roomType === roomTypeFilter);
                });
            });
        }
        console.log(`Found ${dormitories.length} dormitories matching filters`); 
        res.status(200).json({
            success: true,
            data: dormitories
        });
    } catch (error) {
        console.error('Error filtering dormitories:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể lọc dữ liệu ký túc xá'
        });
    }
});

router.get('/dormitories/search', async (req, res) => {
    try {
        const searchQuery = req.query.query;       
        if (!searchQuery) {
            return res.status(400).json({
                success: false,
                error: 'Thiếu từ khóa tìm kiếm'
            });
        }
        const searchPattern = new RegExp(searchQuery, 'i');
        const dormitories = await DormitoryCollection.find({
            $or: [
                { name: searchPattern },
                { address: searchPattern }
            ]
        });
        console.log(`Found ${dormitories.length} dormitories matching search query: ${searchQuery}`);
        res.status(200).json({
            success: true,
            data: dormitories
        });
    } catch (error) {
        console.error('Error searching dormitories:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể tìm kiếm ký túc xá'
        });
    }
});

router.get('/dormitories/registration', async (req, res) => {
    try {
        const { showAll } = req.query;
        const dormitories = await DormitoryCollection.find({}, {
            name: 1,
            address: 1,
            'details.type': 1,
            'details.category': 1,
            'details.available': 1,
            imageUrl: 1
        });
        const result = showAll === 'true' 
            ? dormitories 
            : dormitories.filter(dorm => dorm.details && dorm.details.available === true);
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching dormitories for registration:', error);
        res.status(500).json({ error: 'Không thể lấy dữ liệu ký túc xá' });
    }
});

router.get('/map-data', async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find({}, {
            name: 1,
            address: 1,
            location: 1,
            imageUrl: 1,
            'details.available': 1,
            'details.priceRange': 1,
            'details.type': 1,
            'details.category': 1,
            'details.amenities': 1,
            'contact': 1
        });
        
        res.json(dormitories);
    } catch (error) {
        console.error('Error fetching map data:', error);
        res.status(500).json({ error: 'Không thể lấy dữ liệu bản đồ' });
    }
});
router.get('/dormitories/:id', async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id);
        if (!dormitory) {
            return res.status(404).json({ error: 'Không tìm thấy ký túc xá' });
        }
        res.json(dormitory);
    } catch (error) {
        console.error('Error fetching dormitory:', error);
        res.status(500).json({ error: 'Không thể lấy dữ liệu ký túc xá' });
    }
});

router.post('/dormitories', isAdmin, async (req, res) => {
    try {
        console.log("Received data:", JSON.stringify(req.body, null, 2));
        const existingDorm = await DormitoryCollection.findOne({ name: req.body.name });
        if (existingDorm) {
            return res.status(400).json({ error: 'Ký túc xá với tên này đã tồn tại' });
        }
        let coordinates = [105.84322, 21.007119]; //Toạ độ gốc
        
        if (req.body.location && req.body.location.coordinates) {
            if (Array.isArray(req.body.location.coordinates)) {
                coordinates = [
                    parseFloat(req.body.location.coordinates[0]),
                    parseFloat(req.body.location.coordinates[1])
                ];
            }
        }
        const defaultMinPrice = 500000;
        const defaultMaxPrice = 1500000;
        
        let minPrice = defaultMinPrice;
        let maxPrice = defaultMaxPrice;
        
        if (req.body.details && req.body.details.priceRange) {
            if (req.body.details.priceRange.min) {
                minPrice = parseInt(req.body.details.priceRange.min);
            }
            if (req.body.details.priceRange.max) {
                maxPrice = parseInt(req.body.details.priceRange.max);
            }
        }

        const floors = [];
        if (req.body.floorRoomConfigs && Array.isArray(req.body.floorRoomConfigs)) {
            for (const floorConfig of req.body.floorRoomConfigs) {
                const floorNumber = floorConfig.floorNumber;
                const rooms = [];
                
                for (const roomConfig of floorConfig.rooms) {
                    let maxCapacity;
                    switch (roomConfig.roomType) {
                        case '8-person': maxCapacity = 8; break;
                        case '4-person-service': maxCapacity = 4; break;
                        case '5-person': maxCapacity = 5; break;
                        case '10-person': maxCapacity = 10; break;
                        default: maxCapacity = 4;
                    }
                    
                    rooms.push({
                        roomNumber: roomConfig.roomNumber,
                        roomType: roomConfig.roomType,
                        maxCapacity: maxCapacity,
                        floor: floorNumber,
                        pricePerMonth: minPrice, 
                        occupants: []
                    });
                }
                
                floors.push({
                    floorNumber: floorNumber,
                    rooms: rooms
                });
            }
        } else {
            const totalFloors = parseInt(req.body.details && req.body.details.totalFloors ? req.body.details.totalFloors : 1);
            const roomsPerFloor = parseInt(req.body.details && req.body.details.roomsPerFloor ? req.body.details.roomsPerFloor : 5);
            const defaultRoomType = req.body.details && req.body.details.roomType ? req.body.details.roomType : '4-person-service';
            let defaultMaxCapacity;
            switch (defaultRoomType) {
                case '8-person': defaultMaxCapacity = 8; break;
                case '4-person-service': defaultMaxCapacity = 4; break;
                case '5-person': defaultMaxCapacity = 5; break;
                case '10-person': defaultMaxCapacity = 10; break;
                default: defaultMaxCapacity = 4;
            }
            
            for (let i = 1; i <= totalFloors; i++) {
                const rooms = [];
                
                for (let j = 1; j <= roomsPerFloor; j++) {
                    const roomNumber = `P${i}${j.toString().padStart(2, '0')}`;
                    
                    rooms.push({
                        roomNumber,
                        roomType: defaultRoomType,
                        maxCapacity: defaultMaxCapacity,
                        floor: i,
                        pricePerMonth: minPrice,
                        occupants: []
                    });
                }
                
                floors.push({
                    floorNumber: i,
                    rooms
                });
            }
        }
        const dormitoryData = {
            name: req.body.name,
            address: req.body.address,
            location: {
                type: 'Point', 
                coordinates: coordinates
            },
            contact: req.body.contact || {},
            details: {
                type: req.body.details && req.body.details.type ? req.body.details.type : 'school',
                category: req.body.details && req.body.details.category ? req.body.details.category : 'basic',
                totalFloors: req.body.details && req.body.details.totalFloors ? parseInt(req.body.details.totalFloors) : 1,
                amenities: req.body.details && req.body.details.amenities ? req.body.details.amenities : [],
                priceRange: {
                    min: minPrice,
                    max: maxPrice
                },
                available: req.body.details && req.body.details.available === 'true' ? true : false
            },
            floors: floors,
            imageUrl: req.body.imageUrl || ''
        };
        
        console.log("Creating dormitory with data:", JSON.stringify(dormitoryData, null, 2));
        
        const newDormitory = await DormitoryCollection.create(dormitoryData);
        res.status(201).json({ success: true, dormitory: newDormitory });
    } catch (error) {
        console.error('Error creating dormitory:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Không thể tạo ký túc xá mới', 
            details: error.message 
        });
    }
});

router.put('/dormitories/:id', isAdmin, async (req, res) => {
    try {
        const { floors, ...updateData } = req.body;    
        const updatedDormitory = await DormitoryCollection.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ); 
        if (!updatedDormitory) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy ký túc xá' });
        }
        
        res.json({ success: true, dormitory: updatedDormitory });
    } catch (error) {
        console.error('Error updating dormitory:', error);
        res.status(500).json({ success: false, error: 'Không thể cập nhật ký túc xá' });
    }
});

router.delete('/dormitories/:id', isAdmin, async (req, res) => {
    try {
        const deletedDormitory = await DormitoryCollection.findByIdAndDelete(req.params.id);
        
        if (!deletedDormitory) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy ký túc xá' });
        }
        
        res.json({ success: true, message: 'Xóa ký túc xá thành công' });
    } catch (error) {
        console.error('Error deleting dormitory:', error);
        res.status(500).json({ success: false, error: 'Không thể xóa ký túc xá' });
    }
});

router.post('/dormitories/:dormId/floors/:floorNum/rooms/:roomNum/toggle-spot/:spotIndex', isAdmin, async (req, res) => {
    try {
        const { dormId } = req.params;
        const floorNum = parseInt(req.params.floorNum);
        const roomNum = req.params.roomNum;
        const spotIndex = parseInt(req.params.spotIndex);
        const dormitory = await DormitoryCollection.findById(dormId);
        if (!dormitory) {
            return res.status(404).json({ error: 'Không tìm thấy ký túc xá' });
        }
        const floor = dormitory.floors.find(f => f.floorNumber === floorNum);
        if (!floor) {
            return res.status(404).json({ error: 'Không tìm thấy tầng' });
        }
        const room = floor.rooms.find(r => r.roomNumber === roomNum);
        if (!room) {
            return res.status(404).json({ error: 'Không tìm thấy phòng' });
        }
        if (spotIndex < 0 || spotIndex >= room.maxCapacity) {
            return res.status(400).json({ error: 'Vị trí không hợp lệ' });
        }
        const activeOccupants = room.occupants.filter(o => o.active);

        if (activeOccupants.length > spotIndex) {
            room.occupants[spotIndex].active = false;
        } else {
            const newOccupant = {
                studentId: req.body.studentId || `SV-${Date.now()}`,
                name: req.body.name || 'Sinh viên mới',
                phone: req.body.phone || '',
                email: req.body.email || '',
                checkInDate: new Date(),
                active: true
            };
            
            room.occupants.push(newOccupant);
        }
        
        await dormitory.save();
        
        res.json({ success: true, room });
    } catch (error) {
        console.error('Error toggling occupant:', error);
        res.status(500).json({ 
            error: 'Không thể thay đổi trạng thái người ở', 
            details: error.message 
        });
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
        
        res.json(result);
    } catch (error) {
        console.error('Error fetching room status:', error);
        res.status(500).json({ error: 'Không thể lấy trạng thái phòng' });
    }
});

module.exports = router;