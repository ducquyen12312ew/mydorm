'use strict';
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

// Inline minimal schemas to avoid config.js side-effects
const RoomTransferModel = require('../src/schemas/RoomTransferSchema');
const { MaintenanceRequestModel } = require('../src/schemas/MaintenanceRequestSchema');

const TRANSFER_REASONS = [
  'Phòng hiện tại xa khu vực học, muốn chuyển sang tòa gần hơn để tiết kiệm thời gian đi lại.',
  'Phòng có vấn đề về điều hòa không khí, xin chuyển phòng khác cho điều kiện học tốt hơn.',
  'Có bạn cùng phòng gây ồn ào ảnh hưởng việc học, xin đổi phòng để tập trung hơn.',
  'Cần ở gần bạn học cùng nhóm nghiên cứu để tiện thảo luận và làm việc nhóm.',
  'Phòng hiện tại có mùi ẩm mốc, ảnh hưởng sức khỏe, xin chuyển phòng khô ráo hơn.',
  'Muốn ở phòng 4 người dịch vụ để có không gian học tập yên tĩnh hơn.',
  'Lý do sức khỏe cá nhân, bác sĩ khuyên ở phòng có điều hòa tốt hơn.',
  'Phòng cũ sắp xuống cấp, xin đổi phòng tốt hơn trong cùng tòa nhà.',
  'Thay đổi lịch học nên cần phòng ở tầng cao hơn để tiện thang máy.',
  'Muốn chuyển sang tòa gần phòng gym và thư viện hơn.',
];

const ADMIN_REJECT_NOTES = [
  'Không đủ phòng trống tại tòa yêu cầu trong thời điểm hiện tại.',
  'Lý do chuyển phòng không đủ cơ sở theo quy định KTX.',
  'Sinh viên đang trong thời gian thử thách vi phạm nội quy, chưa đủ điều kiện chuyển phòng.',
  'Phòng đề xuất đã có danh sách chờ ưu tiên, không thể phân ngay.',
  'Hồ sơ đề nghị thiếu giấy xác nhận từ bác sĩ theo yêu cầu.',
];

