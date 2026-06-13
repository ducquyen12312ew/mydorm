/**
 * Comprehensive Atlas demo seeder
 * Seeds: dormitories, students (demo account + roommates), allocation cycle,
 *        room allocation, pending application, maintenance requests, notifications.
 *
 * Demo student login: username=sinhvien_demo  password=Demo@1234
 * Usage: node scripts/seed-demo-atlas.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) { console.error('MONGODB_URI not set'); process.exit(1); }

// ─── Schemas (inline to avoid import order issues) ───────────────────────────

const OccupantSchema = new mongoose.Schema({
  studentId:  { type: String },
  name:       { type: String },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'students' },
  active:     { type: Boolean, default: true },
  assignedAt: { type: Date, default: Date.now },
});

const RoomSchema = new mongoose.Schema({
  roomNumber:    { type: String, required: true },
  roomType:      { type: String, enum: ['8-person','4-person-service','5-person','10-person'], required: true },
  maxCapacity:   { type: Number, required: true },
  floor:         { type: Number, required: true },
  pricePerMonth: { type: Number, required: true },
  amenities:     { type: [String], default: [] },
  description:   { type: String, default: '' },
  imageUrl:      { type: String, default: '' },
  occupants:     { type: [OccupantSchema], default: [] },
});

const FloorSchema = new mongoose.Schema({
  floorNumber: { type: Number, required: true },
  rooms:       [RoomSchema],
});

const DormitorySchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  location: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], required: true } },
  contact:  { phone: String, email: String },
  details: {
    type:       { type: String, enum: ['school','private'], required: true },
    category:   { type: String, enum: ['basic','premium','international'], required: true },
    totalFloors:{ type: Number, required: true, min: 1 },
    amenities:  { type: [String], default: [] },
    priceRange: { min: { type: Number, default: 0 }, max: { type: Number, default: 0 } },
    available:  { type: Boolean, default: true },
  },
  floors:    [FloorSchema],
  imageUrl:  { type: String, default: '' },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const StudentSchema = new mongoose.Schema({
  name: String, username: { type: String, unique: true }, studentId: String,
  email: String, phone: String, password: String, faculty: String,
  academicYear: String, gender: String, role: { type: String, default: 'user' },
  priorityScore: { type: Number, default: 0 }, favoriteRoomIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  nationality: String, citizenship: String, country: String, isInternational: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }, updatedAt: { type: Date, default: Date.now },
});

const NotificationSchema = new mongoose.Schema({
  title: String, message: String,
  type:     { type: String, enum: ['info','success','warning','error'], default: 'info' },
  category: { type: String, default: 'system' },
  priority: { type: String, enum: ['low','normal','medium','high'], default: 'normal' },
  isGlobal: { type: Boolean, default: false },
  targetUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'students' }],
  targetRole: String,
  readBy:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'students' }],
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now },
});

const MaintenanceSchema = new mongoose.Schema({
  requestNumber: { type: String, required: true, unique: true },
  studentId:   { type: String, required: true },
  studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'students' },
  dormitoryId:   { type: mongoose.Schema.Types.ObjectId, ref: 'dormitories' },
  dormitoryName: String,
  roomNumber:    String,
  floorNumber:   Number,
  type:          String,
  title:         String,
  description:   String,
  priority:      { type: String, enum: ['low','medium','high','urgent'], default: 'medium' },
  status:        { type: String, enum: ['submitted','assigned','in_progress','completed','cancelled'], default: 'submitted' },
  reportedAt:    { type: Date, default: Date.now },
  updatedAt:     { type: Date, default: Date.now },
});

const AllocationCycleSchema = new mongoose.Schema({
  name:              String,
  academicYear:      String,
  semester:          String,
  registrationStart: Date,
  registrationEnd:   Date,
  allocationDate:    Date,
  status:            { type: String, enum: ['planning','open','closed','completed'], default: 'open' },
  createdAt:         { type: Date, default: Date.now },
  updatedAt:         { type: Date, default: Date.now },
});

const RoomAllocationSchema = new mongoose.Schema({
  studentId: String, studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'students' },
  dormitoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'dormitories' }, dormitoryName: String,
  roomNumber: String, roomId: mongoose.Schema.Types.ObjectId,
  cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'allocationcycles' },
  status: { type: String, enum: ['pending','assigned','cancelled'], default: 'assigned' },
  assignedAt: { type: Date, default: Date.now }, updatedAt: { type: Date, default: Date.now },
});

// ─── Models ───────────────────────────────────────────────────────────────────

const Dormitory = mongoose.models.dormitories || mongoose.model('dormitories', DormitorySchema);
const Student   = mongoose.models.students    || mongoose.model('students', StudentSchema);
const Notif     = mongoose.models.notifications || mongoose.model('notifications', NotificationSchema);
const Maint     = mongoose.models.maintenancerequests || mongoose.model('maintenancerequests', MaintenanceSchema);
const AllocCycle= mongoose.models.allocationcycles || mongoose.model('allocationcycles', AllocationCycleSchema);
const RoomAlloc = mongoose.models.roomallocations || mongoose.model('roomallocations', RoomAllocationSchema);

// ─── Seed data ────────────────────────────────────────────────────────────────

async function run() {
  console.log('Connecting to Atlas...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  // ── 1. Dormitories ────────────────────────────────────────────────────────
  console.log('\n[1] Seeding dormitories...');
  await Dormitory.deleteMany({});

  const dorm1 = new Dormitory({
    name: 'KTX A1 - Bách Khoa',
    address: 'Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
    location: { type: 'Point', coordinates: [105.8412, 21.0045] },
    contact: { phone: '024.3869.2222', email: 'ktxa1@hust.edu.vn' },
    details: {
      type: 'school', category: 'basic', totalFloors: 5,
      amenities: ['WiFi', 'Bãi xe', 'Bảo vệ 24/7', 'Giặt ủi'],
      priceRange: { min: 400000, max: 700000 }, available: true,
    },
    imageUrl:   'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781175726/01-front_unhrum.png',
    coverImage: 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781175726/01-front_unhrum.png',
    images: [
      'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781175726/01-front_unhrum.png',
      'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781175793/07-corner_uj6gfa.png',
      'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781175796/06-door_f8hxgg.png',
    ],
    videos: ['https://res.cloudinary.com/dysgt8t4d/video/upload/v1780934048/ktx-hust/dormitory-videos/gvssl6arhxtdt4s6vv2v.mp4'],
    virtualTour: '/vr-tour',
    floors: [
      {
        floorNumber: 1,
        rooms: [
          { roomNumber: '101', roomType: '8-person', maxCapacity: 8, floor: 1, pricePerMonth: 400000, amenities: ['Quạt', 'Tủ cá nhân', 'Bàn học'], occupants: [] },
          { roomNumber: '102', roomType: '8-person', maxCapacity: 8, floor: 1, pricePerMonth: 400000, amenities: ['Quạt', 'Tủ cá nhân', 'Bàn học'], occupants: [] },
          { roomNumber: '103', roomType: '5-person', maxCapacity: 5, floor: 1, pricePerMonth: 550000, amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng'], occupants: [] },
        ],
      },
      {
        floorNumber: 2,
        rooms: [
          { roomNumber: '201', roomType: '8-person', maxCapacity: 8, floor: 2, pricePerMonth: 400000, amenities: ['Quạt', 'Tủ cá nhân'], occupants: [] },
          { roomNumber: '202', roomType: '4-person-service', maxCapacity: 4, floor: 2, pricePerMonth: 700000, amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng', 'Tủ lạnh'], occupants: [] },
          { roomNumber: '203', roomType: '5-person', maxCapacity: 5, floor: 2, pricePerMonth: 550000, amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học'], occupants: [] },
        ],
      },
      {
        floorNumber: 3,
        rooms: [
          { roomNumber: '301', roomType: '8-person', maxCapacity: 8, floor: 3, pricePerMonth: 400000, amenities: ['Quạt', 'Tủ cá nhân'], occupants: [] },
          { roomNumber: '302', roomType: '8-person', maxCapacity: 8, floor: 3, pricePerMonth: 400000, amenities: ['Quạt', 'Tủ cá nhân'], occupants: [] },
          { roomNumber: '303', roomType: '4-person-service', maxCapacity: 4, floor: 3, pricePerMonth: 700000, amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng', 'Tủ lạnh'], occupants: [] },
        ],
      },
    ],
  });

  const dorm2 = new Dormitory({
    name: 'KTX B2 - Bách Khoa',
    address: 'Số 17 Tạ Quang Bửu, Hai Bà Trưng, Hà Nội',
    location: { type: 'Point', coordinates: [105.8430, 21.0060] },
    contact: { phone: '024.3869.3333', email: 'ktxb2@hust.edu.vn' },
    details: {
      type: 'school', category: 'premium', totalFloors: 4,
      amenities: ['WiFi tốc độ cao', 'Bãi xe', 'Bảo vệ 24/7', 'Phòng sinh hoạt chung', 'Nhà bếp chung'],
      priceRange: { min: 550000, max: 750000 }, available: true,
    },
    imageUrl:   'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781103106/e22ca35b-a539-47d5-9d2d-bb51945ba345_m4tu8o.png',
    coverImage: 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781103106/e22ca35b-a539-47d5-9d2d-bb51945ba345_m4tu8o.png',
    images: [
      'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781103106/e22ca35b-a539-47d5-9d2d-bb51945ba345_m4tu8o.png',
      'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781103106/951abc95-b43e-4ff6-a6f3-7b07786e7bc4_yhvim3.png',
      'https://res.cloudinary.com/dysgt8t4d/image/upload/v1781176046/4a928e90-4fb8-4b4c-be9b-b91d454d2467_yibfor.jpg',
    ],
    videos: ['https://res.cloudinary.com/dysgt8t4d/video/upload/v1781051760/Ultra_realistic_university_dor_d7emty.mp4'],
    virtualTour: '/vr-tour2',
    floors: [
      {
        floorNumber: 1,
        rooms: [
          { roomNumber: '101', roomType: '5-person', maxCapacity: 5, floor: 1, pricePerMonth: 550000, amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học'], occupants: [] },
          { roomNumber: '102', roomType: '4-person-service', maxCapacity: 4, floor: 1, pricePerMonth: 750000, amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng', 'Tủ lạnh', 'TV'], occupants: [] },
        ],
      },
      {
        floorNumber: 2,
        rooms: [
          { roomNumber: '201', roomType: '5-person', maxCapacity: 5, floor: 2, pricePerMonth: 550000, amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'Ban công'], occupants: [] },
          { roomNumber: '202', roomType: '4-person-service', maxCapacity: 4, floor: 2, pricePerMonth: 750000, amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng', 'Tủ lạnh', 'TV'], occupants: [] },
          { roomNumber: '203', roomType: '10-person', maxCapacity: 10, floor: 2, pricePerMonth: 350000, amenities: ['Quạt', 'Tủ cá nhân'], occupants: [] },
        ],
      },
    ],
  });

  await dorm1.save();
  await dorm2.save();
  console.log('  Dormitories created:', dorm1.name, '|', dorm2.name);

  // Get room references from dorm1 floor 2 room 202 (4-person-service) for demo student
  const targetFloor = dorm1.floors.find(f => f.floorNumber === 2);
  const targetRoom  = targetFloor.rooms.find(r => r.roomNumber === '202');

  // ── 2. Students ───────────────────────────────────────────────────────────
  console.log('\n[2] Seeding demo student + roommates...');
  const hash = await bcrypt.hash('Demo@1234', 10);

  await Student.deleteMany({ role: 'user', isProtected: { $ne: true } });

  // Demo student (the one used for screenshots)
  const demoStudent = await Student.create({
    name: 'Nguyễn Văn Minh',
    username: 'sinhvien_demo',
    studentId: '20220001',
    email: 'minh.nv220001@sis.hust.edu.vn',
    phone: '0912345678',
    password: hash,
    faculty: 'Công nghệ Thông tin',
    academicYear: '2022',
    gender: 'male',
    priorityScore: 82,
    role: 'user',
  });
  console.log('  Demo student:', demoStudent.username, '/ password: Demo@1234');

  // 3 roommates
  const rm1 = await Student.create({ name: 'Trần Hữu Đức', username: 'rm_duc', studentId: '20220045', email: 'duc.th220045@sis.hust.edu.vn', phone: '0913111222', password: hash, faculty: 'Điện - Điện tử', academicYear: '2022', gender: 'male', priorityScore: 74, role: 'user' });
  const rm2 = await Student.create({ name: 'Lê Quang Huy', username: 'rm_huy', studentId: '20220089', email: 'huy.lq220089@sis.hust.edu.vn', phone: '0914222333', password: hash, faculty: 'Cơ khí', academicYear: '2022', gender: 'male', priorityScore: 68, role: 'user' });
  const rm3 = await Student.create({ name: 'Phạm Thế Anh', username: 'rm_anh', studentId: '20210033', email: 'anh.pt210033@sis.hust.edu.vn', phone: '0915333444', password: hash, faculty: 'Vật lý kỹ thuật', academicYear: '2021', gender: 'male', priorityScore: 71, role: 'user' });
  console.log('  Roommates: duc, huy, anh');

  // Assign all 4 students to room 202 dorm1
  const allInRoom = [
    { userId: demoStudent._id, name: demoStudent.name, studentId: demoStudent.studentId },
    { userId: rm1._id, name: rm1.name, studentId: rm1.studentId },
    { userId: rm2._id, name: rm2.name, studentId: rm2.studentId },
    { userId: rm3._id, name: rm3.name, studentId: rm3.studentId },
  ];
  targetRoom.occupants = allInRoom.map(s => ({ studentId: s.studentId, name: s.name, userId: s.userId, active: true }));
  await dorm1.save();

  // ── 3. Allocation cycle ───────────────────────────────────────────────────
  console.log('\n[3] Seeding allocation cycle...');
  await AllocCycle.deleteMany({});
  const cycle = await AllocCycle.create({
    name: 'Đợt xét duyệt HK1 2025-2026',
    academicYear: '2025-2026',
    semester: 'HK1',
    registrationStart: new Date('2025-08-01'),
    registrationEnd: new Date('2025-08-31'),
    allocationDate: new Date('2025-09-05'),
    status: 'completed',
  });
  console.log('  Cycle:', cycle.name);

  // ── 4. Room allocation ────────────────────────────────────────────────────
  console.log('\n[4] Seeding room allocation for demo student...');
  await RoomAlloc.deleteMany({ studentId: '20220001' });
  await RoomAlloc.create({
    studentId: demoStudent.studentId,
    studentUserId: demoStudent._id,
    dormitoryId: dorm1._id,
    dormitoryName: dorm1.name,
    roomNumber: '202',
    roomId: targetRoom._id,
    cycleId: cycle._id,
    status: 'assigned',
    assignedAt: new Date('2025-09-05'),
    updatedAt: new Date('2025-09-05'),
  });
  console.log('  Allocated demo student → room 202, KTX A1');

  // ── 5. Maintenance requests ───────────────────────────────────────────────
  console.log('\n[5] Seeding maintenance requests...');
  await Maint.deleteMany({ studentId: demoStudent.studentId });
  const now = new Date();
  await Maint.insertMany([
    {
      requestNumber: 'MR-2025-00001', studentId: demoStudent.studentId, studentUserId: demoStudent._id,
      dormitoryId: dorm1._id, dormitoryName: dorm1.name, roomNumber: '202', floorNumber: 2,
      type: 'electrical', title: 'Ổ điện bị hỏng', description: 'Ổ điện bên cạnh cửa sổ không hoạt động, cần sửa gấp.',
      priority: 'high', status: 'in_progress',
      reportedAt: new Date(now.getTime() - 3 * 24 * 3600 * 1000),
      updatedAt: new Date(now.getTime() - 1 * 24 * 3600 * 1000),
    },
    {
      requestNumber: 'MR-2025-00002', studentId: demoStudent.studentId, studentUserId: demoStudent._id,
      dormitoryId: dorm1._id, dormitoryName: dorm1.name, roomNumber: '202', floorNumber: 2,
      type: 'plumbing', title: 'Vòi nước bị rò rỉ', description: 'Vòi nước trong phòng tắm bị rò rỉ từ 2 hôm nay.',
      priority: 'medium', status: 'completed',
      reportedAt: new Date(now.getTime() - 10 * 24 * 3600 * 1000),
      updatedAt: new Date(now.getTime() - 7 * 24 * 3600 * 1000),
    },
    {
      requestNumber: 'MR-2025-00003', studentId: demoStudent.studentId, studentUserId: demoStudent._id,
      dormitoryId: dorm1._id, dormitoryName: dorm1.name, roomNumber: '202', floorNumber: 2,
      type: 'internet', title: 'Mạng WiFi chậm bất thường', description: 'WiFi phòng 202 chập chờn từ tối qua, download speed < 1Mbps.',
      priority: 'medium', status: 'submitted',
      reportedAt: new Date(now.getTime() - 0.5 * 24 * 3600 * 1000),
      updatedAt: new Date(now.getTime() - 0.5 * 24 * 3600 * 1000),
    },
  ]);
  console.log('  3 maintenance requests created.');

  // ── 6. Notifications ──────────────────────────────────────────────────────
  console.log('\n[6] Seeding notifications...');
  await Notif.deleteMany({ targetUsers: demoStudent._id });
  await Notif.deleteMany({ isGlobal: true });
  await Notif.insertMany([
    {
      title: 'Xếp phòng thành công', type: 'success', category: 'allocation', priority: 'high',
      message: 'Chúc mừng! Bạn đã được xếp vào Phòng 202, KTX A1 - Bách Khoa. Vui lòng nhận chìa khóa trong vòng 3 ngày.',
      targetUsers: [demoStudent._id], isGlobal: false, readBy: [],
      createdAt: new Date(now.getTime() - 5 * 24 * 3600 * 1000),
    },
    {
      title: 'Yêu cầu bảo trì được tiếp nhận', type: 'info', category: 'maintenance', priority: 'normal',
      message: 'Yêu cầu MR-2025-00001 (Ổ điện bị hỏng) đã được tiếp nhận. Kỹ thuật viên sẽ xử lý trong 24 giờ.',
      targetUsers: [demoStudent._id], isGlobal: false, readBy: [demoStudent._id],
      createdAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
    },
    {
      title: 'Thông báo đóng phí ký túc xá HK1', type: 'warning', category: 'system', priority: 'high',
      message: 'Hạn cuối đóng phí ký túc xá học kỳ 1 năm học 2025-2026 là ngày 30/09/2025. Sinh viên chưa đóng phí sẽ bị hủy suất ở.',
      isGlobal: true, targetRole: 'user', readBy: [],
      createdAt: new Date(now.getTime() - 1 * 24 * 3600 * 1000),
    },
    {
      title: 'Quy định ra vào KTX ban đêm', type: 'info', category: 'announcement', priority: 'normal',
      message: 'Từ ngày 01/10/2025, cổng KTX sẽ đóng lúc 23:00. Sinh viên về sau giờ quy định cần xuất trình thẻ cư trú tại bảo vệ.',
      isGlobal: true, targetRole: 'user', readBy: [demoStudent._id],
      createdAt: new Date(now.getTime() - 3 * 24 * 3600 * 1000),
    },
    {
      title: 'Hệ thống bảo trì định kỳ', type: 'info', category: 'system', priority: 'low',
      message: 'Hệ thống sẽ bảo trì từ 02:00 - 04:00 ngày 01/06/2025. Trong thời gian này, ứng dụng có thể hoạt động không ổn định.',
      isGlobal: true, targetRole: 'all', readBy: [demoStudent._id],
      createdAt: new Date(now.getTime() - 7 * 24 * 3600 * 1000),
    },
  ]);
  console.log('  5 notifications created (2 unread for demo student).');

  // ── 7. Add more occupants to other rooms for realistic data ───────────────
  console.log('\n[7] Adding other students to other rooms for realistic occupancy...');
  const extraHash = await bcrypt.hash('Extra@1234', 10);
  const extraStudents = [];
  for (let i = 0; i < 6; i++) {
    const s = await Student.create({
      name: `Sinh viên ${String(i+1).padStart(2,'0')}`,
      username: `student_extra_${i+1}`,
      studentId: `2023000${i+1}`,
      email: `sv${i+1}@sis.hust.edu.vn`,
      phone: `091${String(7000+i)}`,
      password: extraHash,
      faculty: ['Cơ khí','Điện - Điện tử','IT','Hóa học'][i % 4],
      academicYear: ['2022','2023','2023','2022','2021','2024'][i],
      gender: i % 2 === 0 ? 'male' : 'female',
      priorityScore: 55 + i * 3,
      role: 'user',
    });
    extraStudents.push(s);
  }
  // Assign them to room 101 dorm1 (8-person) to show partial occupancy
  const room101 = dorm1.floors[0].rooms.find(r => r.roomNumber === '101');
  room101.occupants = extraStudents.slice(0, 5).map(s => ({ studentId: s.studentId, name: s.name, userId: s._id, active: true }));
  await dorm1.save();
  console.log('  6 extra students added, room 101 partially filled (5/8).');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✅ Demo seed complete!');
  console.log('   Login:     username=sinhvien_demo  password=Demo@1234');
  console.log('   Room:      202, KTX A1 - Bách Khoa, tầng 2, 4-person-service, 700,000đ/người/tháng');
  console.log('   Roommates: Trần Hữu Đức, Lê Quang Huy, Phạm Thế Anh');
  console.log('   Unread notifications: 2');
  console.log('   Maintenance: 1 in_progress, 1 completed, 1 submitted');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => { console.error('Seed failed:', err); process.exit(1); });
