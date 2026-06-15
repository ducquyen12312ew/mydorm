/**
 * Generates realistic Vietnamese Year-1 student data for simulation.
 * Students are split into 4 priority groups that produce distinct
 * computed scores when run through the allocation engine:
 *
 *   Group A (20%) — high score  ≈ 95-100 (capped)
 *   Group B (40%) — medium-high ≈ 75-95
 *   Group C (30%) — medium-low  ≈ 55-75
 *   Group D (10%) — low score   ≈ 30-55  ← will be rejected
 *
 * All data is synthetic — no real student information is used.
 */

// ── Vietnamese name pools ────────────────────────────────────────────────────

// Pools match scripts/reset-and-reseed-production.js so synthetic and real
// students draw from the same name space (30 × 20 × 30 = 18,000 per gender).
const LAST_NAMES = [
  'Nguyễn','Trần','Lê','Phạm','Hoàng','Huỳnh','Phan','Vũ','Võ','Đặng',
  'Bùi','Đỗ','Hồ','Ngô','Dương','Lý','Đinh','Trịnh','Đào','Mai',
  'Trương','Tô','Lưu','Hà','Tạ','Thái','Mạc','Tống','Cao','Vương'
];                                                                            // 30
const MIDDLE_MALE   = ['Văn','Hữu','Công','Đức','Quốc','Gia','Hoàng','Trung','Minh','Phước',
  'Thanh','Bảo','Duy','Ngọc','Đình','Xuân','Tiến','Hải','Sơn','Tuấn'];        // 20
const MIDDLE_FEMALE = ['Thị','Ngọc','Thanh','Bích','Kim','Thu','Lan','Mỹ','Diễm','Hoàng',
  'Phương','Hương','Linh','Tuyết','Xuân','Mai','Hà','Thùy','Gia','Khánh'];    // 20
const FIRST_MALE    = ['An','Bình','Cường','Dũng','Đạt','Đức','Hải','Hùng','Hưng','Khoa',
  'Khánh','Kiên','Long','Mạnh','Minh','Nam','Nghĩa','Phong','Phúc','Quân',
  'Quang','Quốc','Sơn','Thắng','Thành','Tiến','Trung','Tùng','Tuấn','Việt'];  // 30
const FIRST_FEMALE  = ['Anh','Bích','Chi','Diệu','Giang','Hà','Hằng','Hiền','Hoa','Hương',
  'Lan','Linh','Loan','Mai','My','Nhi','Nhung','Ngọc','Phương','Thanh',
  'Thảo','Thu','Thư','Trang','Trinh','Tuyết','Uyên','Vân','Xuân','Yến'];      // 30

// ── HUST Faculties ───────────────────────────────────────────────────────────

const FACULTIES = [
  { code: 'CNTT', name: 'Công nghệ Thông tin',     weight: 18 },
  { code: 'DTVT', name: 'Điện tử Viễn thông',      weight: 12 },
  { code: 'DIEN', name: 'Kỹ thuật Điện',           weight: 10 },
  { code: 'CKTN', name: 'Cơ khí',                  weight: 10 },
  { code: 'KTHH', name: 'Kỹ thuật Hóa học',        weight: 7  },
  { code: 'VLKT', name: 'Vật lý Kỹ thuật',         weight: 6  },
  { code: 'TOAN', name: 'Toán Tin ứng dụng',       weight: 7  },
  { code: 'KTMT', name: 'Kỹ thuật Máy tính',       weight: 6  },
  { code: 'KTCK', name: 'Kinh tế Kỹ thuật',        weight: 6  },
  { code: 'CNSH', name: 'Công nghệ Sinh học',      weight: 5  },
  { code: 'HKQC', name: 'Hàng không Vũ trụ',       weight: 5  },
  { code: 'QLCN', name: 'Quản lý Công nghiệp',     weight: 8  },
];

// ── Province pools by distance band ─────────────────────────────────────────

