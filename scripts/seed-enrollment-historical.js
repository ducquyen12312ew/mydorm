/**
 * Seed HUST historical enrollment data (2019-2025) and an enrollment plan for 2025-2026.
 * Run: node scripts/seed-enrollment-historical.js
 */
require('dotenv').config();
require('../src/config/config');   // establishes mongoose connection
const mongoose = require('mongoose');

const HistoricalEnrollment = require('../src/schemas/HistoricalEnrollmentSchema');
const EnrollmentPlan = require('../src/schemas/EnrollmentPlanSchema');

const DORM_CAP = 1308;

// Real-world-approximated HUST enrollment data
const HISTORICAL_DATA = [
  {
    academicYear: '2019-2020',
    totalEnrollmentQuota: 6800,
    totalActualEnrollment: 6542,
    freshmanQuota: 6800, freshmanActual: 6542,
    dormApplications: 3120, dormAcceptedStudents: 980, dormResidents: 980,
    dormCapacity: DORM_CAP,
    retentionYear2: 0.61, retentionYear3: 0.55, retentionYear4: 0.42,
    appRateYear1: 0.62, appRateYear2_3: 0.43, appRateYear4Plus: 0.20,
    growthRate: 0, dormGrowthRate: 0,
    faculties: [
      { faculty: 'Công nghệ thông tin',      enrollment: 820,  dormApps: 480, dormResidents: 155 },
      { faculty: 'Điện tử - Viễn thông',     enrollment: 450,  dormApps: 260, dormResidents: 88  },
      { faculty: 'Điện',                      enrollment: 420,  dormApps: 245, dormResidents: 80  },
      { faculty: 'Cơ khí',                    enrollment: 480,  dormApps: 268, dormResidents: 90  },
      { faculty: 'Hoá & Thực phẩm',          enrollment: 390,  dormApps: 222, dormResidents: 72  },
      { faculty: 'Kinh tế & Quản lý',        enrollment: 240,  dormApps: 115, dormResidents: 38  },
      { faculty: 'Xây dựng & Môi trường',    enrollment: 320,  dormApps: 185, dormResidents: 60  },
      { faculty: 'Khoa học & Kỹ thuật Vật liệu', enrollment: 130, dormApps: 72, dormResidents: 24 },
      { faculty: 'Liên khoa',                 enrollment: 200,  dormApps: 110, dormResidents: 35  },
      { faculty: 'Quốc tế',                   enrollment: 110,  dormApps: 52,  dormResidents: 17  }
    ],
    notes: 'Dữ liệu trước COVID-19',
    isActual: true
  },
  {
    academicYear: '2020-2021',
    totalEnrollmentQuota: 7000,
    totalActualEnrollment: 6320,
    freshmanQuota: 7000, freshmanActual: 6320,
    dormApplications: 2680, dormAcceptedStudents: 920, dormResidents: 898,
    dormCapacity: DORM_CAP,
    retentionYear2: 0.58, retentionYear3: 0.52, retentionYear4: 0.40,
    appRateYear1: 0.58, appRateYear2_3: 0.40, appRateYear4Plus: 0.18,
    growthRate: 0.029, dormGrowthRate: -0.084,
    faculties: [
      { faculty: 'Công nghệ thông tin',      enrollment: 850,  dormApps: 445, dormResidents: 143 },
      { faculty: 'Điện tử - Viễn thông',     enrollment: 465,  dormApps: 243, dormResidents: 79  },
      { faculty: 'Điện',                      enrollment: 430,  dormApps: 225, dormResidents: 73  },
      { faculty: 'Cơ khí',                    enrollment: 490,  dormApps: 248, dormResidents: 80  },
      { faculty: 'Hoá & Thực phẩm',          enrollment: 380,  dormApps: 198, dormResidents: 64  },
      { faculty: 'Kinh tế & Quản lý',        enrollment: 248,  dormApps: 108, dormResidents: 35  },
      { faculty: 'Xây dựng & Môi trường',    enrollment: 310,  dormApps: 165, dormResidents: 53  },
      { faculty: 'Liên khoa',                 enrollment: 210,  dormApps: 100, dormResidents: 32  },
      { faculty: 'Quốc tế',                   enrollment: 108,  dormApps: 44,  dormResidents: 14  }
    ],
    notes: 'Giảm nhẹ do ảnh hưởng COVID-19',
    isActual: true
  },
  {
    academicYear: '2021-2022',
    totalEnrollmentQuota: 7200,
    totalActualEnrollment: 6780,
    freshmanQuota: 7200, freshmanActual: 6780,
    dormApplications: 3250, dormAcceptedStudents: 1020, dormResidents: 995,
    dormCapacity: DORM_CAP,
    retentionYear2: 0.62, retentionYear3: 0.56, retentionYear4: 0.43,
    appRateYear1: 0.64, appRateYear2_3: 0.44, appRateYear4Plus: 0.21,
    growthRate: 0.073, dormGrowthRate: 0.108,
    faculties: [
      { faculty: 'Công nghệ thông tin',      enrollment: 920,  dormApps: 540, dormResidents: 168 },
      { faculty: 'Khoa học Dữ liệu & AI',    enrollment: 180,  dormApps: 112, dormResidents: 35  },
      { faculty: 'Điện tử - Viễn thông',     enrollment: 480,  dormApps: 278, dormResidents: 88  },
      { faculty: 'Điện',                      enrollment: 440,  dormApps: 252, dormResidents: 80  },
      { faculty: 'Cơ khí',                    enrollment: 500,  dormApps: 280, dormResidents: 89  },
      { faculty: 'Hoá & Thực phẩm',          enrollment: 390,  dormApps: 218, dormResidents: 70  },
      { faculty: 'Kinh tế & Quản lý',        enrollment: 260,  dormApps: 115, dormResidents: 37  },
      { faculty: 'Xây dựng & Môi trường',    enrollment: 320,  dormApps: 178, dormResidents: 57  },
      { faculty: 'Liên khoa',                 enrollment: 220,  dormApps: 118, dormResidents: 38  },
      { faculty: 'Quốc tế',                   enrollment: 120,  dormApps: 55,  dormResidents: 18  }
    ],
    notes: 'Phục hồi sau COVID, mở ngành KHMT&DL',
    isActual: true
  },
  {
    academicYear: '2022-2023',
    totalEnrollmentQuota: 7400,
    totalActualEnrollment: 7120,
    freshmanQuota: 7400, freshmanActual: 7120,
    dormApplications: 3520, dormAcceptedStudents: 1100, dormResidents: 1082,
    dormCapacity: DORM_CAP,
    retentionYear2: 0.63, retentionYear3: 0.57, retentionYear4: 0.44,
    appRateYear1: 0.66, appRateYear2_3: 0.46, appRateYear4Plus: 0.22,
    growthRate: 0.050, dormGrowthRate: 0.088,
    faculties: [
      { faculty: 'Công nghệ thông tin',      enrollment: 980,  dormApps: 590, dormResidents: 185 },
      { faculty: 'Khoa học Dữ liệu & AI',    enrollment: 200,  dormApps: 128, dormResidents: 40  },
      { faculty: 'Điện tử - Viễn thông',     enrollment: 490,  dormApps: 288, dormResidents: 92  },
      { faculty: 'Điện',                      enrollment: 450,  dormApps: 262, dormResidents: 83  },
      { faculty: 'Cơ khí',                    enrollment: 520,  dormApps: 292, dormResidents: 93  },
      { faculty: 'Hoá & Thực phẩm',          enrollment: 400,  dormApps: 228, dormResidents: 73  },
      { faculty: 'Kinh tế & Quản lý',        enrollment: 270,  dormApps: 122, dormResidents: 39  },
      { faculty: 'Xây dựng & Môi trường',    enrollment: 325,  dormApps: 182, dormResidents: 58  },
      { faculty: 'Liên khoa',                 enrollment: 225,  dormApps: 125, dormResidents: 40  },
      { faculty: 'Quốc tế',                   enrollment: 110,  dormApps: 52,  dormResidents: 17  }
    ],
    notes: 'Tăng trưởng ổn định, KTX gần đầy',
    isActual: true
  },
  {
    academicYear: '2023-2024',
    totalEnrollmentQuota: 7600,
    totalActualEnrollment: 7380,
    freshmanQuota: 7600, freshmanActual: 7380,
    dormApplications: 3820, dormAcceptedStudents: 1180, dormResidents: 1156,
    dormCapacity: DORM_CAP,
    retentionYear2: 0.64, retentionYear3: 0.58, retentionYear4: 0.45,
    appRateYear1: 0.68, appRateYear2_3: 0.47, appRateYear4Plus: 0.23,
    growthRate: 0.037, dormGrowthRate: 0.068,
    faculties: [
      { faculty: 'Công nghệ thông tin',      enrollment: 1050, dormApps: 648, dormResidents: 202 },
      { faculty: 'Khoa học Dữ liệu & AI',    enrollment: 220,  dormApps: 142, dormResidents: 44  },
      { faculty: 'Điện tử - Viễn thông',     enrollment: 500,  dormApps: 298, dormResidents: 95  },
      { faculty: 'Điện',                      enrollment: 460,  dormApps: 272, dormResidents: 86  },
      { faculty: 'Cơ khí',                    enrollment: 530,  dormApps: 302, dormResidents: 96  },
      { faculty: 'Hoá & Thực phẩm',          enrollment: 405,  dormApps: 234, dormResidents: 75  },
      { faculty: 'Kinh tế & Quản lý',        enrollment: 280,  dormApps: 128, dormResidents: 41  },
      { faculty: 'Xây dựng & Môi trường',    enrollment: 330,  dormApps: 188, dormResidents: 60  },
      { faculty: 'Liên khoa',                 enrollment: 235,  dormApps: 130, dormResidents: 42  },
      { faculty: 'Quốc tế',                   enrollment: 115,  dormApps: 57,  dormResidents: 18  }
    ],
    notes: 'Năm gần nhất — dữ liệu đầy đủ',
    isActual: true
  },
  {
    academicYear: '2024-2025',
    totalEnrollmentQuota: 7800,
    totalActualEnrollment: 7550,
    freshmanQuota: 7800, freshmanActual: 7550,
    dormApplications: 3980, dormAcceptedStudents: 1240, dormResidents: 1210,
    dormCapacity: DORM_CAP,
    retentionYear2: 0.64, retentionYear3: 0.58, retentionYear4: 0.46,
    appRateYear1: 0.69, appRateYear2_3: 0.48, appRateYear4Plus: 0.24,
    growthRate: 0.026, dormGrowthRate: 0.047,
    faculties: [
      { faculty: 'Công nghệ thông tin',      enrollment: 1100, dormApps: 690, dormResidents: 215 },
      { faculty: 'Khoa học Dữ liệu & AI',    enrollment: 250,  dormApps: 162, dormResidents: 51  },
      { faculty: 'Điện tử - Viễn thông',     enrollment: 510,  dormApps: 308, dormResidents: 98  },
      { faculty: 'Điện',                      enrollment: 470,  dormApps: 280, dormResidents: 89  },
      { faculty: 'Cơ khí',                    enrollment: 545,  dormApps: 315, dormResidents: 100 },
      { faculty: 'Hoá & Thực phẩm',          enrollment: 412,  dormApps: 240, dormResidents: 77  },
      { faculty: 'Kinh tế & Quản lý',        enrollment: 290,  dormApps: 134, dormResidents: 43  },
      { faculty: 'Xây dựng & Môi trường',    enrollment: 335,  dormApps: 193, dormResidents: 62  },
      { faculty: 'Liên khoa',                 enrollment: 240,  dormApps: 135, dormResidents: 43  },
      { faculty: 'Quốc tế',                   enrollment: 120,  dormApps: 60,  dormResidents: 19  }
    ],
    notes: 'Năm học hiện tại — dữ liệu ước tính',
    isActual: false
  }
];

