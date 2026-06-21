'use strict';
require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 30000 });

const StudentSchema = new mongoose.Schema({
  name: String, studentId: String, email: String, phone: String,
  faculty: String, gender: String, dormitoryId: mongoose.Schema.Types.ObjectId, roomNumber: String
}, { collection: 'students' });

const DormSchema = new mongoose.Schema({ name: String }, { collection: 'dormitories' });

// Must use EXACT lowercase collection name that PendingApplicationCollection uses
const AppSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  faculty: String, academicYear: String,
  gender: { type: String, enum: ['male','female'] },
  dormitoryId: { type: mongoose.Schema.Types.ObjectId, required: true },
  dormitoryName: String,
  roomNumber: { type: String, required: true },
  priorityPolicies: Array,
  priorityScore: { type: Number, default: 0 },
  status: { type: String, default: 'pending' },
  comments: String,
  approvedBy: mongoose.Schema.Types.ObjectId,
  approvedAt: Date,
  rejectedBy: mongoose.Schema.Types.ObjectId,
  rejectedAt: Date,
  rejectionReason: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'pendingapplications' }); // lowercase — matches PendingApplicationCollection

const StudentModel = mongoose.model('PASeedStudent2', StudentSchema);
const DormModel    = mongoose.model('PASeedDorm2', DormSchema);
const AppModel     = mongoose.model('PASeedApp2', AppSchema);

const FACULTIES = [
  'Công nghệ Thông tin', 'Điện tử Viễn thông', 'Cơ khí', 'Điện',
  'Vật lý Kỹ thuật', 'Toán - Tin học', 'Hóa học', 'Kinh tế Quản lý'
];
const REJECTION_REASONS = [
  'Hồ sơ không đầy đủ', 'Không đủ điều kiện ưu tiên', 'Phòng đã hết chỗ',
  'Sinh viên đã có chỗ ở KTX', 'Ngoài khu vực ưu tiên'
];
const ACADEMIC_YEARS = ['2023-2024', '2024-2025', '2025-2026'];

// status: ~50% pending, ~30% approved, ~20% rejected
const STATUSES = [
  'pending','pending','pending','pending','pending',
  'approved','approved','approved',
  'rejected','rejected'
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(a,b) { return Math.floor(Math.random()*(b-a+1))+a; }
function randDate(daysAgo) { return new Date(Date.now() - daysAgo * 86400000); }
function fakePhone() { return '09' + String(randInt(10000000,99999999)); }

async function run() {
  const [students, dorms] = await Promise.all([
    StudentModel.find(
      { dormitoryId: { $exists: true, $ne: null }, roomNumber: { $exists: true, $ne: null, $ne: '' } },
      { _id:1, name:1, studentId:1, email:1, phone:1, faculty:1, gender:1, dormitoryId:1, roomNumber:1 }
    ).limit(500).lean(),
    DormModel.find({}, { _id:1, name:1 }).lean(),
  ]);

  if (!students.length || !dorms.length) { console.error('No students/dorms'); process.exit(1); }
  console.log(`Found ${students.length} students with rooms, ${dorms.length} dorms`);

  const dormMap = {};
  dorms.forEach(d => { dormMap[String(d._id)] = d.name; });

  await AppModel.deleteMany({});
  console.log('Cleared pendingapplications');

  const TARGET = 85;
  const shuffled = [...students].filter(s => s.dormitoryId).sort(() => Math.random() - 0.5).slice(0, TARGET);
  const docs = [];

  for (const st of shuffled) {
    const dormId = st.dormitoryId;
    if (!dormId) continue;
    const dormName = dormMap[String(dormId)] || 'KTX';
    const status = pick(STATUSES);
    const daysAgo = randInt(10, 365);
    const createdAt = randDate(daysAgo);
    const processedAt = new Date(createdAt.getTime() + randInt(1, 10) * 86400000);

    docs.push({
      studentId:    st.studentId || String(st._id),
      fullName:     st.name || 'Sinh viên',
      email:        st.email || `sv${st.studentId}@hust.edu.vn`,
      phone:        st.phone || fakePhone(),
      faculty:      st.faculty || pick(FACULTIES),
      academicYear: pick(ACADEMIC_YEARS),
      gender:       st.gender || (Math.random() > 0.5 ? 'male' : 'female'),
      dormitoryId:  dormId,
      dormitoryName: dormName,
      roomNumber:   st.roomNumber,
      priorityScore: randInt(10, 95),
      status,
      comments:     status === 'approved' ? 'Hồ sơ đầy đủ, đủ điều kiện' : undefined,
      approvedBy:   status === 'approved' ? st._id : undefined,
      approvedAt:   status === 'approved' ? processedAt : undefined,
      rejectedBy:   status === 'rejected' ? st._id : undefined,
      rejectedAt:   status === 'rejected' ? processedAt : undefined,
      rejectionReason: status === 'rejected' ? pick(REJECTION_REASONS) : undefined,
      createdAt,
      updatedAt: processedAt,
    });
  }

  await AppModel.insertMany(docs, { ordered: false });

  const stats = {};
  docs.forEach(d => { stats[d.status] = (stats[d.status] || 0) + 1; });
  console.log(`Seeded ${docs.length} applications into pendingapplications:`);
  Object.entries(stats).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
