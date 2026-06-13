'use strict';

const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../../middleware/auth');
const { StudentCollection, DormitoryCollection } = require('../../config/config');
const RoomTransfer = require('../../schemas/RoomTransferSchema');

// Main unified page
router.get('/student/service-requests', isAuthenticated, async (req, res) => {
    try {
        const student = await StudentCollection.findById(req.session.userId).lean();
        if (!student) return res.redirect('/login');

        const activeRequest = await RoomTransfer.findOne({
            studentId: req.session.userId,
            status: { $in: ['pending', 'approved'] }
        }).lean();

        const transferHistory = await RoomTransfer.find({
            studentId: req.session.userId,
            status: { $in: ['completed', 'rejected', 'cancelled'] }
        }).sort({ createdAt: -1 }).limit(5).lean();

        const dormitories = await DormitoryCollection.find({}).select('name').lean();

        let currentRoom = null;
        if (student.dormitoryId && student.roomNumber) {
            const dorm = await DormitoryCollection.findById(student.dormitoryId).lean();
            if (dorm) {
                outer: for (const floor of (dorm.floors || [])) {
                    for (const room of (floor.rooms || [])) {
                        if (room.roomNumber === student.roomNumber) {
                            currentRoom = {
                                dormName: dorm.name,
                                floor: floor.floorNumber,
                                roomNumber: room.roomNumber,
                                roomType: room.roomType,
                                occupancy: (room.occupants || []).length,
                                maxCapacity: room.maxCapacity
                            };
                            break outer;
                        }
                    }
                }
            }
        }

        res.render('student/service-requests', {
            user: student,
            student,
            activeRequest,
            transferHistory,
            dormitories,
            currentRoom,
            tab: req.query.tab || 'maintenance'
        });
    } catch (err) {
        console.error('[ServiceRequests] page error:', err);
        res.status(500).send('Lỗi máy chủ');
    }
});

module.exports = router;
