const express = require('express');
const router = express.Router();
const { 
    DormitoryCollection, 
    PendingApplicationCollection, 
    StudentCollection, 
    ActivityLogCollection,
    AcademicWindowCollection
} = require('./config');

const isAdmin = (req, res, next) => {
    if (req.session && req.session.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Không có quyền truy cập' });
};

router.get('/admin/dashboard', isAdmin, (req, res) => {
    res.render('dashboard');
});

router.get('/admin/logs', isAdmin, (req, res) => {
    res.render('logs');
});

router.get('/admin/dashboard/stats', isAdmin, async (req, res) => {
    try {
        const stats = {};
        
        // Đếm tổng số sinh viên đang ở ký túc xá
        const totalStudents = await StudentCollection.countDocuments({
            dormitoryId: { $exists: true, $ne: null },
            roomNumber: { $exists: true, $ne: null }
        });
        
        // Lấy thông tin ký túc xá
        const dormitories = await DormitoryCollection.find({});
        
        // Tính toán thống kê
        let totalRooms = 0;
        let availableRooms = 0;
        let totalCapacity = 0;
        let occupiedSpots = 0;
        let dormitoryStats = [];
        
        for (const dorm of dormitories) {
            let dormRooms = 0;
            let dormAvailableRooms = 0;
            let dormCapacity = 0;
            let dormOccupied = 0;
            
            for (const floor of dorm.floors || []) {
                for (const room of floor.rooms || []) {
                    dormRooms++;
                    totalRooms++;
                    
                    dormCapacity += room.maxCapacity || 0;
                    totalCapacity += room.maxCapacity || 0;
                    
                    // Đếm người ở đang active
                    const activeOccupants = room.occupants?.filter(o => o.active)?.length || 0;
                    dormOccupied += activeOccupants;
                    occupiedSpots += activeOccupants;
                    
                    // Kiểm tra xem phòng còn trống không
                    if (activeOccupants < room.maxCapacity) {
                        dormAvailableRooms++;
                        availableRooms++;
                    }
                }
            }
            
            // Tính tỷ lệ lấp đầy
            const dormOccupancyRate = dormCapacity > 0 
                ? Math.round((dormOccupied / dormCapacity) * 100) 
                : 0;
            
            // Thêm vào thống kê ký túc xá
            dormitoryStats.push({
                _id: dorm._id,
                name: dorm.name,
                totalRooms: dormRooms,
                availableRooms: dormAvailableRooms,
                capacity: dormCapacity,
                occupied: dormOccupied,
                occupancyRate: dormOccupancyRate
            });
        }
        
        // Tính tỷ lệ lấp đầy tổng thể
        const occupancyRate = totalCapacity > 0 
            ? Math.round((occupiedSpots / totalCapacity) * 100) 
            : 0;
        
        // Đếm số đơn đăng ký đang chờ duyệt
        const pendingApplications = await PendingApplicationCollection.countDocuments({
            status: 'pending'
        });
        
        // Lấy hoạt động gần đây
        const recentActivities = await ActivityLogCollection.find()
            .sort({ createdAt: -1 })
            .limit(10);
            
        const recentActivityData = await Promise.all(recentActivities.map(async (log) => {
            let actorName = 'Hệ thống';
            
            if (log.userId) {
                const user = await StudentCollection.findById(log.userId);
                if (user) {
                    actorName = user.name || user.username;
                }
            }
            
            return {
                action: log.action,
                actor: actorName,
                timestamp: log.createdAt,
                details: log.details
            };
        }));
        
        // Gán các thống kê vào đối tượng kết quả
        stats.totalStudents = totalStudents;
        stats.totalDormitories = dormitories.length;
        stats.totalRooms = totalRooms;
        stats.availableRooms = availableRooms;
        stats.totalCapacity = totalCapacity;
        stats.occupiedSpots = occupiedSpots;
        stats.occupancyRate = occupancyRate;
        stats.pendingApplications = pendingApplications;
        stats.dormitoryStats = dormitoryStats;
        stats.recentActivities = recentActivityData;
        
        res.status(200).json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

router.get('/admin/dashboard/occupancy-trend', isAdmin, async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        
        // Tính toán khoảng thời gian dựa trên period
        const endDate = new Date();
        let startDate = new Date();
        
        switch (period) {
            case 'week':
                startDate.setDate(endDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(endDate.getMonth() - 1);
                break;
            case 'quarter':
                startDate.setMonth(endDate.getMonth() - 3);
                break;
            case 'year':
                startDate.setFullYear(endDate.getFullYear() - 1);
                break;
            default:
                startDate.setMonth(endDate.getMonth() - 1); // Mặc định là tháng
        }
        
        // Tạo nhãn cho biểu đồ
        const labels = generateDateLabels(startDate, endDate, period);
        
        // Tạo dữ liệu mẫu cho biểu đồ
        // Trong ứng dụng thực tế, bạn nên truy vấn dữ liệu từ database
        const studentSeries = generateRandomSeries(labels.length, 500, 700);
        const capacitySeries = generateConstantSeries(labels.length, 800);
        const applicationSeries = generateRandomSeries(labels.length, 30, 100);
        
        res.json({
            success: true,
            data: {
                labels,
                series: [
                    {
                        name: 'Sinh viên đang ở',
                        data: studentSeries
                    },
                    {
                        name: 'Tổng sức chứa',
                        data: capacitySeries
                    },
                    {
                        name: 'Đơn đăng ký',
                        data: applicationSeries
                    }
                ]
            }
        });
    } catch (error) {
        console.error('Error fetching occupancy trend:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// Route lấy thống kê phân bổ phòng và sinh viên
router.get('/admin/dashboard/distribution', isAdmin, async (req, res) => {
    try {
        // Lấy thống kê theo loại phòng
        const dormitories = await DormitoryCollection.find();
        const roomTypeStats = {};
        
        // Tính toán thông tin về các loại phòng
        for (const dorm of dormitories) {
            for (const floor of dorm.floors || []) {
                for (const room of floor.rooms || []) {
                    const roomType = room.roomType || 'unknown';
                    
                    if (!roomTypeStats[roomType]) {
                        roomTypeStats[roomType] = {
                            totalRooms: 0,
                            occupiedSpots: 0,
                            totalCapacity: 0
                        };
                    }
                    
                    roomTypeStats[roomType].totalRooms++;
                    roomTypeStats[roomType].totalCapacity += room.maxCapacity || 0;
                    
                    const activeOccupants = room.occupants?.filter(o => o.active)?.length || 0;
                    roomTypeStats[roomType].occupiedSpots += activeOccupants;
                }
            }
        }
        
        // Định dạng kết quả
        const roomTypeData = Object.entries(roomTypeStats).map(([type, stats]) => ({
            type,
            rooms: stats.totalRooms,
            occupants: stats.occupiedSpots,
            capacity: stats.totalCapacity,
            occupancyRate: stats.totalCapacity > 0 
                ? (stats.occupiedSpots / stats.totalCapacity * 100).toFixed(1) 
                : 0
        }));
        
        // Lấy thống kê theo năm học
        const students = await StudentCollection.find({
            dormitoryId: { $exists: true, $ne: null },
            roomNumber: { $exists: true, $ne: null },
            academicYear: { $exists: true, $ne: null }
        });
        
        // Tính toán số sinh viên theo năm học
        const academicYearStats = {};
        for (const student of students) {
            const year = student.academicYear || 'unknown';
            if (!academicYearStats[year]) {
                academicYearStats[year] = 0;
            }
            academicYearStats[year]++;
        }
        
        // Định dạng kết quả
        const academicYearData = Object.entries(academicYearStats)
            .map(([year, count]) => ({ year, students: count }))
            .sort((a, b) => a.year.localeCompare(b.year));
        
        res.json({
            success: true,
            distribution: {
                roomType: roomTypeData,
                academicYear: academicYearData
            }
        });
    } catch (error) {
        console.error('Error fetching distribution data:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// Route lấy danh sách activity logs với phân trang
router.get('/admin/dashboard/activity-logs', isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, action } = req.query;
        
        // Xây dựng query
        const query = {};
        if (action) {
            query.action = action;
        }
        
        // Tính skip cho phân trang
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Lấy danh sách log
        const logs = await ActivityLogCollection.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        // Xử lý dữ liệu log để hiển thị
        const activityData = await Promise.all(logs.map(async (log) => {
            let actorName = 'Hệ thống';
            
            if (log.userId) {
                const user = await StudentCollection.findById(log.userId);
                if (user) {
                    actorName = user.name || user.username;
                }
            }
            
            return {
                _id: log._id,
                action: log.action,
                actor: actorName,
                timestamp: log.createdAt,
                details: log.details
            };
        }));
        
        // Đếm tổng số log để phân trang
        const total = await ActivityLogCollection.countDocuments(query);
        
        res.json({ 
            success: true, 
            logs: activityData,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// Route lấy thống kê theo tầng của một ký túc xá
router.get('/admin/dashboard/floor-stats/:dormitoryId', isAdmin, async (req, res) => {
    try {
        const { dormitoryId } = req.params;
        
        // Tìm ký túc xá
        const dormitory = await DormitoryCollection.findById(dormitoryId);
        
        if (!dormitory) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy ký túc xá' });
        }
        
        // Tính toán thống kê cho từng tầng
        const floorStats = [];
        
        for (const floor of dormitory.floors || []) {
            let totalRooms = floor.rooms?.length || 0;
            let availableRooms = 0;
            let totalCapacity = 0;
            let occupiedSpots = 0;
            
            for (const room of floor.rooms || []) {
                totalCapacity += room.maxCapacity || 0;
                
                // Đếm người ở đang active
                const activeOccupants = room.occupants?.filter(o => o.active)?.length || 0;
                occupiedSpots += activeOccupants;
                
                // Kiểm tra xem phòng còn trống không
                if (activeOccupants < (room.maxCapacity || 0)) {
                    availableRooms++;
                }
            }
            
            // Tính tỷ lệ lấp đầy
            const occupancyRate = totalCapacity > 0 
                ? (occupiedSpots / totalCapacity * 100).toFixed(1) 
                : 0;
            
            floorStats.push({
                floorNumber: floor.floorNumber,
                totalRooms,
                availableRooms,
                unavailableRooms: totalRooms - availableRooms,
                totalCapacity,
                occupiedSpots,
                occupancyRate
            });
        }
        
        res.json({ 
            success: true, 
            dormitoryName: dormitory.name,
            floorStats 
        });
    } catch (error) {
        console.error('Error fetching floor stats:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

// Hàm hỗ trợ để tạo nhãn ngày tháng
function generateDateLabels(startDate, endDate, period) {
    const labels = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        let label;
        
        switch (period) {
            case 'week':
                label = currentDate.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric' });
                currentDate.setDate(currentDate.getDate() + 1);
                break;
            case 'month':
                label = currentDate.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
                currentDate.setDate(currentDate.getDate() + 3);
                break;
            case 'quarter':
                label = currentDate.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
                currentDate.setDate(currentDate.getDate() + 7);
                break;
            case 'year':
                label = currentDate.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' });
                currentDate.setMonth(currentDate.getMonth() + 1);
                break;
            default:
                label = currentDate.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
                currentDate.setDate(currentDate.getDate() + 3);
        }
        
        labels.push(label);
    }
    
    return labels;
}

// Hàm hỗ trợ để tạo dữ liệu ngẫu nhiên
function generateRandomSeries(length, min, max) {
    return Array.from({ length }, () => Math.floor(Math.random() * (max - min + 1)) + min);
}

// Hàm hỗ trợ để tạo dữ liệu không đổi
function generateConstantSeries(length, value) {
    return Array.from({ length }, () => value);
}

module.exports = router;