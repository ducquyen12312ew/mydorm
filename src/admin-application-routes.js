const express = require('express');
const router = express.Router();
const { DormitoryCollection, PendingApplicationCollection, StudentCollection } = require('./config');

const isAdmin = (req, res, next) => {
    if (req.session && req.session.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Không có quyền truy cập' });
};

// Helper function kiểm tra sinh viên đã tồn tại trong hệ thống chưa
async function checkStudentExistsInSystem(studentId, name) {
    try {
        // Sử dụng MongoDB aggregation để tìm kiếm hiệu quả hơn
        const result = await DormitoryCollection.aggregate([
            { $unwind: "$floors" },
            { $unwind: "$floors.rooms" },
            { $unwind: "$floors.rooms.occupants" },
            {
                $match: {
                    "floors.rooms.occupants.active": true,
                    $or: [
                        { "floors.rooms.occupants.studentId": studentId },
                        { "floors.rooms.occupants.name": name }
                    ]
                }
            },
            {
                $project: {
                    dormitoryName: "$name",
                    floorNumber: "$floors.floorNumber",
                    roomNumber: "$floors.rooms.roomNumber",
                    occupant: "$floors.rooms.occupants"
                }
            },
            { $limit: 1 } // Chỉ cần tìm 1 kết quả để kiểm tra
        ]);

        if (result.length > 0) {
            const found = result[0];
            return {
                exists: true,
                location: {
                    dormitoryName: found.dormitoryName,
                    floorNumber: found.floorNumber,
                    roomNumber: found.roomNumber,
                    studentId: found.occupant.studentId,
                    name: found.occupant.name
                },
                type: found.occupant.studentId === studentId ? 'studentId' : 'name'
            };
        }

        return { exists: false };
    } catch (error) {
        console.error('Error checking student existence:', error);
        throw error;
    }
}

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

        // ✅ THÊM MỚI: Kiểm tra sinh viên đã tồn tại trong hệ thống chưa
        let studentExistsInfo = null;
        try {
            const existingStudent = await checkStudentExistsInSystem(application.studentId, application.fullName);
            if (existingStudent.exists) {
                studentExistsInfo = existingStudent.location;
            }
        } catch (error) {
            console.error('Error checking student existence:', error);
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
            comments: application.comments,
            // ✅ THÊM MỚI: Thông tin sinh viên đã tồn tại
            studentExistsInfo: studentExistsInfo,
            canApprove: !studentExistsInfo && currentOccupants < roomCapacity
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
        const adminId = req.session.userId;
        
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

        if (status === 'approved') {
            // ✅ THÊM MỚI: Kiểm tra sinh viên đã tồn tại trong toàn hệ thống chưa
            console.log(`[DEBUG] Checking if student already exists in system...`);
            
            const existingStudent = await checkStudentExistsInSystem(application.studentId, application.fullName);
            
            if (existingStudent.exists) {
                const location = existingStudent.location;
                const fieldType = existingStudent.type === 'studentId' ? 'Mã sinh viên' : 'Tên sinh viên';
                const fieldValue = existingStudent.type === 'studentId' ? application.studentId : application.fullName;
                
                console.log(`[ERROR] Student already exists:`, location);
                
                return res.status(400).json({ 
                    success: false, 
                    error: `${fieldType} "${fieldValue}" đã được đăng ký tại ${location.dormitoryName} - Tầng ${location.floorNumber} - Phòng ${location.roomNumber}. Không thể duyệt đơn đăng ký này!` 
                });
            }

            const dormitory = await DormitoryCollection.findById(application.dormitoryId);
            
            if (!dormitory) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Không tìm thấy ký túc xá' 
                });
            }
            
            let roomFound = false;
            let roomIsFull = false;
            let targetRoom = null;

            for (const floor of dormitory.floors) {
                const room = floor.rooms.find(r => r.roomNumber === application.roomNumber);
                if (room) {
                    roomFound = true;
                    targetRoom = room;

                    const activeOccupants = room.occupants.filter(o => o.active).length;
                    if (activeOccupants >= room.maxCapacity) {
                        roomIsFull = true;
                        break;
                    }
                    break;
                }
            }
            
            if (!roomFound) {
                return res.status(404).json({ 
                    success: false, 
                    error: `Không tìm thấy phòng ${application.roomNumber}` 
                });
            }
            
            if (roomIsFull) {
                const activeOccupants = targetRoom.occupants.filter(o => o.active).length;
                return res.status(400).json({ 
                    success: false, 
                    error: `Phòng ${application.roomNumber} đã đầy (${activeOccupants}/${targetRoom.maxCapacity}). Không thể duyệt đơn đăng ký!` 
                });
            }

            // ✅ Thêm sinh viên vào phòng
            targetRoom.occupants.push({
                studentId: application.studentId,
                name: application.fullName,
                phone: application.phone || '',
                email: application.email || '',
                checkInDate: new Date(),
                active: true
            });

            // ✅ Đảm bảo totalFloors được cập nhật đúng
            if (!dormitory.details.totalFloors) {
                dormitory.details.totalFloors = dormitory.floors.length;
            }

            // Lưu dormitory với validation
            await dormitory.save();

            // ✅ Cập nhật thông tin sinh viên trong StudentCollection
            const student = await StudentCollection.findOne({ studentId: application.studentId });
            if (student) {
                await StudentCollection.findByIdAndUpdate(student._id, {
                    dormitoryId: application.dormitoryId,
                    roomNumber: application.roomNumber,
                    updatedAt: new Date()
                });

                // ✅ Gửi thông báo cho sinh viên (nếu có hàm sendNotificationOnEvent)
                if (typeof global.sendNotificationOnEvent === 'function') {
                    await global.sendNotificationOnEvent('registration_approved', student._id, {
                        roomNumber: application.roomNumber,
                        dormitoryName: application.dormitoryName || dormitory.name,
                        applicationId: application._id
                    });
                }

                // ✅ Tạo activity log (nếu có hàm createActivityLog)
                if (typeof global.createActivityLog === 'function') {
                    await global.createActivityLog(student._id, 'application_approved', 
                        `Đơn đăng ký phòng ${application.roomNumber} đã được duyệt`, {
                        applicationId: application._id,
                        approvedBy: adminId
                    });
                }
            }
        }

        // ✅ Cập nhật trạng thái đơn đăng ký
        application.status = status;
        if (comments) {
            application.comments = comments;
        }
        
        // Thêm thông tin admin và thời gian xử lý
        if (status === 'approved') {
            application.approvedBy = adminId;
            application.approvedAt = new Date();
        } else if (status === 'rejected') {
            application.rejectedBy = adminId;
            application.rejectedAt = new Date();
            application.rejectionReason = comments || "Không đáp ứng yêu cầu";
            
            // ✅ Gửi thông báo từ chối cho sinh viên
            const student = await StudentCollection.findOne({ studentId: application.studentId });
            if (student && typeof global.sendNotificationOnEvent === 'function') {
                await global.sendNotificationOnEvent('registration_rejected', student._id, {
                    roomNumber: application.roomNumber,
                    reason: comments || "Không đáp ứng yêu cầu",
                    applicationId: application._id
                });
            }
        }

        application.updatedAt = new Date();
        await application.save();
        
        res.status(200).json({ 
            success: true, 
            message: status === 'approved' ? 
                'Đơn đăng ký đã được chấp nhận thành công!' : 
                'Đơn đăng ký đã bị từ chối!',
            application: application
        });
    } catch (error) {
        console.error('Error updating application status:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi hệ thống khi cập nhật trạng thái',
            details: error.message 
        });
    }
});

module.exports = router;