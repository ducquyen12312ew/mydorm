const mongoose = require('mongoose');

// Lightweight records for allocated / waitlisted students inside a run
const AllocatedStudentSchema = new mongoose.Schema({
  simStudentId: mongoose.Schema.Types.ObjectId,
  studentId:    String,
  name:         String,
  yearGroup:    String,
  yearInSchool: Number,
  gender:       String,
  faculty:      String,
  province:     String,
  priorityScore: Number,
  dormName:     String,
  dormGender:   String,
  floor:        Number,
  roomNumber:   String,
  roomType:     String,
  isNewYear1:   Boolean
}, { _id: false });

const WaitlistedStudentSchema = new mongoose.Schema({
  simStudentId: mongoose.Schema.Types.ObjectId,
  studentId:    String,
  name:         String,
  yearGroup:    String,
  yearInSchool: Number,
  gender:       String,
  faculty:      String,
  province:     String,
  priorityScore: Number,
  reason:       String,
  isNewYear1:   Boolean
}, { _id: false });

const HeatmapRoomSchema = new mongoose.Schema({
  roomNumber:    String,
  maxCapacity:   Number,
  occupied:      Number,
  available:     Number,
  occupancyRate: Number,
  status:        String   // 'empty', 'partial', 'full'
}, { _id: false });

const HeatmapFloorSchema = new mongoose.Schema({
  floorNumber: Number,
  rooms:       [HeatmapRoomSchema]
}, { _id: false });

const HeatmapDormSchema = new mongoose.Schema({
  dormId:       mongoose.Schema.Types.ObjectId,
  dormName:     String,
  gender:       String,
  totalBeds:    Number,
  occupiedBeds: Number,
  availableBeds: Number,
  occupancyRate: Number,
  floors:       [HeatmapFloorSchema]
}, { _id: false });

const YearGroupStatSchema = new mongoose.Schema({
  total:     { type: Number, default: 0 },
  allocated: { type: Number, default: 0 },
  waitlisted: { type: Number, default: 0 },
  rate:       { type: Number, default: 0 },
  quota:      { type: Number, default: 0 }
}, { _id: false });

const SimulationRunSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SimulationWorkspace',
    required: true,
    index: true
  },
  runId:  { type: String, required: true, unique: true, index: true },
  runAt:  { type: Date, default: Date.now, index: true },
  simYear: { type: String },  // "2025-2026"

  policySnapshot: { type: Object, default: {} },

  cohortDistribution: {
    year1:     { type: Number, default: 0 },
    year2:     { type: Number, default: 0 },
    year3:     { type: Number, default: 0 },
    year4_plus: { type: Number, default: 0 },
    year5plus: { type: Number, default: 0 }
  },

  summary: {
    totalStudentsInQueue: { type: Number, default: 0 },
    totalRooms:           { type: Number, default: 0 },
    totalBeds:            { type: Number, default: 0 },
    availableBedsInitial: { type: Number, default: 0 },
    effectiveBeds:        { type: Number, default: 0 },
    maintenanceBuffer:    { type: Number, default: 0 },
    mustLeaveCount:       { type: Number, default: 0 },
    mustLeaveWithRoom:    { type: Number, default: 0 },
    occupancyBeforeCohortShift: { type: Number, default: 0 },
    allocated:            { type: Number, default: 0 },
    waitlisted:           { type: Number, default: 0 },
    occupancyRateBefore:  { type: Number, default: 0 },
    occupancyRateAfter:   { type: Number, default: 0 },
    fillRate:             { type: Number, default: 0 },
    quotaBands: {
      year1:     { type: Number, default: 0 },
      year2:     { type: Number, default: 0 },
      year3:     { type: Number, default: 0 },
      year4_plus: { type: Number, default: 0 }
    }
  },

  byYearGroup: {
    year1:     YearGroupStatSchema,
    year2:     YearGroupStatSchema,
    year3:     YearGroupStatSchema,
    year4_plus: YearGroupStatSchema,
    year5plus: YearGroupStatSchema
  },

  allocatedStudents:  [AllocatedStudentSchema],
  waitlistedStudents: [WaitlistedStudentSchema],
  heatmap:            [HeatmapDormSchema]
}, { collection: 'sim_runs' });

SimulationRunSchema.index({ workspaceId: 1, runAt: -1 });

const SimulationRun = mongoose.models.SimulationRun
  || mongoose.model('SimulationRun', SimulationRunSchema);

module.exports = SimulationRun;
