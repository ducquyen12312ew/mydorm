/**
 * Seed realistic student occupants into rooms (70% occupancy)
 * Usage: node scripts/seed-occupants.js
 *
 * This script:
 * 1. Generates realistic Vietnamese student data
 * 2. Assigns students to rooms (~70% occupancy)
 * 3. Updates currentOccupants and availableBeds
 * 4. Maintains data integrity across dormitories
 */

const { DormitoryCollection } = require('../src/config/config');
require('dotenv').config();

// Vietnamese name components
const FIRST_NAMES = [
  'Nguyễn', 'Trần', 'Phạm', 'Hoàng', 'Phan', 'Vũ', 'Dương', 'Đặng',
  'Bùi', 'Đinh', 'Đỗ', 'Lê', 'Hồ', 'Mã', 'Tạ', 'Tô'
];

const MIDDLE_NAMES = [
  'Văn', 'Thị', 'Quốc', 'Minh', 'Nhân', 'Hữu', 'Gia', 'Đức',
  'Vinh', 'Hồng', 'Thu', 'Xuân', 'Hạ', 'Thu', 'Đông', 'Lan',
  'Hương', 'Tú', 'Ánh', 'Phương', 'Hương', 'Thanh', 'Linh', 'Trang'
];

const LAST_NAMES = [
  'An', 'Anh', 'Âu', 'Ân', 'Bình', 'Cảnh', 'Chính', 'Danh',
  'Dân', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hạnh', 'Hậu', 'Hiệp',
  'Hoa', 'Hoàng', 'Hùng', 'Huy', 'Huyền', 'Khánh', 'Kiên', 'Liên',
  'Long', 'Lợi', 'Lương', 'Mai', 'Miên', 'Mộng', 'Mỹ', 'Nam',
  'Nhi', 'Nhật', 'Niên', 'Nước', 'Phát', 'Phúc', 'Phương', 'Quân',
  'Quốc', 'Sơn', 'Tài', 'Tâm', 'Thắng', 'Thanh', 'Thành', 'Thảo',
  'Thiên', 'Thiệu', 'Thịnh', 'Thọ', 'Thống', 'Thúc', 'Thủy', 'Thuần',
  'Thuật', 'Thương', 'Thọ', 'Tín', 'Tĩnh', 'Toan', 'Toàn', 'Tôi',
  'Tôn', 'Tông', 'Trác', 'Trâm', 'Trananh', 'Trí', 'Triệu', 'Trình',
  'Trọng', 'Trua', 'Trung', 'Trường', 'Tú', 'Tú', 'Tuấn', 'Tuân',
  'Tuệ', 'Tuến', 'Tuyền', 'Tuyết', 'Tuấn', 'Uyên', 'Uyển', 'Vân',
  'Vật', 'Vân', 'Vệ', 'Viên', 'Vinh', 'Việc', 'Vũ', 'Xuân',
  'Xuyên', 'Yên', 'Ý', 'Ân', 'Ái', 'Ắc', 'Ặc'
];

const FACULTIES = [
  'CNTT',        // Computer Science
  'Điện tử',     // Electronics
  'Cơ khí',      // Mechanical
  'Xây dựng',    // Construction
  'Hóa học',     // Chemistry
  'Vật lý',      // Physics
  'Toán',        // Mathematics
  'Sinh học',    // Biology
  'Ngoại ngữ',   // Foreign Languages
  'Kinh tế',     // Economics
  'Quản lý',     // Management
  'Luật',        // Law
];

const GENDERS = ['Nam', 'Nữ'];

/**
 * Generate random Vietnamese name
 */
function generateVietnameseName() {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const middle = MIDDLE_NAMES[Math.floor(Math.random() * MIDDLE_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${middle} ${last}`;
}

/**
 * Generate random but realistic student ID (e.g., 20231234)
 */
function generateStudentId() {
  const year = Math.floor(Math.random() * 5) + 2019; // 2019-2023
  const number = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${year}${number}`;
}

/**
 * Generate Vietnamese phone number (09xxxxxxxx format)
 */
function generatePhoneNumber() {
  const prefix = '09';
  const number = Math.floor(Math.random() * 900000000).toString().padStart(8, '0');
  return `${prefix}${number}`;
}

/**
 * Generate email from name
 */
function generateEmail(name, studentId) {
  // Convert Vietnamese name to basic ASCII: "Nguyễn Văn A" -> "a.nguyen"
  const parts = name.toLowerCase().split(' ');
  const lastName = parts[parts.length - 1];
  const firstNames = parts.slice(0, -1).join('.');
  
  // Remove Vietnamese diacritics
  const sanitized = (lastName + '.' + firstNames)
    .replace(/[àáảãạăằắẳẵặâầấẩẫậ]/g, 'a')
    .replace(/[èéẻẽẹêềếểễệ]/g, 'e')
    .replace(/[ìíỉĩị]/g, 'i')
    .replace(/[òóỏõọôồốổỗộơờớởỡợ]/g, 'o')
    .replace(/[ùúủũụưừứửữự]/g, 'u')
    .replace(/[ỳýỷỹỵ]/g, 'y')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9._]/g, '');
  
  return `${sanitized}@hust.edu.vn`;
}

