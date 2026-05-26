const express = require('express');
const router = express.Router();
const { NotificationCollection } = require('../config/config');
const { createNotification } = require('../utils/notificationHelper');
const { logger } = require('../config/logger');
const { isAdmin } = require('../middleware/auth');

const requireSession = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

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
                }
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
        const { title, message, type, targetRole, isGlobal, priority, expiresAt } = req.body;

        const notification = await createNotification({
            title,
            message,
            type: type || 'info',
            targetRole: targetRole || 'all',
            isGlobal: isGlobal || false,
            priority: priority || 'normal',
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            createdBy: req.session.userId
        });

        if (notification) {
            res.json({ success: true, notification });
        } else {
            res.status(500).json({ error: 'Failed to create notification' });
        }
    } catch (error) {
        logger.error('Error creating notification', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/admin/send-announcement', isAdmin, async (req, res) => {
    try {
        const { title, message, type, targetRole, priority } = req.body;

        const notification = await createNotification({
            title,
            message,
            type: type || 'info',
            isGlobal: true,
            targetRole: targetRole || 'all',
            priority: priority || 'normal',
            createdBy: req.session.userId
        });

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

module.exports = router;
