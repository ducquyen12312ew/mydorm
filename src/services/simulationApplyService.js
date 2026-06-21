const mongoose = require('mongoose');
const SimulationRun      = require('../schemas/simulation/SimulationRunSchema');
const SimulationStudent  = require('../schemas/simulation/SimulationStudentSchema');
const SimulationDormitory = require('../schemas/simulation/SimulationDormitorySchema');
const SimulationApply    = require('../schemas/simulation/SimulationApplySchema');
const SimulationResult   = require('../schemas/simulation/SimulationResultSchema');
const { logger } = require('../config/logger');

class SimulationApplyService {

  // ── Edit: move a student to a different room in the simulation run ──────────

  static async moveRoom(workspaceId, runId, simStudentId, newRoom) {
    const { dormName, floor, roomNumber, roomType } = newRoom;

    const run = await SimulationRun.findOne({ workspaceId, runId });
    if (!run) throw new Error('Simulation run không tồn tại');

    const idx = run.allocatedStudents.findIndex(
      s => String(s.simStudentId) === String(simStudentId)
    );
    if (idx === -1) throw new Error('Sinh viên không có trong danh sách được nhận');

    run.allocatedStudents[idx].dormName   = dormName;
    run.allocatedStudents[idx].floor      = floor;
    run.allocatedStudents[idx].roomNumber = roomNumber;
    if (roomType) run.allocatedStudents[idx].roomType = roomType;

    run.markModified('allocatedStudents');
    await run.save();
    return this._recalcStats(run);
  }

  // ── Edit: remove an allocated student (move to waitlist) ───────────────────

  static async removeStudent(workspaceId, runId, simStudentId, reason = 'Điều chỉnh thủ công') {
    const run = await SimulationRun.findOne({ workspaceId, runId });
    if (!run) throw new Error('Simulation run không tồn tại');

    const idx = run.allocatedStudents.findIndex(
      s => String(s.simStudentId) === String(simStudentId)
    );
    if (idx === -1) throw new Error('Sinh viên không có trong danh sách được nhận');

    const [student] = run.allocatedStudents.splice(idx, 1);
    run.waitlistedStudents.push({
      simStudentId:  student.simStudentId,
      studentId:     student.studentId,
      name:          student.name,
      yearGroup:     student.yearGroup,
      yearInSchool:  student.yearInSchool,
      gender:        student.gender,
      faculty:       student.faculty,
      province:      student.province,
      priorityScore: student.priorityScore,
      reason,
      isNewYear1:    student.isNewYear1
    });

    run.markModified('allocatedStudents');
    run.markModified('waitlistedStudents');
    await run.save();
    return this._recalcStats(run);
  }

  // ── Edit: promote a waitlisted student to allocated with manual room ────────

  static async promoteStudent(workspaceId, runId, simStudentId, roomAssignment) {
    const { dormName, floor, roomNumber, roomType } = roomAssignment;

    const run = await SimulationRun.findOne({ workspaceId, runId });
    if (!run) throw new Error('Simulation run không tồn tại');

    const idx = run.waitlistedStudents.findIndex(
      s => String(s.simStudentId) === String(simStudentId)
    );
    if (idx === -1) throw new Error('Sinh viên không có trong danh sách chờ');

    const [student] = run.waitlistedStudents.splice(idx, 1);
    run.allocatedStudents.push({
      simStudentId:  student.simStudentId,
      studentId:     student.studentId,
      name:          student.name,
      yearGroup:     student.yearGroup,
      yearInSchool:  student.yearInSchool,
      gender:        student.gender,
      faculty:       student.faculty,
      province:      student.province,
      priorityScore: student.priorityScore + 10,  // bonus for manual promote
      dormName,
      floor,
      roomNumber,
      roomType:  roomType || '',
      isNewYear1: student.isNewYear1 || false
    });

    run.markModified('allocatedStudents');
    run.markModified('waitlistedStudents');
    await run.save();
    return this._recalcStats(run);
  }

