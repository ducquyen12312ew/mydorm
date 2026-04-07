const { StudentCollection, DormitoryCollection } = require('../config/config');

const YEAR_GROUPS = ['year1', 'year2', 'year3', 'year4_plus'];
const YEAR_GROUP_SHIFT_MAP = {
  year1: 'year2',
  year2: 'year3',
  year3: 'year4_plus',
  year4_plus: 'year4_plus'
};

function normalizeAcademicYearStart(academicYear) {
  if (!academicYear) return null;

  if (typeof academicYear === 'number' && Number.isFinite(academicYear)) {
    return academicYear;
  }

  if (typeof academicYear !== 'string') {
    return null;
  }

  const value = academicYear.trim();
  if (!value) return null;

  if (/^\d{4}-\d{4}$/.test(value)) {
    return Number(value.slice(0, 4));
  }

  if (/^\d{4}$/.test(value)) {
    return Number(value);
  }

  return null;
}

function parseEnrollmentYear(student) {
  if (!student) return null;

  if (Number.isFinite(student.enrollmentYear)) {
    return Number(student.enrollmentYear);
  }

  if (typeof student.academicYear === 'number' && student.academicYear >= 1900) {
    return Number(student.academicYear);
  }

  if (typeof student.academicYear !== 'string') {
    return null;
  }

  const value = student.academicYear.trim();
  if (/^\d{4}$/.test(value)) {
    return Number(value);
  }

  if (/^\d{4}-\d{4}$/.test(value)) {
    return Number(value.slice(0, 4));
  }

  return null;
}

function yearInSchoolToGroup(yearInSchool) {
  if (!Number.isFinite(yearInSchool) || yearInSchool <= 1) {
    return 'year1';
  }

  if (yearInSchool === 2) return 'year2';
  if (yearInSchool === 3) return 'year3';
  return 'year4_plus';
}

function deriveYearGroup(student, academicYear) {
  const enrollmentYear = parseEnrollmentYear(student);
  const academicYearStart = normalizeAcademicYearStart(academicYear);

  if (enrollmentYear && academicYearStart) {
    const yearInSchool = academicYearStart - enrollmentYear + 1;
    return yearInSchoolToGroup(yearInSchool);
  }

  if (YEAR_GROUPS.includes(student?.yearGroup)) {
    return student.yearGroup;
  }

  return 'year4_plus';
}

function shiftYearGroup(student, academicYear) {
  // Prefer direct year-group transition when current group is already known.
  if (YEAR_GROUPS.includes(student?.yearGroup)) {
    return YEAR_GROUP_SHIFT_MAP[student.yearGroup] || 'year4_plus';
  }

  // Fallback for records that do not store yearGroup.
  return deriveYearGroup(student, academicYear);
}

function shiftStudents(students, academicYear) {
  return (Array.isArray(students) ? students : []).map((student) => {
    const yearGroup = shiftYearGroup(student, academicYear);

    return {
      ...student,
      yearGroup,
      shiftedYearGroup: yearGroup
    };
  });
}

async function applyShiftToAllStudents(academicYear, filter = {}) {
  const students = await StudentCollection.find({
    role: { $ne: 'admin' },
    ...filter
  }).lean();

  const shiftedStudents = shiftStudents(students, academicYear);

  return {
    academicYear,
    totalStudents: shiftedStudents.length,
    students: shiftedStudents
  };
}

async function executeShiftToAllStudents(academicYear, filter = {}) {
  const students = await StudentCollection.find({
    role: { $ne: 'admin' },
    ...filter
  }).select({ _id: 1, academicYear: 1, enrollmentYear: 1, yearGroup: 1 }).lean();

  if (!students.length) {
    return {
      academicYear,
      totalStudents: 0,
      updated: 0
    };
  }

  const operations = students.map((student) => ({
    // Persist shift result in existing schema-safe object field.
    // This avoids relying on undeclared top-level fields during bulk updates.
    
    updateOne: {
      filter: { _id: student._id },
      update: {
        $set: {
          'priorityDetails.shiftedYearGroup': shiftYearGroup(student, academicYear),
          'priorityDetails.lastShiftAcademicYear': academicYear,
          updatedAt: new Date()
        }
      }
    }
  }));

  const result = await StudentCollection.bulkWrite(operations, { ordered: false });

  return {
    academicYear,
    totalStudents: students.length,
    updated: Number(result?.modifiedCount || 0)
  };
}

function getPriorityScore(student) {
  const rawScore = student?.priorityScore;
  const numericScore = Number(rawScore);

  if (Number.isFinite(numericScore)) {
    return numericScore;
  }

  const nestedScore = Number(student?.priorityScore?.total);
  if (Number.isFinite(nestedScore)) {
    return nestedScore;
  }

  return 0;
}

