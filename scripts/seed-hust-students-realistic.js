/**
 * Update existing students to have realistic year-group distribution:
 *   Year 1 (academicYear = current - 0): 40-45%
 *   Year 2 (academicYear = current - 1): 25-30%
 *   Year 3 (academicYear = current - 2): 15-20%
 *   Year 4+ (academicYear = current - 3+): 10-15%
 *
 * Also assigns realistic HUST faculty names.
 * Run: node scripts/seed-hust-students-realistic.js
 */
require('dotenv').config();
require('../src/config/config');
const mongoose = require('mongoose');
const { StudentCollection } = require('../src/config/config');

const CURRENT_YEAR = 2025; // Freshman year for 2025-2026

const HUST_FACULTIES = [
  'Công nghệ thông tin',
  'Khoa học Máy tính',
  'Khoa học Dữ liệu & Trí tuệ nhân tạo',
  'Kỹ thuật Điện tử - Viễn thông',
  'Kỹ thuật Điều khiển & Tự động hoá',
  'Hệ thống Điện',
  'Kỹ thuật Cơ khí',
  'Cơ khí Chính xác & Quang học',
  'Công nghệ Hoá học',
  'Công nghệ Thực phẩm',
  'Quản trị Kinh doanh',
  'Kỹ thuật Xây dựng',
  'Kỹ thuật Môi trường',
  'Vật liệu Kỹ thuật',
  'Elitech (Chất lượng cao)',
  'Chương trình Quốc tế'
];

// Faculty distribution weights (heavier for larger faculties)
const FACULTY_WEIGHTS = [16, 11, 9, 10, 8, 6, 12, 5, 7, 6, 7, 6, 4, 4, 7, 2];

function weightedRandom(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

async function run() {
  await mongoose.connection.asPromise();
  console.log('Connected. Updating student year distribution...');

  const students = await StudentCollection.find({}).lean();
  const total = students.length;
  console.log(`Found ${total} students`);

  // Target distribution
  const targets = {
    year1: Math.round(total * 0.42),
    year2: Math.round(total * 0.28),
    year3: Math.round(total * 0.18),
    year4: total - Math.round(total * 0.42) - Math.round(total * 0.28) - Math.round(total * 0.18)
  };
  console.log('Target distribution:', targets);

  // Build bucket assignment
  const yearAssignments = [];
  for (let i = 0; i < targets.year1; i++) yearAssignments.push(CURRENT_YEAR);
  for (let i = 0; i < targets.year2; i++) yearAssignments.push(CURRENT_YEAR - 1);
  for (let i = 0; i < targets.year3; i++) yearAssignments.push(CURRENT_YEAR - 2);
  for (let i = 0; i < targets.year4; i++) yearAssignments.push(CURRENT_YEAR - 3);

  // Shuffle assignments
  for (let i = yearAssignments.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [yearAssignments[i], yearAssignments[j]] = [yearAssignments[j], yearAssignments[i]];
  }

  // Bulk update in batches of 100
  const BATCH = 100;
  let updated = 0;
  for (let i = 0; i < students.length; i += BATCH) {
    const batch = students.slice(i, i + BATCH);
    const ops = batch.map((s, idx) => ({
      updateOne: {
        filter: { _id: s._id },
        update: {
          $set: {
            academicYear: String(yearAssignments[i + idx]),
            faculty: s.faculty && s.faculty !== 'N/A' && s.faculty !== 'Unknown'
              ? s.faculty
              : weightedRandom(HUST_FACULTIES, FACULTY_WEIGHTS)
          }
        }
      }
    }));
    await StudentCollection.bulkWrite(ops);
    updated += batch.length;
    if (updated % 500 === 0) console.log(`  Updated ${updated}/${total}...`);
  }

  // Verify distribution
  const distribution = await StudentCollection.aggregate([
    { $group: { _id: '$academicYear', count: { $sum: 1 } } },
    { $sort: { _id: -1 } }
  ]);
  console.log('\nFinal year distribution:');
  distribution.forEach(d => {
    const pct = Math.round((d.count / total) * 100);
    console.log(`  ${d._id}: ${d.count} students (${pct}%)`);
  });

  const facultyDist = await StudentCollection.aggregate([
    { $group: { _id: '$faculty', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  console.log('\nFaculty distribution (top 5):');
  facultyDist.slice(0, 5).forEach(d => {
    console.log(`  ${d._id}: ${d.count} students`);
  });

  console.log(`\n✓ Updated ${updated} students with realistic year/faculty distribution`);
  process.exit(0);
}

run().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