const ENROLLMENT_PLAN_2025 = {
  academicYear: '2025-2026',
  planName: 'Kế hoạch tuyển sinh HUST 2025-2026',
  description: 'Kế hoạch chỉ tiêu tuyển sinh năm học 2025-2026, dựa trên xu hướng tăng trưởng và năng lực KTX',
  status: 'approved',
  programs: [
    { programCode:'CNTT',    programName:'Công nghệ Thông tin',                     faculty:'Công nghệ thông tin',       programType:'standard',      plannedQuota:400, dormApplicationRate:0.68, expectedDormResidents:272 },
    { programCode:'KHMT',    programName:'Khoa học Máy tính',                       faculty:'Công nghệ thông tin',       programType:'standard',      plannedQuota:260, dormApplicationRate:0.67, expectedDormResidents:174 },
    { programCode:'DSAI',    programName:'Khoa học Dữ liệu & Trí tuệ nhân tạo',    faculty:'Công nghệ thông tin',       programType:'standard',      plannedQuota:220, dormApplicationRate:0.69, expectedDormResidents:152 },
    { programCode:'KTDT',    programName:'Kỹ thuật Điện tử',                        faculty:'Điện tử - Viễn thông',      programType:'standard',      plannedQuota:290, dormApplicationRate:0.62, expectedDormResidents:180 },
    { programCode:'VT',      programName:'Kỹ thuật Viễn thông',                    faculty:'Điện tử - Viễn thông',      programType:'standard',      plannedQuota:210, dormApplicationRate:0.60, expectedDormResidents:126 },
    { programCode:'KTD',     programName:'Kỹ thuật Điều khiển - Tự động hoá',      faculty:'Điện',                      programType:'standard',      plannedQuota:270, dormApplicationRate:0.61, expectedDormResidents:165 },
    { programCode:'HT',      programName:'Hệ thống Điện',                           faculty:'Điện',                      programType:'standard',      plannedQuota:190, dormApplicationRate:0.58, expectedDormResidents:110 },
    { programCode:'KTCK',    programName:'Kỹ thuật Cơ khí',                         faculty:'Cơ khí',                    programType:'standard',      plannedQuota:320, dormApplicationRate:0.59, expectedDormResidents:189 },
    { programCode:'CKCT',    programName:'Cơ khí Chính xác',                        faculty:'Cơ khí',                    programType:'standard',      plannedQuota:160, dormApplicationRate:0.57, expectedDormResidents:91 },
    { programCode:'CDIO',    programName:'Cơ điện tử (Chương trình tiên tiến)',     faculty:'Cơ khí',                    programType:'advanced',      plannedQuota:80,  dormApplicationRate:0.44, expectedDormResidents:35 },
    { programCode:'CH',      programName:'Công nghệ Hoá học',                       faculty:'Hoá & Thực phẩm',           programType:'standard',      plannedQuota:210, dormApplicationRate:0.58, expectedDormResidents:122 },
    { programCode:'TP',      programName:'Công nghệ Thực phẩm',                     faculty:'Hoá & Thực phẩm',           programType:'standard',      plannedQuota:190, dormApplicationRate:0.56, expectedDormResidents:106 },
    { programCode:'QTKD',    programName:'Quản trị Kinh doanh',                    faculty:'Kinh tế & Quản lý',         programType:'standard',      plannedQuota:250, dormApplicationRate:0.47, expectedDormResidents:118 },
    { programCode:'KTXD',    programName:'Kỹ thuật Xây dựng',                      faculty:'Xây dựng & Môi trường',     programType:'standard',      plannedQuota:210, dormApplicationRate:0.58, expectedDormResidents:122 },
    { programCode:'MT',      programName:'Kỹ thuật Môi trường',                    faculty:'Xây dựng & Môi trường',     programType:'standard',      plannedQuota:125, dormApplicationRate:0.55, expectedDormResidents:69 },
    { programCode:'VLKT',    programName:'Vật liệu Kỹ thuật',                      faculty:'Khoa học & Kỹ thuật VL',    programType:'standard',      plannedQuota:140, dormApplicationRate:0.54, expectedDormResidents:76 },
    { programCode:'ELITECH', programName:'Elitech (Chất lượng cao)',                faculty:'Liên khoa',                 programType:'advanced',      plannedQuota:200, dormApplicationRate:0.45, expectedDormResidents:90 },
    { programCode:'INTL_IT', programName:'CNTT Quốc tế',                            faculty:'Quốc tế',                   programType:'international', plannedQuota:65,  dormApplicationRate:0.35, expectedDormResidents:23 },
    { programCode:'INTL_EM', programName:'Quản trị Kỹ thuật Quốc tế',              faculty:'Quốc tế',                   programType:'international', plannedQuota:55,  dormApplicationRate:0.33, expectedDormResidents:18 }
  ]
};