  // ── Recalculate stats after manual edits ────────────────────────────────────

  static async _recalcStats(run) {
    const groups = ['year1', 'year2', 'year3', 'year4_plus', 'year5plus'];
    const byYearGroup = {};

    groups.forEach(yg => {
      const total     = (run.allocatedStudents.filter(s => s.yearGroup === yg).length)
                      + (run.waitlistedStudents.filter(s => s.yearGroup === yg).length);
      const allocN    = run.allocatedStudents.filter(s => s.yearGroup === yg).length;
      const waitN     = run.waitlistedStudents.filter(s => s.yearGroup === yg).length;
      byYearGroup[yg] = { total, allocated: allocN, waitlisted: waitN, rate: total > 0 ? Math.round((allocN/total)*100) : 0 };
    });

    run.byYearGroup             = byYearGroup;
    run.summary.allocated        = run.allocatedStudents.length;
    run.summary.waitlisted       = run.waitlistedStudents.length;
    const avail = run.summary.availableBedsInitial || 1;
    run.summary.fillRate = Math.round((run.allocatedStudents.length / avail) * 100 * 10) / 10;

    run.markModified('byYearGroup');
    run.markModified('summary');
    return run.save();
  }

  // ── Get available rooms from sim dormitories ────────────────────────────────

  static async getSimRoomList(workspaceId) {
    const dorms = await SimulationDormitory.find({ workspaceId }).lean();
    const rooms = [];
    dorms.forEach(d => {
      (d.floors || []).forEach(f => {
        (f.rooms || []).forEach(r => {
          rooms.push({
            dormName: d.name,
            dormGender: d.gender,
            floor: f.floorNumber,
            roomNumber: r.roomNumber,
            roomType: r.roomType,
            maxCapacity: r.maxCapacity,
            available: r.available
          });
        });
      });
    });
    return rooms;
  }

  // ── Apply simulation results — saves to sim-only collections, no real DB writes

