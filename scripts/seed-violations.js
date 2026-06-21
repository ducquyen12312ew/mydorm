'use strict';
require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 30000 });

const StudentSchema = new mongoose.Schema({
  name: String, studentId: String, dormitoryId: mongoose.Schema.Types.ObjectId, roomNumber: String
}, { collection: 'students' });
const DormSchema = new mongoose.Schema({ name: String }, { collection: 'dormitories' });

const ViolationSchema = new mongoose.Schema({
  studentId: { type: String, required: true, index: true },
  studentObjectId: mongoose.Schema.Types.ObjectId,
  studentName: { type: String, required: true },
  dormitoryId: mongoose.Schema.Types.ObjectId,
  dormitoryName: String,
  roomNumber: String,
  type: { type: String, required: true, enum: ['noise','alcohol','smoking','late_return','unauthorized_guest','damage','hygiene','theft','violence','other'] },
  description: { type: String, required: true },
  severity: { type: String, required: true, enum: ['low','medium','high','critical'], default: 'medium' },
  status: { type: String, required: true, enum: ['pending','investigating','resolved','dismissed'], default: 'pending' },
  evidenceUrls: [String],
  reportedBy: { userId: mongoose.Schema.Types.ObjectId, name: String, role: String },
  reportedAt: { type: Date, default: Date.now },
  resolvedBy: { userId: mongoose.Schema.Types.ObjectId, name: String },
  resolvedAt: Date,
  resolution: { action: String, notes: String, fineAmount: Number },
  investigationNotes: Array,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'violations' });

const StudentModel  = mongoose.model('ViolSeedStudent', StudentSchema);
const DormModel     = mongoose.model('ViolSeedDorm', DormSchema);
const ViolModel     = mongoose.model('ViolSeed', ViolationSchema);

// Type descriptions
const DESCRIPTIONS = {
  noise: ['Gây ồn ào sau 22:00, ảnh hưởng đến sinh viên tầng trên','Phát nhạc to trong phòng vào giờ yên tĩnh','Tổ chức họp nhóm ồn ào lúc nửa đêm'],
  damage: ['Làm hỏng cửa phòng, bong tróc sơn tường','Vỡ cửa kính phòng tắm chung','Hư hỏng bàn học và ghế ngồi trong phòng'],
  unauthorized_guest: ['Đưa khách ngoại trú ở qua đêm không xin phép','Cho người lạ vào KTX sau 22:00','Nhiều người ngoài cư trú không đăng ký'],
  hygiene: ['Không dọn vệ sinh phòng trong nhiều ngày','Để rác bừa bãi trong hành lang','Vi phạm quy định về phân loại rác'],
  late_return: ['Về sau 23:30 nhiều lần trong tháng','Vi phạm giờ giới nghiêm KTX lần thứ 3','Không ký sổ khi về muộn theo quy định'],
  smoking: ['Hút thuốc trong phòng ngủ, vi phạm nghiêm trọng','Hút thuốc khu vực cầu thang','Phát hiện tàn thuốc trong phòng tắm chung'],
  alcohol: ['Mang rượu về phòng và tổ chức uống rượu','Gây mất trật tự sau khi uống rượu','Vi phạm cấm đồ uống có cồn trong KTX'],
  theft: ['Bị tố cáo lấy đồ của bạn cùng phòng','Mất tài sản trong phòng kho chung'],
  violence: ['Xô xát với bạn cùng phòng','Có hành vi đe dọa sinh viên khác'],
  other: ['Vi phạm nội quy KTX, hành vi chưa phân loại','Không tuân thủ quy định phòng chống dịch'],
};
const RESOLUTION_NOTES = [
  'Đã nhắc nhở và ký cam kết không tái phạm. Trường hợp vi phạm lần 2 sẽ phạt tiền.',
  'Phạt cảnh cáo lần 1. Sinh viên đã nhận lỗi và cam kết sửa chữa hành vi.',
  'Yêu cầu bồi thường thiệt hại 500.000đ. Sinh viên đã nộp phạt đủ.',
  'Đã xử lý theo quy chế KTX, ghi vào hồ sơ vi phạm của sinh viên.',
  'Giải quyết xong sau hòa giải. Hai bên đã đồng ý và cam kết không tái diễn.',
];

