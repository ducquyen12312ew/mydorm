const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
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
    // Check if it's a page request (not API)
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.redirect('/login');
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
router.get('/admin/logs', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        // Build filter
        const filter = {};
        
        if (req.query.action) {
            filter.action = req.query.action;
        }
        
        if (req.query.user) {
            filter.$or = [
                { 'userId.name': { $regex: req.query.user, $options: 'i' } },
                { actor: { $regex: req.query.user, $options: 'i' } }
            ];
        }

        if (req.query.startDate || req.query.endDate) {
            filter.createdAt = {};
            if (req.query.startDate) {
                filter.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                const endDate = new Date(req.query.endDate);
                endDate.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = endDate;
            }
        }

        // Fetch logs
        const logs = await ActivityLogCollection
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .lean();

        const totalLogs = await ActivityLogCollection.countDocuments(filter);

        res.render('admin/logs', {
            user: { 
                name: req.session.name, 
                role: req.session.role 
            },
            logs: logs || [],
            totalLogs: totalLogs,
            currentPage: page,
            totalPages: Math.ceil(totalLogs / limit)
        });
    } catch (error) {
        console.error('Error loading logs page:', error);
        res.render('admin/logs', {
            user: { 
                name: req.session.name, 
                role: req.session.role 
            },
            logs: [],
            totalLogs: 0,
            currentPage: 1
        });
    }
});

// API: Lấy thống kê dashboard
router.get('/admin/dashboard/stats', isAdmin, async (req, res) => {
    try {
        // Đếm tổng số sinh viên đang ở ký túc xá
        const totalStudents = await StudentCollection.countDocuments({
            dormitoryId: { $exists: true, $ne: null },
            roomNumber: { $exists: true, $ne: null }
        });
        
        // Lấy thông tin ký túc xá (không lấy những cái đã xóa); bao gồm bản ghi cũ chưa có cờ isDeleted
        const dormitories = await DormitoryCollection.find({
            $or: [
                { isDeleted: false },
                { isDeleted: { $exists: false } }
            ]
        });
        
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

// Render trang maintenance requests
router.get('/admin/maintenance-requests', isAdmin, (req, res) => {
    res.render('admin/maintenance/admin-maintenance-requests', {
        user: { name: req.session.name, role: req.session.role },
        navActive: 'requests'
    });
});

// Render trang application
router.get('/admin/application', isAdmin, (req, res) => {
    res.render('admin/application/admin-application', {
        user: { 
            name: req.session.name, 
            role: req.session.role 
        }
    });
});

// Render trang view dormitory
router.get('/admin/dormitories/view/:id', isAdmin, async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id);
        if (!dormitory || dormitory.isDeleted) {
            return res.status(404).render('404', { 
                message: 'Không tìm thấy ký túc xá' 
            });
        }
        res.render('admin/dormitory/admin-dormitory-view', {
            user: { 
                name: req.session.name, 
                role: req.session.role 
            },
            dormitory: dormitory
        });
    } catch (error) {
        res.status(500).render('404', { 
            message: 'Lỗi hệ thống' 
        });
    }
});

