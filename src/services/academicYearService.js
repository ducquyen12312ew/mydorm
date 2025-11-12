/**
 * ACADEMIC YEAR SERVICE
 * Service xử lý logic phân loại sinh viên theo năm học
 * và các quy tắc đăng ký phòng
 */

const AcademicPolicyModel = require('../schemas/AcademicPolicySchema');
const { StudentCollection, DormitoryCollection } = require('../config/config');

/**
 * Xác định nhóm năm học của sinh viên
 * @param {Number} academicYear - Năm học của sinh viên (1, 2, 3, 4, 5...)
 * @returns {Number} - Nhóm năm: 1 (năm 1), 2 (năm 2-3), 3 (năm 4+)
 */
function determineYearGroup(academicYear) {
    const year = parseInt(academicYear);
    
    if (year === 1) {
        return 1; // Năm 1
    } else if (year === 2 || year === 3) {
        return 2; // Năm 2-3
    } else if (year >= 4) {
        return 3; // Năm 4+
    }
    
    return 1; // Default
}

/**
 * Tính điểm ưu tiên của sinh viên
 * Điểm cao hơn = ưu tiên cao hơn
 * @param {Object} student - Đối tượng sinh viên
 * @returns {Number} - Điểm ưu tiên
 */
function calculatePriorityScore(student) {
    let score = 0;
    
    // Điểm cơ bản theo năm học
    const yearGroup = determineYearGroup(student.academicYear);
    if (yearGroup === 1) {
        score += 10; // Năm 1: 10 điểm
    } else if (yearGroup === 2) {
        score += 50; // Năm 2-3: 50 điểm
    } else {
        score += 100; // Năm 4+: 100 điểm
    }
    
    // Thêm điểm nếu sinh viên đã ở KTX trước đó
    if (student.registrationHistory && student.registrationHistory.length > 0) {
        const completedYears = student.registrationHistory.filter(
            h => h.status === 'completed'
        ).length;
        score += completedYears * 10; // +10 điểm/năm đã ở
    }
    
    // Thêm điểm nếu đã có phòng cũ (ưu tiên giữ phòng)
    if (student.dormitoryId && student.roomNumber) {
        score += 20;
    }
    
    return score;
}

/**
 * Kiểm tra sinh viên có đủ điều kiện đăng ký không
 * @param {Object} student - Đối tượng sinh viên
 * @param {String} academicYear - Năm học đăng ký (VD: "2024-2025")
 * @returns {Object} - { eligible: Boolean, reason: String, canChooseRoom: Boolean, autoAssign: Boolean, policy: Object }
 */
async function checkRegistrationEligibility(student, academicYear) {
    try {
        // Lấy chính sách của năm học này
        const policy = await AcademicPolicyModel.getActivePolicy(academicYear);
        
        if (!policy) {
            return {
                eligible: false,
                reason: 'Chưa có chính sách đăng ký cho năm học này',
                canChooseRoom: false,
                autoAssign: false
            };
        }
        
        // Xác định nhóm năm của sinh viên
        const yearGroup = determineYearGroup(student.academicYear);
        const groupPolicy = policy.getPolicyForYearGroup(yearGroup);
        
        // Kiểm tra sinh viên đã đăng ký chưa
        if (student.registrationStatus === 'checked_in' || 
            student.registrationStatus === 'assigned_room') {
            return {
                eligible: false,
                reason: 'Bạn đã được phân phòng rồi',
                canChooseRoom: false,
                autoAssign: false,
                policy: groupPolicy
            };
        }
        
        // Kiểm tra cửa sổ thời gian đăng ký (nếu có)
        if (groupPolicy.selectionWindow && 
            groupPolicy.selectionWindow.start && 
            groupPolicy.selectionWindow.end) {
            
            const now = new Date();
            const start = new Date(groupPolicy.selectionWindow.start);
            const end = new Date(groupPolicy.selectionWindow.end);
            
            if (now < start) {
                return {
                    eligible: false,
                    reason: `Cửa sổ đăng ký chưa mở. Bắt đầu từ ${start.toLocaleDateString('vi-VN')}`,
                    canChooseRoom: false,
                    autoAssign: false,
                    policy: groupPolicy
                };
            }
            
            if (now > end) {
                return {
                    eligible: false,
                    reason: `Cửa sổ đăng ký đã đóng. Kết thúc vào ${end.toLocaleDateString('vi-VN')}`,
                    canChooseRoom: false,
                    autoAssign: false,
                    policy: groupPolicy
                };
            }
        }
        
        // Sinh viên đủ điều kiện
        return {
            eligible: true,
            reason: 'Đủ điều kiện đăng ký',
            canChooseRoom: groupPolicy.canChooseRoom || false,
            autoAssign: groupPolicy.autoAssign || false,
            policy: groupPolicy
        };
        
    } catch (error) {
        console.error('Error checking registration eligibility:', error);
        return {
            eligible: false,
            reason: 'Lỗi hệ thống khi kiểm tra điều kiện',
            canChooseRoom: false,
            autoAssign: false
        };
    }
}

