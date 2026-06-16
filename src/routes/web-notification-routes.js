const express = require('express');
const router = express.Router();
const { NotificationCollection } = require('../config/config');
const { logger } = require('../config/logger');
const { isAdmin } = require('../middleware/auth');

const requireSession = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

// Enum hợp lệ theo NotificationSchema (config.js)
const VALID_TYPES = ['success', 'warning', 'info', 'error'];
const VALID_CATEGORIES = ['allocation', 'registration', 'maintenance', 'violation', 'payment', 'system', 'announcement'];
const VALID_PRIORITIES = ['low', 'normal', 'high'];
const VALID_ROLES = ['all', 'user', 'admin'];

// Category → màn hình deep-link trong app mobile
function getCategoryDeepLink(category) {
    const links = {
        allocation: '/allocation',
        registration: '/allocation',
        maintenance: '/maintenance',
        violation: '/violations',
        payment: '/profile',
    };
    return links[category] || '/';
}

/**
 * Đẩy notification realtime tới các socket sinh viên.
 * - Global / targetRole 'all' → io.emit('notification:push') tới mọi client.
 * - Có targetUsers → 'new_notification' tới từng room student:<id>.
 * Mobile (useSocketEvents.ts) sẽ gọi scheduleLocalPush() khi nhận event này.
 */
function pushNotificationToSockets(io, notification) {
    if (!io) {
        logger.warn('Socket io not available — notification not pushed realtime');
        return;
    }
    const payload = {
        id: String(notification._id),
        title: notification.title,
        message: notification.message,
        type: notification.type,
        category: notification.category || 'announcement',
        priority: notification.priority || 'normal',
        deepLink: getCategoryDeepLink(notification.category),
    };

    const targets = Array.isArray(notification.targetUsers) ? notification.targetUsers : [];
    if (notification.isGlobal || notification.targetRole === 'all' || targets.length === 0) {
        io.emit('notification:push', payload);
    } else {
        targets.forEach((uid) => {
            io.to(`student:${String(uid)}`).emit('new_notification', payload);
        });
    }
}

router.get('/api/notifications', requireSession, async (req, res) => {
    try {
        const userId = req.session.userId;
        const userRole = req.session.role || 'user';
        const now = new Date();

        const notifications = await NotificationCollection.find({
            $and: [
                {
                    $or: [
                        { isGlobal: true },
                        { targetUsers: userId },
                        { targetRole: userRole },
                        { targetRole: 'all' }
                    ]
                },
                {
                    $or: [
                        { expiresAt: { $exists: false } },
                        { expiresAt: null },
                        { expiresAt: { $gt: now } }
                    ]
                },
                { deletedBy: { $ne: userId } }
            ]
        })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

        const notificationsWithReadStatus = notifications.map(notification => ({
            ...notification,
            isRead: notification.readBy.some(read => read.userId.toString() === userId.toString())
        }));

        res.json({
            success: true,
            notifications: notificationsWithReadStatus,
            unreadCount: notificationsWithReadStatus.filter(n => !n.isRead).length
        });
    } catch (error) {
        logger.error('Error fetching notifications', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/api/notifications/:id/read', requireSession, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const userId = req.session.userId;

        const notification = await NotificationCollection.findById(notificationId);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        const alreadyRead = notification.readBy.some(read =>
            read.userId.toString() === userId.toString()
        );

        if (!alreadyRead) {
            await NotificationCollection.findByIdAndUpdate(notificationId, {
                $push: { readBy: { userId, readAt: new Date() } }
            });
        }

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        logger.error('Error marking notification as read', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/api/notifications/mark-all-read', requireSession, async (req, res) => {
    try {
        const userId = req.session.userId;
        const userRole = req.session.role || 'user';

        const result = await NotificationCollection.updateMany(
            {
                $or: [
                    { isGlobal: true },
                    { targetUsers: userId },
                    { targetRole: userRole },
                    { targetRole: 'all' }
                ],
                'readBy.userId': { $ne: userId }
            },
            {
                $push: { readBy: { userId, readAt: new Date() } }
            }
        );

        res.json({
            success: true,
            message: `Đã đánh dấu ${result.modifiedCount} thông báo là đã đọc`
        });
    } catch (error) {
        logger.error('Error marking all notifications as read', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/api/admin/notifications', isAdmin, async (req, res) => {
    try {
        const { title, message, type, targetRole, isGlobal, priority, category, targetUsers, expiresAt } = req.body;
        if (!title || !message) {
            return res.status(400).json({ error: 'title và message là bắt buộc' });
        }

        const notification = await NotificationCollection.create({
            title,
            message,
            type: VALID_TYPES.includes(type) ? type : 'info',
            targetRole: VALID_ROLES.includes(targetRole) ? targetRole : 'all',
            targetUsers: Array.isArray(targetUsers) ? targetUsers : [],
            isGlobal: isGlobal !== undefined ? !!isGlobal : false,
            priority: VALID_PRIORITIES.includes(priority) ? priority : 'normal',
            category: VALID_CATEGORIES.includes(category) ? category : 'announcement',
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            createdBy: req.session.userId
        });

        // Đẩy realtime tới mobile/socket sinh viên
        pushNotificationToSockets(req.app.get('io'), notification);

        res.json({ success: true, notification });
    } catch (error) {
        logger.error('Error creating notification', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/admin/send-announcement', isAdmin, async (req, res) => {
    try {
        const { title, message, type, targetRole, priority, category } = req.body;
        if (!title || !message) {
            return res.status(400).json({ error: 'title và message là bắt buộc' });
        }

        const notification = await NotificationCollection.create({
            title,
            message,
            type: VALID_TYPES.includes(type) ? type : 'info',
            isGlobal: true,
            targetRole: VALID_ROLES.includes(targetRole) ? targetRole : 'all',
            priority: VALID_PRIORITIES.includes(priority) ? priority : 'normal',
            category: VALID_CATEGORIES.includes(category) ? category : 'announcement',
            createdBy: req.session.userId
        });

        // Đẩy realtime tới mobile/socket sinh viên
        pushNotificationToSockets(req.app.get('io'), notification);

        res.json({
            success: true,
            message: 'Đã gửi thông báo thành công!',
            notificationId: notification._id
        });
    } catch (error) {
        logger.error('Error sending announcement', { error: error.message });
        res.status(500).json({ error: 'Không thể gửi thông báo' });
    }
});

// DELETE /api/notifications/:id/delete — soft-delete (hide) a notification for this user
router.delete('/api/notifications/:id/delete', requireSession, async (req, res) => {
    try {
        const userId = req.session.userId;
        const notifId = req.params.id;
        // Mark as deleted by pushing userId to deletedBy array (soft delete)
        await NotificationCollection.findByIdAndUpdate(notifId, {
            $addToSet: { deletedBy: userId }
        });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error deleting notification', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
