const mongoose = require('mongoose');
const { StudentCollection, DormitoryCollection } = require('../config/config');
const AllocationPolicy = require('../schemas/AllocationPolicySchema');
const AllocationCycle = require('../schemas/AllocationCycleSchema');
const AllocationRegistration = require('../schemas/AllocationRegistrationSchema');
const SimulationWorkspace = require('../schemas/simulation/SimulationWorkspaceSchema');
const SimulationStudent = require('../schemas/simulation/SimulationStudentSchema');
const SimulationDormitory = require('../schemas/simulation/SimulationDormitorySchema');
const SimulationPolicy = require('../schemas/simulation/SimulationPolicySchema');
const SimulationCycle = require('../schemas/simulation/SimulationCycleSchema');
const SimulationRegistration = require('../schemas/simulation/SimulationRegistrationSchema');
const SimulationRun          = require('../schemas/simulation/SimulationRunSchema');
const { logger } = require('../config/logger');

class SimulationWorkspaceService {

  static async getActiveWorkspace(adminUserId) {
    return SimulationWorkspace.findOne({
      adminUserId,
      status: 'ACTIVE'
    }).lean();
  }

  static async archiveExistingWorkspaces(adminUserId) {
    const existing = await SimulationWorkspace.find({
      adminUserId,
      status: { $in: ['ACTIVE', 'INITIALIZING'] }
    }).lean();

    if (!existing.length) return;

    const workspaceIds = existing.map(w => w._id);

    await Promise.all([
      SimulationStudent.deleteMany({ workspaceId: { $in: workspaceIds } }),
      SimulationDormitory.deleteMany({ workspaceId: { $in: workspaceIds } }),
      SimulationPolicy.deleteMany({ workspaceId: { $in: workspaceIds } }),
      SimulationCycle.deleteMany({ workspaceId: { $in: workspaceIds } }),
      SimulationRegistration.deleteMany({ workspaceId: { $in: workspaceIds } }),
      SimulationRun.deleteMany({ workspaceId: { $in: workspaceIds } }),
      SimulationWorkspace.updateMany(
        { _id: { $in: workspaceIds } },
        { status: 'ARCHIVED' }
      )
    ]);

    logger.info('Archived old simulation workspaces', {
      adminUserId,
      count: workspaceIds.length
    });
  }

  static async initWorkspace(adminUserId, username) {
    await this.archiveExistingWorkspaces(adminUserId);

    const workspace = await SimulationWorkspace.create({
      adminUserId,
      username,
      status: 'INITIALIZING',
      clonedAt: new Date(),
      lastActivity: new Date()
    });

    try {
      const summary = await this._cloneProductionData(workspace._id);

      workspace.status = 'ACTIVE';
      workspace.snapshotSummary = summary;
      await workspace.save();

      logger.info('Simulation workspace initialized', { adminUserId, workspaceId: workspace._id, summary });
      return workspace;
    } catch (err) {
      await SimulationWorkspace.findByIdAndUpdate(workspace._id, { status: 'ARCHIVED' });
      logger.error('Workspace init failed, archived stub', { error: err.message });
      throw err;
    }
  }

