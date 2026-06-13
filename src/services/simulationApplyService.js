const mongoose = require('mongoose');
const { DormitoryCollection, StudentCollection } = require('../config/config');
const AllocationCycle    = require('../schemas/AllocationCycleSchema');
const RoomAllocation     = require('../schemas/RoomAllocationSchema');
const SimulationRun      = require('../schemas/simulation/SimulationRunSchema');
const SimulationStudent  = require('../schemas/simulation/SimulationStudentSchema');
const SimulationDormitory = require('../schemas/simulation/SimulationDormitorySchema');
const SimulationApply    = require('../schemas/simulation/SimulationApplySchema');
const { logger } = require('../config/logger');

// Map simulation year-group labels → RoomAllocation enum values
function mapYearGroup(simYg) {
  if (simYg === 'year1')     return 'year1';
  if (simYg === 'year2')     return 'year2_3';
  if (simYg === 'year3')     return 'year2_3';
  return 'year4_plus';
}

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

  // ── Snapshot of real state BEFORE apply ─────────────────────────────────────

  static async captureBeforeState(simYear) {
    const totalAllocs = await RoomAllocation.countDocuments({ academicYear: simYear, status: 'ACTIVE' });
    const dorms = await DormitoryCollection.find({}, { name: 1, 'floors.floorNumber': 1, 'floors.rooms.roomNumber': 1, 'floors.rooms.occupants': 1 }).lean();

    const dormOccupancy = {};
    dorms.forEach(d => {
      let occ = 0, cap = 0;
      (d.floors || []).forEach(f => {
        (f.rooms || []).forEach(r => {
          occ += (r.occupants || []).filter(o => o.active).length;
          cap += r.maxCapacity || 0;
        });
      });
      dormOccupancy[d.name] = { occupied: occ, capacity: cap };
    });

    return { totalAllocations: totalAllocs, dormOccupancy };
  }

  // ── Apply simulation results to real allocation DB ──────────────────────────

  static async applyToRealAllocation(workspaceId, runId, adminUserId) {
    const run = await SimulationRun.findOne({ workspaceId, runId });
    if (!run) throw new Error('Simulation run không tồn tại');

    // Check not already applied
    const existing = await SimulationApply.findOne({ workspaceId, runId, status: 'APPLIED' });
    if (existing) throw new Error('Run này đã được apply. Undo trước rồi apply lại.');

    // Capture state before apply
    const beforeState = await this.captureBeforeState(run.simYear);

    // Create or find a simulation AllocationCycle
    const simYear = run.simYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    const now = new Date();

    let cycle = await AllocationCycle.findOne({
      academicYear: simYear,
      name: 'Manual Allocation',
      status: { $in: ['PENDING', 'RUNNING'] }
    });

    if (!cycle) {
      cycle = await AllocationCycle.create({
        academicYear: simYear,
        name: 'Manual Allocation',
        registrationStart: now,
        registrationEnd:   new Date(now.getTime() + 86400000),
        status: 'RUNNING',
        createdBy: adminUserId,
        notes: `Auto-created by simulation apply (run: ${runId})`
      });
    }

    // Process allocated students
    const createdAllocationIds = [];
    const modifiedRooms        = [];
    let   skippedYear1         = 0;
    let   realStudents         = 0;

    for (const alloc of run.allocatedStudents) {
      // Seeded Year-1 students have no real DB counterpart — skip
      if (alloc.isNewYear1) { skippedYear1++; continue; }

      // Find real student via simStudent.sourceStudentId
      const simStudent = await SimulationStudent.findById(alloc.simStudentId).lean();
      if (!simStudent || !simStudent.sourceStudentId) { skippedYear1++; continue; }

      const realStudentId = simStudent.sourceStudentId;

      // Avoid duplicate active allocation for same student + year
      const dupCheck = await RoomAllocation.findOne({
        studentId: realStudentId,
        academicYear: simYear,
        status: 'ACTIVE'
      });
      if (dupCheck) continue;

      // Find the real dormitory and room
      const dorm = await DormitoryCollection.findOne({ name: alloc.dormName }).lean();
      if (!dorm) continue;

      let targetRoomId  = null;
      let targetRoomNum = alloc.roomNumber;

      for (const floor of dorm.floors || []) {
        if (Number(floor.floorNumber) !== Number(alloc.floor)) continue;
        for (const room of floor.rooms || []) {
          if (room.roomNumber === alloc.roomNumber) {
            targetRoomId = room._id;
            break;
          }
        }
        if (targetRoomId) break;
      }

      if (!targetRoomId) continue;

      // Create RoomAllocation
      const yearGroup = mapYearGroup(alloc.yearGroup);
      const raDoc = await RoomAllocation.create({
        academicYear:      simYear,
        allocationCycleId: cycle._id,
        studentId:         realStudentId,
        roomId:            targetRoomId,
        studentYearGroup:  yearGroup,
        studentFaculty:    alloc.faculty,
        studentEnrollmentYear: simStudent.enrollmentYear,
        dormitoryId:       dorm._id,
        roomNumber:        targetRoomNum,
        buildingCode:      dorm.name,
        roomCapacity:      run.allocatedStudents.find(a => String(a.simStudentId) === String(alloc.simStudentId))?.maxCapacity,
        allocationType:    'MANUAL_OVERRIDE',
        allocationReason:  `Applied from simulation run ${runId}`,
        allocationBy:      adminUserId,
        status:            'ACTIVE',
        allocationTimestamp: now
      });

      createdAllocationIds.push(raDoc._id);

      // Add occupant to real dormitory room
      await DormitoryCollection.updateOne(
        { _id: dorm._id },
        {
          $push: {
            'floors.$[fl].rooms.$[rm].occupants': {
              studentId:   String(realStudentId),
              name:        alloc.name,
              checkInDate: now,
              active:      true
            }
          }
        },
        {
          arrayFilters: [
            { 'fl.floorNumber': Number(alloc.floor) },
            { 'rm._id': targetRoomId }
          ]
        }
      );

      modifiedRooms.push({
        dormitoryId:    dorm._id,
        dormitoryName:  dorm.name,
        floorNumber:    Number(alloc.floor),
        roomId:         targetRoomId,
        roomNumber:     targetRoomNum,
        studentMongoId: String(realStudentId),
        studentName:    alloc.name
      });

      realStudents++;
    }

    // Mark cycle completed if we applied anything
    if (createdAllocationIds.length > 0) {
      await AllocationCycle.findByIdAndUpdate(cycle._id, {
        status: 'COMPLETED',
        executedBy: adminUserId,
        executedAt: now,
        'stats.totalAllocated': createdAllocationIds.length
      });
    }

    // Save snapshot record
    const snapshotId = `SNAP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const snapshot = await SimulationApply.create({
      workspaceId,
      runId,
      snapshotId,
      status:             'APPLIED',
      simYear,
      academicYear:       simYear,
      createdCycleId:     cycle._id,
      createdAllocationIds,
      modifiedRooms,
      stats:              { studentsApplied: createdAllocationIds.length, realStudents, skippedYear1 },
      appliedBy:          adminUserId,
      beforeState
    });

    logger.info('Simulation applied to real allocation', {
      workspaceId, runId, snapshotId,
      applied: createdAllocationIds.length,
      skipped: skippedYear1
    });

    return snapshot;
  }

  // ── Undo: restore real DB to pre-apply state ─────────────────────────────────

  static async undoAllocation(workspaceId, snapshotId) {
    const snapshot = await SimulationApply.findOne({ workspaceId, snapshotId });
    if (!snapshot) throw new Error('Snapshot không tồn tại');
    if (snapshot.status === 'UNDONE') throw new Error('Snapshot này đã được undo rồi');

    // 1. Revoke all RoomAllocation records
    if (snapshot.createdAllocationIds.length > 0) {
      await RoomAllocation.updateMany(
        { _id: { $in: snapshot.createdAllocationIds } },
        {
          $set: {
            status:            'REVOKED',
            revokedAt:         new Date(),
            revocationReason:  `Undone via simulation snapshot ${snapshotId}`
          }
        }
      );
    }

    // 2. Remove added occupants from real dormitory rooms
    for (const mod of snapshot.modifiedRooms) {
      await DormitoryCollection.updateOne(
        { _id: mod.dormitoryId },
        {
          $pull: {
            'floors.$[fl].rooms.$[rm].occupants': { studentId: mod.studentMongoId }
          }
        },
        {
          arrayFilters: [
            { 'fl.floorNumber': mod.floorNumber },
            { 'rm._id': mod.roomId }
          ]
        }
      );
    }

    // 3. Cancel the created AllocationCycle if it was ours
    if (snapshot.createdCycleId) {
      await AllocationCycle.findByIdAndUpdate(snapshot.createdCycleId, { status: 'CANCELLED' });
    }

    // 4. Mark snapshot as undone
    snapshot.status  = 'UNDONE';
    snapshot.undoneAt = new Date();
    await snapshot.save();

    logger.info('Simulation undo complete', { workspaceId, snapshotId });
    return snapshot;
  }

  // ── Get latest snapshot for a workspace ──────────────────────────────────────

  static async getLatestSnapshot(workspaceId) {
    return SimulationApply.findOne({ workspaceId }).sort({ appliedAt: -1 }).lean();
  }

  // ── Generate markdown report ─────────────────────────────────────────────────

  static async generateReport(workspaceId, runId) {
    const run      = await SimulationRun.findOne({ workspaceId, runId }).lean();
    if (!run) throw new Error('Run không tồn tại');

    const snapshot = await SimulationApply.findOne({ workspaceId, runId }).lean();

    const now  = new Date().toLocaleString('vi-VN');
    const s    = run.summary;
    const byYG = run.byYearGroup || {};

    const ygLabel = {
      year1: 'Năm 1', year2: 'Năm 2', year3: 'Năm 3',
      year4_plus: 'Năm 4+', year5plus: 'Năm 5+ (Ra KTX)'
    };

    // Heatmap section (top dormitories)
    const heatmapLines = (run.heatmap || []).map(d => {
      const floorLines = (d.floors || []).map(f => {
        const roomLines = (f.rooms || []).map(r =>
          `    - Phòng ${r.roomNumber}: ${r.occupied}/${r.maxCapacity} (${r.occupancyRate}%) [${r.status}]`
        ).join('\n');
        return `  - **Tầng ${f.floorNumber}**\n${roomLines}`;
      }).join('\n');
      return `### ${d.dormName} (${d.gender === 'male' ? 'Nam' : d.gender === 'female' ? 'Nữ' : 'Hỗn hợp'})\n- Giường: ${d.occupiedBeds}/${d.totalBeds} (${d.occupancyRate}%)\n${floorLines}`;
    }).join('\n\n');

    // Rejected list
    const rejectedLines = (run.waitlistedStudents || []).slice(0, 50).map((s, i) =>
      `| ${i+1} | ${s.studentId || '—'} | ${s.name} | ${ygLabel[s.yearGroup] || s.yearGroup} | ${s.priorityScore} | ${s.reason} |`
    ).join('\n');

    // Rollback section
    let rollbackSection = '_Chưa apply vào dữ liệu thật._';
    if (snapshot) {
      const before = snapshot.beforeState || {};
      rollbackSection = `
| Thời điểm     | Tổng allocation | Ghi chú                          |
|---------------|-----------------|----------------------------------|
| Before Apply  | ${before.totalAllocations ?? '—'} | Trước khi apply simulation |
| After Apply   | ${(before.totalAllocations ?? 0) + snapshot.stats.studentsApplied} | +${snapshot.stats.studentsApplied} sinh viên thực |
| After Undo    | ${snapshot.status === 'UNDONE' ? (before.totalAllocations ?? 0) : '_(chưa undo)_'} | ${snapshot.status === 'UNDONE' ? 'Đã restore về trạng thái ban đầu' : 'Chưa undo'} |

**Snapshot ID:** \`${snapshot.snapshotId}\`
**Trạng thái:** ${snapshot.status}
**Sinh viên thực được apply:** ${snapshot.stats.realStudents}
**Sinh viên Năm 1 mô phỏng (bỏ qua):** ${snapshot.stats.skippedYear1}
`;
    }

    const md = `# Simulation Test Report — eDorm
> Tạo lúc: ${now}
> Run ID: \`${run.runId}\`
> Năm học mô phỏng: ${run.simYear}

---

## 1. Database Overview

| Chỉ số              | Giá trị         |
|---------------------|-----------------|
| Sinh viên trong Queue | ${s.totalStudentsInQueue.toLocaleString()} |
| Tổng phòng           | ${s.totalRooms} |
| Tổng giường          | ${s.totalBeds.toLocaleString()} |
| Giường trống ban đầu | ${s.availableBedsInitial.toLocaleString()} |
| Occupancy trước Sim  | ${s.occupancyRateBefore}% |

---

## 2. Kết quả Allocation

| Kết quả          | Số lượng        |
|------------------|-----------------|
| **Được nhận**    | **${s.allocated.toLocaleString()}** |
| Danh sách chờ    | ${s.waitlisted.toLocaleString()} |
| Fill Rate        | ${s.fillRate}% |
| Occupancy sau    | ${s.occupancyRateAfter}% |

### Theo Khóa

| Khóa   | Tổng đăng ký | Được nhận | Chờ | Tỷ lệ |
|--------|-------------|-----------|-----|-------|
${Object.entries(byYG).map(([yg, st]) =>
  `| ${ygLabel[yg] || yg} | ${st.total} | ${st.allocated} | ${st.waitlisted} | ${st.rate}% |`
).join('\n')}

---

## 3. Danh sách bị loại (50 đầu)

| # | MSSV | Tên | Khóa | Điểm | Lý do |
|---|------|-----|------|------|-------|
${rejectedLines || '_(Không có sinh viên bị loại)_'}

---

## 4. Occupancy theo Tòa / Tầng / Phòng

${heatmapLines || '_Không có dữ liệu heatmap._'}

---

## 5. Rollback / Undo

${rollbackSection}

---

_Report được tạo tự động bởi eDorm Simulation Engine._
`;

    return md;
  }
}

module.exports = SimulationApplyService;
