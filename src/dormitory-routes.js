// Tạo các route cho dormitory
const express = require('express');
const router = express.Router();
const { DormitoryCollection } = require('./config');

// Middleware kiểm tra quyền admin
const isAdmin = (req, res, next) => {
    if (req.session && req.session.name && req.session.role === 'admin') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này!' });
    }
};

// Lấy tất cả ký túc xá
router.get('/dormitories', async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find();
        res.json({ success: true, data: dormitories });
    } catch (error) {
        console.error('Error fetching dormitories:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// Lấy thông tin chi tiết của một ký túc xá
router.get('/dormitories/:id', async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id);
        if (!dormitory) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ký túc xá' });
        }
        res.json({ success: true, data: dormitory });
    } catch (error) {
        console.error('Error fetching dormitory details:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// Tìm kiếm ký túc xá theo tên hoặc địa chỉ
router.get('/dormitories/search', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp từ khóa tìm kiếm' });
        }

        const dormitories = await DormitoryCollection.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { address: { $regex: query, $options: 'i' } }
            ]
        });

        res.json({ success: true, data: dormitories });
    } catch (error) {
        console.error('Error searching dormitories:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// Lọc ký túc xá theo loại hoặc danh mục
router.get('/dormitories/filter', async (req, res) => {
    try {
        const { category, roomType, type } = req.query;
        const filter = {};

        if (category) filter['details.category'] = category;
        if (roomType) filter['details.roomType'] = roomType;
        if (type) filter['details.type'] = type;

        const dormitories = await DormitoryCollection.find(filter);
        res.json({ success: true, data: dormitories });
    } catch (error) {
        console.error('Error filtering dormitories:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// Tìm ký túc xá gần một vị trí
router.get('/dormitories/nearby', async (req, res) => {
    try {
        const { lng, lat, maxDistance = 2000 } = req.query; // maxDistance mặc định 2km
        
        if (!lng || !lat) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp tọa độ' });
        }

        const dormitories = await DormitoryCollection.find({
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    $maxDistance: parseInt(maxDistance)
                }
            }
        });

        res.json({ success: true, data: dormitories });
    } catch (error) {
        console.error('Error finding nearby dormitories:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// Thêm ký túc xá mới (chỉ admin)
router.post('/dormitories', isAdmin, async (req, res) => {
    try {
        console.log('Body nhận được:', req.body);
        console.log('User session:', req.session);
        const newDormitory = new DormitoryCollection(req.body);
        const savedDormitory = await newDormitory.save();
        res.status(201).json({ success: true, data: savedDormitory });
    } catch (error) {
        console.error('Error creating dormitory:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
});

// Cập nhật thông tin ký túc xá (chỉ admin)
router.put('/dormitories/:id', isAdmin, async (req, res) => {
    try {
        const updatedDormitory = await DormitoryCollection.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!updatedDormitory) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ký túc xá' });
        }
        
        res.json({ success: true, data: updatedDormitory });
    } catch (error) {
        console.error('Error updating dormitory:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
});

// Xóa ký túc xá (chỉ admin)
router.delete('/dormitories/:id', isAdmin, async (req, res) => {
    try {
        const deletedDormitory = await DormitoryCollection.findByIdAndDelete(req.params.id);
        
        if (!deletedDormitory) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ký túc xá' });
        }
        
        res.json({ success: true, message: 'Đã xóa ký túc xá thành công' });
    } catch (error) {
        console.error('Error deleting dormitory:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

module.exports = router;