const PROVINCES_NEAR   = [  // ≤ 50 km → distScore = -10
  { name: 'Hà Nội', km: 10 }, { name: 'Hà Nam', km: 58 },
  { name: 'Bắc Ninh', km: 30 }, { name: 'Hà Tây cũ', km: 25 },
  { name: 'Vĩnh Phúc', km: 60 }, { name: 'Hưng Yên', km: 64 },
];
const PROVINCES_MEDIUM = [  // 50–200 km → distScore = +10
  { name: 'Hải Phòng', km: 102 }, { name: 'Thái Bình', km: 110 },
  { name: 'Nam Định', km: 90 }, { name: 'Ninh Bình', km: 93 },
  { name: 'Bắc Giang', km: 50 }, { name: 'Quảng Ninh', km: 170 },
  { name: 'Thái Nguyên', km: 80 }, { name: 'Thanh Hóa', km: 150 },
];
const PROVINCES_FAR    = [  // 200–500 km → distScore = +20
  { name: 'Nghệ An', km: 295 }, { name: 'Hà Tĩnh', km: 340 },
  { name: 'Sơn La', km: 320 }, { name: 'Cao Bằng', km: 272 },
  { name: 'Lào Cai', km: 296 }, { name: 'Điện Biên', km: 500 },
  { name: 'Quảng Bình', km: 450 }, { name: 'Quảng Trị', km: 500 },
];
const PROVINCES_VFAR   = [  // > 500 km → distScore = +30
  { name: 'Thừa Thiên Huế', km: 568 }, { name: 'Đà Nẵng', km: 763 },
  { name: 'Bình Định', km: 1065 }, { name: 'Khánh Hòa', km: 1278 },
  { name: 'Đắk Lắk', km: 1400 }, { name: 'TP. Hồ Chí Minh', km: 1738 },
  { name: 'Cần Thơ', km: 1877 }, { name: 'Kiên Giang', km: 1900 },
  { name: 'Gia Lai', km: 1200 }, { name: 'Kon Tum', km: 1330 },
];

// ── Ethnic minorities ────────────────────────────────────────────────────────

