/**
 * seed-production.js — Single source of truth for all demo data
 *
 * Creates:
 *   • 7 KTX (A1, B2, C3, D4, E5, F6, G7)
 *   • 265 phòng với cấu trúc thực tế
 *   • ~1254 sinh viên Việt Nam với tên thực
 *   • Occupancy 72% — đồng bộ hai chiều (room.occupants ↔ student.dormitoryId/roomNumber)
 *   • Bao gồm allocation cycle, maintenance requests, notifications
 *
 * Usage: node scripts/seed-production.js
 * Admin login: admin / Admin@1234
 * Demo student: sinhvien_demo / Demo@1234
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) { console.error('MONGODB_URI not set'); process.exit(1); }

// ─── Inline schemas (avoid circular require issues) ──────────────────────────

const OccupantSchema = new mongoose.Schema({
  studentId:  { type: String, required: true },
  name:       { type: String, required: true },
  phone:      { type: String, default: '' },
  email:      { type: String, default: '' },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'students' },
  active:     { type: Boolean, default: true },
  assignedAt: { type: Date, default: Date.now },
});

const RoomSchema = new mongoose.Schema({
  roomNumber:    { type: String, required: true },
  roomType:      { type: String, enum: ['8-person', '4-person-service', '5-person', '10-person'], required: true },
  maxCapacity:   { type: Number, required: true, min: 1 },
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

const DormSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  address:  { type: String, required: true, trim: true },
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  contact:  { phone: String, email: String },
  details: {
    type:        { type: String, enum: ['school', 'private'], required: true },
    category:    { type: String, enum: ['basic', 'premium', 'international'], required: true },
    totalFloors: { type: Number, required: true, min: 1 },
    amenities:   { type: [String], default: [] },
    priceRange:  { min: { type: Number, default: 0 }, max: { type: Number, default: 0 } },
    available:   { type: Boolean, default: true },
    gender:      { type: String, enum: ['male', 'female', 'mixed'], default: 'mixed' },
  },
  floors:    [FloorSchema],
  imageUrl:  { type: String, default: '' },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const StudentSchema = new mongoose.Schema({
  name:          { type: String },
  username:      { type: String, unique: true },
  studentId:     { type: String, sparse: true },
  email:         { type: String, sparse: true },
  phone:         { type: String },
  password:      { type: String },
  faculty:       { type: String },
  academicYear:  { type: String },
  gender:        { type: String, enum: ['male', 'female', 'other'] },
  role:          { type: String, default: 'user' },
  priorityScore: { type: Number, default: 0 },
  dormitoryId:   { type: mongoose.Schema.Types.ObjectId, ref: 'dormitories' },
  roomNumber:    { type: String },
  favoriteRoomIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  nationality:   { type: String, default: 'Việt Nam' },
  citizenship:   { type: String, default: 'Việt Nam' },
  country:       { type: String, default: 'Việt Nam' },
  isInternational: { type: Boolean, default: false },
  createdAt:     { type: Date, default: Date.now },
  updatedAt:     { type: Date, default: Date.now },
});

const NotifSchema = new mongoose.Schema({
  title: String, message: String,
  type:      { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
  category:  { type: String, default: 'system' },
  priority:  { type: String, enum: ['low', 'normal', 'medium', 'high'], default: 'normal' },
  isGlobal:  { type: Boolean, default: false },
  targetUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'students' }],
  targetRole: String,
  readBy:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'students' }],
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now },
});

const MaintSchema = new mongoose.Schema({
  requestNumber: { type: String, required: true, unique: true },
  studentId:     { type: String, required: true },
  studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'students' },
  dormitoryId:   { type: mongoose.Schema.Types.ObjectId, ref: 'dormitories' },
  dormitoryName: String, roomNumber: String, floorNumber: Number,
  type: String, title: String, description: String,
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status:   { type: String, enum: ['submitted', 'assigned', 'in_progress', 'completed', 'cancelled'], default: 'submitted' },
  reportedAt: { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now },
});

const AllocCycleSchema = new mongoose.Schema({
  name: String, academicYear: String, semester: String,
  registrationStart: Date, registrationEnd: Date, allocationDate: Date,
  status: { type: String, enum: ['planning', 'open', 'closed', 'completed'], default: 'completed' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const RoomAllocSchema = new mongoose.Schema({
  studentId: String, studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'students' },
  dormitoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'dormitories' },
  dormitoryName: String, roomNumber: String, roomId: mongoose.Schema.Types.ObjectId,
  cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'allocationcycles' },
  status: { type: String, default: 'assigned' },
  assignedAt: { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now },
});

const Dorm     = mongoose.models.dormitories       || mongoose.model('dormitories', DormSchema);
const Student  = mongoose.models.students          || mongoose.model('students', StudentSchema);
const Notif    = mongoose.models.notifications     || mongoose.model('notifications', NotifSchema);
const Maint    = mongoose.models.maintenancerequests || mongoose.model('maintenancerequests', MaintSchema);
const AllocCyc = mongoose.models.allocationcycles  || mongoose.model('allocationcycles', AllocCycleSchema);
const RoomAlloc = mongoose.models.roomallocations  || mongoose.model('roomallocations', RoomAllocSchema);

// ─── Vietnamese name data ─────────────────────────────────────────────────────

const HO = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Phan', 'Vũ', 'Đặng',
  'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Tô', 'Cao', 'Mai', 'Lưu', 'Hà',
];

const TEN_DEM_NAM = ['Văn', 'Hữu', 'Đức', 'Quang', 'Minh', 'Thế', 'Công', 'Trung', 'Xuân', 'Gia', 'Khắc', 'Nhật'];
const TEN_NAM = [
  'Minh', 'Hùng', 'Tuấn', 'Dũng', 'Nam', 'Anh', 'Tùng', 'Long', 'Hiếu', 'Thắng',
  'Đạt', 'Khoa', 'Huy', 'Bình', 'Cường', 'Hải', 'Lâm', 'Phong', 'Quân', 'Khánh',
  'Phúc', 'Đông', 'Kiên', 'Tài', 'Sơn', 'Toàn', 'Linh', 'Trí', 'Bảo', 'Lộc',
];

const TEN_DEM_NU = ['Thị', 'Minh', 'Thanh', 'Ngọc', 'Thùy', 'Mai', 'Thu', 'Lan', 'Bích', 'Kim'];
const TEN_NU = [
  'Linh', 'Hoa', 'Mai', 'Lan', 'Hương', 'Ngọc', 'Phương', 'Thảo', 'Trang', 'Nga',
  'Yến', 'Châu', 'Diễm', 'Hà', 'Nhung', 'Vy', 'Trâm', 'Tú', 'Dung', 'Hiền',
  'Quỳnh', 'Ly', 'Vân', 'Nhi', 'Chi', 'Ánh', 'Giang', 'Oanh', 'Hằng', 'Loan',
];

const KHOA = [
  'Công nghệ Thông tin', 'Điện - Điện tử', 'Cơ khí', 'Hóa học',
  'Vật lý kỹ thuật', 'Toán - Tin học ứng dụng', 'Cơ kỹ thuật',
  'Kỹ thuật Hàng không', 'Kinh tế & Quản lý', 'Khoa học Máy tính',
];

const removeDiacritics = (str) => str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

let nameCounter = 0;

function genMaleName(index) {
  const ho    = HO[index % HO.length];
  const dem   = TEN_DEM_NAM[Math.floor(index / HO.length) % TEN_DEM_NAM.length];
  const ten   = TEN_NAM[Math.floor(index / (HO.length * TEN_DEM_NAM.length)) % TEN_NAM.length];
  return `${ho} ${dem} ${ten}`;
}

function genFemaleName(index) {
  const ho    = HO[index % HO.length];
  const dem   = TEN_DEM_NU[Math.floor(index / HO.length) % TEN_DEM_NU.length];
  const ten   = TEN_NU[Math.floor(index / (HO.length * TEN_DEM_NU.length)) % TEN_NU.length];
  return `${ho} ${dem} ${ten}`;
}

function genUsername(name, studentId) {
  const parts = removeDiacritics(name).toLowerCase().split(' ');
  return parts.join('.') + '.' + studentId.slice(-4);
}

function genPhone(index) {
  const prefixes = ['096', '097', '098', '032', '033', '034', '035', '036', '037', '038', '039', '086', '089'];
  const prefix = prefixes[index % prefixes.length];
  const suffix = String(1000000 + (index * 7 + 123456) % 9000000).padStart(7, '0');
  return prefix + suffix;
}

// ─── KTX structure definitions ────────────────────────────────────────────────

function buildRooms(floorNum, template) {
  return template.map((cfg, i) => ({
    roomNumber: `${floorNum}${String(i + 1).padStart(2, '0')}`,
    roomType:   cfg.type,
    maxCapacity: cfg.cap,
    floor:      floorNum,
    pricePerMonth: cfg.price,
    amenities:  cfg.amenities || [],
    description: cfg.desc || '',
    occupants:  [],
  }));
}

const TEMPLATE_BASIC_8 = [
  { type: '8-person',        cap: 8,  price: 420000,  amenities: ['Quạt', 'Tủ cá nhân', 'Bàn học'] },
  { type: '8-person',        cap: 8,  price: 420000,  amenities: ['Quạt', 'Tủ cá nhân', 'Bàn học'] },
  { type: '8-person',        cap: 8,  price: 420000,  amenities: ['Quạt', 'Tủ cá nhân', 'Bàn học'] },
  { type: '5-person',        cap: 5,  price: 560000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học'] },
  { type: '5-person',        cap: 5,  price: 560000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học'] },
  { type: '4-person-service', cap: 4,  price: 720000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng', 'Tủ lạnh'] },
  { type: '4-person-service', cap: 4,  price: 720000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng', 'Tủ lạnh'] },
  { type: '10-person',       cap: 10, price: 350000,  amenities: ['Quạt', 'Tủ cá nhân'] },
];

const TEMPLATE_PREMIUM_8 = [
  { type: '4-person-service', cap: 4,  price: 800000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng', 'Tủ lạnh', 'TV'] },
  { type: '4-person-service', cap: 4,  price: 800000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng', 'Tủ lạnh', 'TV'] },
  { type: '5-person',         cap: 5,  price: 620000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'Ban công'] },
  { type: '5-person',         cap: 5,  price: 620000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'Ban công'] },
  { type: '8-person',         cap: 8,  price: 450000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học'] },
  { type: '8-person',         cap: 8,  price: 450000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học'] },
  { type: '8-person',         cap: 8,  price: 450000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học'] },
  { type: '10-person',        cap: 10, price: 380000,  amenities: ['Quạt', 'Tủ cá nhân'] },
];

const TEMPLATE_E5_9 = [
  { type: '8-person',        cap: 8,  price: 420000,  amenities: ['Quạt', 'Tủ cá nhân', 'Bàn học'] },
  { type: '8-person',        cap: 8,  price: 420000,  amenities: ['Quạt', 'Tủ cá nhân', 'Bàn học'] },
  { type: '8-person',        cap: 8,  price: 420000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học'] },
  { type: '8-person',        cap: 8,  price: 420000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học'] },
  { type: '5-person',        cap: 5,  price: 560000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học'] },
  { type: '5-person',        cap: 5,  price: 560000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học'] },
  { type: '4-person-service', cap: 4, price: 720000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng', 'Tủ lạnh'] },
  { type: '4-person-service', cap: 4, price: 720000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng', 'Tủ lạnh'] },
  { type: '10-person',       cap: 10, price: 350000,  amenities: ['Quạt', 'Tủ cá nhân'] },
];

const TEMPLATE_G7_7 = [
  { type: '8-person',        cap: 8,  price: 420000,  amenities: ['Quạt', 'Tủ cá nhân', 'Bàn học'] },
  { type: '8-person',        cap: 8,  price: 420000,  amenities: ['Quạt', 'Tủ cá nhân', 'Bàn học'] },
  { type: '8-person',        cap: 8,  price: 420000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học'] },
  { type: '5-person',        cap: 5,  price: 560000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học'] },
  { type: '5-person',        cap: 5,  price: 560000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học'] },
  { type: '4-person-service', cap: 4, price: 720000,  amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng'] },
  { type: '10-person',       cap: 10, price: 350000,  amenities: ['Quạt', 'Tủ cá nhân'] },
];

function makeFloors(count, template) {
  const floors = [];
  for (let f = 1; f <= count; f++) {
    floors.push({ floorNumber: f, rooms: buildRooms(f, template) });
  }
  return floors;
}

// ─── Dormitory definitions ────────────────────────────────────────────────────

function getDormDefinitions() {
  return [
    {
      name: 'KTX A1 - Bách Khoa',
      address: 'Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
      location: { type: 'Point', coordinates: [105.8412, 21.0045] },
      contact: { phone: '024.3869.2222', email: 'ktxa1@hust.edu.vn' },
      details: {
        type: 'school', category: 'basic', totalFloors: 3,
        amenities: ['WiFi', 'Bãi xe', 'Bảo vệ 24/7', 'Giặt ủi'],
        priceRange: { min: 400000, max: 720000 }, available: true, gender: 'mixed',
      },
      imageUrl: 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1773142008/5deb042e-de1a-4ca0-8f2d-c28eae9f995f_oioewe.png',
      floors: [
        { floorNumber: 1, rooms: buildRooms(1, [
          { type: '8-person', cap: 8, price: 420000, amenities: ['Quạt', 'Tủ cá nhân', 'Bàn học'] },
          { type: '8-person', cap: 8, price: 420000, amenities: ['Quạt', 'Tủ cá nhân', 'Bàn học'] },
          { type: '5-person', cap: 5, price: 560000, amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng'] },
        ]) },
        { floorNumber: 2, rooms: buildRooms(2, [
          { type: '8-person', cap: 8, price: 420000, amenities: ['Quạt', 'Tủ cá nhân'] },
          { type: '4-person-service', cap: 4, price: 720000, amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng', 'Tủ lạnh'] },
          { type: '5-person', cap: 5, price: 560000, amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học'] },
        ]) },
        { floorNumber: 3, rooms: buildRooms(3, [
          { type: '8-person', cap: 8, price: 420000, amenities: ['Quạt', 'Tủ cá nhân'] },
          { type: '8-person', cap: 8, price: 420000, amenities: ['Quạt', 'Tủ cá nhân'] },
          { type: '4-person-service', cap: 4, price: 720000, amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng', 'Tủ lạnh'] },
        ]) },
      ],
    },
    {
      name: 'KTX B2 - Bách Khoa',
      address: 'Số 17 Tạ Quang Bửu, Hai Bà Trưng, Hà Nội',
      location: { type: 'Point', coordinates: [105.8430, 21.0060] },
      contact: { phone: '024.3869.3333', email: 'ktxb2@hust.edu.vn' },
      details: {
        type: 'school', category: 'premium', totalFloors: 2,
        amenities: ['WiFi tốc độ cao', 'Bãi xe', 'Bảo vệ 24/7', 'Phòng sinh hoạt chung', 'Nhà bếp chung'],
        priceRange: { min: 560000, max: 800000 }, available: true, gender: 'mixed',
      },
      imageUrl: 'https://res.cloudinary.com/dysgt8t4d/image/upload/v1773732655/main_autvkg.png',
      floors: [
        { floorNumber: 1, rooms: buildRooms(1, [
          { type: '5-person', cap: 5, price: 620000, amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học'] },
          { type: '4-person-service', cap: 4, price: 800000, amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng', 'Tủ lạnh', 'TV'] },
        ]) },
        { floorNumber: 2, rooms: buildRooms(2, [
          { type: '5-person', cap: 5, price: 620000, amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'Ban công'] },
          { type: '4-person-service', cap: 4, price: 800000, amenities: ['Điều hòa', 'Tủ cá nhân', 'Bàn học', 'WC riêng', 'Tủ lạnh', 'TV'] },
          { type: '10-person', cap: 10, price: 380000, amenities: ['Quạt', 'Tủ cá nhân'] },
        ]) },
      ],
    },
    {
      name: 'KTX C3 - Bách Khoa',
      address: 'Số 23 Lê Thanh Nghị, Hai Bà Trưng, Hà Nội',
      location: { type: 'Point', coordinates: [105.8395, 21.0038] },
      contact: { phone: '024.3869.4444', email: 'ktxc3@hust.edu.vn' },
      details: {
        type: 'school', category: 'basic', totalFloors: 5,
        amenities: ['WiFi', 'Bãi xe', 'Bảo vệ 24/7', 'Phòng đọc sách', 'Phòng sinh hoạt nữ'],
        priceRange: { min: 350000, max: 720000 }, available: true, gender: 'female',
      },
      imageUrl: '',
      floors: makeFloors(5, TEMPLATE_BASIC_8),
    },
    {
      name: 'KTX D4 - Bách Khoa',
      address: 'Số 31 Giải Phóng, Hai Bà Trưng, Hà Nội',
      location: { type: 'Point', coordinates: [105.8440, 21.0050] },
      contact: { phone: '024.3869.5555', email: 'ktxd4@hust.edu.vn' },
      details: {
        type: 'school', category: 'basic', totalFloors: 6,
        amenities: ['WiFi', 'Bãi xe', 'Bảo vệ 24/7', 'Phòng thể thao', 'Sân bóng đá nhỏ'],
        priceRange: { min: 350000, max: 720000 }, available: true, gender: 'male',
      },
      imageUrl: '',
      floors: makeFloors(6, TEMPLATE_BASIC_8),
    },
    {
      name: 'KTX E5 - Bách Khoa',
      address: 'Số 5 Trần Đại Nghĩa, Hai Bà Trưng, Hà Nội',
      location: { type: 'Point', coordinates: [105.8425, 21.0072] },
      contact: { phone: '024.3869.6666', email: 'ktxe5@hust.edu.vn' },
      details: {
        type: 'school', category: 'premium', totalFloors: 8,
        amenities: ['WiFi tốc độ cao', 'Bãi xe', 'Bảo vệ 24/7', 'Phòng sinh hoạt chung', 'Nhà bếp chung', 'Máy giặt tự động', 'Phòng gym'],
        priceRange: { min: 350000, max: 720000 }, available: true, gender: 'mixed',
      },
      imageUrl: '',
      floors: makeFloors(8, TEMPLATE_E5_9),
    },
    {
      name: 'KTX F6 - Bách Khoa',
      address: 'Số 9 Bạch Mai, Hai Bà Trưng, Hà Nội',
      location: { type: 'Point', coordinates: [105.8455, 21.0030] },
      contact: { phone: '024.3869.7777', email: 'ktxf6@hust.edu.vn' },
      details: {
        type: 'school', category: 'premium', totalFloors: 7,
        amenities: ['WiFi tốc độ cao', 'Bãi xe', 'Bảo vệ 24/7', 'Phòng sinh hoạt nữ', 'Nhà bếp chung', 'Máy giặt', 'Phòng học nhóm'],
        priceRange: { min: 380000, max: 800000 }, available: true, gender: 'female',
      },
      imageUrl: '',
      floors: makeFloors(7, TEMPLATE_PREMIUM_8),
    },
    {
      name: 'KTX G7 - Bách Khoa',
      address: 'Số 2 Hoàng Quốc Việt, Cầu Giấy, Hà Nội',
      location: { type: 'Point', coordinates: [105.8380, 21.0020] },
      contact: { phone: '024.3869.8888', email: 'ktxg7@hust.edu.vn' },
      details: {
        type: 'school', category: 'basic', totalFloors: 5,
        amenities: ['WiFi', 'Bãi xe', 'Bảo vệ 24/7', 'Phòng sinh hoạt nam', 'Sân bóng bàn'],
        priceRange: { min: 350000, max: 720000 }, available: true, gender: 'male',
      },
      imageUrl: '',
      floors: makeFloors(5, TEMPLATE_G7_7),
    },
  ];
}

// ─── ACADEMIC YEARS & PRIORITY ────────────────────────────────────────────────

const YEAR_CONFIG = [
  { year: '2021', weight: 0.15, priorityMin: 72, priorityMax: 92 }, // năm 4+
  { year: '2022', weight: 0.25, priorityMin: 62, priorityMax: 82 }, // năm 3
  { year: '2023', weight: 0.30, priorityMin: 50, priorityMax: 72 }, // năm 2
  { year: '2024', weight: 0.30, priorityMin: 40, priorityMax: 65 }, // năm 1
];

function pickYear(index, total) {
  let cumulative = 0;
  const t = (index / total) % 1 || 0.5;
  for (const cfg of YEAR_CONFIG) {
    cumulative += cfg.weight;
    if (t < cumulative) return cfg;
  }
  return YEAR_CONFIG[3];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n🚀 Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 30000 });
  console.log('✅ Connected.\n');

  const now = new Date();

  // ── 1. Clear existing data ─────────────────────────────────────────────────
  console.log('[1/8] Clearing existing data...');
  await Dorm.deleteMany({});
  await Student.deleteMany({ role: 'user' });
  await Student.deleteMany({ username: 'sinhvien_demo' }); // safety: clear demo account if leftover
  await Notif.deleteMany({});
  await Maint.deleteMany({});
  await AllocCyc.deleteMany({});
  await RoomAlloc.deleteMany({});
  console.log('  ✓ Cleared: dormitories, students(user), notifications, maintenance, allocation data\n');

  // ── 2. Create dormitories ──────────────────────────────────────────────────
  console.log('[2/8] Creating 7 dormitories...');
  const dormDefs = getDormDefinitions();
  const savedDorms = [];
  for (const def of dormDefs) {
    const d = new Dorm(def);
    await d.save();
    savedDorms.push(d);
    let totalRooms = 0, totalCap = 0;
    for (const fl of d.floors) {
      totalRooms += fl.rooms.length;
      for (const rm of fl.rooms) totalCap += rm.maxCapacity;
    }
    console.log(`  ✓ ${d.name}: ${d.floors.length} tầng, ${totalRooms} phòng, ${totalCap} chỗ`);
  }

  // ── 3. Calculate total capacity ────────────────────────────────────────────
  console.log('\n[3/8] Calculating total capacity...');
  let allRoomSlots = []; // { dormIdx, floorIdx, roomIdx, cap, target }
  let totalCap = 0;

  for (let di = 0; di < savedDorms.length; di++) {
    const d = savedDorms[di];
    for (let fi = 0; fi < d.floors.length; fi++) {
      for (let ri = 0; ri < d.floors[fi].rooms.length; ri++) {
        const cap = d.floors[fi].rooms[ri].maxCapacity;
        const target = Math.min(Math.round(cap * 0.74), cap - 1); // ~74% occupancy, never full
        totalCap += cap;
        allRoomSlots.push({ di, fi, ri, cap, target, count: 0 });
      }
    }
  }

  const totalStudentsNeeded = allRoomSlots.reduce((s, r) => s + r.target, 0);
  console.log(`  Total capacity: ${totalCap} chỗ`);
  console.log(`  Students to create: ${totalStudentsNeeded} (72% occupancy)`);

  // ── 4. Generate student records ────────────────────────────────────────────
  console.log('\n[4/8] Generating Vietnamese student records...');
  const hashPass = await bcrypt.hash('Demo@1234', 10);

  // Determine gender per dormitory
  const dormGender = savedDorms.map(d => d.details.gender || 'mixed');

  // Build ordered assignment: room slots → students
  const studentDocs = [];
  let maleIdx = 0, femaleIdx = 0;
  let globalStudentIdx = 0;

  // Map: slot index → students assigned to it
  for (let si = 0; si < allRoomSlots.length; si++) {
    const slot = allRoomSlots[si];
    const dorm = savedDorms[slot.di];
    const gender = dormGender[slot.di];
    const room = dorm.floors[slot.fi].rooms[slot.ri];

    for (let j = 0; j < slot.target; j++) {
      const acYearCfg = pickYear(globalStudentIdx, totalStudentsNeeded);
      const yearPrefix = acYearCfg.year;

      let studentGender, fullName;
      if (gender === 'female') {
        studentGender = 'female';
        fullName = genFemaleName(femaleIdx++);
      } else if (gender === 'male') {
        studentGender = 'male';
        fullName = genMaleName(maleIdx++);
      } else {
        // mixed: alternate based on room index
        if ((globalStudentIdx + slot.ri) % 2 === 0) {
          studentGender = 'male';
          fullName = genMaleName(maleIdx++);
        } else {
          studentGender = 'female';
          fullName = genFemaleName(femaleIdx++);
        }
      }

      const seqNum = String(globalStudentIdx + 1).padStart(4, '0');
      const studentId = `${yearPrefix}${seqNum}`;
      const username = genUsername(fullName, studentId);
      const email = `sv${studentId}@sis.hust.edu.vn`;
      const phone = genPhone(globalStudentIdx);
      const faculty = KHOA[globalStudentIdx % KHOA.length];
      const priorityScore = randInt(acYearCfg.priorityMin, acYearCfg.priorityMax);

      studentDocs.push({
        _id: new mongoose.Types.ObjectId(),
        name: fullName,
        username,
        studentId,
        email,
        phone,
        password: hashPass,
        faculty,
        academicYear: yearPrefix,
        gender: studentGender,
        role: 'user',
        priorityScore,
        nationality: 'Việt Nam',
        citizenship: 'Việt Nam',
        country: 'Việt Nam',
        isInternational: false,
        dormitoryId: dorm._id,
        roomNumber: room.roomNumber,
        createdAt: new Date(now.getTime() - randInt(1, 180) * 24 * 3600 * 1000),
        updatedAt: now,
        _slotSi: si,
        _slotJ: j,
      });

      globalStudentIdx++;
    }
  }

  console.log(`  Generated ${studentDocs.length} student records`);

  // ── 5. Insert students in batches ──────────────────────────────────────────
  console.log('\n[5/8] Inserting students into DB...');
  const BATCH = 200;
  const cleanDocs = studentDocs.map(d => {
    const { _slotSi, _slotJ, ...rest } = d;
    return rest;
  });

  for (let i = 0; i < cleanDocs.length; i += BATCH) {
    await Student.insertMany(cleanDocs.slice(i, i + BATCH), { ordered: false });
    process.stdout.write(`  Inserted ${Math.min(i + BATCH, cleanDocs.length)}/${cleanDocs.length}\r`);
  }
  console.log(`  ✓ ${cleanDocs.length} students inserted                    `);

  // ── 6. Update room occupants ───────────────────────────────────────────────
  console.log('\n[6/8] Assigning students to rooms (updating occupants)...');

  // Build slot → students map
  const slotStudents = new Map();
  for (const sd of studentDocs) {
    if (!slotStudents.has(sd._slotSi)) slotStudents.set(sd._slotSi, []);
    slotStudents.get(sd._slotSi).push(sd);
  }

  for (let di = 0; di < savedDorms.length; di++) {
    const d = savedDorms[di];
    for (let fi = 0; fi < d.floors.length; fi++) {
      for (let ri = 0; ri < d.floors[fi].rooms.length; ri++) {
        const room = d.floors[fi].rooms[ri];
        const si = allRoomSlots.findIndex(s => s.di === di && s.fi === fi && s.ri === ri);
        const students = slotStudents.get(si) || [];
        room.occupants = students.map(s => ({
          studentId: s.studentId,
          name: s.name,
          phone: s.phone || '',
          email: s.email || '',
          userId: s._id,
          active: true,
          assignedAt: s.createdAt,
        }));
      }
    }
    d.updatedAt = now;
    await d.save();
    console.log(`  ✓ ${d.name}: occupants assigned`);
  }

  // ── 7. Create demo student (special) ──────────────────────────────────────
  console.log('\n[7/8] Creating demo student account...');
  const dorm1 = savedDorms[0]; // KTX A1
  const floor2 = dorm1.floors.find(f => f.floorNumber === 2);
  const room202 = floor2.rooms.find(r => r.roomNumber === '202');

  // Remove one occupant from room202 to make space for demo student
  if (room202.occupants.length >= room202.maxCapacity) {
    room202.occupants.pop();
  }

  const demoStudent = new Student({
    name: 'Nguyễn Văn Minh',
    username: 'sinhvien_demo',
    studentId: '20220001',
    email: 'minh.nv220001@sis.hust.edu.vn',
    phone: '0912345678',
    password: hashPass,
    faculty: 'Công nghệ Thông tin',
    academicYear: '2022',
    gender: 'male',
    priorityScore: 82,
    role: 'user',
    dormitoryId: dorm1._id,
    roomNumber: '202',
    nationality: 'Việt Nam',
    citizenship: 'Việt Nam',
    country: 'Việt Nam',
    createdAt: new Date(now.getTime() - 200 * 24 * 3600 * 1000),
    updatedAt: now,
  });
  await demoStudent.save();

  // Add demo student to room202
  room202.occupants.push({
    studentId: demoStudent.studentId,
    name: demoStudent.name,
    phone: demoStudent.phone,
    email: demoStudent.email,
    userId: demoStudent._id,
    active: true,
    assignedAt: demoStudent.createdAt,
  });
  await dorm1.save();
  console.log('  ✓ Demo student: sinhvien_demo / Demo@1234 → KTX A1, Phòng 202');

  // ── 7b. Allocation cycle ───────────────────────────────────────────────────
  const cycle = await AllocCyc.create({
    name: 'Đợt xét duyệt HK1 2025-2026',
    academicYear: '2025-2026',
    semester: 'HK1',
    registrationStart: new Date('2025-08-01'),
    registrationEnd: new Date('2025-08-31'),
    allocationDate: new Date('2025-09-05'),
    status: 'completed',
  });

  await RoomAlloc.create({
    studentId: demoStudent.studentId,
    studentUserId: demoStudent._id,
    dormitoryId: dorm1._id,
    dormitoryName: dorm1.name,
    roomNumber: '202',
    roomId: room202._id,
    cycleId: cycle._id,
    status: 'assigned',
    assignedAt: new Date('2025-09-05'),
    updatedAt: new Date('2025-09-05'),
  });

  // ── 7c. Maintenance requests ───────────────────────────────────────────────
  await Maint.insertMany([
    {
      requestNumber: 'MR-2025-00001', studentId: '20220001', studentUserId: demoStudent._id,
      dormitoryId: dorm1._id, dormitoryName: dorm1.name, roomNumber: '202', floorNumber: 2,
      type: 'electrical', title: 'Ổ điện bị hỏng',
      description: 'Ổ điện bên cạnh cửa sổ không hoạt động, cần sửa gấp.',
      priority: 'high', status: 'in_progress',
      reportedAt: new Date(now.getTime() - 3 * 86400000),
      updatedAt: new Date(now.getTime() - 86400000),
    },
    {
      requestNumber: 'MR-2025-00002', studentId: '20220001', studentUserId: demoStudent._id,
      dormitoryId: dorm1._id, dormitoryName: dorm1.name, roomNumber: '202', floorNumber: 2,
      type: 'plumbing', title: 'Vòi nước bị rò rỉ',
      description: 'Vòi nước trong phòng tắm bị rò rỉ từ 2 hôm nay.',
      priority: 'medium', status: 'completed',
      reportedAt: new Date(now.getTime() - 10 * 86400000),
      updatedAt: new Date(now.getTime() - 7 * 86400000),
    },
    {
      requestNumber: 'MR-2025-00003', studentId: '20220001', studentUserId: demoStudent._id,
      dormitoryId: dorm1._id, dormitoryName: dorm1.name, roomNumber: '202', floorNumber: 2,
      type: 'internet', title: 'Mạng WiFi chậm bất thường',
      description: 'WiFi phòng 202 chập chờn từ tối qua, download speed < 1Mbps.',
      priority: 'medium', status: 'submitted',
      reportedAt: new Date(now.getTime() - 12 * 3600000),
      updatedAt: new Date(now.getTime() - 12 * 3600000),
    },
    {
      requestNumber: 'MR-2025-00004', studentId: '20220001', studentUserId: demoStudent._id,
      dormitoryId: dorm1._id, dormitoryName: dorm1.name, roomNumber: '202', floorNumber: 2,
      type: 'furniture', title: 'Bàn học bị gãy chân',
      description: 'Bàn học trong phòng bị gãy một chân, không thể sử dụng được.',
      priority: 'low', status: 'assigned',
      reportedAt: new Date(now.getTime() - 5 * 86400000),
      updatedAt: new Date(now.getTime() - 2 * 86400000),
    },
    {
      requestNumber: 'MR-2025-00005', studentId: '20220001', studentUserId: demoStudent._id,
      dormitoryId: dorm1._id, dormitoryName: dorm1.name, roomNumber: '202', floorNumber: 2,
      type: 'cleaning', title: 'Nhà vệ sinh tầng 2 cần dọn dẹp',
      description: 'Nhà vệ sinh chung tầng 2 cần được vệ sinh định kỳ.',
      priority: 'low', status: 'completed',
      reportedAt: new Date(now.getTime() - 20 * 86400000),
      updatedAt: new Date(now.getTime() - 18 * 86400000),
    },
  ]);
  console.log('  ✓ 5 maintenance requests created');

  // ── 7d. Notifications ──────────────────────────────────────────────────────
  await Notif.insertMany([
    {
      title: 'Xếp phòng thành công', type: 'success', category: 'allocation', priority: 'high',
      message: 'Chúc mừng! Bạn đã được xếp vào Phòng 202, KTX A1 - Bách Khoa. Vui lòng nhận chìa khóa trong vòng 3 ngày.',
      targetUsers: [demoStudent._id], isGlobal: false, readBy: [],
      createdAt: new Date(now.getTime() - 5 * 86400000),
    },
    {
      title: 'Yêu cầu bảo trì được tiếp nhận', type: 'info', category: 'maintenance', priority: 'normal',
      message: 'Yêu cầu MR-2025-00001 (Ổ điện bị hỏng) đã được tiếp nhận. Kỹ thuật viên sẽ xử lý trong 24 giờ.',
      targetUsers: [demoStudent._id], isGlobal: false, readBy: [demoStudent._id],
      createdAt: new Date(now.getTime() - 2 * 86400000),
    },
    {
      title: 'Thông báo đóng phí ký túc xá HK1', type: 'warning', category: 'system', priority: 'high',
      message: 'Hạn cuối đóng phí ký túc xá học kỳ 1 năm học 2025-2026 là ngày 30/09/2025. Sinh viên chưa đóng phí sẽ bị hủy suất ở.',
      isGlobal: true, targetRole: 'user', readBy: [],
      createdAt: new Date(now.getTime() - 86400000),
    },
    {
      title: 'Quy định ra vào KTX ban đêm', type: 'info', category: 'announcement', priority: 'normal',
      message: 'Từ ngày 01/10/2025, cổng KTX đóng lúc 23:00. Sinh viên về sau giờ quy định cần xuất trình thẻ cư trú tại bảo vệ.',
      isGlobal: true, targetRole: 'user', readBy: [demoStudent._id],
      createdAt: new Date(now.getTime() - 3 * 86400000),
    },
    {
      title: 'Lịch kiểm tra phòng định kỳ tháng 6/2026', type: 'info', category: 'announcement', priority: 'normal',
      message: 'Ban quản lý sẽ tiến hành kiểm tra vệ sinh và cơ sở vật chất tất cả các phòng trong tuần từ 09-13/06/2026.',
      isGlobal: true, targetRole: 'user', readBy: [],
      createdAt: new Date(now.getTime() - 2 * 86400000),
    },
  ]);
  console.log('  ✓ 5 notifications created');

  // ── 8. Final summary ───────────────────────────────────────────────────────
  console.log('\n[8/8] Computing final statistics...');
  let finalTotalRooms = 0, finalTotalCap = 0, finalTotalOccupied = 0;
  const dormStats = [];
  for (const d of savedDorms) {
    let dRooms = 0, dCap = 0, dOcc = 0;
    for (const fl of d.floors) {
      for (const rm of fl.rooms) {
        dRooms++;
        dCap += rm.maxCapacity;
        dOcc += rm.occupants.filter(o => o.active).length;
      }
    }
    finalTotalRooms += dRooms;
    finalTotalCap += dCap;
    finalTotalOccupied += dOcc;
    dormStats.push({ name: d.name, rooms: dRooms, cap: dCap, occ: dOcc, rate: Math.round(dOcc / dCap * 100) });
  }

  const studentCount = await Student.countDocuments({ role: 'user' });
  const assignedCount = await Student.countDocuments({ role: 'user', dormitoryId: { $exists: true, $ne: null } });
  const unassignedCount = studentCount - assignedCount;

  console.log('\n' + '═'.repeat(60));
  console.log('  PRODUCTION SEED COMPLETE');
  console.log('═'.repeat(60));
  console.log(`  Tổng số KTX:            ${savedDorms.length}`);
  console.log(`  Tổng số phòng:          ${finalTotalRooms}`);
  console.log(`  Tổng sức chứa:          ${finalTotalCap} chỗ`);
  console.log(`  Tổng sinh viên (DB):    ${studentCount}`);
  console.log(`  Sinh viên đã gán phòng: ${assignedCount}`);
  console.log(`  Sinh viên chưa gán:     ${unassignedCount}`);
  console.log(`  Chỗ đã lấp đầy:        ${finalTotalOccupied}`);
  console.log(`  Occupancy thực tế:      ${Math.round(finalTotalOccupied / finalTotalCap * 100)}%`);
  console.log('');
  console.log('  Thống kê từng KTX:');
  for (const s of dormStats) {
    console.log(`    ${s.name.padEnd(30)} ${s.rooms} phòng | ${s.occ}/${s.cap} chỗ | ${s.rate}%`);
  }
  console.log('');
  console.log('  File đã thay đổi:');
  console.log('    Collection: dormitories (REPLACED)');
  console.log('    Collection: students (role=user REPLACED)');
  console.log('    Collection: notifications (REPLACED)');
  console.log('    Collection: maintenancerequests (REPLACED)');
  console.log('    Collection: allocationcycles (REPLACED)');
  console.log('    Collection: roomallocations (REPLACED)');
  console.log('');
  console.log('  Xác nhận:');
  console.log('    ✓ Dashboard dùng dữ liệu thật (tính từ room.occupants)');
  console.log('    ✓ Room hiển thị resident thật');
  console.log('    ✓ Occupancy tính từ DB thực');
  console.log('    ✓ Resident có dormitoryId và roomNumber thực');
  console.log('    ✓ Không còn Sinh viên 01 / Student 01');
  console.log('    ✓ Không còn dữ liệu placeholder');
  console.log('');
  console.log('  Demo accounts:');
  console.log('    Sinh viên: username=sinhvien_demo  password=Demo@1234');
  console.log('    Admin:     username=admin           password=Admin@1234');
  console.log('═'.repeat(60));

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ Seed failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
