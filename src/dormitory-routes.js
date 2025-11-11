const express = require('express');
const router = express.Router();
const { 
    StudentCollection, 
    DormitoryCollection, 
    PendingApplicationCollection,  // Đảm bảo import đúng
    NotificationCollection, 
    ActivityLogCollection 
} = require('./config');

// Middleware kiểm tra quyền admin
const isAdmin = (req, res, next) => {
    if (req.session && req.session.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Không có quyền truy cập' });
};

// Route cho thống kê dashboard
router.get('/admin/dashboard/stats', isAdmin, async (req, res) => {
    try {
        // Tính toán thống kê
        const stats = await getDashboardStats();
        
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể lấy dữ liệu thống kê'
        });
    }
});

// Route cho việc lấy dữ liệu xu hướng lấp đầy
router.get('/admin/dashboard/occupancy-trend', isAdmin, async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        const trendData = await getOccupancyTrend(period);
        
        res.json({
            success: true,
            data: trendData
        });
    } catch (error) {
        console.error('Error fetching occupancy trend:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể lấy dữ liệu xu hướng'
        });
    }
});

// Hàm để lấy thống kê dashboard
async function getDashboardStats() {
    try {
        // Lấy tổng số ký túc xá
        const dormitories = await DormitoryCollection.find();
        
        // Tính toán tổng sinh viên, phòng và sức chứa
        let totalStudents = 0;
        let totalRooms = 0;
        let availableRooms = 0;
        let totalCapacity = 0;
        let occupiedSpots = 0;
        
        // Thống kê chi tiết cho mỗi ký túc xá
        const dormitoryStats = [];
        
        for (const dorm of dormitories) {
            let dormTotalRooms = 0;
            let dormAvailableRooms = 0;
            let dormCapacity = 0;
            let dormOccupied = 0;
            
            // Xử lý các tầng và phòng
            for (const floor of dorm.floors || []) {
                for (const room of floor.rooms || []) {
                    dormTotalRooms++;
                    totalRooms++;
                    
                    dormCapacity += room.maxCapacity || 0;
                    totalCapacity += room.maxCapacity || 0;
                    
                    // Đếm người ở đang active
                    const activeOccupants = room.occupants?.filter(o => o.active)?.length || 0;
                    dormOccupied += activeOccupants;
                    occupiedSpots += activeOccupants;
                    totalStudents += activeOccupants;
                    
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
                name: dorm.name,
                totalRooms: dormTotalRooms,
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
        
        // Lấy số đơn đăng ký đang chờ xử lý
        // CHỈNH SỬA: Sử dụng PendingApplicationCollection thay vì ApplicationCollection
        const pendingApplications = await PendingApplicationCollection.countDocuments({ status: 'pending' });
        
        // Lấy hoạt động gần đây
        const recentActivities = await ActivityLogCollection
            .find()
            .sort({ timestamp: -1 })
            .limit(10);
        
        return {
            totalStudents,
            totalRooms,
            availableRooms,
            totalCapacity,
            occupiedSpots,
            occupancyRate,
            pendingApplications,
            dormitoryStats,
            recentActivities
        };
    } catch (error) {
        console.error('Error calculating dashboard stats:', error);
        throw error;
    }
}

// Hàm để lấy dữ liệu xu hướng lấp đầy
async function getOccupancyTrend(period) {
    try {
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
        
        // Cho ví dụ này, chúng ta sẽ tạo một số dữ liệu mẫu
        // Trong ứng dụng thực tế, bạn sẽ truy vấn dữ liệu lịch sử từ cơ sở dữ liệu
        const studentSeries = generateRandomSeries(labels.length, 500, 700);
        const capacitySeries = generateConstantSeries(labels.length, 800);
        const applicationSeries = generateRandomSeries(labels.length, 30, 100);
        
        return {
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
        };
    } catch (error) {
        console.error('Error calculating occupancy trend:', error);
        throw error;
    }
}

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