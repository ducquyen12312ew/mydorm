const express = require('express');

const authRoutes = require('./auth.routes');
const profileRoutes = require('./profile.routes');
const roomRoutes = require('./room.routes');
const notificationRoutes = require('./notification.routes');
const maintenanceRoutes = require('./maintenance.routes');
const allocationRoutes = require('./allocation.routes');
const qrRoutes = require('./qr.routes');

const router = express.Router();

router.use(authRoutes);
router.use(profileRoutes);
router.use(roomRoutes);
router.use(notificationRoutes);
router.use(maintenanceRoutes);
router.use(allocationRoutes);
router.use(qrRoutes);

module.exports = router;