/**
 * Lấy danh sách phòng khả dụng cho sinh viên theo năm học
 * @param {Number} yearGroup - Nhóm năm (1, 2, 3)
 * @param {String} gender - Giới tính ('male' hoặc 'female')
 * @param {Object} preferences - Sở thích chọn phòng
 * @param {String} academicYear - Năm học
 * @returns {Array} - Danh sách phòng khả dụng
 */
async function getAvailableRoomsForYear(yearGroup, gender, preferences = {}, academicYear) {
    try {
        // Lấy chính sách năm học
        const policy = await AcademicPolicyModel.getActivePolicy(academicYear);
        
        if (!policy) {
            return [];
        }
        
        const groupPolicy = policy.getPolicyForYearGroup(yearGroup);
        
        // Xây dựng query cho ký túc xá
        let dormQuery = { available: true };
        
        // Nếu chính sách giới hạn KTX cho nhóm này
        if (groupPolicy.allowedBuildings && groupPolicy.allowedBuildings.length > 0) {
            dormQuery._id = { $in: groupPolicy.allowedBuildings };
        }
        
        // Nếu sinh viên có preferences về KTX
        if (preferences.preferredBuildings && preferences.preferredBuildings.length > 0) {
            dormQuery._id = { $in: preferences.preferredBuildings };
        }
        
        // Lấy danh sách KTX
        const dormitories = await DormitoryCollection.find(dormQuery);
        
        const availableRooms = [];
        
        for (const dorm of dormitories) {
            for (const floor of dorm.floors) {
                // Kiểm tra floor range nếu có preferences
                if (preferences.preferredFloorRange) {
                    if (floor.floorNumber < preferences.preferredFloorRange.min ||
                        floor.floorNumber > preferences.preferredFloorRange.max) {
                        continue;
                    }
                }
                
                for (const room of floor.rooms) {
                    // Kiểm tra phòng còn chỗ trống
                    const activeOccupants = room.occupants.filter(o => o.active);
                    const availableSpots = room.maxCapacity - activeOccupants.length;
                    
                    if (availableSpots <= 0) {
                        continue; // Phòng đầy
                    }
                    
                    // Kiểm tra giới tính
                    // Nếu phòng có người, phải cùng giới tính
                    if (activeOccupants.length > 0) {
                        // Lấy giới tính của người đầu tiên trong phòng
                        const firstOccupant = activeOccupants[0];
                        // Giả sử có field gender trong occupant hoặc phải tra StudentCollection
                        // Tạm thời skip logic này, để admin quản lý
                    }
                    
                    // Thêm phòng vào danh sách
                    availableRooms.push({
                        dormitoryId: dorm._id,
                        dormitoryName: dorm.name,
                        floorNumber: floor.floorNumber,
                        roomNumber: room.roomNumber,
                        roomType: room.roomType,
                        maxCapacity: room.maxCapacity,
                        currentOccupants: activeOccupants.length,
                        availableSpots: availableSpots,
                        pricePerMonth: room.pricePerMonth,
                        amenities: room.amenities || []
                    });
                }
            }
        }
        
        // Sắp xếp theo số chỗ trống (nhiều nhất trước)
        availableRooms.sort((a, b) => b.availableSpots - a.availableSpots);
        
        return availableRooms;
        
    } catch (error) {
        console.error('Error getting available rooms:', error);
        return [];
    }
}

