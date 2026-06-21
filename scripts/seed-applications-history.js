'use strict';
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// ── Schemas (inline) ─────────────────────────────────────────────────────────
const StudentSchema = new mongoose.Schema({ name: String, studentId: String, faculty: String }, { collection: 'students' });

const RegSchema = new mongoose.Schema({
  academicYear:          { type: String, required: true },
  allocationCycleId:     { type: mongoose.Schema.Types.ObjectId, required: true },
  studentId:             { type: mongoose.Schema.Types.ObjectId, required: true },
  studentName:           String,
  studentFaculty:        String,
  studentEnrollmentYear: Number,
  yearGroup:             { type: String, enum: ['year1','year2_3','year4_plus'], required: true },
  status:                { type: String, enum: ['PENDING','ALLOCATED','WAITLIST','WITHDRAWN','REJECTED'], default: 'PENDING' },
  priority:              { type: Number, default: 0 },
  applicationNotes:      String,
  createdAt:             { type: Date, default: Date.now },
  updatedAt:             { type: Date, default: Date.now }
}, { collection: 'allocationregistrations' });

const StudentModel = mongoose.model('HistSeedStudent', StudentSchema);
const RegModel = mongoose.model('HistSeedReg', RegSchema);

// ── Config ───────────────────────────────────────────────────────────────────
const ACADEMIC_YEARS = ['2023-2024', '2024-2025', '2025-2026'];
// Fake cycle IDs — one per year, stable
const CYCLE_IDS = {
  '2023-2024': new mongoose.Types.ObjectId('6500000000000000000001aa'),
  '2024-2025': new mongoose.Types.ObjectId('6500000000000000000002bb'),
  '2025-2026': new mongoose.Types.ObjectId('6500000000000000000003cc'),
};
const TOTAL = 200;
const APPROVED_RATIO = 0.65; // ~65% ALLOCATED, ~35% REJECTED

const YEAR_GROUPS = ['year1', 'year2_3', 'year4_plus'];
const REJECTION_NOTES = [
  'Không đủ điều kiện ưu tiên', 'Hết chỗ ở KTX đã đăng ký', 'Hồ sơ không hợp lệ',
  'Đã có phòng ở KTX', 'Không đáp ứng tiêu chí khoảng cách', 'Điểm ưu tiên thấp',
];

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Random date within academic year
function randDate(academicYear) {
  const startYear = parseInt(academicYear.split('-')[0]);
  const from = new Date(`${startYear}-08-01`).getTime();
  const to   = new Date(`${startYear + 1}-06-30`).getTime();
  return new Date(from + Math.random() * (to - from));
}

async function run() {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 30000 });
  console.log('Connected to MongoDB');

  // Fetch real students
  const students = await StudentModel.find({ role: { $ne: 'admin' } }, { _id: 1, name: 1, faculty: 1 }).limit(1000).lean();
  if (students.length === 0) { console.error('No students found'); process.exit(1); }
  console.log(`Found ${students.length} students`);

  // Delete old history seeds to avoid duplicate key conflicts
  await RegModel.deleteMany({ allocationCycleId: { $in: Object.values(CYCLE_IDS) } });
  console.log('Cleared old history seed records');

  const docs = [];
  // Track used (studentId + cycleId) pairs to avoid unique-key conflict
  const used = new Set();

  let perYear = Math.floor(TOTAL / ACADEMIC_YEARS.length);
  let remainder = TOTAL - perYear * ACADEMIC_YEARS.length;

  for (let yi = 0; yi < ACADEMIC_YEARS.length; yi++) {
    const year = ACADEMIC_YEARS[yi];
    const cycleId = CYCLE_IDS[year];
    const count = perYear + (yi < remainder ? 1 : 0);
    let created = 0;
    const shuffled = [...students].sort(() => Math.random() - 0.5);

    for (const st of shuffled) {
      if (created >= count) break;
      const key = `${st._id}-${cycleId}`;
      if (used.has(key)) continue;
      used.add(key);

      const isApproved = Math.random() < APPROVED_RATIO;
      const status = isApproved ? 'ALLOCATED' : 'REJECTED';
      const createdAt = randDate(year);
      const reviewedAt = new Date(createdAt.getTime() + randInt(1, 14) * 86400000);

      docs.push({
        academicYear:      year,
        allocationCycleId: cycleId,
        studentId:         st._id,
        studentName:       st.name || 'Sinh viên',
        studentFaculty:    st.faculty || 'Không xác định',
        yearGroup:         pick(YEAR_GROUPS),
        status,
        priority:          randInt(20, 95),
        applicationNotes:  !isApproved ? pick(REJECTION_NOTES) : null,
        createdAt,
        updatedAt:         reviewedAt,
      });
      created++;
    }
    console.log(`  ${year}: ${created} records`);
  }

  await RegModel.insertMany(docs, { ordered: false });

  // Verify
  const allocCount = await RegModel.countDocuments({ allocationCycleId: { $in: Object.values(CYCLE_IDS) }, status: 'ALLOCATED' });
  const rejCount   = await RegModel.countDocuments({ allocationCycleId: { $in: Object.values(CYCLE_IDS) }, status: 'REJECTED' });
  console.log(`\nSeeded ${docs.length} records total`);
  console.log(`  ALLOCATED: ${allocCount}  |  REJECTED: ${rejCount}`);
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
