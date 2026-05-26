const express = require("express");
const path = require("path");
const http = require('http');
const fs = require('fs');
const { StudentCollection } = require('./src/config/config');
const bcrypt = require('bcrypt');
const app = express();
const session = require('express-session');
const { setupStudentSocketServer } = require('./src/realtime/student-socket-server');
const { startDomainEventDispatcher } = require('./src/events/durable-event-publisher');
const { requestLogger } = require('./src/observability/observability');

// ============================================
// LOGGING IMPORTS
// ============================================
require('dotenv').config();
const { logger } = require('./src/config/logger');

// ============================================
// SECURITY IMPORTS
// ============================================
const {
    helmetConfig,
    apiLimiter,
    userApiLimiter,
    xssProtection,
    sanitizeInput,
    secureHeaders,
    errorHandler
} = require('./src/middleware/security');

// Log application start
logger.info('Application starting...', { env: process.env.NODE_ENV });

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
    logger.error('SESSION_SECRET is not set in production — using insecure default. Set SESSION_SECRET in .env immediately.');
} else if (!process.env.SESSION_SECRET) {
    logger.warn('SESSION_SECRET not set, using insecure default. Only acceptable in development.');
}

// Routes
const dormitoryRoutes = require('./src/routes/dormitory-routes');
const registrationRoutes = require('./src/routes/student/registration-routes');
const adminApplicationRoutes = require('./src/routes/admin/admin-application-routes');
const roomStatusRoutes = require('./src/routes/student/room-status-routes');
const dashboardRoutes = require('./src/routes/admin/dashboard-routes');
const adminAcademicRoutes = require('./src/routes/admin/adminAcademicRoutes');
const studentAcademicRoutes = require('./src/routes/student/studentAcademicRoutes');
const violationRoutes = require('./src/routes/admin/violation-routes');
const maintenanceRoutes = require('./src/routes/maintenance-routes');
const twoFactorRoutes = require('./src/routes/twoFactorRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const allocationRoutes = require('./src/routes/allocation-routes');
const allocationDashboardRoutes = require('./src/routes/allocation-dashboard-routes');
const adminAllocationUIRoutes = require('./src/routes/admin/admin-allocation-ui-routes');
const priorityClaimRoutes = require('./src/routes/student/priorityClaimRoutes');
const adminPriorityClaimRoutes = require('./src/routes/admin/adminPriorityClaimRoutes');
const cohortShiftRoutes = require('./src/routes/admin/cohort-shift-routes');
const adminQuotaRoutes = require('./src/routes/admin/admin-quota-routes');
const simulationPredictionRoutes = require('./src/routes/simulation-prediction-routes');
const enhancedApplicationRoutes = require('./src/routes/enhanced-application-routes');
const roomViewerRoutes = require('./src/routes/room-viewer-routes');
const mobileStudentRoutes = require('./src/routes/student/mobile-student-routes');
const adminOpsRoutes = require('./src/routes/admin/admin-ops-routes');
const adminAcademicWindowRoutes = require('./src/routes/admin/admin-academic-window-routes');
const adminPageRoutes = require('./src/routes/admin/admin-page-routes');
const authRoutes = require('./src/routes/auth-routes');
const publicRoutes = require('./src/routes/public-routes');
const webNotificationRoutes = require('./src/routes/web-notification-routes');
const { isAuthenticated, isAdmin } = require('./src/middleware/auth');

// Session configuration
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 1 ngày
        sameSite: 'strict'
    },
    name: 'dormitory_session'
});

app.use(sessionMiddleware);

// ============================================
// SECURITY MIDDLEWARE (Apply early)
// ============================================
app.use(helmetConfig);                    // Security headers
app.use(secureHeaders);                   // Custom security headers
app.use(xssProtection);                   // XSS protection
app.use(sanitizeInput);                   // NoSQL injection protection
app.use(apiLimiter);                      // General rate limiting
app.use('/api', userApiLimiter);          // User/IP aware API throttling

// ============================================
// ENCODING MIDDLEWARE
// ============================================
// Keep UTF-8 without overriding content type of static assets
app.use((req, res, next) => {
    res.charset = 'utf-8';
    next();
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(requestLogger);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'src/uploads')));


