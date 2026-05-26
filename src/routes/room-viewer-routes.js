/**
 * ROOM VIEWER ROUTES
 * 360-degree panoramic room viewing with Photo Sphere Viewer
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const RoomViewerService = require('../services/roomViewerService');
const Room = require('../schemas/RoomSchema'); // Assuming Room schema exists
const { logger } = require('../config/logger');

// ============================================
// MULTER CONFIGURATION FOR PANORAMA IMAGES
// ============================================

const panoramasDir = path.join(__dirname, '../uploads/panoramas');
if (!fs.existsSync(panoramasDir)) {
  fs.mkdirSync(panoramasDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, panoramasDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'panorama-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Only allow panorama images (JPEG, PNG)
  const allowedTypes = ['image/jpeg', 'image/png'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB for high-res panoramas
  }
});

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/rooms/:roomId/viewer-config
 * Get 360 viewer configuration for a room
 */
router.get('/api/rooms/:roomId/viewer-config', async (req, res) => {
  try {
    const { roomId } = req.params;

    // Try to fetch from DB first
    let room;
    try {
      room = await Room.findById(roomId);
    } catch (error) {
      logger.warn('Room not found in DB', { roomId });
    }

    // Fallback to sample data
    if (!room) {
      room = RoomViewerService.getSampleRoomData(roomId);
    }

    const viewerConfig = RoomViewerService.generateViewerConfig(room);

    res.json({
      success: true,
      roomId,
      config: viewerConfig,
      room: {
        id: room.id || roomId,
        number: room.roomNumber,
        building: room.building,
        floor: room.floor,
        type: room.type,
        capacity: room.capacity,
        facilities: room.facilities || [],
        imageUrl: room.panoramaUrl || '/default-room-360.jpg'
      }
    });
  } catch (error) {
    logger.error('Viewer config failed', { error: error.message });
    res.status(500).json({ error: 'Failed to load viewer config' });
  }
});

/**
 * GET /api/rooms/:roomId/panoramas
 * List all panorama images for a room
 */
router.get('/api/rooms/:roomId/panoramas', async (req, res) => {
  try {
    const { roomId } = req.params;

    let room;
    try {
      room = await Room.findById(roomId);
    } catch (error) {
      logger.warn('Room not found', { roomId });
    }

    const panoramas = room?.panoramas || [
      {
        id: 'main',
        name: 'Main View',
        url: '/default-room-360.jpg',
        hotspots: []
      },
      {
        id: 'view1',
        name: 'Window View',
        url: '/room-window-360.jpg',
        hotspots: [{ x: 0.5, y: 0.5, title: 'Window', description: 'Overlooks campus' }]
      }
    ];

    res.json({
      success: true,
      roomId,
      totalPanoramas: panoramas.length,
      panoramas: panoramas.map(p => ({
        id: p.id,
        name: p.name,
        url: p.url,
        hotspotsCount: p.hotspots?.length || 0
      }))
    });
  } catch (error) {
    logger.error('Panoramas fetch failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch panoramas' });
  }
});

/**
 * POST /api/rooms/:roomId/upload-panorama
 * Upload new panorama image for a room (admin only)
 */
