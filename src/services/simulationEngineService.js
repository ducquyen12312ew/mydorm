const { v4: uuidv4 } = require('uuid');
const SimulationStudent    = require('../schemas/simulation/SimulationStudentSchema');
const SimulationDormitory  = require('../schemas/simulation/SimulationDormitorySchema');
const SimulationRun        = require('../schemas/simulation/SimulationRunSchema');
const SimulationWorkspace  = require('../schemas/simulation/SimulationWorkspaceSchema');
const { generateYear1Students } = require('../data/simulation/year1Generator');
const { logger } = require('../config/logger');

// ── Default policy weights ───────────────────────────────────────────────────

const DEFAULT_WEIGHTS = {
  year:       1.0,   // year group priority
  distance:   1.0,   // distance from home
  family:     1.0,   // family situation
  policy:     1.0,   // priority policies (financial/ethnic/disabled/rural/scholarship)
  ethnicity:  0.5,   // ethnic minority bonus
  violation:  1.0,   // violation penalty
  dormHistory: 0.3   // dorm history bonus
};

// ── Year-group score table ───────────────────────────────────────────────────

const YEAR_BASE_SCORE = {
  year1:      30,
  year2:      20,
  year3:      10,
  year4_plus:  0,
  year5plus:  -15
};

// ── Priority Engine ──────────────────────────────────────────────────────────

class SimulationEngineService {

