// src/config/logger.js
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if not exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// ============================================
// WINSTON LOGGER CONFIGURATION
// ============================================

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'dormitory-graduation' },
    transports: [
        // Error logs
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        
        // Combined logs
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 10,
        }),
        
        // Security audit logs
        new winston.transports.File({
            filename: path.join(logsDir, 'security.log'),
            level: 'info',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.json()
            )
        }),
    ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
                return `${timestamp} ${level}: ${message} ${metaStr}`;
            })
        ),
    }));
}

// ============================================
// SPECIALIZED LOGGERS
// ============================================

// Security audit logger
const auditLogger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(logsDir, 'audit.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 20,
        }),
    ],
});

// Activity logger (for user actions)
const activityLogger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(logsDir, 'activity.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 20,
        }),
    ],
});

// ============================================
// LOG HELPER FUNCTIONS
// ============================================

// Security event logging
function logSecurityEvent(userId, action, details, severity = 'info') {
    auditLogger.log({
        level: severity,
        userId,
        action,
        details,
        timestamp: new Date().toISOString(),
        ip: details.ip || 'unknown',
    });
}

// Activity logging
function logActivity(userId, action, resource, resourceId, changes) {
    activityLogger.info({
        userId,
        action,
        resource,
        resourceId,
        changes,
        timestamp: new Date().toISOString(),
    });
}

// Error logging with context
function logError(error, context = {}) {
    logger.error({
        message: error.message,
        stack: error.stack,
        ...context,
        timestamp: new Date().toISOString(),
    });
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    logger,
    auditLogger,
    activityLogger,
    logSecurityEvent,
    logActivity,
    logError,
};
