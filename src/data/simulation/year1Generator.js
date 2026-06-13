/**
 * Generates realistic Vietnamese Year-1 student data for simulation.
 * All data is synthetic — no real student information is used.
 */

// ── Vietnamese name pools ────────────────────────────────────────────────────

const LAST_NAMES = [
  'Nguyễn','Trần','Lê','Phạm','Hoàng','Huỳnh','Phan','Vũ','Võ','Đặng',
  'Bùi','Đỗ','Hồ','Ngô','Dương','Lý','Đinh','Lưu','Đào','Trịnh',
  'Mai','Cao','Tô','Hà','Trương','Lâm','Tạ','Mạc','Thái','Kiều'
];

const MIDDLE_MALE = [
  'Văn','Đình','Đức','Công','Quang','Minh','Xuân','Thái',
  'Gia','Hữu','Ngọc','Trung','Tuấn','Duy','Hồng','Bảo'
];
const MIDDLE_FEMALE = [
  'Thị','Ngọc','Thanh','Phương','Thu','Tú','Kim','Lan',
  'Thùy','Khánh','Mỹ','Bích','Hoàng','Tuyết','Diễm','Bảo'
];

const FIRST_MALE = [
  'Minh','Tuấn','Hùng','Nam','Đức','Khoa','Long','Trí','Anh','Bình',
  'Dũng','Hải','Phong','Quang','Việt','Hoàng','Khánh','Sơn','Thắng','Tùng',
  'Cường','Hiếu','Kiên','Lâm','Nghĩa','Phúc','Thành','Tiến','Vy','Xuân'
];
const FIRST_FEMALE = [
  'Linh','Thảo','Hương','Lan','Mai','Hà','Ngọc','Phương','Trang','Vy',
  'Ánh','Chi','Dung','Hằng','Loan','Nhi','Thư','Trinh','Yến','Diễm',
  'Giang','Hiền','Khánh','Lam','My','Nhung','Quyên','Thảo','Uyên','Xuân'
];

// ── HUST Faculties ───────────────────────────────────────────────────────────

const FACULTIES = [
  { code: 'IT',   name: 'Công nghệ thông tin',        weight: 18 },
  { code: 'ET',   name: 'Điện tử Viễn thông',         weight: 15 },
  { code: 'EE',   name: 'Kỹ thuật Điện',              weight: 14 },
  { code: 'ME',   name: 'Cơ khí',                      weight: 12 },
  { code: 'CHEM', name: 'Hóa học',                     weight: 8  },
  { code: 'PHYS', name: 'Vật lý kỹ thuật',             weight: 7  },
  { code: 'MAT',  name: 'Toán ứng dụng',               weight: 7  },
  { code: 'ENV',  name: 'Kỹ thuật Môi trường',         weight: 6  },
  { code: 'ECON', name: 'Kinh tế Kỹ thuật',            weight: 7  },
  { code: 'BIO',  name: 'Kỹ thuật Y sinh',             weight: 6  },
];

// ── Vietnamese provinces with approximate distances to Hanoi (km) ────────────

