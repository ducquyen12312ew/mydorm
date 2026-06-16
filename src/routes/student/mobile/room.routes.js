const express = require('express');
const mongoose = require('mongoose');
const { StudentCollection, DormitoryCollection } = require('../../../config/config');
const { requireMobileJwt } = require('../../../middleware/mobileJwtAuth');
const { getRoomExploreData } = require('../../../services/studentMobileService');
const { requireStudentAuth, isValidObjectId } = require('./utils');

const router = express.Router();

// ── Helpers ─────────────────────────────────────────────────

function mapRoomFavorite(room, dormitory) {
  const activeCount = (room.occupants || []).filter(o => o.active).length;
  return {
    id: String(room._id),
    dormitoryId: String(dormitory._id),
    dormName: dormitory.name,
    roomNumber: room.roomNumber,
    roomType: room.roomType,
    floor: room.floor,
    maxCapacity: room.maxCapacity,
    availableBeds: Math.max((room.maxCapacity || 0) - activeCount, 0),
    pricePerMonth: room.pricePerMonth,
    imageUrl: room.imageUrl || '',
  };
}

async function resolveFavoriteRooms(userId) {
  const student = await StudentCollection.findById(userId).select('favoriteRoomIds').lean();
  const favoriteRoomIds = (student?.favoriteRoomIds || []).map(id => String(id));
  if (!favoriteRoomIds.length) return [];

  const objectIds = favoriteRoomIds
    .filter(id => isValidObjectId(id))
    .map(id => new mongoose.Types.ObjectId(id));
  if (!objectIds.length) return [];

  const dormitories = await DormitoryCollection.find({ 'floors.rooms._id': { $in: objectIds } }).lean();
  const roomMap = new Map();
  dormitories.forEach(dorm => {
    (dorm.floors || []).forEach(floor => {
      (floor.rooms || []).forEach(room => {
        const key = String(room._id);
        if (favoriteRoomIds.includes(key)) {
          roomMap.set(key, mapRoomFavorite({ ...room, floor: floor.floorNumber }, dorm));
        }
      });
    });
  });
  return favoriteRoomIds.map(id => roomMap.get(id)).filter(Boolean);
}

async function addFavoriteRoom(userId, roomId) {
  if (!isValidObjectId(roomId)) return { status: 400, payload: { success: false, error: 'Invalid room id' } };
  const exists = await DormitoryCollection.exists({ 'floors.rooms._id': new mongoose.Types.ObjectId(roomId) });
  if (!exists) return { status: 404, payload: { success: false, error: 'Room not found' } };
  await StudentCollection.findByIdAndUpdate(userId, { $addToSet: { favoriteRoomIds: new mongoose.Types.ObjectId(roomId) } });
  return { status: 200, payload: { success: true } };
}

async function removeFavoriteRoom(userId, roomId) {
  if (!isValidObjectId(roomId)) return { status: 400, payload: { success: false, error: 'Invalid room id' } };
  await StudentCollection.findByIdAndUpdate(userId, { $pull: { favoriteRoomIds: new mongoose.Types.ObjectId(roomId) } });
  return { status: 200, payload: { success: true } };
}

// ── Session-auth routes (student web) ───────────────────────

router.get('/rooms/explore', requireStudentAuth, async (req, res) => {
  try {
    const data = await getRoomExploreData(req.query || {});
    return res.json({ success: true, dormitories: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/public/rooms/explore', async (req, res) => {
  try {
    const data = await getRoomExploreData(req.query || {});
    return res.json({ success: true, dormitories: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── JWT-auth routes (mobile) ─────────────────────────────────

router.get('/mobile/rooms/explore', requireMobileJwt, async (req, res) => {
  try {
    const data = await getRoomExploreData(req.query || {});
    return res.json({ success: true, dormitories: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/mobile/favorites', requireMobileJwt, async (req, res) => {
  try {
    const favorites = await resolveFavoriteRooms(req.mobileAuth.userId);
    return res.json({ success: true, favorites });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mobile/favorites', requireMobileJwt, async (req, res) => {
  try {
    const result = await addFavoriteRoom(req.mobileAuth.userId, req.body?.roomId);
    return res.status(result.status).json(result.payload);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/mobile/favorites/:roomId', requireMobileJwt, async (req, res) => {
  try {
    const result = await removeFavoriteRoom(req.mobileAuth.userId, req.params.roomId);
    return res.status(result.status).json(result.payload);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
