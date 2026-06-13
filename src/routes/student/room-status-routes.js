const express = require('express');
const router = express.Router();
const { DormitoryCollection, PendingApplicationCollection, StudentCollection } = require('../../config/config');
const AllocationRegistration = require('../../schemas/AllocationRegistrationSchema');
const RoomAllocationModel = require('../../schemas/RoomAllocationSchema');

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
    
    res.render('student/room-status', {
        user: {
            name: req.session.name,
            role: req.session.role,
            id: req.session.userId
        },
        student: null
    });
});

// Redirect legacy maintenance page to unified service-requests
router.get('/student/maintenance-requests', isAuthenticated, (req, res) => {
    if (req.session.role === 'admin') return res.redirect('/admin/dormitories');
    res.redirect('/student/service-requests?tab=maintenance');
});

// API để lấy thông tin phòng hiện tại của sinh viên
router.get('/api/student/current-room', isAuthenticated, async (req, res) => {
    try {
        const studentId = req.session.studentId || req.session.userId;
        
        // Tìm phòng mà sinh viên đang ở
        const dormitories = await DormitoryCollection.find();
        const applications = await PendingApplicationCollection.find({
            studentId: studentId
        }).sort({ createdAt: -1 });
        let currentRoom = null;
        let latestApprovedApplication = null;

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
            return res.json({ success: true, room: currentRoom });
        }

        if (applications && applications.length > 0) {
            latestApprovedApplication = applications.find(app => app.status === 'approved');
        }

        if (latestApprovedApplication) {
            const dormitory = dormitories.find(d => d._id.toString() === latestApprovedApplication.dormitoryId?.toString());
            
            // Tìm phòng từ đơn đã duyệt để lấy thông tin đầy đủ
            let approvedRoomDetails = null;
            if (dormitory) {
                for (const floor of dormitory.floors) {
                    const room = floor.rooms.find(r => r.roomNumber === latestApprovedApplication.roomNumber);
                    if (room) {
                        approvedRoomDetails = {
                            dormitoryName: dormitory.name,
                            dormitoryImage: dormitory.images?.[0] || null,
                            roomNumber: room.roomNumber,
                            maxCapacity: room.maxCapacity,
                            currentOccupants: room.occupants.filter(o => o.active).length,
                            checkInDate: latestApprovedApplication.createdAt,
                            roommates: [],
                            pricePerMonth: room.pricePerMonth || 0,
                            roomType: room.roomType || 'Phòng thường',
                            isPending: true
                        };
                        break;
                    }
                }
            }
            
            // Trả về thông tin phòng đầy đủ nếu tìm thấy, nếu không thì trả về thông tin cơ bản
            if (approvedRoomDetails) {
                return res.json({
                    success: true,
                    room: approvedRoomDetails
                });
            } else {
                return res.json({
                    success: true,
                    latestApprovedApplication: {
                        dormitoryName: dormitory ? dormitory.name : 'Không xác định',
                        roomNumber: latestApprovedApplication.roomNumber,
                        status: latestApprovedApplication.status,
                        createdAt: latestApprovedApplication.createdAt,
                        comments: latestApprovedApplication.comments || ''
                    }
                });
            }
        }

        res.json({ success: false, message: 'Không tìm thấy phòng hiện tại' });
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

// Comprehensive allocation result — joins allocationRegistrations + roomAllocations + rooms + dormitories
router.get('/api/student/allocation-result', isAuthenticated, async (req, res) => {
    try {
        const studentObjectId = req.session.userId;
        const studentId = req.session.studentId;

        // 1. Allocation engine flow (allocationregistrations)
        const reg = await AllocationRegistration.findOne({ studentId: studentObjectId })
            .sort({ createdAt: -1 })
            .populate('allocationCycleId')
            .lean();

        if (reg) {
            let roomAllocation = null;
            let room = null;
            let dormitory = null;

            let roommates = [];

            if (reg.status === 'ALLOCATED') {
                roomAllocation = await RoomAllocationModel.findOne({
                    studentId: studentObjectId,
                    status: 'ACTIVE'
                })
                    .populate({ path: 'roomId', model: 'Room' })
                    .populate({ path: 'dormitoryId', model: 'dormitories' })
                    .sort({ allocationTimestamp: -1 })
                    .lean();

                if (roomAllocation) {
                    room = roomAllocation.roomId || null;
                    dormitory = roomAllocation.dormitoryId || null;

                    // Fetch roommates: other ACTIVE allocations in same room
                    const otherAllocs = await RoomAllocationModel.find({
                        roomId: roomAllocation.roomId?._id || roomAllocation.roomId,
                        status: 'ACTIVE',
                        studentId: { $ne: studentObjectId }
                    }).lean();

                    if (otherAllocs.length) {
                        const otherIds = otherAllocs.map(a => a.studentId);
                        const roommateStudents = await StudentCollection.find(
                            { _id: { $in: otherIds } },
                            'name studentId faculty academicYear gender'
                        ).lean();
                        roommates = roommateStudents.map(s => ({
                            name: s.name || '—',
                            studentId: s.studentId || '—',
                            faculty: s.faculty || '—',
                            academicYear: s.academicYear || '—',
                            gender: s.gender || '—'
                        }));
                    }
                }
            }

            return res.json({
                success: true,
                data: {
                    flow: 'allocation',
                    registration: reg,
                    roomAllocation: roomAllocation ? {
                        _id: roomAllocation._id,
                        roomNumber: roomAllocation.roomNumber,
                        buildingCode: roomAllocation.buildingCode,
                        allocationType: roomAllocation.allocationType,
                        allocationTimestamp: roomAllocation.allocationTimestamp,
                        allocationReason: roomAllocation.allocationReason,
                        roomCapacity: roomAllocation.roomCapacity
                    } : null,
                    room,
                    dormitory,
                    cycle: reg.allocationCycleId || null,
                    roommates
                }
            });
        }

        // 2. Manual admin flow (pendingapplications)
        const app = await PendingApplicationCollection.findOne({
            $or: [{ studentId: studentId }, { studentId: studentObjectId?.toString() }]
        }).sort({ createdAt: -1 }).lean();

        if (app) {
            let dormitory = null;
            let room = null;
            let roommates = [];

            if (['approved', 'assigned_room', 'waitlist', 'pending', 'pending_review'].includes(app.status)) {
                if (app.dormitoryId) {
                    dormitory = await DormitoryCollection.findById(app.dormitoryId).lean();
                    if (dormitory && app.roomNumber) {
                        for (const floor of dormitory.floors || []) {
                            const found = (floor.rooms || []).find(r => r.roomNumber === app.roomNumber);
                            if (found) {
                                room = { ...found, floorNumber: floor.floorNumber };

                                // Fetch roommates from occupants (excluding self), enrich with Student data
                                const otherOccupants = (found.occupants || []).filter(
                                    o => o.active && o.studentId !== studentId && o.studentId !== studentObjectId?.toString()
                                );
                                if (otherOccupants.length) {
                                    const occIds = otherOccupants.map(o => o.studentId);
                                    const roommateStudents = await StudentCollection.find(
                                        { studentId: { $in: occIds } },
                                        'name studentId faculty academicYear gender'
                                    ).lean();
                                    // Merge with occupant check-in date
                                    roommates = roommateStudents.map(s => {
                                        const occ = otherOccupants.find(o => o.studentId === s.studentId) || {};
                                        return {
                                            name: s.name || occ.name || '—',
                                            studentId: s.studentId || '—',
                                            faculty: s.faculty || '—',
                                            academicYear: s.academicYear || '—',
                                            gender: s.gender || '—',
                                            checkInDate: occ.checkInDate || null
                                        };
                                    });
                                }
                                break;
                            }
                        }
                    }
                }
            }

            return res.json({
                success: true,
                data: {
                    flow: 'manual',
                    registration: app,
                    roomAllocation: null,
                    room,
                    dormitory,
                    cycle: null,
                    roommates
                }
            });
        }

        return res.json({ success: true, data: { flow: null, registration: null, roomAllocation: null, room: null, dormitory: null, cycle: null } });
    } catch (error) {
        console.error('allocation-result error:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

module.exports = router;