  /**
   * Compute a single student's priority score given admin-configured weights.
   * All factors are additive on top of base 50.
   */
  static computePriorityScore(student, weights = {}) {
    const w = { ...DEFAULT_WEIGHTS, ...weights };
    let score = 50;

    // Year group
    const yearScore = YEAR_BASE_SCORE[student.yearGroup] ?? 0;
    score += yearScore * w.year;

    // Distance from Hanoi
    const km = student.distanceToHanoi || 0;
    let distScore = 0;
    if      (km > 500) distScore = 30;
    else if (km > 200) distScore = 20;
    else if (km >  50) distScore = 10;
    else               distScore = -10;
    score += distScore * w.distance;

    // Family situation
    const famMap = { poor: 25, average: 0, wealthy: -10 };
    score += (famMap[student.familySituation] || 0) * w.family;

    // Priority policies (additive)
    const pp = student.priorityPolicies || {};
    let policyScore = 0;
    if (pp.financialHardship) policyScore += 20;
    if (pp.ethnicMinority)    policyScore += 15;
    if (pp.disabled)          policyScore += 25;
    if (pp.ruralPolicy)       policyScore += 10;
    if (pp.scholarship)       policyScore += 10;
    score += policyScore * w.policy;

    // Ethnicity minority bonus (separate from policy)
    if (student.ethnicity && student.ethnicity !== 'Kinh') {
      score += 10 * w.ethnicity;
    }

    // Violation penalty
    const violMap = { none: 5, minor: -10, major: -25, critical: -40 };
    score += (violMap[student.violationHistory] || 0) * w.violation;

    // Dorm history
    const dormMap = { never_stayed: 5, good_history: 3, bad_history: -10 };
    score += (dormMap[student.dormHistory] || 0) * w.dormHistory;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ── MSSV-prefix → year group mapping ─────────────────────────────────────

  static getMssvPrefix(studentId) {
    if (!studentId) return null;
    const s = String(studentId).trim();
    if (s === '99999999') return null; // special account
    const p = parseInt(s.substring(0, 4), 10);
    return isNaN(p) ? null : p;
  }

  static yearGroupFromPrefix(prefix, simYear) {
    if (prefix === null) return null;
    // yearInSchool = (simYear - enrollmentYear) + 1
    // e.g. enrolled 2022, simYear 2026: yearInSchool = 4+1 = 5 → mustLeave
    const yearInSchool = (simYear - prefix) + 1;
    if (yearInSchool >= 5) return { yearGroup: 'year5plus',  yearInSchool, mustLeave: true  };
    if (yearInSchool === 4) return { yearGroup: 'year4_plus', yearInSchool, mustLeave: false };
    if (yearInSchool === 3) return { yearGroup: 'year3',      yearInSchool, mustLeave: false };
    if (yearInSchool === 2) return { yearGroup: 'year2',      yearInSchool, mustLeave: false };
    return { yearGroup: 'year1', yearInSchool: 1, mustLeave: false };
  }

  // ── Cohort Shift (MSSV-prefix based) ─────────────────────────────────────

  static async applyCohortShift(workspaceId, simAcademicYear) {
    const simYear = parseInt(simAcademicYear.split('-')[0], 10);

    const students = await SimulationStudent.find({ workspaceId }).lean();

    const bulkOps = [];
    const mustLeaveIds = []; // sim_student._id list for those who must leave

    for (const s of students) {
      // isTestAccount (99999999) stays as year1 always, no shift
      if (s.isTestAccount) {
        bulkOps.push({ updateOne: { filter: { _id: s._id },
          update: { $set: { yearGroup: 'year1', yearInSchool: 1, mustLeave: false } } } });
        continue;
      }

      // isNewYear1 (synthetic 2026 students injected by seedYear1) — skip if already shifted
      if (s.isNewYear1) continue;

      const prefix = this.getMssvPrefix(s.studentId);
      if (prefix === null) continue;

      const result = this.yearGroupFromPrefix(prefix, simYear);
      if (!result) continue;

      bulkOps.push({ updateOne: { filter: { _id: s._id },
        update: { $set: { yearGroup: result.yearGroup, yearInSchool: result.yearInSchool, mustLeave: result.mustLeave } } } });

      if (result.mustLeave) mustLeaveIds.push(String(s.studentId));
    }

    if (bulkOps.length) await SimulationStudent.bulkWrite(bulkOps);

    // Free sim_dormitory beds for mustLeave students
    if (mustLeaveIds.length) {
      const dorms = await SimulationDormitory.find({ workspaceId }).lean();
      for (const dorm of dorms) {
        let dormModified = false;
        const updatedFloors = dorm.floors.map(f => ({
          ...f,
          rooms: f.rooms.map(r => {
            const before = (r.occupants || []).length;
            const filtered = (r.occupants || []).filter(o => !mustLeaveIds.includes(String(o.studentId)));
            if (filtered.length < before) { dormModified = true; }
            return { ...r, occupants: filtered, currentOccupancy: filtered.filter(o => o.active).length };
          })
        }));
        if (dormModified) {
          await SimulationDormitory.findByIdAndUpdate(dorm._id, { $set: { floors: updatedFloors } });
        }
      }
      logger.info('Freed rooms for mustLeave students', { workspaceId, count: mustLeaveIds.length });
    }

    logger.info('Cohort shift applied (MSSV-prefix)', { workspaceId, simAcademicYear, count: bulkOps.length, mustLeave: mustLeaveIds.length });
    return bulkOps.length;
  }

  // ── Seed Year 1 (2026xxx) ────────────────────────────────────────────────

  static async seedYear1Students(workspaceId, count = 200, enrollmentYear = null) {
    if (!enrollmentYear) enrollmentYear = new Date().getFullYear();

    await SimulationStudent.deleteMany({ workspaceId, isNewYear1: true, enrollmentYear });

    // Fix 3: seed EXACTLY year1Quota + REJECT_TARGET so allocation rejects exactly
    // REJECT_TARGET year-1 students (the low-scoring Group D). The quota MUST be
    // computed from the same effective-bed figure that runAllocationPreview uses
    // (raw available beds minus the maintenance buffer) — otherwise the quota used
    // here and the quota used during allocation diverge and the reject count drifts.
    const dorms = await SimulationDormitory.find({ workspaceId }).lean();
    let totalBeds = 0, occupied = 0;
    dorms.forEach(d => d.floors.forEach(f => f.rooms.forEach(r => {
      totalBeds += r.maxCapacity || 0;
      occupied  += r.currentOccupancy || 0;
    })));
    const availableBeds = totalBeds - occupied;
    const MAINTENANCE_BUFFER = 0.03; // must match runAllocationPreview
    const effectiveBeds = Math.floor(availableBeds * (1 - MAINTENANCE_BUFFER));
    const year1Quota    = this.computeQuotaBands(effectiveBeds).year1;
    const REJECT_TARGET = 7; // fixed — Group D students that always lose
    const finalCount    = Math.max(count, year1Quota + REJECT_TARGET);

    const docs = generateYear1Students(finalCount, enrollmentYear, workspaceId, Date.now() % 100000);
    const inserted = await SimulationStudent.insertMany(docs, { ordered: false });

    logger.info('Seeded Year-1 students', { workspaceId, count: inserted.length, enrollmentYear, year1Quota, rejectTarget: REJECT_TARGET });
    return inserted.length;
  }

  // ── Cohort distribution summary ───────────────────────────────────────────

  static async getCohortDistribution(workspaceId) {
    const groups = await SimulationStudent.aggregate([
      { $match: { workspaceId } },
      { $group: { _id: '$yearGroup', count: { $sum: 1 } } }
    ]);

    const dist = { year1: 0, year2: 0, year3: 0, year4_plus: 0, year5plus: 0 };
    groups.forEach(g => {
      if (g._id && dist.hasOwnProperty(g._id)) dist[g._id] = g.count;
    });
    return dist;
  }

  // ── Allocation Preview ────────────────────────────────────────────────────

  /**
   * Run the full allocation preview simulation.
   * Does NOT write to real production data.
   * Stores results in sim_runs collection.
   *
   * @param {string} workspaceId
   * @param {object} weights      - admin-configured weights
   * @param {string} simAcademicYear - e.g. "2025-2026"
   * @returns {SimulationRun}
   */
  static async runAllocationPreview(workspaceId, weights = {}, simAcademicYear) {
    const allStudents = await SimulationStudent.find({ workspaceId }).lean();
    if (!allStudents.length) throw new Error('Workspace không có sinh viên.');

    const dorms = await SimulationDormitory.find({ workspaceId }).lean();
    if (!dorms.length) throw new Error('Workspace không có ký túc xá.');

    // ── Build mutable room slots ─────────────────────────────────────────────
    const dormSlots = dorms.map(d => ({
      dormId: d._id, dormName: d.name, gender: d.gender || 'mixed',
      floors: d.floors.map(f => ({
        floorNumber: f.floorNumber,
        rooms: f.rooms.map(r => ({
          roomNumber: r.roomNumber, roomType: r.roomType,
          maxCapacity: r.maxCapacity,
          available: Math.max(0, (r.maxCapacity || 0) - (r.currentOccupancy || 0))
        }))
      }))
    }));

    // ── Compute available beds after cohort shift freed mustLeave rooms ───────
    let totalBeds = 0, totalOccupiedBefore = 0;
    dormSlots.forEach(d => d.floors.forEach(f => f.rooms.forEach(r => {
      totalBeds += r.maxCapacity;
      totalOccupiedBefore += r.maxCapacity - r.available;
    })));
    const availableBedsInitial = totalBeds - totalOccupiedBefore;
    const totalRooms = dormSlots.reduce((s, d) => s + d.floors.reduce((sf, f) => sf + f.rooms.length, 0), 0);

    // ── MustLeave stats (for report: explain pre/post cohort shift occupancy) ─
    const mustLeaveStudents = allStudents.filter(s => s.mustLeave);
    const mustLeaveWithRoom  = mustLeaveStudents.filter(s => s.dormitoryId).length;
    const occupancyBeforeCohortShift = totalBeds > 0
      ? Math.round(((totalOccupiedBefore + mustLeaveWithRoom) / totalBeds) * 1000) / 10 : 0;

    // ── Quota bands — apply 3% maintenance buffer so fill rate ≤ 97% ─────────
    const MAINTENANCE_BUFFER = 0.03;
    const effectiveBeds = Math.floor(availableBedsInitial * (1 - MAINTENANCE_BUFFER));
    const quota = this.computeQuotaBands(effectiveBeds, weights._quotaConfig || null);

    // ── Score only students WITHOUT a current room (Fix 1: exclude existing residents) ──
    const ELIGIBLE = ['year1','year2','year3','year4_plus'];
    const byGroup = {};
    ELIGIBLE.forEach(yg => {
      byGroup[yg] = allStudents
        .filter(s => s.yearGroup === yg && !s.mustLeave && !s.dormitoryId)
        .map(s => ({ ...s, computedScore: this.computePriorityScore(s, weights) }))
        .sort((a, b) => b.computedScore - a.computedScore);
    });

    // ── Helper: place one student in a gender-compatible room ────────────────
    function placeInRoom(student) {
      for (const dorm of dormSlots) {
        const dg = dorm.gender;
        if (dg !== 'mixed' && dg !== student.gender && student.gender !== 'other') continue;
        for (const floor of dorm.floors) {
          for (const room of floor.rooms) {
            if (room.available > 0) {
              room.available--;
              return { dorm, floor, room };
            }
          }
        }
      }
      return null;
    }

    const allocated  = [];
    const waitlisted = [];

    // ── Process each cohort against its quota ────────────────────────────────
    for (const yg of ELIGIBLE) {
      const candidates = byGroup[yg] || [];
      const cap        = quota[yg];
      let   seated     = 0;

      for (const student of candidates) {
        const slot = seated < cap ? placeInRoom(student) : null;

        if (slot) {
          seated++;
          allocated.push({
            simStudentId:  student._id,
            studentId:     student.studentId,
            name:          student.name,
            yearGroup:     student.yearGroup,
            yearInSchool:  student.yearInSchool,
            gender:        student.gender,
            faculty:       student.faculty,
            province:      student.province,
            priorityScore: student.computedScore,
            dormName:      slot.dorm.dormName,
            dormGender:    slot.dorm.gender,
            floor:         slot.floor.floorNumber,
            roomNumber:    slot.room.roomNumber,
            roomType:      slot.room.roomType,
            isNewYear1:    student.isNewYear1 || false
          });
        } else {
          const reason = seated >= cap
            ? `Vượt quota ${yg === 'year1' ? 'Năm 1' : yg === 'year2' ? 'Năm 2' : yg === 'year3' ? 'Năm 3' : 'Năm 4+'} (${cap} suất)`
            : 'Không còn giường trống';
          waitlisted.push({
            simStudentId:  student._id,
            studentId:     student.studentId,
            name:          student.name,
            yearGroup:     student.yearGroup,
            yearInSchool:  student.yearInSchool,
            gender:        student.gender,
            faculty:       student.faculty,
            province:      student.province,
            priorityScore: student.computedScore,
            reason,
            isNewYear1:    student.isNewYear1 || false
          });
        }
      }
    }

    // ── Per-year-group stats ─────────────────────────────────────────────────
    const yearGroups = ['year1','year2','year3','year4_plus','year5plus'];
    const byYearGroup = {};
    yearGroups.forEach(yg => {
      const total  = (byGroup[yg] || allStudents.filter(s => s.yearGroup === yg)).length;
      const allocN = allocated.filter(s => s.yearGroup === yg).length;
      const waitN  = waitlisted.filter(s => s.yearGroup === yg).length;
      byYearGroup[yg] = { total, allocated: allocN, waitlisted: waitN,
        rate: total > 0 ? Math.round((allocN / total) * 100) : 0,
        quota: quota[yg] || 0 };
    });

    // ── Capacity summary ─────────────────────────────────────────────────────
    const occupancyRateBefore = totalBeds > 0 ? Math.round((totalOccupiedBefore / totalBeds) * 1000) / 10 : 0;
    const occupiedAfter = totalOccupiedBefore + allocated.length;
    const occupancyRateAfter = totalBeds > 0 ? Math.round((occupiedAfter / totalBeds) * 1000) / 10 : 0;
    const fillRate = availableBedsInitial > 0 ? Math.round((allocated.length / availableBedsInitial) * 1000) / 10 : 100;

    // 7. Heatmap data (recompute from updated dormSlots)
    const heatmap = dormSlots.map(d => {
      let dormTotalBeds = 0, dormOccupied = 0;
      const floors = d.floors.map(f => ({
        floorNumber: f.floorNumber,
        rooms: f.rooms.map(r => {
          const occNow = (r.maxCapacity - r.available);
          dormTotalBeds += r.maxCapacity;
          dormOccupied  += occNow;
          const rate = r.maxCapacity > 0 ? Math.round((occNow / r.maxCapacity) * 100) : 0;
          return {
            roomNumber:    r.roomNumber,
            maxCapacity:   r.maxCapacity,
            occupied:      occNow,
            available:     r.available,
            occupancyRate: rate,
            status: rate === 0 ? 'empty' : rate < 60 ? 'partial' : rate < 100 ? 'high' : 'full'
          };
        })
      }));
      const dormRate = dormTotalBeds > 0 ? Math.round((dormOccupied / dormTotalBeds) * 100) : 0;
      return {
        dormId:        d.dormId,
        dormName:      d.dormName,
        gender:        d.gender,
        totalBeds:     dormTotalBeds,
        occupiedBeds:  dormOccupied,
        availableBeds: dormTotalBeds - dormOccupied,
        occupancyRate: dormRate,
        floors
      };
    });

    // 8. Cohort distribution snapshot
    const cohortDistribution = await this.getCohortDistribution(workspaceId);

    // 9. Store run
    const runId = `SIM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const run = await SimulationRun.create({
      workspaceId,
      runId,
      runAt: new Date(),
      simYear: simAcademicYear,
      policySnapshot: weights,
      cohortDistribution,
      summary: {
        totalStudentsInQueue: allocated.length + waitlisted.length,
        quotaBands: quota,
        totalRooms,
        totalBeds,
        availableBedsInitial,
        effectiveBeds,
        maintenanceBuffer: MAINTENANCE_BUFFER,
        mustLeaveCount: mustLeaveStudents.length,
        mustLeaveWithRoom,
        occupancyBeforeCohortShift,
        allocated:             allocated.length,
        waitlisted:            waitlisted.length,
        occupancyRateBefore,
        occupancyRateAfter,
        fillRate
      },
      byYearGroup,
      allocatedStudents:  allocated,
      waitlistedStudents: waitlisted,
      heatmap
    });

    logger.info('Simulation run completed', {
      workspaceId,
      runId,
      allocated: allocated.length,
      waitlisted: waitlisted.length
    });

    return run;
  }

  // ── Quota band computation ────────────────────────────────────────────────

  /**
   * Compute integer bed quotas per year group from an optional policy quotaConfig.
   * Distributes floor() remainder to highest-priority cohorts in order.
   *
   * @param {number} availableBeds
   * @param {object|null} quotaConfig  - { year1, year2, year3, year4plus, allowOverflow }
   *                                     percentages must sum to 100; defaults: 50/30/15/5
   * @returns {{ year1, year2, year3, year4_plus }}
   */
  static computeQuotaBands(availableBeds, quotaConfig = null) {
    const cfg = quotaConfig || { year1: 50, year2: 30, year3: 15, year4plus: 5 };
    const pcts = [
      { key: 'year1',     pct: cfg.year1     ?? 50 },
      { key: 'year2',     pct: cfg.year2     ?? 30 },
      { key: 'year3',     pct: cfg.year3     ?? 15 },
      { key: 'year4_plus',pct: cfg.year4plus ??  5 }
    ];

    const bands = { year1: 0, year2: 0, year3: 0, year4_plus: 0 };
    let  assigned = 0;
    pcts.forEach(({ key, pct }) => {
      bands[key] = Math.floor(availableBeds * (pct / 100));
      assigned  += bands[key];
    });

    // Distribute remainder to highest-priority cohorts
    let remainder = availableBeds - assigned;
    for (const { key } of pcts) {
      if (remainder <= 0) break;
      bands[key]++;
      remainder--;
    }

    return bands;
  }

  // ── Get latest run ────────────────────────────────────────────────────────

  static async getLatestRun(workspaceId) {
    return SimulationRun.findOne({ workspaceId }).sort({ runAt: -1 }).lean();
  }

  static async getRunById(workspaceId, runId) {
    return SimulationRun.findOne({ workspaceId, runId }).lean();
  }

  static async listRuns(workspaceId) {
    return SimulationRun.find({ workspaceId })
      .sort({ runAt: -1 })
      .select('runId runAt simYear summary.allocated summary.waitlisted summary.fillRate')
      .lean();
  }

  // ── Delete all runs for a workspace ──────────────────────────────────────

  static async deleteRunsForWorkspace(workspaceId) {
    await SimulationRun.deleteMany({ workspaceId });
  }
}

module.exports = SimulationEngineService;
