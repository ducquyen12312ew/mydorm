/**
 * MIGRATION: Update Student Schema
 * Thêm các trường mới vào Student collection để hỗ trợ hệ thống năm học
 * 
 * Chạy file này MỘT LẦN: node src/migrations/updateStudentSchema.js
 */

const { StudentCollection } = require('../config/config');
const { determineYearGroup, calculatePriorityScore } = require('../services/academicYearService');

async function migrateStudentData() {
    try {
        console.log('Bắt đầu migration Student schema...');
        
        // Lấy tất cả sinh viên
        const students = await StudentCollection.find({});
        
        console.log(`Tìm thấy ${students.length} sinh viên cần cập nhật`);
        
        let updatedCount = 0;
        let skippedCount = 0;
        
        for (const student of students) {
            try {
                const updates = {};
                
                // 1. Thêm yearGroup nếu chưa có
                if (!student.yearGroup && student.academicYear) {
                    updates.yearGroup = determineYearGroup(student.academicYear);
                }
                
                // 2. Thêm priorityScore nếu chưa có
                if (student.priorityScore === undefined || student.priorityScore === null) {
                    updates.priorityScore = calculatePriorityScore(student);
                }
                
                // 3. Khởi tạo registrationHistory nếu chưa có
                if (!student.registrationHistory) {
                    updates.registrationHistory = [];
                    
                    // Nếu sinh viên đang có phòng, thêm vào history
                    if (student.dormitoryId && student.roomNumber) {
                        updates.registrationHistory = [{
                            academicYear: new Date().getFullYear().toString(),
                            dormitoryId: student.dormitoryId,
                            roomNumber: student.roomNumber,
                            checkInDate: new Date(),
                            status: 'current'
                        }];
                    }
                }
                
                // 4. Khởi tạo roomPreferences nếu chưa có
                if (!student.roomPreferences) {
                    updates.roomPreferences = {
                        preferredBuildings: [],
                        preferredFloorRange: { min: 1, max: 10 },
                        preferredRoommates: [],
                        notes: ''
                    };
                }
                
                // 5. Khởi tạo allocated nếu chưa có nhưng có dormitoryId
                if (!student.allocated && student.dormitoryId && student.roomNumber) {
                    updates.allocated = {
                        dormitoryId: student.dormitoryId,
                        dormitoryName: '', // Sẽ cập nhật sau nếu cần
                        floorNumber: null, // Không biết từ dữ liệu cũ
                        roomNumber: student.roomNumber,
                        assignedAt: new Date()
                    };
                }
                
                // 6. Cập nhật registrationStatus nếu chưa có
                if (!student.registrationStatus) {
                    if (student.dormitoryId && student.roomNumber) {
                        updates.registrationStatus = 'assigned_room';
                    } else {
                        updates.registrationStatus = 'not_registered';
                    }
                }
                
                // Cập nhật nếu có thay đổi
                if (Object.keys(updates).length > 0) {
                    await StudentCollection.findByIdAndUpdate(
                        student._id,
                        { $set: updates }
                    );
                    updatedCount++;
                    
                    if (updatedCount % 10 === 0) {
                        console.log(`Đã cập nhật ${updatedCount}/${students.length} sinh viên...`);
                    }
                } else {
                    skippedCount++;
                }
                
            } catch (error) {
                console.error(`Lỗi khi cập nhật sinh viên ${student.studentId}:`, error.message);
            }
        }
        
        console.log('\n========================================');
        console.log('MIGRATION HOÀN TẤT');
        console.log('========================================');
        console.log(`Tổng số sinh viên: ${students.length}`);
        console.log(`Đã cập nhật: ${updatedCount}`);
        console.log(`Bỏ qua (đã có đầy đủ): ${skippedCount}`);
        console.log('========================================\n');
        
        return {
            success: true,
            total: students.length,
            updated: updatedCount,
            skipped: skippedCount
        };
        
    } catch (error) {
        console.error('Lỗi trong quá trình migration:', error);
        throw error;
    }
}

// Chạy migration nếu file được gọi trực tiếp
if (require.main === module) {
    const mongoose = require('mongoose');
    
    mongoose.connect('mongodb://0.0.0.0:27017/Dormitory', {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
    })
    .then(async () => {
        console.log('Kết nối MongoDB thành công');
        await migrateStudentData();
        process.exit(0);
    })
    .catch(err => {
        console.error('Lỗi kết nối MongoDB:', err);
        process.exit(1);
    });
}

module.exports = { migrateStudentData };