  static async _cloneProductionData(workspaceId) {
    const [students, dorms, policies, cycles] = await Promise.all([
      StudentCollection.find({ role: { $ne: 'admin' } }).lean(),
      DormitoryCollection.find({ isDeleted: { $ne: true } }).lean(),
      AllocationPolicy.find({}).lean(),
      AllocationCycle.find({}).lean()
    ]);

    // Clone students
    const studentDocs = students.map(s => ({
      workspaceId,
      sourceStudentId: s._id,
      name: s.name,
      username: s.username,
      studentId: s.studentId,
      email: s.email,
      phone: s.phone,
      faculty: s.faculty,
      academicYear: s.academicYear,
      gender: s.gender,
      role: s.role,
      priorityScore: s.priorityScore || 0,
      priorityDetails: s.priorityDetails || {},
      enrollmentYear: s.enrollmentYear,
      dormitoryId: s.dormitoryId,
      roomNumber: s.roomNumber
    }));

    // Clone dormitories (with embedded rooms)
    let totalRooms = 0;
    const dormDocs = dorms.map(d => {
      const floors = (d.floors || []).map(f => {
        const rooms = (f.rooms || []).map(r => {
          totalRooms++;
          return {
            roomNumber: r.roomNumber,
            roomType: r.roomType,
            maxCapacity: r.maxCapacity,
            floor: f.floorNumber,
            currentOccupancy: (r.occupants || []).filter(o => o.active).length,
            occupants: (r.occupants || []).map(o => ({
              studentId: o.studentId,
              name: o.name,
              phone: o.phone,
              email: o.email,
              checkInDate: o.checkInDate,
              active: o.active
            })),
            sourceRoomId: r._id
          };
        });
        return { floorNumber: f.floorNumber, rooms };
      });

      const totalCap = floors.reduce((s, f) =>
        s + f.rooms.reduce((rs, r) => rs + (r.maxCapacity || 0), 0), 0
      );
      const currentOcc = floors.reduce((s, f) =>
        s + f.rooms.reduce((rs, r) => rs + r.currentOccupancy, 0), 0
      );

      return {
        workspaceId,
        sourceDormitoryId: d._id,
        name: d.name,
        address: d.address,
        gender: d.gender,
        totalCapacity: totalCap,
        currentOccupancy: currentOcc,
        floors
      };
    });

    // Clone policies
    const policyDocs = policies.map(p => ({
      workspaceId,
      sourcePolicyId: p._id,
      academicYear: p.academicYear,
      active: p.active,
      priorityRules: p.priorityRules,
      rebalanceThresholds: p.rebalanceThresholds,
      autoEvictionRules: p.autoEvictionRules,
      notes: p.notes
    }));

    // Clone cycles
    const cycleDocs = cycles.map(c => ({
      workspaceId,
      sourceCycleId: c._id,
      academicYear: c.academicYear,
      name: c.name,
      allowedAcademicYears: c.allowedAcademicYears,
      registrationStart: c.registrationStart,
      registrationEnd: c.registrationEnd,
      allocationDate: c.allocationDate,
      status: c.status,
      capacitySnapshot: c.capacitySnapshot,
      stats: c.stats,
      notes: c.notes
    }));

    await Promise.all([
      studentDocs.length ? SimulationStudent.insertMany(studentDocs, { ordered: false }) : Promise.resolve(),
      dormDocs.length ? SimulationDormitory.insertMany(dormDocs, { ordered: false }) : Promise.resolve(),
      policyDocs.length ? SimulationPolicy.insertMany(policyDocs, { ordered: false }) : Promise.resolve(),
      cycleDocs.length ? SimulationCycle.insertMany(cycleDocs, { ordered: false }) : Promise.resolve()
    ]);

    // Generate synthetic registrations from active students
    const simStudents = await SimulationStudent.find({ workspaceId }).lean();
    const simCycles = await SimulationCycle.find({ workspaceId, status: { $in: ['PENDING', 'RUNNING'] } }).lean();

    if (simStudents.length && simCycles.length) {
      const cycle = simCycles[0];
      const currentYear = parseInt(cycle.academicYear.split('-')[0], 10);

      const regDocs = simStudents.slice(0, 300).map(s => {
        const enrollmentYear = s.enrollmentYear
          || (s.academicYear && /^K\d+$/i.test(s.academicYear)
            ? 2020 + (parseInt(s.academicYear.replace(/[^0-9]/g, ''), 10) - 66)
            : null)
          || 2024;

        const yearsIn = currentYear - enrollmentYear;
        let yearGroup = 'year1';
        if (yearsIn === 1 || yearsIn === 2) yearGroup = 'year2_3';
        else if (yearsIn >= 3) yearGroup = 'year4_plus';

        return {
          workspaceId,
          simCycleId: cycle._id,
          simStudentId: s._id,
          sourceStudentId: s.sourceStudentId,
          academicYear: cycle.academicYear,
          studentName: s.name,
          studentEmail: s.email,
          studentPhone: s.phone,
          studentFaculty: s.faculty,
          studentEnrollmentYear: enrollmentYear,
          yearGroup,
          status: 'PENDING',
          priority: s.priorityScore || 0
        };
      });

      if (regDocs.length) {
        await SimulationRegistration.insertMany(regDocs, { ordered: false });
      }
    }

    const regCount = await SimulationRegistration.countDocuments({ workspaceId });

    return {
      studentCount: studentDocs.length,
      dormitoryCount: dormDocs.length,
      roomCount: totalRooms,
      policyCount: policyDocs.length,
      cycleCount: cycleDocs.length,
      registrationCount: regCount
    };
  }