function normalizeQuotaEntries(quotaConfig) {
  const quotas = Array.isArray(quotaConfig?.quotas) ? quotaConfig.quotas : [];
  const quotaMap = {
    year1: { slot: 0 },
    year2: { slot: 0 },
    year3: { slot: 0 },
    year4_plus: { slot: 0 }
  };

  quotas.forEach((entry) => {
    if (!YEAR_GROUPS.includes(entry.yearGroup)) return;

    const slot = Number(entry.slot);

    quotaMap[entry.yearGroup] = {
      slot: Number.isFinite(slot) ? slot : 0
    };
  });

  return quotaMap;
}

function groupStudentsByYearGroup(students, academicYear) {
  const grouped = {
    year1: [],
    year2: [],
    year3: [],
    year4_plus: []
  };

  (Array.isArray(students) ? students : []).forEach((student) => {
    const yearGroup = shiftYearGroup(student, academicYear);
    if (!YEAR_GROUPS.includes(yearGroup)) return;

    grouped[yearGroup].push({
      ...student,
      yearGroup
    });
  });

  return grouped;
}

function sortEvictionCandidates(students) {
  return [...students].sort((left, right) => {
    const leftScore = getPriorityScore(left);
    const rightScore = getPriorityScore(right);

    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    const leftKey = String(left.studentId || left.username || left._id || left.name || '');
    const rightKey = String(right.studentId || right.username || right._id || right.name || '');
    return leftKey.localeCompare(rightKey);
  });
}

function buildRemovalList(plan) {
  return YEAR_GROUPS.flatMap((group) => {
    return (plan[group] || []).map((student) => ({
      ...student,
      yearGroup: group
    }));
  });
}

async function getAvailableCapacity(academicYear, options = {}) {
  const includeFreedSlots = options.includeFreedSlots !== false;
  const assumeYear4PlusGraduates = options.assumeYear4PlusGraduates !== false;

  const dormitories = await DormitoryCollection.find({ isDeleted: { $ne: true } })
    .select({ floors: 1 })
    .lean();

  let totalRooms = 0;
  let totalSlots = 0;
  let occupiedSlots = 0;
  const occupantStudentKeys = new Set();

  dormitories.forEach((dormitory) => {
    (dormitory.floors || []).forEach((floor) => {
      (floor.rooms || []).forEach((room) => {
        totalRooms += 1;
        const roomCapacity = Number(room.maxCapacity || 0);
        totalSlots += roomCapacity;

        const activeOccupants = (room.occupants || []).filter((occupant) => occupant?.active);
        occupiedSlots += activeOccupants.length;

        activeOccupants.forEach((occupant) => {
          const key = String(occupant?.studentId || '');
          if (key) occupantStudentKeys.add(key);
        });
      });
    });
  });

  const availableSlots = Math.max(0, totalSlots - occupiedSlots);

  let estimatedFreedSlots = 0;
  let graduatingStudents = [];

  if (includeFreedSlots && occupantStudentKeys.size > 0) {
    const occupantStudents = await StudentCollection.find({
      role: { $ne: 'admin' },
      studentId: { $in: Array.from(occupantStudentKeys) }
    })
      .select({ _id: 1, studentId: 1, username: 1, academicYear: 1, enrollmentYear: 1, yearGroup: 1, priorityScore: 1, isGraduating: 1 })
      .lean();

    graduatingStudents = occupantStudents.filter((student) => {
      if (student?.isGraduating === true) {
        return true;
      }

      if (!assumeYear4PlusGraduates) {
        return false;
      }

      return deriveYearGroup(student, academicYear) === 'year4_plus';
    });

    estimatedFreedSlots = graduatingStudents.length;
  }

  return {
    academicYear,
    totalRooms,
    totalSlots,
    occupiedSlots,
    availableSlots,
    estimatedFreedSlots,
    projectedAvailableSlots: availableSlots + estimatedFreedSlots,
    graduatingStudents: graduatingStudents.map((student) => ({
      studentId: student.studentId,
      username: student.username,
      yearGroup: deriveYearGroup(student, academicYear),
      priorityScore: getPriorityScore(student)
    }))
  };
}