// API: Lấy xu hướng lấp đầy theo kỳ
router.get('/admin/dashboard/occupancy-trend', isAdmin, async (req, res) => {
    try {
        const period = req.query.period || 'month'; // month, quarter, semester
        const now = new Date();
        let startDate = new Date();
        let dataPoints = [];

        if (period === 'month') {
            startDate.setDate(1);
            // Get daily data for current month
            for (let i = 1; i <= new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); i++) {
                dataPoints.push({
                    date: new Date(now.getFullYear(), now.getMonth(), i),
                    label: `Ngày ${i}`
                });
            }
        } else if (period === 'quarter') {
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            // Get weekly data for current quarter
            for (let i = 0; i < 13; i++) {
                const date = new Date(startDate);
                date.setDate(date.getDate() + i * 7);
                if (date.getMonth() === (quarter * 3) || date.getMonth() === (quarter * 3 + 1) || date.getMonth() === (quarter * 3 + 2)) {
                    dataPoints.push({
                        date: date,
                        label: `Tuần ${i + 1}`
                    });
                }
            }
        } else if (period === 'semester') {
            const semester = now.getMonth() < 6 ? 1 : 2;
            startDate = new Date(now.getFullYear(), semester === 1 ? 0 : 6, 1);
            // Get monthly data for current semester
            for (let i = 0; i < 6; i++) {
                const date = new Date(now.getFullYear(), (semester === 1 ? 0 : 6) + i, 1);
                dataPoints.push({
                    date: date,
                    label: `Tháng ${i + (semester === 1 ? 1 : 7)}`
                });
            }
        }

        // Calculate occupancy rate for each data point
        const trendData = [];
        for (const point of dataPoints) {
            const totalCapacity = await StudentCollection.aggregate([
                { $group: { _id: null, capacity: { $sum: 1 } } }
            ]);
            
            const occupied = await StudentCollection.countDocuments({
                dormitoryId: { $exists: true, $ne: null },
                roomNumber: { $exists: true, $ne: null }
            });

            const capacity = totalCapacity[0]?.capacity || 1000;
            const rate = Math.round((occupied / capacity) * 100);

            trendData.push({
                label: point.label,
                occupancy: rate,
                date: point.date.toISOString().split('T')[0]
            });
        }

        res.json({
            success: true,
            period: period,
            data: trendData
        });

    } catch (error) {
        console.error('Error fetching occupancy trend:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Không thể lấy dữ liệu xu hướng lấp đầy',
            data: []
        });
    }
});

// API: Lấy phân bố sinh viên theo năm
router.get('/admin/dashboard/year-distribution', isAdmin, async (req, res) => {
    try {
        // Lấy tất cả sinh viên đang ở KTX
        const students = await StudentCollection.find({
            dormitoryId: { $exists: true, $ne: null },
            roomNumber: { $exists: true, $ne: null }
        }).lean();

        // Đếm sinh viên theo năm
        const yearCount = {
            '1': 0,
            '2': 0,
            '3': 0,
            '4': 0,
            '5': 0,
            '6': 0
        };

        students.forEach(student => {
            // Lấy năm từ mã số sinh viên (4 ký tự đầu tiên)
            const currentYear = new Date().getFullYear();
            let admissionYear = parseInt((student.studentId || '').substring(0, 4));

            if (isNaN(admissionYear)) {
                // fallback 2-digit
                const code2 = parseInt((student.studentId || '').substring(0, 2));
                admissionYear = code2 >= 50 ? 1900 + code2 : 2000 + code2;
            }

            let academicYear = currentYear - admissionYear;
            if (academicYear < 1 || isNaN(academicYear)) academicYear = 1;
            if (academicYear > 6) academicYear = 6;

            if (academicYear >= 1 && academicYear <= 6) {
                yearCount[academicYear.toString()]++;
            } else if (student.academicYear) {
                // Fallback: sử dụng academicYear nếu có
                const year = student.academicYear.toString();
                if (yearCount.hasOwnProperty(year)) {
                    yearCount[year]++;
                }
            }
        });

        // Chuẩn bị dữ liệu cho chart
        const labels = [];
        const values = [];
        
        for (let year = 1; year <= 6; year++) {
            const count = yearCount[year.toString()];
            if (count > 0) {
                labels.push(year === 6 ? 'Sau đại học' : `Năm ${year}`);
                values.push(count);
            }
        }

        res.json({
            success: true,
            data: {
                labels: labels,
                values: values,
                total: students.length
            }
        });

    } catch (error) {
        console.error('Error fetching year distribution:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Không thể lấy dữ liệu phân bố năm học',
            data: { labels: [], values: [], total: 0 }
        });
    }
});

