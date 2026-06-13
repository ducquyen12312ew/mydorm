const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    
    // Notification details
    type: {
        type: String,
        enum: ['violation', 'maintenance', 'system', 'alert', '2fa', 'allocation', 'announcement', 'room_assigned', 'application'],
        required: true
    },
    
    title: {
        type: String,
        required: true
    },
    
    message: {
        type: String,
        required: true
    },
    
    description: String,
    
    // Delivery channels
    channels: {
        email: {
            sent: Boolean,
            sentAt: Date,
            opened: Boolean,
            openedAt: Date
        },
        sms: {
            sent: Boolean,
            sentAt: Date
        },
        inApp: {
            sent: Boolean,
            sentAt: Date,
            read: Boolean,
            readAt: Date
        }
    },
    
    // Content
    data: mongoose.Schema.Types.Mixed,  // Additional data (violationId, maintenanceId, etc)
    actionUrl: String,                  // Link for in-app notification
    
    // Settings
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'critical'],
        default: 'normal'
    },
    
    // Status
    read: {
        type: Boolean,
        default: false
    },
    archived: {
        type: Boolean,
        default: false
    },
    
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    expiresAt: Date  // Auto-delete after time
});

// Auto-delete old notifications
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', NotificationSchema);