// Type weights: noise, hygiene, damage, unauthorized_guest, late_return phổ biến nhất
const TYPES = ['noise','noise','noise','hygiene','hygiene','damage','damage','unauthorized_guest','unauthorized_guest','late_return','late_return','smoking','alcohol','other'];
// Severity: low ~60%, medium ~30%, high ~10%
const SEVERITIES = ['low','low','low','low','low','low','medium','medium','medium','high'];
// Status: resolved ~70%, pending ~30%
const STATUSES_W = ['resolved','resolved','resolved','resolved','resolved','resolved','resolved','pending','pending','pending'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(a,b) { return Math.floor(Math.random()*(b-a+1))+a; }
function randDate(daysAgo) { return new Date(Date.now() - daysAgo * 86400000); }

async function run() {
  const [students, dorms] = await Promise.all([
    StudentModel.find(
      { dormitoryId: { $exists: true, $ne: null }, roomNumber: { $exists: true, $ne: null, $ne: '' } },
      { _id:1, name:1, studentId:1, dormitoryId:1, roomNumber:1 }
    ).limit(300).lean(),
    DormModel.find({}, { _id:1, name:1 }).lean()
  ]);

  if (!students.length) { console.error('No students with rooms'); process.exit(1); }
  const dormMap = {};
  dorms.forEach(d => { dormMap[String(d._id)] = d.name; });
  console.log(`Found ${students.length} students, ${dorms.length} dorms`);

  await ViolModel.deleteMany({});
  console.log('Cleared violations');

  const TARGET = 45;
  const shuffled = [...students].sort(() => Math.random() - 0.5).slice(0, TARGET);
  const docs = [];
  let adminId = new mongoose.Types.ObjectId();

  for (const st of shuffled) {
    const type = pick(TYPES);
    const severity = pick(SEVERITIES);
    const status = pick(STATUSES_W);
    const daysAgo = randInt(5, 540); // ~1.5 years spread
    const reportedAt = randDate(daysAgo);
    const resolvedAt = status === 'resolved' ? new Date(reportedAt.getTime() + randInt(1, 14) * 86400000) : undefined;
    const dormName = dormMap[String(st.dormitoryId)] || 'KTX';
    const descList = DESCRIPTIONS[type] || DESCRIPTIONS.other;

    docs.push({
      studentId:      st.studentId || String(st._id),
      studentObjectId: st._id,
      studentName:    st.name || 'Sinh viên',
      dormitoryId:    st.dormitoryId,
      dormitoryName:  dormName,
      roomNumber:     st.roomNumber,
      type,
      description:    pick(descList),
      severity,
      status,
      reportedBy:     { userId: adminId, name: 'Quản lý KTX', role: 'admin' },
      reportedAt,
      resolvedBy:     status === 'resolved' ? { userId: adminId, name: 'Quản lý KTX' } : undefined,
      resolvedAt,
      resolution:     status === 'resolved' ? { action: 'warning', notes: pick(RESOLUTION_NOTES) } : undefined,
      createdAt:      reportedAt,
      updatedAt:      resolvedAt || reportedAt
    });
  }

  await ViolModel.insertMany(docs, { ordered: false });

  const stats = {};
  docs.forEach(d => { stats[d.status] = (stats[d.status] || 0) + 1; });
  const sev = {};
  docs.forEach(d => { sev[d.severity] = (sev[d.severity] || 0) + 1; });
  console.log(`Seeded ${docs.length} violations:`);
  Object.entries(stats).forEach(([k,v]) => console.log(`  status.${k}: ${v}`));
  Object.entries(sev).forEach(([k,v]) => console.log(`  severity.${k}: ${v}`));

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