function normalizeCohort(value) {
    const raw = (value || '').toString().trim();
    if (!raw) return '';
    if (/^k\d{2}$/i.test(raw)) return raw.toUpperCase();
    const numeric = raw.replace(/\D/g, '');
    if (numeric.length >= 2) return `K${numeric.slice(0, 2)}`;
    return raw.toUpperCase();
}

function getStudentCohort(student = {}) {
    const academic = (student.academicYear || '').toString().trim();
    if (/^k\d{2}$/i.test(academic)) return academic.toUpperCase();

    const id = (student.studentId || '').toString();
    const twoDigit = id.match(/^(\d{2})/);
    if (twoDigit) return `K${twoDigit[1]}`;

    const fourDigit = id.match(/^(\d{4})/);
    if (fourDigit) {
        const year = parseInt(fourDigit[1], 10);
        if (!Number.isNaN(year)) {
            return `K${String(year).slice(-2)}`;
        }
    }

    return 'UNKNOWN';
}

function toCsvValue(value) {
    if (value === null || value === undefined) return '';
    const text = String(value);
    if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

async function buildMasterDashboardData(options = {}) {
    const search = (options.search || '').toString().trim().toLowerCase();
    const cohortFilter = normalizeCohort(options.cohort || '');

    const dormitories = await DormitoryCollection.find({
        $or: [
            { isDeleted: false },
            { isDeleted: { $exists: false } }
        ]
    }).lean();

    const occupantIds = [];
    dormitories.forEach((building) => {
        (building.floors || []).forEach((floor) => {
            (floor.rooms || []).forEach((room) => {
                (room.occupants || []).forEach((occupant) => {
                    if (occupant && occupant.active && occupant.studentId) {
                        occupantIds.push(String(occupant.studentId));
                    }
                });
            });
        });
    });

    const uniqueStudentIds = [...new Set(occupantIds)];
    const students = uniqueStudentIds.length
        ? await StudentCollection.find({ _id: { $in: uniqueStudentIds } }).lean()
        : [];

    const studentMap = new Map();
    students.forEach((student) => {
        studentMap.set(String(student._id), student);
    });

    const flatStudents = [];
    const roomSummary = [];
    const buildings = [];
    let totalRooms = 0;
    let availableRooms = 0;
    let occupiedRooms = 0;

    dormitories.forEach((building) => {
        const buildingNode = {
            id: String(building._id),
            name: building.name,
            totalRooms: 0,
            availableRooms: 0,
            occupiedRooms: 0,
            floors: []
        };

        (building.floors || []).forEach((floor) => {
            const floorNode = {
                floorNumber: floor.floorNumber,
                totalRooms: 0,
                availableRooms: 0,
                occupiedRooms: 0,
                rooms: []
            };

            (floor.rooms || []).forEach((room) => {
                const activeOccupants = (room.occupants || []).filter((o) => o.active);
                const roomCapacity = Number(room.maxCapacity || 0);
                const roomAvailableBeds = Math.max(roomCapacity - activeOccupants.length, 0);
                const isAvailable = activeOccupants.length < roomCapacity;

                totalRooms += 1;
                buildingNode.totalRooms += 1;
                floorNode.totalRooms += 1;

                if (isAvailable) {
                    availableRooms += 1;
                    buildingNode.availableRooms += 1;
                    floorNode.availableRooms += 1;
                } else {
                    occupiedRooms += 1;
                    buildingNode.occupiedRooms += 1;
                    floorNode.occupiedRooms += 1;
                }

                const studentsInRoom = activeOccupants.map((occupant, index) => {
                    const profile = studentMap.get(String(occupant.studentId)) || {};
                    const cohort = getStudentCohort(profile);

                    const studentInfo = {
                        bedIndex: index + 1,
                        studentId: String(occupant.studentId || ''),
                        studentCode: profile.studentId || '',
                        name: occupant.name || profile.name || 'Unknown',
                        email: occupant.email || profile.email || '',
                        phone: occupant.phone || profile.phone || '',
                        cohort,
                        buildingId: buildingNode.id,
                        buildingName: buildingNode.name,
                        floorNumber: floor.floorNumber,
                        roomId: String(room._id),
                        roomNumber: room.roomNumber,
                        profileUrl: `/admin/master-dashboard/student/${encodeURIComponent(String(occupant.studentId || ''))}`,
                        maintenanceUrl: `/admin/maintenance-requests?studentCode=${encodeURIComponent(profile.studentId || '')}&roomNumber=${encodeURIComponent(String(room.roomNumber || ''))}`
                    };

                    flatStudents.push(studentInfo);
                    return studentInfo;
                });

                const beds = Array.from({ length: roomCapacity }, (_, idx) => {
                    if (idx < studentsInRoom.length) {
                        return {
                            bedNumber: idx + 1,
                            occupied: true,
                            student: studentsInRoom[idx]
                        };
                    }
                    return {
                        bedNumber: idx + 1,
                        occupied: false,
                        student: null
                    };
                });

                floorNode.rooms.push({
                    roomId: String(room._id),
                    roomNumber: room.roomNumber,
                    roomType: room.roomType,
                    capacity: roomCapacity,
                    occupiedBeds: studentsInRoom.length,
                    availableBeds: roomAvailableBeds,
                    status: isAvailable ? 'AVAILABLE' : 'FULL',
                    beds,
                    students: studentsInRoom
                });

                roomSummary.push({
                    buildingName: buildingNode.name,
                    floorNumber: floor.floorNumber,
                    roomNumber: room.roomNumber,
                    roomType: room.roomType || '',
                    capacity: roomCapacity,
                    occupiedBeds: studentsInRoom.length,
                    availableBeds: roomAvailableBeds,
                    occupancyRate: roomCapacity > 0
                        ? Number(((studentsInRoom.length / roomCapacity) * 100).toFixed(1))
                        : 0,
                    status: isAvailable ? 'AVAILABLE' : 'FULL'
                });
            });

            buildingNode.floors.push(floorNode);
        });

        buildings.push(buildingNode);
    });

    const filteredStudents = flatStudents.filter((student) => {
        if (cohortFilter && student.cohort !== cohortFilter) {
            return false;
        }
        if (search) {
            const haystack = `${student.name} ${student.studentCode} ${student.email}`.toLowerCase();
            if (!haystack.includes(search)) {
                return false;
            }
        }
        return true;
    });

    return {
        summary: {
            totalRooms,
            availableRooms,
            occupiedRooms
        },
        hierarchy: {
            buildings
        },
        students: filteredStudents,
        roomSummary,
        filters: {
            search: options.search || '',
            cohort: cohortFilter
        },
        generatedAt: new Date()
    };
}

router.get('/admin/master-dashboard', isAdmin, async (req, res) => {
    return res.redirect('/admin/dashboard');
});

router.get('/admin/master-dashboard/data', isAdmin, async (req, res) => {
    try {
        const data = await buildMasterDashboardData({
            search: req.query.search,
            cohort: req.query.cohort
        });

        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error fetching master dashboard data:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể tải dữ liệu master dashboard',
            message: error.message
        });
    }
});