/**
 * Lấy hàng đợi ưu tiên sinh viên
 * @param {String} academicYear - Năm học
 * @param {Object} filters - Bộ lọc { yearGroup, faculty, gender }
 * @returns {Array} - Danh sách sinh viên xếp theo ưu tiên
 */
async function getPriorityQueue(academicYear, filters = {}) {
    try {
        // Xây dựng query
        let query = {
            registrationStatus: { 
                $in: ['pending_review', 'approved_waiting_payment', 'waitlist'] 
            }
        };
        
        // Thêm filters
        if (filters.yearGroup) {
            const yearGroup = parseInt(filters.yearGroup);
            if (yearGroup === 1) {
                query.academicYear = 1;
            } else if (yearGroup === 2) {
                query.academicYear = { $in: [2, 3] };
            } else if (yearGroup === 3) {
                query.academicYear = { $gte: 4 };
            }
        }
        
        if (filters.faculty) {
            query.faculty = filters.faculty;
        }
        
        if (filters.gender) {
            query.gender = filters.gender;
        }
        
        // Lấy danh sách sinh viên
        const students = await StudentCollection.find(query);
        
        // Tính điểm ưu tiên cho từng sinh viên
        const studentsWithPriority = students.map(student => {
            const yearGroup = determineYearGroup(student.academicYear);
            const priorityScore = calculatePriorityScore(student);
            
            return {
                _id: student._id,
                studentId: student.studentId,
                name: student.name,
                email: student.email,
                phone: student.phone,
                faculty: student.faculty,
                academicYear: student.academicYear,
                yearGroup: yearGroup,
                gender: student.gender,
                priorityScore: priorityScore,
                registrationStatus: student.registrationStatus,
                dormitoryId: student.dormitoryId,
                roomNumber: student.roomNumber
            };
        });
        
        // Sắp xếp theo điểm ưu tiên (cao nhất trước)
        studentsWithPriority.sort((a, b) => b.priorityScore - a.priorityScore);
        
        return studentsWithPriority;
        
    } catch (error) {
        console.error('Error getting priority queue:', error);
        return [];
    }
}

/**
 * Phân phòng tự động cho sinh viên năm 1
 * @param {String} academicYear - Năm học
 * @param {Array} dormitoryIds - Danh sách ID ký túc xá (null = tất cả)
 * @returns {Object} - Kết quả phân phòng
 */