/**
 * Generate random student occupant data
 */
function generateStudentOccupant() {
  const name = generateVietnameseName();
  const studentId = generateStudentId();
  
  return {
    studentId,
    name,
    phone: generatePhoneNumber(),
    email: generateEmail(name, studentId),
    checkInDate: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
    active: true
  };
}

/**
 * Main seed function
 */
async function seedOccupants() {
  try {
    console.log('👥 Starting occupant seeding (70% occupancy)...\n');
    
    // Find all dormitories
    const dormitories = await DormitoryCollection.find({
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
    });
    
    console.log(`📍 Found ${dormitories.length} dormitories\n`);
    
    if (dormitories.length === 0) {
      console.warn('⚠️  No dormitories found.');
      process.exit(1);
    }
    
    let totalRoomsProcessed = 0;
    let totalOccupantsAdded = 0;
    let successCount = 0;
    
    // Process each dormitory
    for (const dorm of dormitories) {
      try {
        let dormRoomCount = 0;
        let dormOccupantCount = 0;
        
        // Process each floor
        if (!dorm.floors || dorm.floors.length === 0) {
          console.warn(`⚠️  ${dorm.name} has no floors`);
          continue;
        }
        
        for (const floor of dorm.floors) {
          if (!floor.rooms || floor.rooms.length === 0) {
            continue;
          }
          
          // Process each room
          for (const room of floor.rooms) {
            try {
              // Calculate 70% occupancy
              const targetOccupants = Math.round(room.maxCapacity * 0.7);
              
              // Generate students
              const occupants = [];
              for (let i = 0; i < targetOccupants; i++) {
                occupants.push(generateStudentOccupant());
              }
              
              // Update room
              room.occupants = occupants;
              // Note: currentOccupants is a virtual field, but stored data should match
              
              dormRoomCount += 1;
              dormOccupantCount += occupants.length;
              totalRoomsProcessed += 1;
              totalOccupantsAdded += occupants.length;
              
            } catch (roomError) {
              console.error(`  ❌ Error processing room ${room.roomNumber}:`, roomError.message);
            }
          }
        }
        
        // Save dormitory with updated rooms
        await DormitoryCollection.findByIdAndUpdate(
          dorm._id,
          { floors: dorm.floors, updatedAt: new Date() },
          { new: true }
        );
        
        successCount += 1;
        
        console.log(`✅ ${dorm.name}`);
        console.log(`   🏠 ${dormRoomCount} rooms processed`);
        console.log(`   👥 ${dormOccupantCount} occupants added\n`);
        
      } catch (error) {
        console.error(`❌ Error seeding ${dorm.name}:`, error.message);
      }
    }
    
    console.log('═'.repeat(60));
    console.log(`\n🎉 Occupant seeding complete!\n`);
    console.log(`✅ Successfully updated: ${successCount} dormitories`);
    console.log(`🏠 Total rooms processed: ${totalRoomsProcessed}`);
    console.log(`👥 Total occupants added: ${totalOccupantsAdded}`);
    console.log(`📊 Average occupants per room: ${Math.round(totalOccupantsAdded / totalRoomsProcessed)}\n`);
    
    // Verify by fetching one room
    const verifyDorm = await DormitoryCollection.findOne({}).lean();
    if (verifyDorm?.floors?.[0]?.rooms?.[0]) {
      const sampleRoom = verifyDorm.floors[0].rooms[0];
      console.log('📋 Verification Sample:');
      console.log(`   Dormitory: ${verifyDorm.name}`);
      console.log(`   Room: ${sampleRoom.roomNumber} (Max: ${sampleRoom.maxCapacity})`);
      console.log(`   Occupants: ${sampleRoom.occupants?.length || 0}`);
      
      if (sampleRoom.occupants?.length > 0) {
        const sampleOccupant = sampleRoom.occupants[0];
        console.log(`   Sample occupant: ${sampleOccupant.name} (${sampleOccupant.studentId})`);
        console.log(`   Phone: ${sampleOccupant.phone}`);
        console.log(`   Email: ${sampleOccupant.email}\n`);
      }
    }
    
    console.log('✨ API will now show occupied rooms!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the seeder
seedOccupants();
