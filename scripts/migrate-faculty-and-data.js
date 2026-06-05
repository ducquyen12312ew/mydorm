/**
 * migrate-faculty-and-data.js
 * - Updates faculty names to correct HUST faculty names
 * - Adds more maintenance requests, notifications, and registration data
 * Usage: node scripts/migrate-faculty-and-data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) { console.error('MONGODB_URI not set'); process.exit(1); }

const FACULTY_MAP = {
  'Điện - Điện tử':          'Điện tử Viễn thông',
  'Hóa học':                  'Kỹ thuật Máy tính',
  'Vật lý kỹ thuật':          'Cơ điện tử',
  'Toán - Tin học ứng dụng':  'Toán Tin',
  'Cơ kỹ thuật':              'Cơ điện tử',
  'Kỹ thuật Hàng không':      'Kỹ thuật Máy tính',
  'Kinh tế & Quản lý':        'Kinh tế',
};

const HUST_FACULTIES = [
  'Công nghệ Thông tin',
  'Khoa học Máy tính',
  'Kỹ thuật Máy tính',
  'Điện tử Viễn thông',
  'Cơ điện tử',
  'Cơ khí',
  'Toán Tin',
  'Kinh tế',
];

const MaintSchema = new mongoose.Schema({
  requestNumber: String, studentId: String, studentUserId: mongoose.Schema.Types.ObjectId,
  dormitoryId: mongoose.Schema.Types.ObjectId, dormitoryName: String,
  roomNumber: String, floorNumber: Number,
  type: String, title: String, description: String,
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status: { type: String, enum: ['submitted', 'assigned', 'in_progress', 'completed', 'cancelled'], default: 'submitted' },
  reportedAt: { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now },
});

const NotifSchema = new mongoose.Schema({
  title: String, message: String,
  type: { type: String, default: 'info' },
  category: { type: String, default: 'system' },
  priority: { type: String, default: 'normal' },
  isGlobal: { type: Boolean, default: false },
  targetUsers: [mongoose.Schema.Types.ObjectId],
  targetRole: String,
  readBy: [mongoose.Schema.Types.ObjectId],
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now },
});

const AllocRegSchema = new mongoose.Schema({
  studentId: String, studentUserId: mongoose.Schema.Types.ObjectId,
  studentName: String, faculty: String, gender: String,
  priorityScore: Number,
  dormitoryPreference: [String],
  roomTypePreference: String,
  status: { type: String, default: 'pending' },
  submittedAt: { type: Date, default: Date.now },
  cycleId: mongoose.Schema.Types.ObjectId,
});

const Maint   = mongoose.models.maintenancerequests   || mongoose.model('maintenancerequests',   MaintSchema);
const Notif   = mongoose.models.notifications         || mongoose.model('notifications',         NotifSchema);
const AllocReg = mongoose.models.allocationregistrations || mongoose.model('allocationregistrations', AllocRegSchema);

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Connected to MongoDB');

  // ── BƯỚC 7: Update faculty names ─────────────────────────────────────────────
  console.log('\n=== Updating faculty names ===');
  let totalUpdated = 0;
  for (const [oldName, newName] of Object.entries(FACULTY_MAP)) {
    const result = await db.collection('students').updateMany(
      { faculty: oldName },
      { $set: { faculty: newName } }
    );
    if (result.modifiedCount > 0) {
      console.log(`  ${oldName} → ${newName}: ${result.modifiedCount} sinh viên`);
      totalUpdated += result.modifiedCount;
    }
  }
  console.log(`Faculty update complete: ${totalUpdated} records updated`);

  // Verify distribution
  const facDist = {};
  const students = await db.collection('students').find({ role: 'user' }).toArray();
  for (const s of students) { facDist[s.faculty || 'none'] = (facDist[s.faculty || 'none'] || 0) + 1; }
  console.log('New faculty distribution:', JSON.stringify(facDist, null, 2));

  // ── BƯỚC 8: More maintenance requests ────────────────────────────────────────
  console.log('\n=== Adding maintenance requests ===');
  const existingMaint = await db.collection('maintenancerequests').countDocuments();
  if (existingMaint < 30) {
    const dorms = await db.collection('dormitories').find({}).toArray();
    const sampleStudents = await db.collection('students').find({ role: 'user', dormitoryId: { $exists: true } }).limit(80).toArray();

    const MAINT_TYPES = [
      { type: 'điện', titles: ['Bóng đèn phòng hỏng', 'Ổ cắm điện không hoạt động', 'Quạt trần bị hỏng', 'Cầu dao điện bị lỗi'] },
      { type: 'nước', titles: ['Vòi nước bị rỉ', 'Bồn cầu không xả nước', 'Ống nước bị tắc', 'Bình nóng lạnh không hoạt động'] },
      { type: 'cửa', titles: ['Khóa cửa phòng bị hỏng', 'Cửa sổ không đóng được', 'Bản lề cửa bị long', 'Cửa phòng vệ sinh bị kẹt'] },
      { type: 'internet', titles: ['Mất kết nối mạng', 'Router wifi yếu tín hiệu', 'Cáp mạng bị đứt'] },
      { type: 'vệ sinh', titles: ['Rác không được dọn đúng hạn', 'Nhà vệ sinh cần vệ sinh khẩn', 'Mùi hôi từ cống rãnh'] },
      { type: 'cơ sở vật chất', titles: ['Giường tầng bị gãy', 'Tủ cá nhân bị hỏng khóa', 'Bàn học bị lung lay', 'Ghế bị gãy chân'] },
    ];

    const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
    const STATUSES = ['submitted', 'submitted', 'assigned', 'in_progress', 'in_progress', 'completed', 'completed', 'completed'];

    const maintDocs = [];
    let reqNum = existingMaint + 1;

    for (let i = 0; i < 50 && i < sampleStudents.length; i++) {
      const student = sampleStudents[i];
      const dorm = dorms.find(d => d._id.toString() === student.dormitoryId.toString());
      if (!dorm) continue;

      const typeObj = MAINT_TYPES[i % MAINT_TYPES.length];
      const title = typeObj.titles[Math.floor(i / MAINT_TYPES.length) % typeObj.titles.length];
      const priority = PRIORITIES[i % PRIORITIES.length];
      const status = STATUSES[i % STATUSES.length];
      const daysAgo = Math.floor(Math.random() * 60) + 1;
      const reportedAt = new Date(Date.now() - daysAgo * 86400000);

      maintDocs.push({
        requestNumber: `YC${String(reqNum++).padStart(5, '0')}`,
        studentId: student.studentId,
        studentUserId: student._id,
        dormitoryId: dorm._id,
        dormitoryName: dorm.name,
        roomNumber: student.roomNumber,
        type: typeObj.type,
        title,
        description: `Sinh viên ${student.name} phòng ${student.roomNumber} báo cáo: ${title.toLowerCase()}. Cần sửa chữa gấp.`,
        priority,
        status,
        reportedAt,
        updatedAt: new Date(reportedAt.getTime() + Math.random() * 86400000 * 5),
      });
    }

    await db.collection('maintenancerequests').insertMany(maintDocs);
    console.log(`Added ${maintDocs.length} maintenance requests`);
  } else {
    console.log(`Maintenance requests already sufficient: ${existingMaint} records`);
  }

  // ── BƯỚC 8: More notifications ────────────────────────────────────────────────
  console.log('\n=== Adding notifications ===');
  const existingNotif = await db.collection('notifications').countDocuments();
  if (existingNotif < 20) {
    const notifDocs = [
      {
        title: 'Thông báo đóng tiền phòng tháng 6/2026',
        message: 'Sinh viên vui lòng đóng tiền phòng KTX tháng 6/2026 trước ngày 10/06/2026. Mọi thắc mắc liên hệ phòng Quản lý KTX.',
        type: 'warning', category: 'payment', priority: 'high', isGlobal: true,
        expiresAt: new Date('2026-06-30'),
        createdAt: new Date('2026-06-01'),
      },
      {
        title: 'Lịch vệ sinh tổng thể KTX tháng 6',
        message: 'Thứ 7 ngày 07/06/2026, Ban quản lý KTX sẽ tiến hành vệ sinh tổng thể toàn bộ khu KTX. Sinh viên vui lòng dọn dẹp phòng trước 8:00 sáng.',
        type: 'info', category: 'maintenance', priority: 'normal', isGlobal: true,
        expiresAt: new Date('2026-06-08'),
        createdAt: new Date('2026-06-03'),
      },
      {
        title: 'Kiểm tra PCCC định kỳ',
        message: 'Phòng Cơ sở vật chất sẽ tiến hành kiểm tra hệ thống PCCC định kỳ ngày 12/06/2026. Sinh viên cần có mặt tại phòng trong khung giờ 9:00 - 11:00.',
        type: 'warning', category: 'safety', priority: 'high', isGlobal: true,
        expiresAt: new Date('2026-06-13'),
        createdAt: new Date('2026-06-05'),
      },
      {
        title: 'Mở đăng ký KTX học kỳ 1 năm học 2026-2027',
        message: 'Ban quản lý KTX thông báo mở đăng ký ở KTX học kỳ 1 năm học 2026-2027 từ ngày 20/06/2026 đến 30/06/2026 qua hệ thống trực tuyến.',
        type: 'info', category: 'registration', priority: 'high', isGlobal: true,
        expiresAt: new Date('2026-07-01'),
        createdAt: new Date('2026-06-05'),
      },
      {
        title: 'Cắt điện bảo trì hệ thống — KTX C3',
        message: 'KTX C3 sẽ bị cắt điện từ 22:00 ngày 08/06 đến 2:00 ngày 09/06/2026 để bảo trì hệ thống điện. Ban quản lý xin lỗi vì sự bất tiện này.',
        type: 'warning', category: 'maintenance', priority: 'high', isGlobal: false, targetRole: 'user',
        expiresAt: new Date('2026-06-10'),
        createdAt: new Date('2026-06-06'),
      },
      {
        title: 'Chúc mừng sinh viên đạt thành tích xuất sắc',
        message: 'Ban quản lý KTX xin chúc mừng các sinh viên đạt danh hiệu sinh viên xuất sắc học kỳ 2 năm học 2025-2026. Các bạn sẽ được ưu tiên phòng đơn trong đăng ký KTX tiếp theo.',
        type: 'success', category: 'academic', priority: 'normal', isGlobal: true,
        expiresAt: new Date('2026-07-31'),
        createdAt: new Date('2026-06-01'),
      },
      {
        title: 'Quy định mới về giờ giấc ra vào KTX',
        message: 'Từ ngày 01/07/2026, giờ đóng cổng KTX điều chỉnh thành 23:30 (trước đây là 23:00). Sinh viên về muộn cần xuất trình thẻ sinh viên và đăng ký trước tại bảo vệ.',
        type: 'info', category: 'policy', priority: 'normal', isGlobal: true,
        expiresAt: new Date('2026-12-31'),
        createdAt: new Date('2026-06-04'),
      },
      {
        title: 'Bảo trì thang máy KTX E5',
        message: 'Thang máy KTX E5 sẽ bảo trì từ ngày 10-12/06/2026. Trong thời gian này sinh viên vui lòng sử dụng cầu thang bộ.',
        type: 'warning', category: 'maintenance', priority: 'medium', isGlobal: false, targetRole: 'user',
        expiresAt: new Date('2026-06-13'),
        createdAt: new Date('2026-06-06'),
      },
    ];

    await db.collection('notifications').insertMany(notifDocs);
    console.log(`Added ${notifDocs.length} notifications`);
  } else {
    console.log(`Notifications already sufficient: ${existingNotif} records`);
  }

  // ── BƯỚC 8: More allocation registrations ────────────────────────────────────
  console.log('\n=== Adding allocation registrations ===');
  const existingAlloc = await db.collection('allocationregistrations').countDocuments();
  if (existingAlloc < 30) {
    const unassignedStudents = await db.collection('students').find({
      role: 'user',
      $or: [{ dormitoryId: { $exists: false } }, { dormitoryId: null }]
    }).limit(40).toArray();

    const cycles = await db.collection('allocationcycles').find({}).limit(1).toArray();
    const cycleId = cycles[0]?._id;

    const DORM_PREFS = [
      ['KTX A1 - Bách Khoa', 'KTX B2 - Bách Khoa'],
      ['KTX C3 - Bách Khoa', 'KTX D4 - Bách Khoa'],
      ['KTX E5 - Bách Khoa', 'KTX F6 - Bách Khoa'],
      ['KTX G7 - Bách Khoa', 'KTX E5 - Bách Khoa'],
    ];
    const ROOM_TYPES = ['8-person', '5-person', '10-person', '4-person-service'];
    const STATUSES = ['pending', 'pending', 'pending', 'approved', 'approved', 'rejected'];

    const allocDocs = [];
    // Add pending registrations from currently assigned students (simulating new cycle)
    const assignedSample = await db.collection('students').find({ role: 'user', dormitoryId: { $exists: true } }).limit(40).toArray();

    for (let i = 0; i < Math.min(40, assignedSample.length); i++) {
      const s = assignedSample[i];
      const status = STATUSES[i % STATUSES.length];
      const daysAgo = Math.floor(Math.random() * 20) + 1;
      allocDocs.push({
        studentId: s.studentId,
        studentUserId: s._id,
        studentName: s.name,
        faculty: s.faculty,
        gender: s.gender,
        priorityScore: s.priorityScore || 50,
        dormitoryPreference: DORM_PREFS[i % DORM_PREFS.length],
        roomTypePreference: ROOM_TYPES[i % ROOM_TYPES.length],
        status,
        submittedAt: new Date(Date.now() - daysAgo * 86400000),
        cycleId,
      });
    }

    if (allocDocs.length > 0) {
      await db.collection('allocationregistrations').insertMany(allocDocs);
      console.log(`Added ${allocDocs.length} allocation registrations`);
    }
  } else {
    console.log(`Allocation registrations already sufficient: ${existingAlloc} records`);
  }

  // ── Final summary ─────────────────────────────────────────────────────────────
  console.log('\n=== MIGRATION COMPLETE ===');
  const counts = {
    students: await db.collection('students').countDocuments({ role: 'user' }),
    maintenancerequests: await db.collection('maintenancerequests').countDocuments(),
    notifications: await db.collection('notifications').countDocuments(),
    allocationregistrations: await db.collection('allocationregistrations').countDocuments(),
  };
  console.log('Final counts:', JSON.stringify(counts, null, 2));

  await mongoose.disconnect();
  console.log('\nDone.');
}

run().catch(err => { console.error(err.message); process.exit(1); });
