/*
 * Seed 200 sample students with realistic studentId patterns (2020-2025).
 * Usage: node scripts/seed-sample-students.js
 *
 * Distribution by enrollment year (academicYear):
 * - 2020: 10 (ít nhất, năm 6+)
 * - 2021: 20
 * - 2022: 30
 * - 2023: 40
 * - 2024: 50 (suffix 5 digits)
 * - 2025: 50 (suffix 5 digits, nhiều nhất)
 *
 * Fields populated (matches StudentSchema in src/config/config.js):
 * - name, username (unique), studentId, email, phone, password (bcrypt hash),
 *   faculty, academicYear, gender, role=user
 */

const bcrypt = require('bcrypt');
const { StudentCollection } = require('../src/config/config');

// Configuration
const PASSWORD_PLAIN = 'Passw0rd!';
const PASSWORD_HASH_ROUNDS = 10;
const FACULTIES = ['Engineering', 'Business', 'Science', 'IT', 'Economics', 'Social', 'Education'];
const GENDERS = ['male', 'female'];

// Distribution by year
const YEAR_DISTRIBUTION = [
  { year: 2020, count: 10, suffixLength: 4 },
  { year: 2021, count: 20, suffixLength: 4 },
  { year: 2022, count: 30, suffixLength: 4 },
  { year: 2023, count: 40, suffixLength: 4 },
  { year: 2024, count: 50, suffixLength: 5 },
  { year: 2025, count: 50, suffixLength: 5 },
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateUniqueSuffixes(count, length) {
  const min = length === 4 ? 1000 : 10000;
  const max = length === 4 ? 9999 : 99999;
  const set = new Set();
  while (set.size < count) {
    set.add(randomInt(min, max));
  }
  return Array.from(set);
}

async function buildStudents() {
  const passwordHash = await bcrypt.hash(PASSWORD_PLAIN, PASSWORD_HASH_ROUNDS);
  const students = [];

  for (const { year, count, suffixLength } of YEAR_DISTRIBUTION) {
    const suffixes = generateUniqueSuffixes(count, suffixLength);
    suffixes.forEach((suffix, idx) => {
      const studentId = `${year}${suffix.toString().padStart(suffixLength, '0')}`;
      const username = `sv${studentId}`;
      const name = `Student ${year}-${(idx + 1).toString().padStart(3, '0')}`;
      const email = `${username}@example.edu`;
      const phone = `09${randomInt(10000000, 99999999)}`;
      const faculty = FACULTIES[(year + idx) % FACULTIES.length];
      const gender = GENDERS[(year + idx) % GENDERS.length];

      students.push({
        name,
        username,
        studentId,
        email,
        phone,
        password: passwordHash,
        faculty,
        academicYear: year.toString(),
        gender,
        role: 'user',
      });
    });
  }

  return students;
}

async function seed() {
  try {
    const students = await buildStudents();
    console.log(`Generated ${students.length} students. Seeding...`);

    let inserted = 0;
    for (const student of students) {
      const res = await StudentCollection.updateOne(
        { username: student.username },
        { $setOnInsert: student },
        { upsert: true }
      );
      if (res.upsertedCount === 1) inserted += 1;
    }

    console.log(`Done. Inserted: ${inserted}, Skipped (already existed): ${students.length - inserted}`);
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