router.get('/admin/master-dashboard/export', isAdmin, async (req, res) => {
    try {
        const data = await buildMasterDashboardData({
            search: req.query.search,
            cohort: req.query.cohort
        });

        const format = (req.query.format || 'csv').toString().toLowerCase();

        if (format === 'xlsx') {
            const workbook = new ExcelJS.Workbook();

            const studentsSheet = workbook.addWorksheet('Students');
            studentsSheet.columns = [
                { header: 'Name', key: 'name' },
                { header: 'StudentCode', key: 'studentCode' },
                { header: 'Cohort', key: 'cohort' },
                { header: 'Building', key: 'buildingName' },
                { header: 'Floor', key: 'floorNumber' },
                { header: 'Room', key: 'roomNumber' },
                { header: 'Bed', key: 'bedIndex' },
                { header: 'Email', key: 'email' },
                { header: 'Phone', key: 'phone' }
            ];
            (data.students || []).forEach((student) => {
                studentsSheet.addRow({
                    name: student.name,
                    studentCode: student.studentCode,
                    cohort: student.cohort,
                    buildingName: student.buildingName,
                    floorNumber: student.floorNumber,
                    roomNumber: student.roomNumber,
                    bedIndex: student.bedIndex,
                    email: student.email,
                    phone: student.phone
                });
            });

            const roomSummarySheet = workbook.addWorksheet('RoomSummary');
            roomSummarySheet.columns = [
                { header: 'Building', key: 'buildingName' },
                { header: 'Floor', key: 'floorNumber' },
                { header: 'Room', key: 'roomNumber' },
                { header: 'RoomType', key: 'roomType' },
                { header: 'Capacity', key: 'capacity' },
                { header: 'OccupiedBeds', key: 'occupiedBeds' },
                { header: 'AvailableBeds', key: 'availableBeds' },
                { header: 'OccupancyRatePercent', key: 'occupancyRate' },
                { header: 'Status', key: 'status' }
            ];
            (data.roomSummary || []).forEach((room) => {
                roomSummarySheet.addRow({
                    buildingName: room.buildingName,
                    floorNumber: room.floorNumber,
                    roomNumber: room.roomNumber,
                    roomType: room.roomType,
                    capacity: room.capacity,
                    occupiedBeds: room.occupiedBeds,
                    availableBeds: room.availableBeds,
                    occupancyRate: room.occupancyRate,
                    status: room.status
                });
            });

            const xlsxBuffer = await workbook.xlsx.writeBuffer();
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="master-dashboard-export.xlsx"');
            return res.send(xlsxBuffer);
        }

        const header = [
            'name',
            'studentCode',
            'cohort',
            'building',
            'floor',
            'room',
            'bed',
            'email',
            'phone'
        ];

        const lines = [header.join(',')];
        (data.students || []).forEach((student) => {
            lines.push([
                toCsvValue(student.name),
                toCsvValue(student.studentCode),
                toCsvValue(student.cohort),
                toCsvValue(student.buildingName),
                toCsvValue(student.floorNumber),
                toCsvValue(student.roomNumber),
                toCsvValue(student.bedIndex),
                toCsvValue(student.email),
                toCsvValue(student.phone)
            ].join(','));
        });

        const csv = lines.join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="master-dashboard-export.csv"');
        res.send(csv);
    } catch (error) {
        console.error('Error exporting master dashboard data:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể export dữ liệu',
            message: error.message
        });
    }
});