app.use(dashboardRoutes);
app.use(dormitoryRoutes);
app.use('/api', adminAcademicRoutes);
app.use('/api', studentAcademicRoutes);
app.use('/api', violationRoutes);         // Add violation routes
app.use('/api', maintenanceRoutes);       // Add maintenance routes
app.use('/api/2fa', twoFactorRoutes);     // Add 2FA routes
app.use('/api/notifications', notificationRoutes);  // Add notification routes
app.use('/api/allocation', allocationRoutes);  // Add allocation routes
app.use('/api/allocation', allocationDashboardRoutes);  // Add allocation dashboard routes
app.use('/admin/allocation', adminAllocationUIRoutes);  // Add allocation UI routes
app.use('/api/priority-claims', priorityClaimRoutes);  // Student priority claims
app.use('/admin/api/claims', adminPriorityClaimRoutes);  // Admin priority claims review
app.use(cohortShiftRoutes);  // Cohort Shift Timeline (/admin/cohort-shift + /api/cohort-shift)
app.use(adminQuotaRoutes);  // Admin quota planning routes
app.use('/api/allocation/simulation', simulationPredictionRoutes);  // Simulation & prediction endpoints
app.use('/api/allocation', enhancedApplicationRoutes);  // Enhanced application with ranking criteria
app.use(roomViewerRoutes);  // 360-degree room viewer (/api/rooms + /rooms)
app.use('/api/student-app', mobileStudentRoutes);  // Student mobile/web app API facade
app.use(adminOpsRoutes);
app.use(adminAcademicWindowRoutes);
app.use(adminPageRoutes);
app.use(authRoutes);
app.use(publicRoutes);
app.use(webNotificationRoutes);

// Emergency 2FA reset endpoint (admin only)
app.post('/api/admin/emergency-reset-2fa', async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const TwoFactor = require('./src/schemas/TwoFactorSchema');
        
        // Reset all 2FA
        const result = await TwoFactor.updateMany(
            {},
            { 
                $set: { 
                    totpEnabled: false,
                    smsOtpEnabled: false,
                    emailOtpEnabled: false
                }
            }
        );
        
        logSecurityEvent(req.session.userId, 'EMERGENCY_2FA_RESET', {
            ip: req.ip,
            affectedCount: result.modifiedCount
        });
        
        res.json({ 
            success: true, 
            message: `Đã reset 2FA cho ${result.modifiedCount} tài khoản`
        });
    } catch (error) {
        logger.error('Emergency 2FA reset failed', { error: error.message });
        res.status(500).json({ error: 'Failed to reset 2FA' });
    }
});

// Migration endpoint - Fix violations with 'investigating' status (admin only)
app.post('/api/admin/migrate-violations', async (req, res) => {
    try {
        if (!req.session.userId || req.session.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const { ViolationModel } = require('./src/schemas/ViolationSchema');
        
        // Update all violations with 'investigating' status to 'pending'
        const result = await ViolationModel.updateMany(
            { status: 'investigating' },
            { $set: { status: 'pending' } }
        );
        
        logSecurityEvent(req.session.userId, 'VIOLATIONS_MIGRATION', {
            ip: req.ip,
            affectedCount: result.modifiedCount,
            action: 'investigating_to_pending'
        });
        
        res.json({ 
            success: true, 
            message: `Đã migrate ${result.modifiedCount} vi phạm từ "Đang điều tra" → "Chờ xử lý"`,
            migratedCount: result.modifiedCount
        });
    } catch (error) {
        logger.error('Violations migration failed', { error: error.message });
        res.status(500).json({ error: 'Failed to migrate violations' });
    }
});

app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));
app.engine('ejs', require('ejs').__express);

// API routes
app.use('/api', registrationRoutes);
app.use('/api', dormitoryRoutes);
app.use('/api/admin', adminApplicationRoutes);
app.use('/api/admin', roomStatusRoutes);

// User info middleware
app.use((req, res, next) => {
    res.locals.user = {
        name: req.session.name || null,
        role: req.session.role || null,
        id: req.session.userId || null
    };
    next();
});

