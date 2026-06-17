const express = require('express');
const router = express.Router();
const Notification = require('../schemas/NotificationSchema');
const { NotificationCollection } = require('../config/config');
const { getStudentNotifications } = require('../services/studentMobileService');
const notificationService = require('../services/notificationService');
const { logger } = require('../config/logger');

// Middleware: Check if user is authenticated
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

/**
 * GET /notifications - Get user's notifications
 */
router.get('/', requireAuth, async (req, res) => {
    try {
        const { read, limit = 20, type } = req.query;

        // Single source of truth — same query the mobile badge uses. This
        // covers broadcast announcements (targetRole/isGlobal) AND legacy
        // per-user docs, so the web list matches the unread badge count.
        const items = await getStudentNotifications(req.session.userId, parseInt(limit));

        let notifications = items.map((n) => ({
            _id: n.id,
            title: n.title,
            message: n.message,
            type: n.type,
            category: n.category,
            priority: n.priority,
            createdAt: n.createdAt,
            read: n.isRead,
        }));

        if (read !== undefined) {
            const want = read === 'true';
            notifications = notifications.filter((n) => n.read === want);
        }
        if (type) {
            notifications = notifications.filter((n) => n.type === type);
        }

        const unreadCount = notifications.filter((n) => !n.read).length;

        res.json({
            notifications: notifications,
            unreadCount: unreadCount,
            pagination: {
                total: notifications.length,
                unreadCount: unreadCount,
                limit: parseInt(limit),
                skip: 0
            }
        });
    } catch (error) {
        logger.error('Get notifications failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

/**
 * GET /notifications/:id - Get single notification
 */
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            userId: req.session.userId
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        // Mark as read
        if (!notification.read) {
            notification.read = true;
            notification.channels.inApp.read = true;
            notification.channels.inApp.readAt = new Date();
            await notification.save();
        }

        res.json(notification);
    } catch (error) {
        logger.error('Get notification failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to fetch notification' });
    }
});

/**
 * POST /notifications/:id/read - Mark notification as read
 */
router.post('/:id/read', requireAuth, async (req, res) => {
    try {
        // Mark read in the broadcast model (readBy[]) — works for both
        // announcement and legacy docs in the shared collection.
        const result = await NotificationCollection.findByIdAndUpdate(
            req.params.id,
            { $addToSet: { readBy: { userId: req.session.userId, readAt: new Date() } } }
        );

        if (!result) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        logger.error('Mark read failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});

/**
 * POST /notifications/read-all and /notifications/mark-all-read
 */
async function markAllReadHandler(req, res) {
    try {
        const userId = req.session.userId;
        const result = await NotificationCollection.updateMany(
            { 'readBy.userId': { $ne: userId } },
            { $push: { readBy: { userId, readAt: new Date() } } }
        );
        res.json({ success: true, message: `${result.modifiedCount} notifications marked as read` });
    } catch (error) {
        logger.error('Mark all read failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
}
router.post('/mark-all-read', requireAuth, markAllReadHandler);
router.post('/read-all', requireAuth, markAllReadHandler);

/**
 * POST /notifications/:id/archive - Archive notification
 */
router.post('/:id/archive', requireAuth, async (req, res) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            userId: req.session.userId
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        notification.archived = true;
        await notification.save();

        res.json({ success: true, message: 'Notification archived' });
    } catch (error) {
        logger.error('Archive notification failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to archive notification' });
    }
});

/**
 * DELETE /notifications/:id - Delete notification
 */
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const result = await Notification.deleteOne({
            _id: req.params.id,
            userId: req.session.userId
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        logger.error('Delete notification failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

/**
 * DELETE /notifications - Delete all notifications
 */
router.delete('/', requireAuth, async (req, res) => {
    try {
        const result = await Notification.deleteMany({
            userId: req.session.userId
        });

        res.json({
            success: true,
            message: `${result.deletedCount} notifications deleted`
        });
    } catch (error) {
        logger.error('Delete all notifications failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to delete notifications' });
    }
});

/**
 * GET /notifications/count/unread - Get unread count
 */
router.get('/count/unread', requireAuth, async (req, res) => {
    try {
        const items = await getStudentNotifications(req.session.userId, 100);
        const unreadCount = items.filter((n) => !n.isRead).length;

        res.json({ unreadCount: unreadCount });
    } catch (error) {
        logger.error('Get unread count failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to get unread count' });
    }
});

/**
 * Admin: POST /notifications/send - Send notification to user(s)
 */
router.post('/admin/send', async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { userId, userIds, type, title, message, description, data, channels = {} } = req.body;

        if (!type || !title || !message) {
            return res.status(400).json({ error: 'Type, title, and message are required' });
        }

        const targetUserIds = userId ? [userId] : (userIds || []);

        if (targetUserIds.length === 0) {
            return res.status(400).json({ error: 'At least one user ID is required' });
        }

        const notifications = [];

        for (const uid of targetUserIds) {
            const notification = new Notification({
                userId: uid,
                type: type,
                title: title,
                message: message,
                description: description,
                data: data,
                channels: {
                    email: { sent: channels.email ? false : undefined },
                    sms: { sent: channels.sms ? false : undefined },
                    inApp: { sent: true, sentAt: new Date() }
                }
            });

            notifications.push(notification);
        }

        await Notification.insertMany(notifications);

        logger.info('Notifications sent', { count: notifications.length, type: type });

        res.json({
            success: true,
            message: `Sent ${notifications.length} notification(s)`,
            notificationIds: notifications.map(n => n._id)
        });
    } catch (error) {
        logger.error('Send notification failed', { error: error.message });
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

/**
 * Admin: POST /notifications/admin/broadcast — send to all students or all users
 */
router.post('/admin/broadcast', async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { type, title, message, priority } = req.body;
        if (!type || !title || !message) {
            return res.status(400).json({ error: 'type, title và message là bắt buộc' });
        }

        const validTypes = ['violation', 'maintenance', 'system', 'alert', '2fa', 'allocation', 'announcement', 'room_assigned', 'application'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: `type phải là một trong: ${validTypes.join(', ')}` });
        }

        // Lấy tất cả sinh viên (role = user/student)
        const { StudentCollection } = require('../config/config');
        const students = await StudentCollection.find({ role: { $ne: 'admin' } }, '_id').lean();
        if (!students.length) {
            return res.json({ success: true, count: 0, message: 'Không có sinh viên nào trong hệ thống.' });
        }

        const now = new Date();
        const docs = students.map(s => ({
            userId: s._id,
            type,
            title,
            message,
            priority: priority || 'normal',
            read: false,
            channels: { inApp: { sent: true, sentAt: now } }
        }));

        const result = await Notification.insertMany(docs, { ordered: false });

        logger.info('Admin broadcast notification sent', {
            adminId: req.session.userId, type, title, count: result.length
        });

        res.json({ success: true, count: result.length, message: `Đã gửi thông báo đến ${result.length} sinh viên.` });
    } catch (error) {
        logger.error('Broadcast notification failed', { error: error.message });
        res.status(500).json({ error: 'Lỗi hệ thống khi gửi thông báo' });
    }
});

module.exports = router;
