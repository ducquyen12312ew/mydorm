const express = require('express');
const router = express.Router();
const { DormitoryCollection, PendingApplicationCollection } = require('./config');

const isAdmin = (req, res, next) => {
    if (req.session && req.session.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Không có quyền truy cập' });
};

router.get('/admin/applications', isAdmin, async (req, res) => {
    try {
        const { status } = req.query;

        const filter = {};
        if (status) {
            filter.status = status;
        }

        const applications = await PendingApplicationCollection.find(filter)
            .sort({ createdAt: -1 });
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
        
        res.status(200).json({ 
            success: true, 
            applications: applicationData 
        });
    } catch (error) {
        console.error('Error getting applications:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

router.get('/admin/applications/:id', isAdmin, async (req, res) => {
    try {
        const application = await PendingApplicationCollection.findById(req.params.id);
        
        if (!application) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy đơn đăng ký' 
            });
        }
        const dormitory = await DormitoryCollection.findById(application.dormitoryId);
        let room = null;
        let floor = null;
        
        if (dormitory) {
            for (const f of dormitory.floors) {
                const r = f.rooms.find(r => r.roomNumber === application.roomNumber);
                if (r) {
                    room = r;
                    floor = f;
                    break;
                }
            }
        }
 
        let roomCapacity = 0;
        let currentOccupants = 0;
        
        if (room) {
            roomCapacity = room.maxCapacity;
            currentOccupants = room.occupants.filter(o => o.active).length;
        }
        
        const applicationDetails = {
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
            roomCapacity: roomCapacity,
            currentOccupants: currentOccupants,
            isRoomFull: currentOccupants >= roomCapacity,
            status: application.status,
            createdAt: application.createdAt,
            comments: application.comments
        };
        
        res.status(200).json({ 
            success: true, 
            application: applicationDetails 
        });
    } catch (error) {
        console.error('Error getting application details:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

router.put('/admin/applications/:id/update-status', isAdmin, async (req, res) => {
    try {
        const { status, comments } = req.body;
        
        if (!status || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Trạng thái không hợp lệ' 
            });
        }

        const application = await PendingApplicationCollection.findById(req.params.id);
        
        if (!application) {
            return res.status(404).json({ 
                success: false, 
                error: 'Không tìm thấy đơn đăng ký' 
            });
        }

        if (application.status !== 'pending') {
            return res.status(400).json({ 
                success: false, 
                error: 'Đơn đăng ký đã được xử lý trước đó' 
            });
        }

        application.status = status;
        if (comments) {
            application.comments = comments;
        }

        if (status === 'approved') {
            const dormitory = await DormitoryCollection.findById(application.dormitoryId);
            
            if (!dormitory) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Không tìm thấy ký túc xá' 
                });
            }
            
            let roomFound = false;
            let roomIsFull = false;

            for (const floor of dormitory.floors) {
                const room = floor.rooms.find(r => r.roomNumber === application.roomNumber);
                if (room) {
                    roomFound = true;

                    const activeOccupants = room.occupants.filter(o => o.active).length;
                    if (activeOccupants >= room.maxCapacity) {
                        roomIsFull = true;
                        break;
                    }

                    const existingOccupant = room.occupants.find(
                        o => o.studentId === application.studentId && o.active
                    );
                    
                    if (existingOccupant) {
                        return res.status(400).json({ 
                            success: false, 
                            error: 'Sinh viên đã trong phòng này' 
                        });
                    }

                    room.occupants.push({
                        studentId: application.studentId,
                        name: application.fullName,
                        phone: application.phone,
                        email: application.email,
                        checkInDate: new Date(),
                        active: true
                    });
                    
                    break;
                }
            }
            
            if (!roomFound) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Không tìm thấy phòng' 
                });
            }
            
            if (roomIsFull) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Phòng đã đầy' 
                });
            }

            await dormitory.save();
        }

        await application.save();
        
        res.status(200).json({ 
            success: true, 
            message: status === 'approved' ? 
                'Đơn đăng ký đã được chấp nhận' : 
                'Đơn đăng ký đã bị từ chối',
            application: application
        });
    } catch (error) {
        console.error('Error updating application status:', error);
        res.status(500).json({ success: false, error: 'Lỗi hệ thống' });
    }
});

module.exports = router;