const PROVINCES = [
  { name: 'Hà Nội',           km: 10,   weight: 6  },
  { name: 'Hà Nam',           km: 58,   weight: 4  },
  { name: 'Vĩnh Phúc',        km: 60,   weight: 4  },
  { name: 'Hưng Yên',         km: 64,   weight: 4  },
  { name: 'Bắc Ninh',         km: 30,   weight: 3  },
  { name: 'Hải Dương',        km: 58,   weight: 4  },
  { name: 'Hải Phòng',        km: 102,  weight: 5  },
  { name: 'Thái Bình',        km: 110,  weight: 4  },
  { name: 'Nam Định',         km: 90,   weight: 4  },
  { name: 'Ninh Bình',        km: 93,   weight: 3  },
  { name: 'Thanh Hóa',        km: 150,  weight: 5  },
  { name: 'Nghệ An',          km: 295,  weight: 6  },
  { name: 'Hà Tĩnh',         km: 340,  weight: 4  },
  { name: 'Quảng Bình',       km: 450,  weight: 3  },
  { name: 'Quảng Trị',        km: 500,  weight: 2  },
  { name: 'Thừa Thiên Huế',   km: 568,  weight: 3  },
  { name: 'Đà Nẵng',          km: 763,  weight: 3  },
  { name: 'Quảng Nam',        km: 790,  weight: 2  },
  { name: 'Quảng Ngãi',       km: 883,  weight: 2  },
  { name: 'Bình Định',        km: 1065, weight: 2  },
  { name: 'Phú Yên',          km: 1160, weight: 2  },
  { name: 'Khánh Hòa',        km: 1278, weight: 2  },
  { name: 'Gia Lai',          km: 1200, weight: 2  },
  { name: 'Kon Tum',          km: 1330, weight: 1  },
  { name: 'Đắk Lắk',         km: 1400, weight: 2  },
  { name: 'Lâm Đồng',         km: 1500, weight: 1  },
  { name: 'TP. Hồ Chí Minh',  km: 1738, weight: 4  },
  { name: 'Đồng Nai',         km: 1700, weight: 2  },
  { name: 'Cần Thơ',          km: 1877, weight: 2  },
  { name: 'Lạng Sơn',         km: 154,  weight: 3  },
  { name: 'Cao Bằng',         km: 272,  weight: 2  },
  { name: 'Bắc Kạn',          km: 170,  weight: 2  },
  { name: 'Thái Nguyên',      km: 80,   weight: 3  },
  { name: 'Bắc Giang',        km: 50,   weight: 3  },
  { name: 'Quảng Ninh',       km: 170,  weight: 3  },
  { name: 'Hòa Bình',         km: 76,   weight: 3  },
  { name: 'Sơn La',           km: 320,  weight: 2  },
  { name: 'Điện Biên',        km: 500,  weight: 2  },
  { name: 'Lai Châu',         km: 450,  weight: 1  },
  { name: 'Lào Cai',          km: 296,  weight: 2  },
  { name: 'Yên Bái',          km: 183,  weight: 2  },
  { name: 'Tuyên Quang',      km: 165,  weight: 2  },
  { name: 'Hà Giang',         km: 320,  weight: 2  },
  { name: 'Phú Thọ',          km: 90,   weight: 3  },
  { name: 'Bắc Liêu',         km: 1900, weight: 1  },
  { name: 'Sóc Trăng',        km: 1900, weight: 1  },
  { name: 'Kiên Giang',       km: 1900, weight: 1  },
];

// ── Ethnic groups ────────────────────────────────────────────────────────────

const ETHNICITIES = [
  { name: 'Kinh',   weight: 86 },
  { name: 'Tày',    weight: 3  },
  { name: 'Thái',   weight: 2  },
  { name: 'Mường',  weight: 2  },
  { name: 'Khmer',  weight: 2  },
  { name: 'Nùng',   weight: 1  },
  { name: 'H\'Mông', weight: 1  },
  { name: 'Hoa',    weight: 1  },
  { name: 'Dao',    weight: 1  },
  { name: 'Gia Rai', weight: 1 },
];

// ── Helper utilities ─────────────────────────────────────────────────────────

