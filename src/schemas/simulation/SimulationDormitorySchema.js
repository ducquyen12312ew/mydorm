const mongoose = require('mongoose');

const SimOccupantSchema = new mongoose.Schema({
  studentId: String,
  name: String,
  phone: String,
  email: String,
  checkInDate: { type: Date, default: Date.now },
  active: { type: Boolean, default: true }
}, { _id: false });

const SimRoomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true },
  roomType: {
    type: String,
    enum: ['8-person', '4-person-service', '5-person', '10-person']
  },
  maxCapacity: { type: Number, required: true, min: 1 },
  floor: { type: Number },
  currentOccupancy: { type: Number, default: 0 },
  occupants: [SimOccupantSchema],
  sourceRoomId: mongoose.Schema.Types.ObjectId
});

const SimFloorSchema = new mongoose.Schema({
  floorNumber: { type: Number, required: true },
  rooms: [SimRoomSchema]
}, { _id: false });

const SimulationDormitorySchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SimulationWorkspace',
    required: true,
    index: true
  },
  sourceDormitoryId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  name: { type: String, required: true, trim: true },
  address: { type: String, trim: true },
  gender: { type: String, enum: ['male', 'female', 'mixed'] },
  totalCapacity: { type: Number, default: 0 },
  currentOccupancy: { type: Number, default: 0 },
  floors: [SimFloorSchema],
  createdAt: { type: Date, default: Date.now }
}, { collection: 'sim_dormitories' });

SimulationDormitorySchema.index({ workspaceId: 1 });

const SimulationDormitory = mongoose.models.SimulationDormitory
  || mongoose.model('SimulationDormitory', SimulationDormitorySchema);

module.exports = SimulationDormitory;
