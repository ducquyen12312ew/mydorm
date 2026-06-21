'use strict';
require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 30000 });

// ── Schemas ──────────────────────────────────────────────────────────────────
const StudentSchema = new mongoose.Schema({ name: String, studentId: String, dormitoryId: mongoose.Schema.Types.ObjectId, roomNumber: String, floor: Number }, { collection: 'students' });
const DormSchema   = new mongoose.Schema({ name: String }, { collection: 'dormitories' });

const MRSchema = new mongoose.Schema({
  requestNumber: { type: String, unique: true, required: true },
  dormitoryId: { type: mongoose.Schema.Types.ObjectId, required: true },
  dormitoryName: { type: String, required: true },
  floorNumber: { type: Number, required: true },
  roomNumber: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, required: true },
  priority: { type: String, default: 'medium' },
  status: { type: String, default: 'submitted' },
  reportedBy: { userId: mongoose.Schema.Types.ObjectId, name: String, studentId: String, phone: String },
  reportedAt: { type: Date, default: Date.now },
  completedAt: Date,
  completionNotes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'maintenance_requests' });

const StudentModel = mongoose.model('MRSeedStudent', StudentSchema);
const DormModel    = mongoose.model('MRSeedDorm', DormSchema);
const MRModel      = mongoose.model('MRSeedReq', MRSchema);

// ── Config ───────────────────────────────────────────────────────────────────
const TYPES = ['electrical','plumbing','hvac','furniture','door_lock','internet','cleaning','electrical','plumbing','hvac'];
const PRIORITIES = ['low','medium','medium','high','urgent'];
// status weights: 40% completed, 30% in_progress, 20% submitted, 10% assigned
const STATUSES = ['completed','completed','completed','completed','in_progress','in_progress','in_progress','submitted','submitted','assigned'];

const TITLES = {
  electrical: ['Cháy bóng đèn phòng','Ổ điện bị hỏng','Công tắc đèn hành lang hỏng','Đèn huỳnh quang nhấp nháy','Dây điện bị nứt vỏ'],
  plumbing:   ['Vòi nước bị rỉ','Bồn cầu không xả được','Bồn rửa mặt bị tắc','Ống nước bị rò','Áp lực nước yếu'],
  hvac:       ['Điều hòa không mát','Quạt trần hỏng motor','Điều hòa chảy nước','Bộ điều khiển AC hỏng','Điều hòa có mùi lạ'],
  furniture:  ['Giường bị gãy chân','Tủ đựng đồ hỏng bản lề','Bàn học lung lay','Ghế ngồi gãy','Kệ sách bị nứt'],
  door_lock:  ['Khóa cửa bị hỏng','Cửa không đóng được','Tay nắm cửa bị lỏng','Cửa sổ không mở được','Chốt cửa vệ sinh hỏng'],
  internet:   ['Wi-Fi không kết nối được','Internet chập chờn','Cáp mạng bị đứt','Router phát sóng yếu','Không truy cập được mạng'],
  cleaning:   ['Cống thoát nước bị tắc','Vệ sinh chung cần làm sạch','Nấm mốc tường phòng tắm','Rác không được thu gom','Hành lang cần lau dọn'],
};
const DESCRIPTIONS = {
  electrical: 'Bóng đèn/thiết bị điện bị hỏng, ảnh hưởng đến sinh hoạt trong phòng. Cần kiểm tra và thay thế sớm.',
  plumbing:   'Hệ thống nước có vấn đề, gây bất tiện cho sinh viên sinh hoạt hàng ngày. Đề nghị sửa chữa khẩn.',
  hvac:       'Thiết bị điều hòa/quạt hoạt động không đúng, thời tiết nóng ảnh hưởng đến học tập nghỉ ngơi.',
  furniture:  'Nội thất phòng ở bị hư hỏng, ảnh hưởng đến sinh hoạt và an toàn của sinh viên.',
  door_lock:  'Khóa cửa/cửa sổ có vấn đề, ảnh hưởng đến an ninh và tiện nghi của phòng ở.',
  internet:   'Kết nối mạng không ổn định, ảnh hưởng đến việc học trực tuyến và liên lạc của sinh viên.',
  cleaning:   'Vệ sinh khu vực chung chưa đảm bảo, cần được dọn dẹp và xử lý ngay.',
};
const COMPLETION_NOTES = [
  'Đã kiểm tra và thay thế linh kiện hỏng. Thiết bị hoạt động bình thường.',
  'Đã sửa chữa xong. Đề nghị sinh viên kiểm tra và phản hồi nếu còn vấn đề.',
  'Đã khắc phục sự cố. Thiết bị đã hoạt động tốt trở lại.',
  'Hoàn thành sửa chữa. Đã thử nghiệm và xác nhận hoạt động đúng.',
  'Đã xử lý xong theo yêu cầu. Cảm ơn sinh viên đã báo cáo kịp thời.',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randDate(daysAgo) { return new Date(Date.now() - daysAgo * 86400000); }

async function run() {
  const [students, dorms] = await Promise.all([
    StudentModel.find({ dormitoryId: { $exists: true, $ne: null }, roomNumber: { $exists: true, $ne: null, $ne: '' } }, { _id:1, name:1, studentId:1, dormitoryId:1, roomNumber:1 }).limit(300).lean(),
    DormModel.find({}, { _id:1, name:1 }).lean()
  ]);

  const dormMap = {};
  dorms.forEach(d => { dormMap[String(d._id)] = d.name; });

  if (!students.length) { console.error('No students with rooms found'); process.exit(1); }
  console.log(`Found ${students.length} students with rooms, ${dorms.length} dorms`);

  // Clear existing seed
  await MRModel.deleteMany({});
  console.log('Cleared existing maintenance requests');

  const TARGET = 35;
  const shuffled = [...students].sort(() => Math.random() - 0.5).slice(0, TARGET);
  const docs = [];

  for (let i = 0; i < shuffled.length; i++) {
    const st = shuffled[i];
    const type = pick(TYPES);
    const status = pick(STATUSES);
    const daysAgo = randInt(1, 180);
    const reportedAt = randDate(daysAgo);
    const completedAt = (status === 'completed') ? new Date(reportedAt.getTime() + randInt(1, 7) * 86400000) : undefined;

    const dormName = dormMap[String(st.dormitoryId)] || 'KTX';
    const floorNum = parseInt((st.roomNumber || '101')[0]) || randInt(1, 6);

    const titleList = TITLES[type] || TITLES.electrical;

    const date = new Date(reportedAt);
    const yr = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const rnd = String(i + 1001).padStart(4, '0');

    docs.push({
      requestNumber: `MR${yr}${mo}${rnd}`,
      dormitoryId:   st.dormitoryId,
      dormitoryName: dormName,
      floorNumber:   floorNum,
      roomNumber:    st.roomNumber,
      title:         pick(titleList),
      description:   DESCRIPTIONS[type],
      type,
      priority:      pick(PRIORITIES),
      status,
      reportedBy:    { userId: st._id, name: st.name || 'Sinh viên', studentId: st.studentId || '', phone: '' },
      reportedAt,
      completedAt,
      completionNotes: status === 'completed' ? pick(COMPLETION_NOTES) : undefined,
      createdAt: reportedAt,
      updatedAt: completedAt || reportedAt
    });
  }

  await MRModel.insertMany(docs);

  const stats = { submitted:0, assigned:0, in_progress:0, completed:0 };
  docs.forEach(d => { if (stats[d.status] !== undefined) stats[d.status]++; });
  console.log(`Seeded ${docs.length} maintenance requests:`);
  Object.entries(stats).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