function rng(seed) {
  let s = seed;
  return function() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function weightedPick(arr, rand) {
  const total = arr.reduce((s, x) => s + (x.weight || 1), 0);
  let threshold = rand() * total;
  for (const item of arr) {
    threshold -= (item.weight || 1);
    if (threshold <= 0) return item;
  }
  return arr[arr.length - 1];
}

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

function randInt(min, max, rand) {
  return min + Math.floor(rand() * (max - min + 1));
}

function formatPhone(rand) {
  const prefixes = ['096','097','098','086','089','090','091','094','083','085'];
  const prefix = pick(prefixes, rand);
  const suffix = String(Math.floor(rand() * 10000000)).padStart(7, '0');
  return prefix + suffix;
}

function buildStudentId(enrollmentYear, seq) {
  return `${enrollmentYear}${String(seq).padStart(6, '0')}`;
}

// ── Main generator ───────────────────────────────────────────────────────────

/**
 * Generate `count` realistic Year-1 students for the given enrollment year.
 * @param {number} count - number of students to generate (100–500)
 * @param {number} enrollmentYear - e.g. 2025
 * @param {string|mongoose.Types.ObjectId} workspaceId
 * @param {number} [seedBase] - random seed for reproducibility
 * @returns {Array<Object>} array of sim student documents (not yet saved)
 */
function generateYear1Students(count, enrollmentYear, workspaceId, seedBase = 42) {
  const rand = rng(seedBase + enrollmentYear);
  const students = [];

  // Build faculty distribution pool
  const facultyPool = [];
  FACULTIES.forEach(f => {
    for (let i = 0; i < f.weight; i++) facultyPool.push(f);
  });

  // Build province pool
  const provincePool = [];
  PROVINCES.forEach(p => {
    for (let i = 0; i < p.weight; i++) provincePool.push(p);
  });

  // Build ethnicity pool
  const ethnicPool = [];
  ETHNICITIES.forEach(e => {
    for (let i = 0; i < e.weight; i++) ethnicPool.push(e);
  });

  const kCode = `K${66 + (enrollmentYear - 2020)}`;

  for (let i = 0; i < count; i++) {
    const isMale = rand() < 0.54;
    const gender = isMale ? 'male' : 'female';

    // Name
    const lastName   = pick(LAST_NAMES, rand);
    const middleName = pick(isMale ? MIDDLE_MALE : MIDDLE_FEMALE, rand);
    const firstName  = pick(isMale ? FIRST_MALE : FIRST_FEMALE, rand);
    const name = `${lastName} ${middleName} ${firstName}`;

    // Faculty
    const fac = weightedPick(FACULTIES, rand);

    // Class (faculty code + year + section 01-10)
    const section = String(randInt(1, 10, rand)).padStart(2, '0');
    const className = `${fac.code}${enrollmentYear}-${section}`;

    // Province + distance
    const prov = weightedPick(PROVINCES, rand);

    // Ethnicity
    const ethnic = weightedPick(ETHNICITIES, rand);
    const isMinority = ethnic.name !== 'Kinh';

    // Date of birth (18–22 years old in enrollmentYear)
    const birthYear = enrollmentYear - randInt(18, 22, rand);
    const birthMonth = randInt(1, 12, rand);
    const birthDay   = randInt(1, 28, rand);
    const dateOfBirth = new Date(birthYear, birthMonth - 1, birthDay);

    // Family situation — weighted toward average
    const famRoll = rand();
    let familySituation = 'average';
    if (famRoll < 0.18) familySituation = 'poor';
    else if (famRoll > 0.82) familySituation = 'wealthy';

    // Priority policies (correlated with family / province)
    const isRemote = prov.km > 200;
    const isHighlyRemote = prov.km > 400;

    const financialHardship = familySituation === 'poor' && rand() < 0.75;
    const ethnicMinority    = isMinority && rand() < 0.85;
    const disabled          = rand() < 0.02;
    const ruralPolicy       = isRemote && rand() < 0.45;
    const scholarship       = rand() < 0.12;

    // Violation history — mostly clean for Year 1
    let violationHistory = 'none';
    const vRoll = rand();
    if (vRoll < 0.04) violationHistory = 'minor';
    else if (vRoll < 0.005) violationHistory = 'major';

    // Dorm history — Year 1 students have never stayed
    const dormHistory = 'never_stayed';

    // Preference
    const preferredRoomTypes = ['8-person', '5-person', '4-person-service', '10-person'];
    const preferredRoomType = pick(preferredRoomTypes, rand);

    const studentId = buildStudentId(enrollmentYear, i + 1);
    const email = `${studentId}@sis.hust.edu.vn`;

    students.push({
      workspaceId,
      sourceStudentId: null,
      name,
      username: studentId,
      studentId,
      email,
      phone: formatPhone(rand),
      dateOfBirth,
      gender,
      faculty: fac.name,
      className,
      academicYear: kCode,
      enrollmentYear,
      yearInSchool: 1,
      yearGroup: 'year1',
      isNewYear1: true,
      province: prov.name,
      distanceToHanoi: prov.km + randInt(-10, 10, rand),
      familySituation,
      ethnicity: ethnic.name,
      priorityPolicies: {
        financialHardship,
        ethnicMinority,
        disabled,
        ruralPolicy,
        scholarship
      },
      violationHistory,
      dormHistory,
      dormPreference: {
        preferredDormGender: gender === 'male' ? 'male' : 'female',
        preferredRoomType
      },
      priorityScore: 0,
      priorityDetails: {},
      createdAt: new Date()
    });
  }

  return students;
}

module.exports = { generateYear1Students };
