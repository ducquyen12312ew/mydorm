/**
 * ROOM SCHEMA
 * Core room data with panorama support
 */

const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      example: '101'
    },
    building: {
      type: String,
      enum: ['A', 'B', 'C', 'D'],
      required: true
    },
    floor: {
      type: Number,
      required: true,
      min: 1,
      max: 10
    },
    type: {
      type: String,
      enum: ['Single', 'Double', 'Triple', 'Suite'],
      default: 'Double'
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      max: 4
    },
    facilities: {
      type: [String],
      default: [
        'Air Conditioning',
        'WiFi',
        'Study Desk',
        'Wardrobe',
        'Bed',
        'Shelf'
      ]
    },
    // Panorama images for 360 viewer
    panoramas: [
      {
        id: String,
        name: String,
        url: String,
        uploadedBy: mongoose.Schema.Types.ObjectId,
        uploadedAt: { type: Date, default: Date.now },
        hotspots: [
          {
            id: String,
            x: Number,
            y: Number,
            title: String,
            description: String,
            addedAt: { type: Date, default: Date.now }
          }
        ]
      }
    ],
    // Main panorama image URL
    panoramaUrl: String,

    // Room status
    status: {
      type: String,
      enum: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED'],
      default: 'AVAILABLE'
    },

    // Allocation tracking
    allocatedTo: mongoose.Schema.Types.ObjectId, // Student ID

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Index for faster queries
RoomSchema.index({ building: 1, floor: 1 });
RoomSchema.index({ status: 1 });

const Room = mongoose.model('Room', RoomSchema);

module.exports = Room;