router.post(
  '/api/rooms/:roomId/upload-panorama',
  upload.single('panorama'),
  async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const { roomId } = req.params;
      const { name, hotspots } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Save panorama reference to DB
      let room = await Room.findById(roomId);
      if (!room) {
        room = new Room({ _id: roomId });
      }

      if (!room.panoramas) {
        room.panoramas = [];
      }

      room.panoramas.push({
        id: Math.random().toString(36).substr(2, 9),
        name: name || `Panorama ${room.panoramas.length + 1}`,
        url: `/uploads/panoramas/${req.file.filename}`,
        uploadedBy: req.user._id,
        uploadedAt: new Date(),
        hotspots: hotspots ? JSON.parse(hotspots) : []
      });

      await room.save();

      logger.info('Panorama uploaded', {
        roomId,
        filename: req.file.filename,
        uploader: req.user._id
      });

      res.json({
        success: true,
        message: 'Panorama uploaded successfully',
        panorama: {
          id: room.panoramas[room.panoramas.length - 1].id,
          name: room.panoramas[room.panoramas.length - 1].name,
          url: room.panoramas[room.panoramas.length - 1].url
        }
      });
    } catch (error) {
      logger.error('Panorama upload failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /rooms/:roomId/view
 * Display full-screen 360 room viewer (HTML page)
 */
router.get('/rooms/:roomId/view', async (req, res) => {
  try {
    const { roomId } = req.params;

    // Get room data
    let room;
    try {
      room = await Room.findById(roomId);
    } catch (error) {
      logger.warn('Room not found', { roomId });
    }

    // Use sample data if not found
    if (!room) {
      room = RoomViewerService.getSampleRoomData(roomId);
    }

    const viewerEmbed = RoomViewerService.getViewerEmbed(room);

    res.render('student/room-360-viewer', {
      roomId,
      room,
      viewerEmbed,
      user: req.user,
      layout: false // Full-screen viewer
    });
  } catch (error) {
    logger.error('Viewer page failed', { error: error.message });
    res.status(500).json({ error: 'Failed to display viewer' });
  }
});

/**
 * GET /api/rooms
 * Get list of all rooms with 360 views available
 */
router.get('/api/rooms', async (req, res) => {
  try {
    const { building, floor, type } = req.query;
    let query = {};

    if (building) query.building = building;
    if (floor) query.floor = parseInt(floor);
    if (type) query.type = type;

    const rooms = await Room.find(query)
      .select('roomNumber building floor type capacity panoramas -_id')
      .lean();

    res.json({
      success: true,
      totalRooms: rooms.length,
      rooms: rooms.map(r => ({
        id: r._id?.toString(),
        number: r.roomNumber,
        building: r.building,
        floor: r.floor,
        type: r.type,
        capacity: r.capacity,
        panoramasAvailable: (r.panoramas || []).length > 0,
        panoramaCount: (r.panoramas || []).length
      }))
    });
  } catch (error) {
    logger.error('Rooms list failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

/**
 * GET /api/rooms/explore
 * Student exploration endpoint - returns room data without admin details
 */
router.get('/api/rooms/explore', async (req, res) => {
  try {
    if (!req.isAuthenticated() || req.user.role !== 'student') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { building, floor, type } = req.query;
    let query = {};

    if (building) query.building = building;
    if (floor) query.floor = parseInt(floor);
    if (type) query.type = type;

    const rooms = await Room.find(query)
      .select('roomNumber building floor type capacity facilities panoramas')
      .lean();

    res.json({
      success: true,
      message: 'Explore available rooms with 360 views',
      totalRooms: rooms.length,
      rooms: rooms
        .filter(r => (r.panoramas || []).length > 0) // Only show rooms with panoramas
        .map(r => ({
          id: r._id?.toString(),
          number: r.roomNumber,
          building: r.building,
          floor: r.floor,
          type: r.type,
          capacity: r.capacity,
          facilities: r.facilities || [],
          viewerUrl: `/rooms/${r._id}/view`,
          apiUrl: `/api/rooms/${r._id}/viewer-config`
        }))
    });
  } catch (error) {
    logger.error('Explore rooms failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

/**
 * POST /api/rooms/:roomId/add-hotspot
 * Add interactive hotspot to panorama (admin only)
 */
router.post('/api/rooms/:roomId/add-hotspot', async (req, res) => {
  try {
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { roomId } = req.params;
    const { panoramaId, x, y, title, description } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const panorama = room.panoramas?.find(p => p.id === panoramaId);
    if (!panorama) {
      return res.status(404).json({ error: 'Panorama not found' });
    }

    if (!panorama.hotspots) {
      panorama.hotspots = [];
    }

    panorama.hotspots.push({
      id: Math.random().toString(36).substr(2, 9),
      x: parseFloat(x),
      y: parseFloat(y),
      title,
      description,
      addedAt: new Date()
    });

    await room.save();

    res.json({
      success: true,
      message: 'Hotspot added',
      hotspot: panorama.hotspots[panorama.hotspots.length - 1]
    });
  } catch (error) {
    logger.error('Hotspot add failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
