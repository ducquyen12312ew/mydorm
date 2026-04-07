/**
 * CohortShiftService
 *
 * Core logic for:
 *  1. Mapping cohort code (K70) → enrollment year → year-in-school → year-group
 *  2. Generating a full shift snapshot for a given academic year
 *  3. Retrieving historical snapshots for timeline/trend views
 */
const CohortShift   = require('../schemas/CohortShiftSchema');
const RoomAllocation   = require('../schemas/RoomAllocationSchema');
const AllocationCycle  = require('../schemas/AllocationCycleSchema');
const { StudentCollection } = require('../config/config');
const { logger } = require('../config/logger');

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Year-group key rules:
 *   yearInSchool 1           → year1
 *   yearInSchool 2           → year2
 *   yearInSchool 3           → year3
 *   yearInSchool 4+          → year4_plus
 */
const YEAR_GROUP_COLORS = {
  year1:      '#4361ee',
  year2:      '#3a0ca3',
  year3:      '#7209b7',
  year4_plus: '#f72585'
};

const YEAR_GROUP_LABELS = {
  year1:      'Năm 1',
  year2:      'Năm 2',
  year3:      'Năm 3',
  year4_plus: 'Năm 4+'
};

/**
 * Vietnamese cohort naming convention:
 *   K{N} where enrollment year = BASE_ENROLLMENT_YEAR + (N - BASE_K)
 *   e.g. BASE_K=66, BASE_YEAR=2020 → K70 = 2024, K71 = 2025
 *
 * We derive the code from the enrollment year to keep it generic.
 */
const BASE_K          = 66;   // K66 enrolled in 2020
const BASE_YEAR       = 2020;

function cohortCodeFromEnrollmentYear(enrollmentYear) {
  return `K${BASE_K + (enrollmentYear - BASE_YEAR)}`;
}

function enrollmentYearFromCohortCode(code) {
  const n = parseInt(code.replace(/[^0-9]/g, ''), 10);
  return BASE_YEAR + (n - BASE_K);
}

/**
 * Parse the first year from an academic-year string "2026-2027" → 2026
 */
function parseAcademicYear(academicYear) {
  return parseInt(academicYear.split('-')[0], 10);
}

function groupLabel(groupKey) {
  return YEAR_GROUP_LABELS[groupKey] || groupKey;
}

function parseAcademicYearStart(academicYear) {
  return Number(String(academicYear || '').split('-')[0]) || 0;
}

/**
 * Given an enrollment year and the current academic year string,
 * return: { yearInSchool, yearGroup }
 */
function resolveYearInfo(enrollmentYear, academicYear) {
  const currentYear = parseAcademicYear(academicYear);
  const yearInSchool = currentYear - enrollmentYear + 1; // 1-based

  let yearGroup;
  if (yearInSchool <= 1)      yearGroup = 'year1';
  else if (yearInSchool === 2) yearGroup = 'year2';
  else if (yearInSchool === 3) yearGroup = 'year3';
  else                         yearGroup = 'year4_plus';

  return { yearInSchool: Math.max(yearInSchool, 1), yearGroup };
}


// ─── Service class ─────────────────────────────────────────────────────────────

class CohortShiftService {

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Cohort resolution helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Resolve full cohort info for a given enrollment year in an academic year.
   */
  static resolveCohort(enrollmentYear, academicYear) {
    const { yearInSchool, yearGroup } = resolveYearInfo(enrollmentYear, academicYear);
    return {
      code: cohortCodeFromEnrollmentYear(enrollmentYear),
      enrollmentYear,
      yearInSchool,
      yearGroup
    };
  }