router.get('/admin/master-dashboard/student/:studentId', isAdmin, async (req, res) => {
    try {
        const requestedStudentId = String(req.params.studentId || '').trim();
        let student = null;

        if (requestedStudentId) {
            student = await StudentCollection.findById(requestedStudentId).lean().catch(() => null);
        }

        if (!student && requestedStudentId) {
            student = await StudentCollection.findOne({ studentId: requestedStudentId }).lean();
        }

        if (!student) {
            return res.status(404).render('404', {
                message: 'Không tìm thấy sinh viên'
            });
        }

        let dormitoryName = '';
        if (student.dormitoryId) {
            const dormitory = await DormitoryCollection.findById(student.dormitoryId).select('name').lean();
            dormitoryName = dormitory?.name || '';
        }

        res.render('admin/master-dashboard-student', {
            user: {
                name: req.session.name,
                role: req.session.role
            },
            student,
            dormitoryName,
            backUrl: req.get('referer') || '/admin/master-dashboard'
        });
    } catch (error) {
        console.error('Error rendering student quick profile:', error);
        res.status(500).render('404', {
            message: 'Không thể tải hồ sơ sinh viên'
        });
    }
});

// ============================================================
// KPI endpoint — AllocationRegistration-based stats for new dashboard
// ============================================================
router.get('/admin/dashboard/kpi', isAdmin, async (req, res) => {
    try {
        const AllocationRegistration = require('../../schemas/AllocationRegistrationSchema');

        // Room stats from dormitories
        const dormitories = await DormitoryCollection.find({
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
        }).lean();

        let totalRooms = 0, totalCapacity = 0, occupiedSpots = 0;
        const dormRoomStatus = [];

        for (const dorm of dormitories) {
            let dOccupied = 0, dCapacity = 0, dMaintenance = 0, dWaiting = 0;
            for (const floor of dorm.floors || []) {
                for (const room of floor.rooms || []) {
                    totalRooms++;
                    const cap = room.maxCapacity || 0;
                    const active = (room.occupants || []).filter(o => o.active).length;
                    dCapacity += cap;
                    dOccupied += active;
                    totalCapacity += cap;
                    occupiedSpots += active;
                    if (room.status === 'maintenance') dMaintenance++;
                }
            }
            dormRoomStatus.push({
                name: dorm.name,
                occupied: dOccupied,
                available: dCapacity - dOccupied,
                maintenance: dMaintenance,
                waiting: dWaiting,
                total: dCapacity
            });
        }

        const availableRooms = totalCapacity - occupiedSpots;
        const occupancyRate = totalCapacity > 0 ? Math.round((occupiedSpots / totalCapacity) * 100) : 0;

        // AllocationRegistration counts
        const regStats = await AllocationRegistration.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const regSummary = { PENDING: 0, ALLOCATED: 0, WAITLIST: 0, REJECTED: 0, WITHDRAWN: 0, total: 0 };
        regStats.forEach(s => {
            if (s._id) { regSummary[s._id] = s.count; regSummary.total += s.count; }
        });

        // PendingApplication counts (legacy)
        const appStats = await PendingApplicationCollection.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const appSummary = { pending: 0, approved: 0, rejected: 0, total: 0 };
        appStats.forEach(s => {
            if (s._id) { appSummary[s._id] = s.count; appSummary.total += s.count; }
        });

        const totalApplications = regSummary.total + appSummary.total;
        const pendingTotal = regSummary.PENDING + (appSummary.pending || 0);

        res.json({
            success: true,
            kpi: {
                totalApplications,
                availableRooms,
                pendingApplications: pendingTotal,
                occupancyRate,
                totalCapacity,
                occupiedSpots,
                totalRooms
            },
            registrationStats: regSummary,
            applicationStats: appSummary,
            dormRoomStatus
        });
    } catch (error) {
        console.error('Error fetching KPI:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Recent AllocationRegistrations for dashboard list
router.get('/admin/dashboard/recent-registrations', isAdmin, async (req, res) => {
    try {
        const AllocationRegistration = require('../../schemas/AllocationRegistrationSchema');
        const limit = parseInt(req.query.limit) || 20;

        const regs = await AllocationRegistration.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        // Enrich with student photo/avatar if available
        const studentIds = regs.map(r => r.studentId).filter(Boolean);
        const students = await StudentCollection.find(
            { _id: { $in: studentIds } },
            { name: 1, studentId: 1, faculty: 1, avatar: 1, profilePicture: 1 }
        ).lean();
        const studentMap = {};
        students.forEach(s => { studentMap[String(s._id)] = s; });

        const enriched = regs.map(r => {
            const s = studentMap[String(r.studentId)] || {};
            return {
                _id: r._id,
                studentName: r.studentName || s.name || 'N/A',
                studentId: s.studentId || '',
                faculty: r.studentFaculty || s.faculty || '',
                priority: r.priority || 0,
                status: r.status,
                yearGroup: r.yearGroup,
                createdAt: r.createdAt,
                avatar: s.profilePicture || s.avatar || null
            };
        });

        res.json({ success: true, registrations: enriched });
    } catch (error) {
        console.error('Error fetching recent registrations:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// ALIAS ROUTES under /api/admin/ — these are clearly under /api/
// so the 404 handler returns JSON (not HTML) on failure.
// The dashboard.ejs fetches these paths.
// ============================================================

router.get('/api/admin/kpi', isAdmin, async (req, res) => {
    try {
        const AllocationRegistration = require('../../schemas/AllocationRegistrationSchema');

        const dormitories = await DormitoryCollection.find({
            $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
        }).lean();

        let totalCapacity = 0, occupiedSpots = 0;
        const dormRoomStatus = [];

        for (const dorm of dormitories) {
            let dOccupied = 0, dCapacity = 0, dMaintenance = 0;
            for (const floor of dorm.floors || []) {
                for (const room of floor.rooms || []) {
                    const cap = room.maxCapacity || 0;
                    const active = (room.occupants || []).filter(o => o.active).length;
                    dCapacity += cap;
                    dOccupied += active;
                    totalCapacity += cap;
                    occupiedSpots += active;
                    if (room.status === 'maintenance') dMaintenance++;
                }
            }
            dormRoomStatus.push({
                name: dorm.name,
                occupied: dOccupied,
                available: dCapacity - dOccupied,
                maintenance: dMaintenance,
                waiting: 0,
                total: dCapacity
            });
        }

        const availableRooms = totalCapacity - occupiedSpots;
        const occupancyRate = totalCapacity > 0 ? Math.round((occupiedSpots / totalCapacity) * 100) : 0;

        const regStats = await AllocationRegistration.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const regSummary = { PENDING: 0, ALLOCATED: 0, WAITLIST: 0, REJECTED: 0, WITHDRAWN: 0, total: 0 };
        regStats.forEach(s => {
            if (s._id) { regSummary[s._id] = s.count; regSummary.total += s.count; }
        });

        const appStats = await PendingApplicationCollection.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const appSummary = { pending: 0, approved: 0, rejected: 0, total: 0 };
        appStats.forEach(s => {
            if (s._id) { appSummary[s._id] = s.count; appSummary.total += s.count; }
        });

        res.json({
            success: true,
            kpi: {
                totalApplications: regSummary.total + appSummary.total,
                availableRooms,
                pendingApplications: regSummary.PENDING + (appSummary.pending || 0),
                occupancyRate,
                totalCapacity,
                occupiedSpots
            },
            registrationStats: regSummary,
            applicationStats: appSummary,
            dormRoomStatus
        });
    } catch (error) {
        console.error('Error fetching KPI (api/admin):', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/api/admin/recent-registrations', isAdmin, async (req, res) => {
    try {
        const AllocationRegistration = require('../../schemas/AllocationRegistrationSchema');
        const limit = parseInt(req.query.limit) || 20;

        const regs = await AllocationRegistration.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        const studentIds = regs.map(r => r.studentId).filter(Boolean);
        const students = await StudentCollection.find(
            { _id: { $in: studentIds } },
            { name: 1, studentId: 1, faculty: 1 }
        ).lean();
        const studentMap = {};
        students.forEach(s => { studentMap[String(s._id)] = s; });

        const registrations = regs.map(r => {
            const s = studentMap[String(r.studentId)] || {};
            return {
                _id: r._id,
                studentName: r.studentName || s.name || 'N/A',
                studentId: s.studentId || '',
                faculty: r.studentFaculty || s.faculty || '',
                priority: r.priority || 0,
                status: r.status,
                createdAt: r.createdAt
            };
        });

        res.json({ success: true, registrations });
    } catch (error) {
        console.error('Error fetching recent registrations (api/admin):', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;