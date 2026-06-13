const mongoose = require('mongoose');

const TransferHistoryEntrySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['submitted', 'approved', 'rejected', 'assigned', 'cancelled', 'completed'],
    required: true
  },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'students' },
  performedByName: String,
  note: String,
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const RoomTransferSchema = new mongoose.Schema({
  // Student who is requesting
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'students',
    required: true,
    index: true
  },
  studentName:    { type: String, required: true },
  studentMSSV:    { type: String },
  studentEmail:   { type: String },

  // Current room
  fromDormitoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'dormitories' },
  fromDormitoryName: String,
  fromRoomNumber:  String,
  fromRoomType:    String,

  // Destination preference (filled by student)
  preferredBuilding: { type: String, trim: true },
  preferredRoomType: {
    type: String,
    enum: ['8-person', '4-person-service', '5-person', '10-person', 'any'],
    default: 'any'
  },
  reason: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  expectedMoveDate: { type: Date },

  // Assigned room (filled by admin upon approval)
  toDormitoryId:   { type: mongoose.Schema.Types.ObjectId, ref: 'dormitories' },
  toDormitoryName: String,
  toRoomNumber:    String,
  toRoomType:      String,

  // Status lifecycle
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },

  adminNote: { type: String, trim: true, maxlength: 500 },

  // Audit trail
  history: [TransferHistoryEntrySchema],

  // Resolution
  resolvedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'students' },
  resolvedByName: String,
  resolvedAt:   Date,

  academicYear: { type: String, index: true },

  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
});

RoomTransferSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Push a history entry
RoomTransferSchema.methods.addHistory = function(action, performedBy, performedByName, note) {
  this.history.push({ action, performedBy, performedByName, note });
};

RoomTransferSchema.index({ studentId: 1, status: 1 });
RoomTransferSchema.index({ academicYear: 1, status: 1 });
RoomTransferSchema.index({ createdAt: -1 });

const RoomTransferModel = mongoose.model('RoomTransfer', RoomTransferSchema);
module.exports = RoomTransferModel;