function calculateEvictionPlan(
  quotaConfig,
  students = [],
  academicYear = quotaConfig?.academicYear,
  options = {}
) {
  const isPreview = options.isPreview === true;
  const quotaMap = normalizeQuotaEntries(quotaConfig);
  const groupedStudents = groupStudentsByYearGroup(students, academicYear);

  const plan = {
    year1: [],
    year2: [],
    year3: [],
    year4_plus: []
  };

  const summary = {};

  YEAR_GROUPS.forEach((group) => {
    const actual = groupedStudents[group].length;
    const quotaSlot = quotaMap[group].slot;
    const overflow = Math.max(0, actual - quotaSlot);

    const candidates = overflow > 0
      ? sortEvictionCandidates(groupedStudents[group]).slice(0, overflow)
      : [];

    plan[group] = candidates;
    summary[group] = {
      quotaSlot,
      actual,
      overflow,
      removed: candidates.length,
      status: overflow > 0 ? 'over_quota' : 'within_quota'
    };
  });

  const removalList = buildRemovalList(plan);

  return {
    isPreview,
    academicYear,
    plan,
    summary,
    removalList
  };
}

function planEviction(
  quotaConfig,
  students = [],
  academicYear = quotaConfig?.academicYear,
  options = {}
) {
  const preview = calculateEvictionPlan(
    quotaConfig,
    students,
    academicYear,
    { isPreview: true }
  );

  const studentsToNotify = preview.removalList.map((student) => ({
    studentId: student.studentId,
    username: student.username,
    name: student.name,
    yearGroup: student.yearGroup,
    priorityScore: getPriorityScore(student)
  }));

  return {
    isPreview: true,
    academicYear,
    studentsToNotify,
    estimatedSlotsToFree: studentsToNotify.length,
    byYearGroup: preview.summary,
    removalList: options.includeRawRemovalList === true ? preview.removalList : studentsToNotify
  };
}

function finalizeQuota({
  quotaConfig,
  actualNewApplications,
  availableCapacity,
  plannedEviction = null
}) {
  const demand = Math.max(0, Number(actualNewApplications) || 0);
  const availableNow = Math.max(0, Number(availableCapacity?.availableSlots) || 0);
  const graduatingFreed = Math.max(0, Number(availableCapacity?.estimatedFreedSlots) || 0);
  const baselineCapacity = availableNow + graduatingFreed;

  const plannedToRemove = Math.max(
    0,
    Number(plannedEviction?.estimatedSlotsToFree)
    || Number(plannedEviction?.removalList?.length)
    || 0
  );

  const neededEvictions = Math.max(0, demand - baselineCapacity);
  const extraEvictionsNeeded = Math.max(0, neededEvictions - plannedToRemove);

  const finalStudentsToRemove = neededEvictions;
  const finalYear1Slots = Math.max(0, Math.min(demand, baselineCapacity + finalStudentsToRemove));

  const quotaYear1Slot = Number(
    (quotaConfig?.quotas || []).find((q) => q.yearGroup === 'year1')?.slot || 0
  );

  let decision = 'adjusted_for_demand';
  if (baselineCapacity >= demand) {
    decision = 'no_additional_eviction_needed';
  } else if (extraEvictionsNeeded > 0) {
    decision = 'additional_eviction_required';
  } else {
    decision = 'planned_eviction_sufficient';
  }

  return {
    demand,
    capacity: {
      availableNow,
      graduatingFreed,
      baselineCapacity
    },
    planning: {
      quotaYear1Slot,
      plannedEvictions: plannedToRemove,
      neededEvictions,
      extraEvictionsNeeded
    },
    final: {
      year1Slots: finalYear1Slots,
      studentsToRemove: finalStudentsToRemove,
      decision
    }
  };
}

function calculateEvictionOnly(quotaConfig, students = [], academicYear = quotaConfig?.academicYear) {
  return calculateEvictionPlan(quotaConfig, students, academicYear).plan;
}

function previewEvictionPlan(quotaConfig, students = [], academicYear = quotaConfig?.academicYear) {
  const result = calculateEvictionPlan(
    quotaConfig,
    students,
    academicYear,
    { isPreview: true }
  );

  const totalStudents = Array.isArray(students) ? students.length : 0;
  const totalToRemove = result.removalList.length;

  const byYearGroup = {};
  YEAR_GROUPS.forEach((group) => {
    byYearGroup[group] = {
      quota: result.summary[group].quotaSlot,
      actual: result.summary[group].actual,
      overflow: result.summary[group].overflow,
      toRemove: result.summary[group].removed
    };
  });

  return {
    isPreview: true,
    summary: {
      totalStudents,
      totalToRemove,
      totalAfter: Math.max(0, totalStudents - totalToRemove)
    },
    byYearGroup,
    removalList: result.removalList
  };
}

module.exports = {
  YEAR_GROUPS,
  deriveYearGroup,
  shiftYearGroup,
  shiftStudents,
  applyShiftToAllStudents,
  executeShiftToAllStudents,
  getAvailableCapacity,
  calculateEvictionPlan,
  planEviction,
  finalizeQuota,
  calculateEvictionOnly,
  previewEvictionPlan
};