async function autoAssignFreshmen(academicYear, dormitoryIds = null) {
    try {
        // Lấy chính sách năm học
        const policy = await AcademicPolicyModel.getActivePolicy(academicYear);
        
        if (!policy || !policy.policies.year1.autoAssign) {
            return {
                success: false,
                message: 'Chính sách không cho phép phân phòng tự động cho năm 1'
            };
        }
        
        // Lấy danh sách sinh viên năm 1 chưa có phòng
        const freshmen = await StudentCollection.find({
            academicYear: 1,
            $or: [
                { dormitoryId: null },
                { dormitoryId: { $exists: false } }
            ],
            registrationStatus: { 
                $in: ['not_registered', 'pending_review', 'waitlist'] 
            }
        });
        
        if (freshmen.length === 0) {
            return {
                success: true,
                message: 'Không có sinh viên năm 1 nào cần phân phòng',
                assigned: 0,
                total: 0
            };
        }
        
        // Phân loại theo giới tính
        const maleStudents = freshmen.filter(s => s.gender === 'male');
        const femaleStudents = freshmen.filter(s => s.gender === 'female');
        
        // Lấy phòng trống cho nam
        const maleRooms = await getAvailableRoomsForYear(1, 'male', {}, academicYear);
        
        // Lấy phòng trống cho nữ
        const femaleRooms = await getAvailableRoomsForYear(1, 'female', {}, academicYear);
        
        let assignedCount = 0;
        const results = { male: [], female: [] };
        
        // Phân phòng cho nam
        for (const student of maleStudents) {
            if (maleRooms.length === 0) break;
            
            const room = maleRooms[0]; // Lấy phòng đầu tiên
            
            // Cập nhật sinh viên
            await StudentCollection.findByIdAndUpdate(student._id, {
                dormitoryId: room.dormitoryId,
                roomNumber: room.roomNumber,
                registrationStatus: 'assigned_room'
            });
            
            // Thêm vào occupants của phòng
            await DormitoryCollection.updateOne(
                {
                    _id: room.dormitoryId,
                    'floors.floorNumber': room.floorNumber,
                    'floors.rooms.roomNumber': room.roomNumber
                },
                {
                    $push: {
                        'floors.$[floor].rooms.$[room].occupants': {
                            studentId: student.studentId,
                            name: student.name,
                            phone: student.phone || '',
                            email: student.email || '',
                            checkInDate: new Date(),
                            active: true
                        }
                    }
                },
                {
                    arrayFilters: [
                        { 'floor.floorNumber': room.floorNumber },
                        { 'room.roomNumber': room.roomNumber }
                    ]
                }
            );
            
            assignedCount++;
            results.male.push({
                studentId: student.studentId,
                name: student.name,
                room: `${room.dormitoryName} - Tầng ${room.floorNumber} - Phòng ${room.roomNumber}`
            });
            
            // Giảm số chỗ trống
            room.availableSpots--;
            if (room.availableSpots <= 0) {
                maleRooms.shift(); // Bỏ phòng đầy ra khỏi danh sách
            }
        }
        
        // Phân phòng cho nữ (tương tự)
        for (const student of femaleStudents) {
            if (femaleRooms.length === 0) break;
            
            const room = femaleRooms[0];
            
            await StudentCollection.findByIdAndUpdate(student._id, {
                dormitoryId: room.dormitoryId,
                roomNumber: room.roomNumber,
                registrationStatus: 'assigned_room'
            });
            
            await DormitoryCollection.updateOne(
                {
                    _id: room.dormitoryId,
                    'floors.floorNumber': room.floorNumber,
                    'floors.rooms.roomNumber': room.roomNumber
                },
                {
                    $push: {
                        'floors.$[floor].rooms.$[room].occupants': {
                            studentId: student.studentId,
                            name: student.name,
                            phone: student.phone || '',
                            email: student.email || '',
                            checkInDate: new Date(),
                            active: true
                        }
                    }
                },
                {
                    arrayFilters: [
                        { 'floor.floorNumber': room.floorNumber },
                        { 'room.roomNumber': room.roomNumber }
                    ]
                }
            );
            
            assignedCount++;
            results.female.push({
                studentId: student.studentId,
                name: student.name,
                room: `${room.dormitoryName} - Tầng ${room.floorNumber} - Phòng ${room.roomNumber}`
            });
            
            room.availableSpots--;
            if (room.availableSpots <= 0) {
                femaleRooms.shift();
            }
        }
        
        return {
            success: true,
            message: `Đã phân phòng tự động cho ${assignedCount}/${freshmen.length} sinh viên năm 1`,
            assigned: assignedCount,
            total: freshmen.length,
            results: results
        };
        
    } catch (error) {
        console.error('Error auto-assigning freshmen:', error);
        return {
            success: false,
            message: 'Lỗi khi phân phòng tự động: ' + error.message
        };
    }
}

module.exports = {
    determineYearGroup,
    calculatePriorityScore,
    checkRegistrationEligibility,
    getAvailableRoomsForYear,
    getPriorityQueue,
    autoAssignFreshmen
};