const MINORITIES = ['Tày','Thái','Mường','Khmer','Nùng','H\'Mông','Hoa','Dao','Gia Rai'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function rng(seed) {
  let s = seed;
  return function() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

function weightedPick(arr, rand) {
  const total = arr.reduce((s, x) => s + (x.weight || 1), 0);
  let t = rand() * total;
  for (const item of arr) {
    t -= (item.weight || 1);
    if (t <= 0) return item;
  }
  return arr[arr.length - 1];
}

function randInt(min, max, rand) {
  return min + Math.floor(rand() * (max - min + 1));
}

function formatPhone(rand) {
  const prefixes = ['096','097','098','086','089','090','091','094','083','085'];
  return pick(prefixes, rand) + String(Math.floor(rand() * 10000000)).padStart(7, '0');
}

/**
 * Build a profile object for one of the 4 score groups.
 * Returned properties map directly to SimulationStudent fields.
 *
 * Engine scoring (base 50 + year1 +30 = 80 before other factors):
 *   distScore:  km>500 → +30 | km>200 → +20 | km>50 → +10 | km<50 → -10
 *   famScore:   poor → +25 | average → 0 | wealthy → -10
 *   policyScore: financialHardship +20, ethnicMinority +15, disabled +25, rural +10, scholarship +10
 *   ethnicBonus: non-Kinh +10 * w.ethnicity(0.5) = +5
 *   violScore:  none +5 | minor -10 | major -25
 *   dormScore:  never_stayed +5*0.3 = +1.5
 */
function buildProfile(group, rand, dIdx) {
  switch (group) {
    case 'A': {
      // High score (95-100 capped): far, poor, minority, financial hardship
      const prov = pick(PROVINCES_VFAR, rand);
      return {
        province: prov.name,
        distanceToHanoi: prov.km + randInt(-5, 5, rand),
        familySituation: 'poor',
        ethnicity: pick(MINORITIES, rand),
        priorityPolicies: {
          financialHardship: true,
          ethnicMinority:    true,
          disabled:          rand() < 0.15,
          ruralPolicy:       true,
          scholarship:       rand() < 0.20
        },
        violationHistory: 'none',
        dormHistory:      'never_stayed'
      };
    }
    case 'B': {
      // Medium-high (75-95): medium/far distance, average family, no special policy
      const pool = rand() < 0.5 ? PROVINCES_MEDIUM : PROVINCES_FAR;
      const prov = pick(pool, rand);
      const isRemote = prov.km > 200;
      return {
        province: prov.name,
        distanceToHanoi: prov.km + randInt(-10, 10, rand),
        familySituation: 'average',
        ethnicity: 'Kinh',
        priorityPolicies: {
          financialHardship: false,
          ethnicMinority:    false,
          disabled:          false,
          ruralPolicy:       isRemote && rand() < 0.2,
          scholarship:       rand() < 0.12
        },
        violationHistory: 'none',
        dormHistory:      'never_stayed'
      };
    }
    case 'C': {
      // Medium-low (55-75): near/medium, comfortable, no policy
      const pool = rand() < 0.6 ? PROVINCES_NEAR : PROVINCES_MEDIUM;
      const prov = pick(pool, rand);
      return {
        province: prov.name,
        distanceToHanoi: prov.km + randInt(-5, 5, rand),
        familySituation: 'wealthy',
        ethnicity: 'Kinh',
        priorityPolicies: {
          financialHardship: false,
          ethnicMinority:    false,
          disabled:          false,
          ruralPolicy:       false,
          scholarship:       false
        },
        violationHistory: 'none',
        dormHistory:      'never_stayed'
      };
    }
    case 'D':
    default: {
      // Low score (30-50): very close to Hanoi (< 50km → −10 dist), wealthy, no
      // policy benefit, kinh, bad dorm history, and a violation. These students
      // are engineered to ALWAYS lose against quota (Fix 3 — exactly 7 rejected).
      //   - distance < 50km  → distScore −10 (regardless of distance weight)
      //   - wealthy          → −10
      //   - bad_history      → −3 (×0.3 weight)
      //   - minor violation  → −10 → score ≈ 45–47
      //   - major violation  → −25 → score ≈ 30–32
      // dIdx makes the split deterministic: first 4 minor, rest major.
      const NEAR_CLOSE = [
        { name: 'Hà Nội', km: 8 }, { name: 'Bắc Ninh', km: 22 },
        { name: 'Hà Tây cũ', km: 18 }, { name: 'Hưng Yên', km: 28 }
      ];
      const prov = NEAR_CLOSE[(dIdx ?? 0) % NEAR_CLOSE.length];
      const useMajor = (dIdx ?? 0) >= 4; // first 4 minor, remaining major
      return {
        province: prov.name,
        distanceToHanoi: prov.km,
        familySituation: 'wealthy',
        ethnicity: 'Kinh',
        priorityPolicies: {
          financialHardship: false,
          ethnicMinority:    false,
          disabled:          false,
          ruralPolicy:       false,
          scholarship:       false
        },
        violationHistory: useMajor ? 'major' : 'minor',
        dormHistory:      'bad_history'
      };
    }
  }
}

// ── Main generator ───────────────────────────────────────────────────────────

/**
 * Generate `count` Year-1 students with realistic score distribution.
 *
 * @param {number} count          - total students to generate
 * @param {number} enrollmentYear - e.g. 2026
 * @param {string|ObjectId} workspaceId
 * @param {number} [seedBase]     - for reproducibility
 * @returns {Array<Object>}       - sim student documents (not yet saved)
 */
function generateYear1Students(count, enrollmentYear, workspaceId, seedBase = 42) {
  const rand = rng(seedBase + enrollmentYear);

  // ── Group sizes (Fix 3): Group D is FIXED at REJECT_TARGET = 7 ───────────
  // The remaining seats split A=25% / B=45% / C=30%. Since A/B/C all score
  // strictly above Group D, allocation (top-quota by score) rejects exactly
  // the 7 Group-D students when count = year1Quota + 7.
  const REJECT_TARGET = 7;
  const nD = REJECT_TARGET;
  const remaining = Math.max(0, count - nD);
  const nA = Math.floor(remaining * 0.25);
  const nB = Math.floor(remaining * 0.45);
  const nC = remaining - nA - nB;

  function groupFor(i) {
    if (i < nA)           return 'A';
    if (i < nA + nB)      return 'B';
    if (i < nA + nB + nC) return 'C';
    return 'D';
  }

  // Per-gender namer. A coprime stride over the full 30×20×30 = 18,000 name
  // space decorrelates consecutive students (no monotone "X Thị Linh" prefix)
  // while staying a bijection — so names are unique within the batch. (A plain
  // small prime stride on each digit would repeat every lcm(30,20,30)=60 names.)
  const nameSeq = { male: 0, female: 0 };
  const NAME_STRIDE = 7919; // prime, coprime to 18,000
  function nextName(gender) {
    const isF    = gender === 'female';
    const seq    = isF ? nameSeq.female++ : nameSeq.male++;
    const lasts  = LAST_NAMES;                          // 30
    const mids   = isF ? MIDDLE_FEMALE : MIDDLE_MALE;   // 20
    const firsts = isF ? FIRST_FEMALE : FIRST_MALE;     // 30
    const N      = lasts.length * mids.length * firsts.length; // 18,000
    const code   = (seq * NAME_STRIDE) % N;
    const last  = lasts[code % lasts.length];
    const mid   = mids[Math.floor(code / lasts.length) % mids.length];
    const first = firsts[Math.floor(code / (lasts.length * mids.length)) % firsts.length];
    return `${last} ${mid} ${first}`;
  }

  const kCode = `K${66 + (enrollmentYear - 2020)}`;
  const students = [];
  const dStart = nA + nB + nC; // index where Group D begins

  for (let i = 0; i < count; i++) {
    const group   = groupFor(i);
    const dIdx    = group === 'D' ? (i - dStart) : undefined;
    const profile = buildProfile(group, rand, dIdx);

    const isMale   = rand() < 0.54;
    const gender   = isMale ? 'male' : 'female';
    const fullName = nextName(gender);

    const fac     = weightedPick(FACULTIES, rand);
    const section = String(randInt(1, 10, rand)).padStart(2, '0');
    const birthYear = enrollmentYear - randInt(18, 22, rand);
    const dateOfBirth = new Date(birthYear, randInt(0, 11, rand), randInt(1, 28, rand));

    // MSSV format for synthetic year-1: enrollmentYear_XXXX (e.g. 2026_0001)
    const studentId = `${enrollmentYear}_${String(i + 1).padStart(4, '0')}`;

    students.push({
      workspaceId,
      sourceStudentId: null,
      name:         fullName,
      username:     studentId,
      studentId,
      email:        `${studentId.replace('_','')}@sis.hust.edu.vn`,
      phone:        formatPhone(rand),
      dateOfBirth,
      gender,
      faculty:      fac.name,
      className:    `${fac.code}${enrollmentYear}-${section}`,
      academicYear: kCode,
      enrollmentYear,
      yearInSchool: 1,
      yearGroup:    'year1',
      isNewYear1:   true,
      isTestAccount: false,
      mustLeave:    false,
      ...profile,
      dormPreference: {
        preferredDormGender: gender === 'male' ? 'male' : 'female',
        preferredRoomType:   pick(['8-person','5-person','4-person-service','10-person'], rand)
      },
      priorityScore:   0,
      priorityDetails: {},
      createdAt:       new Date()
    });
  }

  return students;
}

module.exports = { generateYear1Students };