  static async getWorkspaceStatus(adminUserId) {
    const workspace = await SimulationWorkspace.findOne({
      adminUserId,
      status: 'ACTIVE'
    }).lean();

    if (!workspace) return { hasWorkspace: false };

    const [studentCount, dormCount, policyCount, cycleCount, regCount] = await Promise.all([
      SimulationStudent.countDocuments({ workspaceId: workspace._id }),
      SimulationDormitory.countDocuments({ workspaceId: workspace._id }),
      SimulationPolicy.countDocuments({ workspaceId: workspace._id }),
      SimulationCycle.countDocuments({ workspaceId: workspace._id }),
      SimulationRegistration.countDocuments({ workspaceId: workspace._id })
    ]);

    return {
      hasWorkspace: true,
      workspace: {
        _id: workspace._id,
        status: workspace.status,
        clonedAt: workspace.clonedAt,
        lastActivity: workspace.lastActivity,
        snapshotSummary: workspace.snapshotSummary
      },
      liveCounts: { studentCount, dormCount, policyCount, cycleCount, regCount }
    };
  }

  static async resetWorkspace(adminUserId, username) {
    await this.archiveExistingWorkspaces(adminUserId);
    return this.initWorkspace(adminUserId, username);
  }

  static async touchActivity(workspaceId) {
    await SimulationWorkspace.findByIdAndUpdate(workspaceId, { lastActivity: new Date() });
  }

  static async getSimStudents(workspaceId, options = {}) {
    const { page = 1, limit = 50, faculty, yearGroup } = options;
    const query = { workspaceId };
    if (faculty) query.faculty = faculty;
    if (yearGroup) {
      const currentYear = new Date().getFullYear();
      if (yearGroup === 'year1') query.enrollmentYear = currentYear;
      else if (yearGroup === 'year2_3') query.enrollmentYear = { $in: [currentYear - 1, currentYear - 2] };
      else if (yearGroup === 'year4_plus') query.enrollmentYear = { $lte: currentYear - 3 };
    }
    const skip = (page - 1) * limit;
    const [students, total] = await Promise.all([
      SimulationStudent.find(query).skip(skip).limit(limit).lean(),
      SimulationStudent.countDocuments(query)
    ]);
    return { students, total, page, limit };
  }

  static async getSimDormitories(workspaceId) {
    return SimulationDormitory.find({ workspaceId }).lean();
  }

  static async getSimPolicies(workspaceId) {
    return SimulationPolicy.find({ workspaceId }).lean();
  }

  static async getSimCycles(workspaceId) {
    return SimulationCycle.find({ workspaceId }).lean();
  }

  static async getSimRegistrations(workspaceId, cycleId) {
    const query = { workspaceId };
    if (cycleId) query.simCycleId = cycleId;
    return SimulationRegistration.find(query).lean();
  }
}

module.exports = SimulationWorkspaceService;