const DORM_NAMES = ['KTX A1', 'KTX A2', 'KTX B1', 'KTX B2', 'KTX C1'];
const ROOM_TYPES_TRANSFER = ['8-person', '4-person-service', '5-person', 'any'];
const MAINT_TYPES = ['electrical', 'plumbing', 'hvac', 'furniture', 'door_lock', 'window', 'internet', 'cleaning', 'other'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const MAINT_TITLES = [
  'Bóng đèn phòng bị hỏng cần thay mới',
  'Vòi nước phòng tắm bị chảy liên tục',
  'Điều hòa không mát, hơi lạnh yếu',
  'Tủ đựng quần áo bị gãy cánh',
  'Khóa cửa phòng bị kẹt, khó mở',
  'Cửa sổ bị hỏng bản lề không đóng được',
  'Mạng internet trong phòng mất kết nối',
  'Phòng vệ sinh cần vệ sinh tổng thể',
  'Ổ cắm điện bị hư, không có điện',
  'Bồn cầu bị tắc nghẽn cần thông',
  'Remote điều hòa mất tín hiệu',
  'Giường tầng bị lỏng ốc cần xiết lại',
  'Đường ống nước bị rò rỉ trong tường',
  'Quạt trần quay yếu, có tiếng kêu lạ',
  'Cửa chính phòng bị cong vênh không khép kín',
];

function randDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  // Get real students
  const Student = mongoose.model('students', new mongoose.Schema({}, { strict: false }));
  const students = await Student.find({}).select('_id name studentId email dormitory room').limit(100).lean();
  if (students.length < 10) {
    console.error('Not enough students in DB. Aborting.');
    process.exit(1);
  }
  console.log(`Found ${students.length} students`);

  // Get real dormitories
  const Dorm = mongoose.model('dormitories', new mongoose.Schema({}, { strict: false }));
  const dorms = await Dorm.find({}).select('_id name floors').limit(10).lean();

  // --- Seed RoomTransfer ---
  const transferCount = 45; // ~60% approved, ~40% rejected
  const approvedCount = Math.round(transferCount * 0.60);
  const transferDocs = [];

  for (let i = 0; i < transferCount; i++) {
    const student = randItem(students);
    const isApproved = i < approvedCount;
    const status = isApproved ? 'approved' : 'rejected';

    const fromDorm = randItem(dorms) || { name: randItem(DORM_NAMES) };
    const fromFloor = Math.floor(Math.random() * 5) + 2;
    const fromRoom = `${fromFloor}${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`;

    const createdAt = randDate(new Date('2023-01-01'), new Date('2025-11-30'));
    const resolvedAt = new Date(createdAt.getTime() + (Math.random() * 7 + 1) * 86400000);

    const academicYearRand = createdAt.getFullYear() < 2024 ? '2023-2024' : createdAt.getFullYear() < 2025 ? '2024-2025' : '2025-2026';

    const doc = {
      studentId: student._id,
      studentName: student.name || `Sinh viên ${student.studentId}`,
      studentMSSV: student.studentId || '',
      studentEmail: student.email || '',
      fromDormitoryName: fromDorm.name,
      fromRoomNumber: fromRoom,
      preferredBuilding: randItem(DORM_NAMES),
      preferredRoomType: randItem(ROOM_TYPES_TRANSFER),
      reason: randItem(TRANSFER_REASONS),
      status,
      adminNote: isApproved ? 'Đã duyệt theo yêu cầu.' : randItem(ADMIN_REJECT_NOTES),
      resolvedByName: 'Admin KTX',
      resolvedAt,
      academicYear: academicYearRand,
      createdAt,
      updatedAt: resolvedAt,
      history: [
        { action: 'submitted', performedByName: student.name || 'Sinh viên', note: 'Nộp đơn chuyển phòng', timestamp: createdAt },
        { action: isApproved ? 'approved' : 'rejected', performedByName: 'Admin KTX', note: isApproved ? 'Đã duyệt' : randItem(ADMIN_REJECT_NOTES), timestamp: resolvedAt }
      ]
    };
    transferDocs.push(doc);
  }

  // Clear old seeded data? No - just insert
  const insertedTransfers = await RoomTransferModel.insertMany(transferDocs, { ordered: false }).catch(e => {
    console.warn('Some transfer inserts failed (dups?):', e.message);
    return [];
  });
  console.log(`Inserted ${Array.isArray(insertedTransfers) ? insertedTransfers.length : 0} RoomTransfer docs`);

  // --- Seed MaintenanceRequests ---
  const maintCount = 30;
  const maintStatuses = ['submitted', 'in_progress', 'completed', 'completed', 'completed']; // mostly completed for history
  const maintDocs = [];

  for (let i = 0; i < maintCount; i++) {
    const student = randItem(students);
    const dorm = randItem(dorms) || { _id: new mongoose.Types.ObjectId(), name: randItem(DORM_NAMES) };
    const floor = Math.floor(Math.random() * 5) + 2;
    const roomNum = `${floor}${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`;

    const createdAt = randDate(new Date('2023-01-01'), new Date('2025-11-30'));
    const status = randItem(maintStatuses);

    const year = createdAt.getFullYear();
    const month = String(createdAt.getMonth() + 1).padStart(2, '0');
    const rand4 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const requestNumber = `MR${year}${month}${rand4}`;

    const doc = {
      requestNumber,
      dormitoryId: dorm._id,
      dormitoryName: dorm.name,
      floorNumber: floor,
      roomNumber: roomNum,
      title: randItem(MAINT_TITLES),
      description: `Sinh viên ${student.name || ''} phản ánh: ${randItem(MAINT_TITLES).toLowerCase()}. Cần kiểm tra và khắc phục sớm để đảm bảo sinh hoạt bình thường.`,
      type: randItem(MAINT_TYPES),
      priority: randItem(PRIORITIES),
      status,
      reportedBy: {
        userId: student._id,
        name: student.name || `SV ${student.studentId}`,
        studentId: student.studentId || '',
        phone: '09' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0')
      },
      reportedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
      ...(status === 'completed' ? {
        completedAt: new Date(createdAt.getTime() + (Math.random() * 5 + 1) * 86400000),
        completionNotes: 'Đã xử lý và bàn giao cho sinh viên.',
      } : {})
    };
    maintDocs.push(doc);
  }

  const insertedMaint = await MaintenanceRequestModel.insertMany(maintDocs, { ordered: false }).catch(e => {
    console.warn('Some maintenance inserts failed (dups?):', e.message?.slice(0, 100));
    return [];
  });
  console.log(`Inserted ${Array.isArray(insertedMaint) ? insertedMaint.length : 0} MaintenanceRequest docs`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
