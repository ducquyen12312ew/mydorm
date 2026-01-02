const express = require('express');
const router = express.Router();
const { 
    DormitoryCollection, 
    PendingApplicationCollection, 
    StudentCollection, 
    ActivityLogCollection,
    AcademicWindowCollection
} = require('../../config/config');

// Middleware kiểm tra admin
const isAdmin = (req, res, next) => {
    if (req.session && req.session.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Không có quyền truy cập' });
};

// Render trang dashboard
router.get('/admin/dashboard', isAdmin, (req, res) => {
    res.render('admin/dashboard', {
        user: { 
            name: req.session.name, 
            role: req.session.role 
        }
    });
});

// Render trang logs
router.get('/admin/logs', isAdmin, (req, res) => {
    res.render('admin/logs', {
        user: { 
            name: req.session.name, 
            role: req.session.role 
        }
    });
});

// API: Lấy thống kê dashboard
router.get('/admin/dashboard/stats', isAdmin, async (req, res) => {
    try {
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
            
            dormitoryStats.push({
                name: dorm.name,
                totalRooms: dormRooms,
                availableRooms: dormAvailableRooms,
                occupiedSpots: dormOccupied,
                totalCapacity: dormCapacity,
                occupancyRate: dormOccupancyRate
            });
        }
        
        // Tỷ lệ lấp đầy tổng
        const overallOccupancyRate = totalCapacity > 0 
            ? Math.round((occupiedSpots / totalCapacity) * 100) 
            : 0;
        
        // Đếm số đơn đăng ký pending
        const pendingApplications = await PendingApplicationCollection.countDocuments({ 
            status: 'pending' 
        });
        
        // Lấy hoạt động gần đây
        const recentLogs = await ActivityLogCollection
            .find({})
            .populate('userId', 'name studentId')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();
        
        // Lấy thống kê đơn đăng ký
        const applicationStats = await PendingApplicationCollection.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);
        
        const applicationSummary = {
            pending: 0,
            approved: 0,
            rejected: 0,
            total: 0
        };
        
        applicationStats.forEach(stat => {
            if (stat._id) {
                applicationSummary[stat._id] = stat.count;
                applicationSummary.total += stat.count;
            }
        });
        
        // Lấy thông tin cửa sổ đăng ký hiện tại
        const currentWindow = await AcademicWindowCollection.findOne({
            status: 'active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        }).lean();
        
        // Trả về response với cấu trúc rõ ràng
        res.json({
            success: true,
            stats: {
                summary: {
                    totalStudents: totalStudents || 0,
                    totalRooms: totalRooms || 0,
                    availableRooms: availableRooms || 0,
                    totalCapacity: totalCapacity || 0,
                    occupiedSpots: occupiedSpots || 0,
                    overallOccupancyRate: overallOccupancyRate || 0,
                    pendingApplications: pendingApplications || 0
                },
                dormitories: dormitoryStats || [],
                recentActivity: recentLogs || [],
                applications: applicationSummary,
                currentWindow: currentWindow || null
            }
        });
        
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Không thể lấy dữ liệu thống kê',
            message: error.message,
            stats: {
                summary: {
                    totalStudents: 0,
                    totalRooms: 0,
                    availableRooms: 0,
                    totalCapacity: 0,
                    occupiedSpots: 0,
                    overallOccupancyRate: 0,
                    pendingApplications: 0
                },
                dormitories: [],
                recentActivity: [],
                applications: {
                    pending: 0,
                    approved: 0,
                    rejected: 0,
                    total: 0
                },
                currentWindow: null
            }
        });
    }
});

// API: Lấy activity logs cho trang dashboard
router.get('/admin/dashboard/activity-logs', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const { userId, action, startDate, endDate } = req.query;
        
        // Build filter
        const filter = {};
        if (userId) filter.userId = userId;
        if (action) filter.action = action;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }
        
        const logs = await ActivityLogCollection
            .find(filter)
            .populate('userId', 'name studentId email')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .lean();
        
        const total = await ActivityLogCollection.countDocuments(filter);
        
        res.json({
            success: true,
            logs: logs || [],
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: limit,
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1
            }
        });
        
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Không thể lấy dữ liệu nhật ký hoạt động',
            message: error.message,
            logs: [],
            pagination: {
                currentPage: 1,
                totalPages: 0,
                totalItems: 0,
                itemsPerPage: 20,
                hasNextPage: false,
                hasPrevPage: false
            }
        });
    }
});

// API: Lấy activity logs cho trang logs (giữ nguyên cho backward compatibility)
router.get('/admin/activity-logs', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const { userId, action, startDate, endDate } = req.query;
        
        // Build filter
        const filter = {};
        if (userId) filter.userId = userId;
        if (action) filter.action = action;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }
        
        const logs = await ActivityLogCollection
            .find(filter)
            .populate('userId', 'name studentId email')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .lean();
        
        const total = await ActivityLogCollection.countDocuments(filter);
        
        res.json({
            success: true,
            logs: logs || [],
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: limit
            }
        });
        
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Không thể lấy dữ liệu nhật ký hoạt động',
            message: error.message,
            logs: [],
            pagination: {
                currentPage: 1,
                totalPages: 0,
                totalItems: 0,
                itemsPerPage: 50
            }
        });
    }
});

module.exports = router;