  static async applyToRealAllocation(workspaceId, runId, adminUserId) {
    const run = await SimulationRun.findOne({ workspaceId, runId });
    if (!run) throw new Error('Simulation run không tồn tại');

    // Prevent double-apply
    const existing = await SimulationApply.findOne({ workspaceId, runId, status: 'APPLIED' });
    if (existing) throw new Error('Run này đã được áp dụng. Hoàn tác trước rồi thử lại.');

    const simYear  = run.simYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    const now      = new Date();
    const snapshotId = `SNAP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // Build allocation list — skip synthetic Year-1 students (no real ID)
    const allocations = [];
    const waitlist    = [];
    let skippedYear1  = 0;

    for (const alloc of run.allocatedStudents) {
      if (alloc.isNewYear1) { skippedYear1++; continue; }

      const simStudent = await SimulationStudent.findById(alloc.simStudentId).lean();
      const realStudentId = simStudent?.sourceStudentId || null;

      allocations.push({
        simStudentId:  alloc.simStudentId,
        studentId:     realStudentId,
        studentCode:   alloc.studentId || '',
        studentName:   alloc.name,
        yearGroup:     alloc.yearGroup,
        gender:        alloc.gender,
        faculty:       alloc.faculty,
        priorityScore: alloc.priorityScore,
        dormName:      alloc.dormName,
        floor:         alloc.floor,
        roomNumber:    alloc.roomNumber,
        roomType:      alloc.roomType || '',
        isNewYear1:    false
      });
    }

    for (const st of run.waitlistedStudents || []) {
      waitlist.push({
        simStudentId:  st.simStudentId,
        studentCode:   st.studentId || '',
        studentName:   st.name,
        yearGroup:     st.yearGroup,
        priorityScore: st.priorityScore,
        reason:        st.reason
      });
    }

    const s = run.summary || {};

    // Save to simulation-only result collection
    await SimulationResult.create({
      workspaceId,
      runId,
      snapshotId,
      status:      'APPLIED',
      simYear,
      academicYear: simYear,
      appliedAt:   now,
      appliedBy:   adminUserId,
      allocations,
      waitlist,
      stats: {
        total:          allocations.length + skippedYear1,
        allocated:      allocations.length,
        waitlisted:     waitlist.length,
        skippedYear1,
        fillRate:       s.fillRate,
        occupancyAfter: s.occupancyRateAfter,
        byYear:         run.byYearGroup || {}
      }
    });

    // Save lightweight apply-record (no real IDs needed since we wrote nothing real)
    const snapshot = await SimulationApply.create({
      workspaceId,
      runId,
      snapshotId,
      status:              'APPLIED',
      simYear,
      academicYear:        simYear,
      createdAllocationIds: [],
      modifiedRooms:        [],
      stats: {
        studentsApplied: allocations.length,
        realStudents:    allocations.length,
        skippedYear1
      },
      appliedBy:   adminUserId,
      beforeState: { totalAllocations: 0, dormOccupancy: {} }
    });

    logger.info('Simulation apply saved (workspace-only, no real DB writes)', {
      workspaceId, runId, snapshotId, allocated: allocations.length, skippedYear1
    });

    return snapshot;
  }

  // ── Undo: marks simulation result as undone — nothing real to reverse ─────────

  static async undoAllocation(workspaceId, snapshotId) {
    const snapshot = await SimulationApply.findOne({ workspaceId, snapshotId });
    if (!snapshot) throw new Error('Snapshot không tồn tại');
    if (snapshot.status === 'UNDONE') throw new Error('Snapshot này đã được hoàn tác rồi');

    // Also mark the SimulationResult as undone
    await SimulationResult.updateOne({ snapshotId }, { $set: { status: 'UNDONE', undoneAt: new Date() } });

    snapshot.status   = 'UNDONE';
    snapshot.undoneAt = new Date();
    await snapshot.save();

    logger.info('Simulation apply undone (workspace-only)', { workspaceId, snapshotId });
    return snapshot;
  }

  // ── Get latest snapshot for a workspace ──────────────────────────────────────

  static async getLatestSnapshot(workspaceId) {
    return SimulationApply.findOne({ workspaceId }).sort({ appliedAt: -1 }).lean();
  }

  // ── Generate xlsx report ─────────────────────────────────────────────────────

  static async generateReport(workspaceId, runId) {
    const XLSX = require('xlsx');

    const run      = await SimulationRun.findOne({ workspaceId, runId }).lean();
    if (!run) throw new Error('Run không tồn tại');

    const snapshot = await SimulationApply.findOne({ workspaceId, runId }).lean();
    const s    = run.summary;
    const byYG = run.byYearGroup || {};
    const now  = new Date().toLocaleString('vi-VN');

    const ygLabel = {
      year1: 'Năm 1', year2: 'Năm 2', year3: 'Năm 3',
      year4_plus: 'Năm 4+', year5plus: 'Năm 5+ (Ra KTX)'
    };

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Tổng quan ────────────────────────────────────────────────────
    const summaryData = [
      ['Báo cáo Mô phỏng Phân bổ Phòng — eDorm'],
      ['Tạo lúc', now],
      ['Run ID', run.runId || '—'],
      ['Năm học mô phỏng', run.simYear || '—'],
      [],
      ['Chỉ số', 'Giá trị'],
      ['Tổng phòng', s.totalRooms],
      ['Tổng giường', s.totalBeds],
      ['Occupancy trước cohort shift', (s.occupancyBeforeCohortShift ?? '—') + '%'],
      ['Năm 5+ rời KTX', s.mustLeaveCount ?? 0],
      ['Giường giải phóng từ Năm 5+', s.mustLeaveWithRoom ?? 0],
      ['Occupancy sau cohort shift', s.occupancyRateBefore + '%'],
      ['Giường trống cho phân bổ', s.availableBedsInitial],
      ['Sinh viên trong Queue', s.totalStudentsInQueue],
      [],
      ['Kết quả Phân bổ', ''],
      ['Được phân phòng', s.allocated],
      ['Danh sách chờ', s.waitlisted],
      ['Fill Rate', s.fillRate + '%'],
      ['Occupancy sau phân bổ', (s.occupancyRateAfter ?? '—') + '%'],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 35 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Tổng quan');

    // ── Sheet 2: Theo khóa ────────────────────────────────────────────────────
    const yearData = [['Khóa', 'Quota', 'Đăng ký', 'Được nhận', 'Fill quota (%)', 'Danh sách chờ', 'Tỷ lệ nhận (%)']];
    Object.entries(byYG).filter(([yg]) => yg !== 'year5plus').forEach(([yg, st]) => {
      const quota = s.quotaBands?.[yg] ?? st.quota ?? '—';
      const fillPct = (quota && quota !== '—' && quota > 0) ? Math.round((st.allocated / quota) * 100) : '—';
      yearData.push([ygLabel[yg] || yg, quota, st.total, st.allocated, fillPct, st.waitlisted, st.rate]);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(yearData);
    ws2['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Theo khóa');

    // ── Sheet 3: Được nhận ────────────────────────────────────────────────────
    const allocData = [['STT', 'MSSV', 'Họ tên', 'Khóa', 'Giới tính', 'Điểm ưu tiên', 'Tòa', 'Tầng', 'Phòng']];
    const genLabel = { male: 'Nam', female: 'Nữ', other: 'Khác' };
    (run.allocatedStudents || []).forEach((st, i) => {
      allocData.push([
        i + 1,
        st.studentId || '—',
        st.name,
        ygLabel[st.yearGroup] || st.yearGroup,
        genLabel[st.gender] || st.gender,
        st.priorityScore ?? 0,
        st.dormName,
        st.floor,
        st.roomNumber
      ]);
    });
    const ws3 = XLSX.utils.aoa_to_sheet(allocData);
    ws3['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Được nhận');

    // ── Sheet 4: Danh sách chờ ────────────────────────────────────────────────
    const waitData = [['STT', 'MSSV', 'Họ tên', 'Khóa', 'Giới tính', 'Điểm ưu tiên', 'Lý do']];
    const sortedWaitlist = (run.waitlistedStudents || [])
      .slice()
      .sort((a, b) => (a.priorityScore ?? 0) - (b.priorityScore ?? 0));
    sortedWaitlist.forEach((st, i) => {
      waitData.push([
        i + 1,
        st.studentId || '—',
        st.name,
        ygLabel[st.yearGroup] || st.yearGroup,
        genLabel[st.gender] || st.gender,
        st.priorityScore ?? 0,
        st.reason
      ]);
    });
    const ws4 = XLSX.utils.aoa_to_sheet(waitData);
    ws4['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Danh sách chờ');

    // ── Sheet 5: Heatmap tòa ──────────────────────────────────────────────────
    const heatData = [['Tòa KTX', 'Giới tính', 'Tầng', 'Phòng', 'Đã ở', 'Sức chứa', 'Occupancy (%)']];
    (run.heatmap || []).forEach(dorm => {
      const genderLabel = dorm.gender === 'male' ? 'Nam' : dorm.gender === 'female' ? 'Nữ' : 'Hỗn hợp';
      (dorm.floors || []).forEach(floor => {
        (floor.rooms || []).forEach(room => {
          heatData.push([
            dorm.dormName,
            genderLabel,
            floor.floorNumber,
            room.roomNumber,
            room.occupied,
            room.maxCapacity,
            room.occupancyRate
          ]);
        });
      });
    });
    const ws5 = XLSX.utils.aoa_to_sheet(heatData);
    ws5['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws5, 'Heatmap phòng');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}

module.exports = SimulationApplyService;