  /**
   * Enumerate all active cohorts for a given academic year.
   * "Active" = enrolled ≤ currentYear and yearInSchool ≤ 6 (safety cap).
   */
  static getActiveCohortEnrollmentYears(academicYear, maxYearsBack = 6) {
    const currentYear = parseAcademicYear(academicYear);
    const years = [];
    for (let offset = 0; offset < maxYearsBack; offset++) {
      years.push(currentYear - offset);
    }
    return years;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Student count per enrollment year
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Count students per enrollment year from the DB.
   * Student.academicYear stores a K-code like "K70".
   * Falls back to extracting the enrollment year from enrollmentYear field
   * or the cohort code stored in academicYear.
   *
   * Returns: { [enrollmentYear: number]: count }
   */
  static async getStudentCountsByEnrollmentYear() {
    const students = await StudentCollection.find(
      { role: { $ne: 'admin' } },
      { academicYear: 1, enrollmentYear: 1 }
    ).lean();

    const counts = {};
    students.forEach(s => {
      let ey = null;
      // Try numeric enrollmentYear field
      if (s.enrollmentYear && typeof s.enrollmentYear === 'number') {
        ey = s.enrollmentYear;
      }
      // Try to parse from academicYear K-code "K70"
      else if (s.academicYear && /^K\d+$/i.test(s.academicYear)) {
        ey = enrollmentYearFromCohortCode(s.academicYear);
      }
      if (ey !== null) {
        counts[ey] = (counts[ey] || 0) + 1;
      }
    });
    return counts;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Actual allocation counts per (cohort / year-group) in an academic year
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns { [enrollmentYear]: allocatedCount } for a given academic year.
   */
  static async getAllocatedCountsByEnrollmentYear(academicYear) {
    const cycles = await AllocationCycle.find({ academicYear }).select('_id').lean();
    const cycleIds = cycles.map(c => c._id);
    if (!cycleIds.length) return {};

    const rows = await RoomAllocation.find(
      { allocationCycleId: { $in: cycleIds }, status: 'ACTIVE' },
      { studentEnrollmentYear: 1 }
    ).lean();

    const counts = {};
    rows.forEach(r => {
      const ey = r.studentEnrollmentYear;
      if (ey) counts[ey] = (counts[ey] || 0) + 1;
    });
    return counts;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. MAIN: Generate (or refresh) a CohortShift snapshot
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Compute the cohort shift snapshot. Upserts the document for academicYear.
   *
   * @param {string} academicYear  - "2026-2027"
   * @param {object} opts
   * @param {boolean} opts.auto    - true if triggered by scheduler
   * @param {string}  opts.triggeredBy - admin userId string
   * @returns {CohortShift document}
   */
  static async generateShiftSnapshot(academicYear, opts = {}) {
    const [studentCounts, allocCounts] = await Promise.all([
      this.getStudentCountsByEnrollmentYear(),
      this.getAllocatedCountsByEnrollmentYear(academicYear)
    ]);

    // Build cohort rows
    const enrollmentYears = this.getActiveCohortEnrollmentYears(academicYear);
    const baseRows = enrollmentYears.map(ey => {
      const { code, yearInSchool, yearGroup } = this.resolveCohort(ey, academicYear);

      return {
        code,
        enrollmentYear: ey,
        yearInSchool,
        yearGroup,
        studentCount: studentCounts[ey] || 0,
        allocated:   allocCounts[ey]  || 0
      };
    });

    const cohortRows = baseRows;

    cohortRows.sort((a, b) => b.enrollmentYear - a.enrollmentYear);

    // Build summary per year-group
    const summary = { year1: {}, year2: {}, year3: {}, year4_plus: {} };
    ['year1', 'year2', 'year3', 'year4_plus'].forEach(key => {
      const rows = cohortRows.filter(r => r.yearGroup === key);
      summary[key] = {
        cohorts:      rows.map(r => r.code),
        allocated:    rows.reduce((s, r) => s + r.allocated, 0),
        studentCount: rows.reduce((s, r) => s + r.studentCount, 0)
      };
    });

    // Upsert
    const doc = await CohortShift.findOneAndUpdate(
      { academicYear },
      {
        $set: {
          generatedAt:    new Date(),
          isAutoGenerated: opts.auto || false,
          cohorts: cohortRows,
          summary,
          notes:   opts.notes || '',
          updatedAt: new Date(),
          ...(opts.triggeredBy ? { triggeredBy: opts.triggeredBy } : {})
        }
      },
      { upsert: true, new: true }
    );

    logger.info('CohortShift snapshot generated', {
      academicYear,
      cohorts: cohortRows.length,
      auto: opts.auto
    });

    return doc;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Historical data
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get all snapshots sorted by academic year (oldest first).
   */
  static async getAllSnapshots() {
    return CohortShift.find({})
      .sort({ academicYear: 1 })
      .lean();
  }

  /**
   * Get a single snapshot for an academic year.
   */
  static async getSnapshot(academicYear) {
    return CohortShift.findOne({ academicYear }).lean();
  }

  /**
   * Build timeline data suitable for rendering trend charts.
    * Returns array of years with per-year-group allocation and student counts.
   */
  static async getTimelineData() {
    const snapshots = await this.getAllSnapshots();

    return snapshots.map((snap, index) => {
      const prev = index > 0 ? snapshots[index - 1] : null;
      const currentSummary = {
        year1:      snap.summary && snap.summary.year1,
        year2:      snap.summary && snap.summary.year2,
        year3:      snap.summary && snap.summary.year3,
        year4_plus: snap.summary && snap.summary.year4_plus
      };

      const deltas = {};
      ['year1', 'year2', 'year3', 'year4_plus'].forEach(key => {
        const current = currentSummary[key] || {};
        const previous = prev && prev.summary ? (prev.summary[key] || {}) : {};
        deltas[key] = {
          allocatedDelta: Number(current.allocated || 0) - Number(previous.allocated || 0),
          studentDelta: Number(current.studentCount || 0) - Number(previous.studentCount || 0)
        };
      });

      const shiftTransitions = [];
      if (prev && Array.isArray(prev.cohorts) && Array.isArray(snap.cohorts)) {
        const prevMap = new Map(prev.cohorts.map(c => [c.code, c]));
        snap.cohorts.forEach(currentCohort => {
          const from = prevMap.get(currentCohort.code);
          if (!from) {
            shiftTransitions.push({
              cohort: currentCohort.code,
              fromYearInSchool: null,
              toYearInSchool: currentCohort.yearInSchool,
              fromYearGroup: null,
              toYearGroup: currentCohort.yearGroup,
              fromLabel: 'Mới',
              toLabel: groupLabel(currentCohort.yearGroup),
              movement: 'new'
            });
            return;
          }

          if (from.yearInSchool !== currentCohort.yearInSchool || from.yearGroup !== currentCohort.yearGroup) {
            shiftTransitions.push({
              cohort: currentCohort.code,
              fromYearInSchool: from.yearInSchool,
              toYearInSchool: currentCohort.yearInSchool,
              fromYearGroup: from.yearGroup,
              toYearGroup: currentCohort.yearGroup,
              fromLabel: groupLabel(from.yearGroup),
              toLabel: groupLabel(currentCohort.yearGroup),
              movement: from.yearGroup === currentCohort.yearGroup ? 'within-group' : 'promoted'
            });
          }
        });
      }

      return {
        academicYear: snap.academicYear,
        generatedAt: snap.generatedAt,
        cohorts: snap.cohorts || [],
        summary: currentSummary,
        comparison: {
          previousAcademicYear: prev ? prev.academicYear : null,
          deltas,
          shiftTransitions
        }
      };
    });
  }

  /**
   * Build one explicit transition report between 2 academic years.
   */
  static buildTransitionReport(fromSnapshot, toSnapshot) {
    if (!fromSnapshot || !toSnapshot) return null;

    const fromMap = new Map((fromSnapshot.cohorts || []).map(c => [c.code, c]));
    const toMap = new Map((toSnapshot.cohorts || []).map(c => [c.code, c]));

    const transitions = [];
    (toSnapshot.cohorts || []).forEach(nextCohort => {
      const prev = fromMap.get(nextCohort.code);
      if (!prev) {
        transitions.push({
          cohort: nextCohort.code,
          fromYearInSchool: null,
          toYearInSchool: nextCohort.yearInSchool,
          fromYearGroup: null,
          toYearGroup: nextCohort.yearGroup,
          fromLabel: 'Mới',
          toLabel: groupLabel(nextCohort.yearGroup),
          movement: 'new'
        });
        return;
      }

      transitions.push({
        cohort: nextCohort.code,
        fromYearInSchool: prev.yearInSchool,
        toYearInSchool: nextCohort.yearInSchool,
        fromYearGroup: prev.yearGroup,
        toYearGroup: nextCohort.yearGroup,
        fromLabel: groupLabel(prev.yearGroup),
        toLabel: groupLabel(nextCohort.yearGroup),
        movement: prev.yearGroup === nextCohort.yearGroup ? 'within-group' : 'promoted'
      });
    });

    const cohortsExited = [];
    (fromSnapshot.cohorts || []).forEach(prevCohort => {
      if (!toMap.has(prevCohort.code)) {
        cohortsExited.push({
          cohort: prevCohort.code,
          lastYearInSchool: prevCohort.yearInSchool,
          lastYearGroup: prevCohort.yearGroup,
          lastLabel: groupLabel(prevCohort.yearGroup),
          movement: 'exited'
        });
      }
    });

    const summaryKeys = ['year1', 'year2', 'year3', 'year4_plus'];
    const summaryDeltas = {};
    summaryKeys.forEach(key => {
      const fromSummary = (fromSnapshot.summary && fromSnapshot.summary[key]) || {};
      const toSummary = (toSnapshot.summary && toSnapshot.summary[key]) || {};
      summaryDeltas[key] = {
        allocatedDelta: Number(toSummary.allocated || 0) - Number(fromSummary.allocated || 0),
        studentDelta: Number(toSummary.studentCount || 0) - Number(fromSummary.studentCount || 0)
      };
    });

    return {
      fromAcademicYear: fromSnapshot.academicYear,
      toAcademicYear: toSnapshot.academicYear,
      generatedAt: new Date(),
      transitions,
      cohortsExited,
      summaryDeltas
    };
  }

  /**
   * Return transition report for a specific year pair.
   */
  static async getTransitionReport(fromAcademicYear, toAcademicYear) {
    const [fromSnapshot, toSnapshot] = await Promise.all([
      this.getSnapshot(fromAcademicYear),
      this.getSnapshot(toAcademicYear)
    ]);

    if (!fromSnapshot || !toSnapshot) {
      return {
        found: false,
        missing: {
          from: !fromSnapshot,
          to: !toSnapshot
        }
      };
    }

    return {
      found: true,
      report: this.buildTransitionReport(fromSnapshot, toSnapshot)
    };
  }

  /**
   * Return all consecutive transition reports, optionally filtered by year range.
   */
  static async getAllTransitionReports(opts = {}) {
    const snapshots = await this.getAllSnapshots();
    const fromStart = parseAcademicYearStart(opts.fromAcademicYear);
    const toStart = parseAcademicYearStart(opts.toAcademicYear);

    const reports = [];
    for (let i = 1; i < snapshots.length; i++) {
      const fromSnap = snapshots[i - 1];
      const toSnap = snapshots[i];
      const toYearStart = parseAcademicYearStart(toSnap.academicYear);

      if (fromStart && toYearStart < fromStart) continue;
      if (toStart && toYearStart > toStart) continue;

      const report = this.buildTransitionReport(fromSnap, toSnap);
      if (report) reports.push(report);
    }

    return reports;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Edge case: graduated / year5+ cohorts
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Filter cohorts that are 5+ years in school (edge case / graduated).
   */
  static getEdgeCaseCohorts(snapshot) {
    if (!snapshot || !snapshot.cohorts) return [];
    return snapshot.cohorts.filter(c => c.yearInSchool >= 5);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Next-year projection (preview before running)
  // ──────────────────────────────────────────────────────────────────────────

  /**
  * Generate a preview of what cohorts will look like NEXT year.
   */
  static async previewNextYear(currentAcademicYear) {
    const [currentStart, currentEnd] = currentAcademicYear.split('-').map(Number);
    const nextAcademicYear = `${currentStart + 1}-${currentEnd + 1}`;

    // Simulate: same student counts + one new cohort (new enrollment year = currentEnd+1)
    const [studentCounts] = await Promise.all([
      this.getStudentCountsByEnrollmentYear(),
    ]);

    const enrollmentYears = this.getActiveCohortEnrollmentYears(nextAcademicYear);

    const baseRows = enrollmentYears.map(ey => {
      const { code, yearInSchool, yearGroup } = this.resolveCohort(ey, nextAcademicYear);
      const isNew = ey === currentEnd + 1;
      return {
        code,
        enrollmentYear: ey,
        yearInSchool,
        yearGroup,
        studentCount: isNew ? 0 : (studentCounts[ey] || 0),
        allocated:   0,    // projection — no allocations yet
        isNew
      };
    });

    const cohortRows = baseRows;

    cohortRows.sort((a, b) => b.enrollmentYear - a.enrollmentYear);

    const summary = { year1: {}, year2: {}, year3: {}, year4_plus: {} };
    ['year1', 'year2', 'year3', 'year4_plus'].forEach(key => {
      const rows = cohortRows.filter(r => r.yearGroup === key);
      summary[key] = {
        cohorts:      rows.map(r => r.code),
        allocated:    0,
        studentCount: rows.reduce((s, r) => s + r.studentCount, 0)
      };
    });

    return {
      academicYear: nextAcademicYear,
      isPreview:    true,
      cohorts:      cohortRows,
      summary
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Static helpers exposed to views
  // ──────────────────────────────────────────────────────────────────────────

  static getYearGroupColors()  { return YEAR_GROUP_COLORS; }
  static getYearGroupLabels()  { return YEAR_GROUP_LABELS; }
  static cohortCodeFromEnrollmentYear = cohortCodeFromEnrollmentYear;
  static resolveYearInfo = resolveYearInfo;
}

module.exports = CohortShiftService;
