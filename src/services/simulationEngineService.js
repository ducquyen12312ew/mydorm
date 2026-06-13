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

  // ── Cohort Shift ──────────────────────────────────────────────────────────

  /**
   * Recalculate yearInSchool / yearGroup for all students in the workspace
   * based on the simulation academic year.
   *
   * Cohort shift rules:
   *   yearInSchool 1  → year1
   *   yearInSchool 2  → year2
   *   yearInSchool 3  → year3
   *   yearInSchool 4+ → year4_plus
   *   yearInSchool 5+ → year5plus (still in system, lowest priority)
   */
  static async applyCohortShift(workspaceId, simAcademicYear) {
    const simYear = parseInt(simAcademicYear.split('-')[0], 10);

    const students = await SimulationStudent.find({ workspaceId, isNewYear1: { $ne: true } }).lean();

    const bulkOps = students.map(s => {
      let enrollmentYear = s.enrollmentYear;

      // Fall back to parsing from academicYear K-code if needed
      if (!enrollmentYear && s.academicYear && /^K\d+$/i.test(s.academicYear)) {
        const n = parseInt(s.academicYear.replace(/[^0-9]/g, ''), 10);
        enrollmentYear = 2020 + (n - 66);
      }

      if (!enrollmentYear) return null;

      const yearInSchool = Math.max(1, simYear - enrollmentYear + 1);
      let yearGroup;
      if      (yearInSchool <= 1) yearGroup = 'year1';
      else if (yearInSchool === 2) yearGroup = 'year2';
      else if (yearInSchool === 3) yearGroup = 'year3';
      else if (yearInSchool === 4) yearGroup = 'year4_plus';
      else                          yearGroup = 'year5plus';

      return {
        updateOne: {
          filter: { _id: s._id },
          update: { $set: { yearInSchool, yearGroup, enrollmentYear } }
        }
      };
    }).filter(Boolean);

    if (bulkOps.length) await SimulationStudent.bulkWrite(bulkOps);

    logger.info('Cohort shift applied', { workspaceId, simAcademicYear, count: bulkOps.length });
    return bulkOps.length;
  }

  // ── Seed Year 1 ───────────────────────────────────────────────────────────

  /**
   * Generate and insert new Year-1 students into the workspace.
   * Removes any previously seeded Year-1 students first.
   */
  static async seedYear1Students(workspaceId, count = 200, enrollmentYear = null) {
    const now = new Date();
    if (!enrollmentYear) enrollmentYear = now.getFullYear();

    // Remove stale seeded Year-1 students from same cohort
    await SimulationStudent.deleteMany({ workspaceId, isNewYear1: true, enrollmentYear });

    const docs = generateYear1Students(count, enrollmentYear, workspaceId, Date.now() % 100000);
    const inserted = await SimulationStudent.insertMany(docs, { ordered: false });

    logger.info('Seeded Year-1 students', { workspaceId, count: inserted.length, enrollmentYear });
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
    // 1. Load all students (who will register = everybody except year5plus if we want to filter)
    const allStudents = await SimulationStudent.find({ workspaceId }).lean();

    if (!allStudents.length) {
      throw new Error('Workspace không có sinh viên. Hãy khởi tạo workspace trước.');
    }

    // 2. Compute priority scores for all
    const scored = allStudents
      .filter(s => s.yearGroup !== 'year5plus')   // year5+ are evicted
      .map(s => ({
        ...s,
        computedScore: this.computePriorityScore(s, weights)
      }))
      .sort((a, b) => {
        if (b.computedScore !== a.computedScore) return b.computedScore - a.computedScore;
        // Tie-break: Year 1 first, then by name
        const yearOrder = { year1: 0, year2: 1, year3: 2, year4_plus: 3 };
        return (yearOrder[a.yearGroup] || 99) - (yearOrder[b.yearGroup] || 99);
      });

    // 3. Load dormitories and compute available capacity per gender
    const dorms = await SimulationDormitory.find({ workspaceId }).lean();

    if (!dorms.length) {
      throw new Error('Workspace không có ký túc xá. Hãy khởi tạo workspace trước.');
    }

    // Build mutable room availability map keyed by dorm._id + floorNumber + roomNumber
    // Structure: dormSlots[dormIdx][floorIdx][roomIdx] = { available, dormName, gender, floor, roomNumber, roomType }
    const dormSlots = dorms.map(d => ({
      dormId:   d._id,
      dormName: d.name,
      gender:   d.gender || 'mixed',
      floors: d.floors.map(f => ({
        floorNumber: f.floorNumber,
        rooms: f.rooms.map(r => ({
          roomNumber: r.roomNumber,
          roomType:   r.roomType,
          maxCapacity: r.maxCapacity,
          available:  Math.max(0, (r.maxCapacity || 0) - (r.currentOccupancy || 0))
        }))
      }))
    }));

    // 4. Allocation loop
    const allocated   = [];
    const waitlisted  = [];

    for (const student of scored) {
      const studentGender = student.gender; // 'male' | 'female' | 'other'

      // Find first room with available bed, matching gender preference
      let placed = false;

      for (const dorm of dormSlots) {
        // Gender check: male→male dorm, female→female dorm, mixed accepts all
        const dormGender = dorm.gender;
        const compatible =
          dormGender === 'mixed'
          || dormGender === studentGender
          || studentGender === 'other';

        if (!compatible) continue;

        for (const floor of dorm.floors) {
          for (const room of floor.rooms) {
            if (room.available > 0) {
              room.available--;

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
                dormName:      dorm.dormName,
                dormGender:    dorm.gender,
                floor:         floor.floorNumber,
                roomNumber:    room.roomNumber,
                roomType:      room.roomType,
                isNewYear1:    student.isNewYear1 || false
              });

              placed = true;
              break;
            }
          }
          if (placed) break;
        }
        if (placed) break;
      }

      if (!placed) {
        let reason = 'Không còn giường trống';
        if (studentGender === 'male' && !dormSlots.some(d => d.gender === 'male' || d.gender === 'mixed')) {
          reason = 'Không có KTX nam phù hợp';
        } else if (studentGender === 'female' && !dormSlots.some(d => d.gender === 'female' || d.gender === 'mixed')) {
          reason = 'Không có KTX nữ phù hợp';
        }

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

    // 5. Build per-year-group stats
    const yearGroups = ['year1', 'year2', 'year3', 'year4_plus', 'year5plus'];
    const byYearGroup = {};
    yearGroups.forEach(yg => {
      const total     = scored.filter(s => s.yearGroup === yg).length;
      const allocN    = allocated.filter(s => s.yearGroup === yg).length;
      const waitN     = waitlisted.filter(s => s.yearGroup === yg).length;
      byYearGroup[yg] = {
        total,
        allocated: allocN,
        waitlisted: waitN,
        rate: total > 0 ? Math.round((allocN / total) * 100) : 0
      };
    });

    // 6. Capacity summary
    let totalBeds = 0, totalOccupiedBefore = 0;
    dorms.forEach(d => {
      d.floors.forEach(f => {
        f.rooms.forEach(r => {
          totalBeds += r.maxCapacity || 0;
          totalOccupiedBefore += r.currentOccupancy || 0;
        });
      });
    });
    const availableBedsInitial = totalBeds - totalOccupiedBefore;
    const totalRooms = dorms.reduce((s, d) => s + d.floors.reduce((sf, f) => sf + f.rooms.length, 0), 0);
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
        totalStudentsInQueue: scored.length,
        totalRooms,
        totalBeds,
        availableBedsInitial,
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
