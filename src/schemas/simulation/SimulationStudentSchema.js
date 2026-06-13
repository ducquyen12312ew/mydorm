const mongoose = require('mongoose');

const SimulationStudentSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SimulationWorkspace',
    required: true,
    index: true
  },
  // null for seeded Year-1 students (no real counterpart)
  sourceStudentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students',
    default: null
  },

  // ── Core identity ──────────────────────────────────────────────
  name:      { type: String, required: true, trim: true },
  username:  { type: String, trim: true },
  studentId: { type: String, trim: true, index: true },
  email:     { type: String, trim: true },
  phone:     { type: String, trim: true },
  dateOfBirth: { type: Date },
  gender:    { type: String, enum: ['male', 'female', 'other'] },

  // ── Academic info ──────────────────────────────────────────────
  faculty:       { type: String, trim: true },
  className:     { type: String, trim: true },
  academicYear:  { type: String },   // K-code e.g. "K70"
  enrollmentYear: { type: Number, index: true },
  role:          { type: String, enum: ['user', 'admin'], default: 'user' },

  // ── Cohort / year group (computed by engine on each run) ───────
  yearInSchool: { type: Number, default: 1 },    // 1, 2, 3, 4, 5+
  yearGroup: {
    type: String,
    enum: ['year1', 'year2', 'year3', 'year4_plus', 'year5plus'],
    default: 'year1',
    index: true
  },
  isNewYear1: { type: Boolean, default: false },  // seeded for this sim

  // ── Geography ──────────────────────────────────────────────────
  province:       { type: String, trim: true },
  distanceToHanoi: { type: Number, default: 0 },  // km

  // ── Priority factors ───────────────────────────────────────────
  familySituation: {
    type: String,
    enum: ['poor', 'average', 'wealthy'],
    default: 'average'
  },
  ethnicity:      { type: String, default: 'Kinh', trim: true },
  priorityPolicies: {
    financialHardship: { type: Boolean, default: false },
    ethnicMinority:    { type: Boolean, default: false },
    disabled:          { type: Boolean, default: false },
    ruralPolicy:       { type: Boolean, default: false },
    scholarship:       { type: Boolean, default: false }
  },
  violationHistory: {
    type: String,
    enum: ['none', 'minor', 'major', 'critical'],
    default: 'none'
  },
  dormHistory: {
    type: String,
    enum: ['never_stayed', 'good_history', 'bad_history'],
    default: 'never_stayed'
  },

  // ── Preferences ────────────────────────────────────────────────
  dormPreference: {
    preferredDormGender: { type: String, enum: ['male', 'female', 'mixed'] },
    preferredRoomType:   { type: String }
  },

  // ── Legacy / compatibility ─────────────────────────────────────
  priorityScore:   { type: Number, default: 0 },
  priorityDetails: { type: Object, default: {} },
  dormitoryId:     { type: mongoose.Schema.Types.ObjectId },
  roomNumber:      { type: String },

  createdAt: { type: Date, default: Date.now }
}, { collection: 'sim_students' });

SimulationStudentSchema.index({ workspaceId: 1, faculty: 1 });
SimulationStudentSchema.index({ workspaceId: 1, enrollmentYear: 1 });

const SimulationStudent = mongoose.models.SimulationStudent
  || mongoose.model('SimulationStudent', SimulationStudentSchema);

module.exports = SimulationStudent;