// isAuthenticated and isAdmin are imported from src/middleware/auth.js

// ============================================
// PUBLIC ROUTES
// ============================================

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get("/", (req, res) => {
    if (req.session && req.session.userId) {
        if (req.session.role === 'admin') {
            res.redirect('/admin/dormitories');
        } else {
            res.render("student/home", {
                user: { 
                    name: req.session.name, 
                    role: req.session.role,
                    id: req.session.userId
                }
            });
        }
    } else {
        res.render("public/startuphome");
    }
});

// Public routes, auth routes, admin page routes, and notification routes
// are handled by their respective route files (see app.use mounts above)

// ============================================
// CREATE DEFAULT ADMIN
// ============================================

async function createDefaultAdmin() {
    try {
        const adminExists = await StudentCollection.findOne({ role: 'admin' });
        if (!adminExists) {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash('admin123', saltRounds);
            
            await StudentCollection.create({
                name: 'Administrator',
                username: 'admin',
                password: hashedPassword,
                phone: '0987654321',
                email: 'admin@hust.edu.vn',
                role: 'admin'
            });
            
            logger.info('Default admin account created');
        }
    } catch (error) {
        logger.error('Error creating admin account', { error: error.message });
    }
}

// Academic window pages and CRUD → handled by adminAcademicWindowRoutes
// Admin page renders, student pages, violations → handled by adminPageRoutes

createDefaultAdmin();

// ============================================
// AUTO MIGRATION: Fix old investigating violations
// ============================================

async function autoMigrateViolations() {
    try {
        const { ViolationModel } = require('./src/schemas/ViolationSchema');
        const count = await ViolationModel.countDocuments({ status: 'investigating' });
        
        if (count > 0) {
            const result = await ViolationModel.updateMany(
                { status: 'investigating' },
                { $set: { status: 'pending' } }
            );
            logger.info(`Auto-migrated ${result.modifiedCount} violations from 'investigating' to 'pending'`);
        }
    } catch (error) {
        logger.error('Auto migration failed:', { error: error.message });
    }
}

// Run migration on startup
autoMigrateViolations();


// ============================================
// ERROR HANDLING & 404
// ============================================

// 404 Handler
app.use((req, res) => {
    const isApiRequest = req.path.startsWith('/api/') || req.path.startsWith('/admin/api/');
    const isAssetRequest = /\.[a-z0-9]+$/i.test(req.path);

    if (isApiRequest) {
        return res.status(404).json({ 
            error: "Not Found",
            message: "The requested resource does not exist",
            path: req.path
        });
    }

    if (isAssetRequest) {
        return res.status(404).type('text/plain').send('Not Found');
    }
    
    // For regular page requests
    res.status(404).render("404", { 
        error: `Trang "${req.path}" không tìm thấy`
    });
});

// Global Error Handler (must be last)
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================

const MAX_PORT_RETRIES = 20;
const basePort = Number(process.env.PORT) || 5000;
let currentPort = basePort;
let server;

function startServer(portToUse, retries = 0) {
    const httpServer = http.createServer(app);
    startDomainEventDispatcher();
    server = httpServer.listen(portToUse, '0.0.0.0', () => {
        currentPort = portToUse;
        logger.info(`Server started successfully on port ${portToUse}`, {
            env: process.env.NODE_ENV,
            nodeVersion: process.version,
        });

        const io = setupStudentSocketServer(httpServer, sessionMiddleware);
        app.set('io', io);
        logger.info(`Server listening on 0.0.0.0:${portToUse}`);
    });

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE' && retries < MAX_PORT_RETRIES) {
            const nextPort = portToUse + 1;
            logger.warn(`Port ${portToUse} is busy, retrying on ${nextPort}...`);
            setTimeout(() => startServer(nextPort, retries + 1), 250);
            return;
        }

        logger.error(error.message, {
            stack: error.stack,
            port: portToUse,
            retries,
        });
        process.exit(1);
    });
}

startServer(basePort);

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled promise rejection', {
            reason: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined
        });
});

process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception', {
            error: error.message,
            stack: error.stack
        });
    if (server) {
            server.close(() => process.exit(1));
            return;
    }
    process.exit(1);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