async function seed() {
  await mongoose.connection.asPromise();
  console.log('Connected. Seeding historical enrollment data...');

  // Clear existing
  await HistoricalEnrollment.deleteMany({});
  console.log('Cleared historical enrollment records');

  // Insert historical records
  for (const data of HISTORICAL_DATA) {
    await HistoricalEnrollment.create(data);
    console.log(`  ✓ ${data.academicYear}: ${data.totalActualEnrollment} enrolled, ${data.dormResidents} dorm residents`);
  }

  // Seed enrollment plan 2025-2026 (skip if already exists)
  const existing = await EnrollmentPlan.findOne({ academicYear: '2025-2026' });
  if (!existing) {
    await EnrollmentPlan.create(ENROLLMENT_PLAN_2025);
    console.log('  ✓ Created enrollment plan for 2025-2026');
  } else {
    console.log('  · Enrollment plan 2025-2026 already exists, skipping');
  }

  console.log('\nSeed complete:');
  console.log(`  - ${HISTORICAL_DATA.length} historical enrollment records inserted`);
  console.log(`  - KTX capacity: ${DORM_CAP} beds`);
  console.log(`  - Years covered: ${HISTORICAL_DATA[0].academicYear} → ${HISTORICAL_DATA[HISTORICAL_DATA.length-1].academicYear}`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
