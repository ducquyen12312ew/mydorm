const express = require("express");
const path = require("path");
const { StudentCollection, DormitoryCollection, PendingApplicationCollection, NotificationCollection, ActivityLogCollection } = require('./src/config/config');
const bcrypt = require('bcrypt');
const app = express();
const session = require('express-session');

// ============================================
// LOGGING IMPORTS
// ============================================
require('dotenv').config();
const { logger, logActivity, logSecurityEvent } = require('./src/config/logger');

// ============================================
// SECURITY IMPORTS
// ============================================
const { 
    helmetConfig, 
    apiLimiter, 
    authLimiter, 
    xssProtection, 
    sanitizeInput,
    secureHeaders, 
    errorHandler,
    adminLimiter,
    uploadLimiter
} = require('./src/middleware/security');

// Log application start
logger.info('Application starting...', { env: process.env.NODE_ENV });

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

// Session configuration
app.use(session({
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
}));

// ============================================
// SECURITY MIDDLEWARE (Apply early)
// ============================================
app.use(helmetConfig);                    // Security headers
app.use(secureHeaders);                   // Custom security headers
app.use(xssProtection);                   // XSS protection
app.use(sanitizeInput);                   // NoSQL injection protection
app.use(apiLimiter);                      // General rate limiting

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
app.use(express.static("public"));
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

// ============================================
// MIDDLEWARE
// ============================================

// Middleware kiểm tra đăng nhập
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.redirect('/login');
};

// Middleware kiểm tra quyền admin
const isAdmin = (req, res, next) => {
    console.log('[isAdmin Middleware] Session:', {
        hasSession: !!req.session,
        role: req.session?.role,
        userId: req.session?.userId,
        path: req.path
    });
    
    if (req.session && req.session.role === 'admin') {
        return next();
    }
    
    console.log('[isAdmin Middleware] Access denied, redirecting to login');
    res.redirect('/login');
};

// ============================================
// PUBLIC ROUTES
// ============================================

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

app.get("/home", isAuthenticated, (req, res) => {
    if (req.session.role === 'admin') {
        return res.redirect('/admin/dormitories');
    }
    res.render("student/home", {
        user: { 
            name: req.session.name, 
            role: req.session.role,
            id: req.session.userId
        }
    });
});

app.get("/map", async (req, res) => {
    if (req.session && req.session.userId && req.session.role !== 'admin') {
        return res.render("student/list", {
            user: {
                name: req.session.name,
                role: req.session.role,
                id: req.session.userId
            }
        });
    }

    try {
        const dormitories = await DormitoryCollection.find({
            $or: [
                { isDeleted: false },
                { isDeleted: { $exists: false } }
            ]
        });
        res.render("public/map", { dormitories: JSON.stringify(dormitories) });
    } catch (error) {
        console.error("Error fetching dormitories for map:", error);
        res.render("public/map", { dormitories: "[]" });
    }
});

// Dormitory detail page
app.get("/dormitory/:id", (req, res) => {
    res.render("public/dormitory-detail", { user: req.session.user });
});

// Room detail page
app.get("/room/:dormId/:roomId", async (req, res) => {
    try {
        res.render("public/room-detail", { user: req.session.user });
    } catch (error) {
        console.error("Error rendering room detail:", error);
        res.status(500).send("Lỗi khi tải trang chi tiết phòng");
    }
});

// API endpoint to get full dormitory data
app.get("/api/dormitories/:id", async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id).lean();
        if (!dormitory) {
            return res.status(404).json({ success: false, error: 'Ký túc xá không tìm thấy' });
        }
        res.json({ success: true, dormitory });
    } catch (error) {
        logger.error('Error fetching dormitory', { error: error.message });
        res.status(500).json({ success: false, error: 'Không thể lấy dữ liệu ký túc xá' });
    }
});

// Student maintenance requests page
app.get("/student/maintenance-requests", isAuthenticated, async (req, res) => {
    try {
        const student = await StudentCollection.findById(req.session.userId).lean();

        res.render("student/maintenance-requests", {
            student,
            user: {
                name: req.session.name,
                role: req.session.role,
                id: req.session.userId
            }
        });
    } catch (error) {
        logger.error('Error loading student maintenance page', { error: error.message });
        res.render("student/maintenance-requests", {
            student: null,
            user: {
                name: req.session.name,
                role: req.session.role,
                id: req.session.userId
            }
        });
    }
});

// API endpoint for dormitories
app.get("/api/dormitories", async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find({
            $or: [
                { isDeleted: false },
                { isDeleted: { $exists: false } }
            ]
        }).lean();
        console.log(`[DEBUG] Found ${dormitories.length} dormitories`);
        res.json({ success: true, dormitories });
    } catch (error) {
        logger.error('Error fetching dormitories', { error: error.message });
        console.error('[ERROR] Fetching dormitories:', error);
        res.status(500).json({ success: false, error: 'Không thể lấy dữ liệu ký túc xá' });
    }
});

// API endpoint for map data
app.get("/api/map-data", async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find({
            $or: [
                { isDeleted: false },
                { isDeleted: { $exists: false } }
            ]
        }).lean();
        res.json({ success: true, dormitories });
    } catch (error) {
        logger.error('Error fetching map data', { error: error.message });
        res.status(500).json({ success: false, error: 'Không thể lấy dữ liệu bản đồ' });
    }
});

// API endpoint for dormitory rooms
app.get("/api/dormitories/:id/rooms", async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id).lean();
        if (!dormitory) {
            return res.status(404).json({ success: false, error: 'Ký túc xá không tìm thấy' });
        }
        
        // Flatten all rooms from all floors
        let allRooms = [];
        if (dormitory.floors && Array.isArray(dormitory.floors)) {
            dormitory.floors.forEach(floor => {
                if (floor.rooms && Array.isArray(floor.rooms)) {
                    allRooms = allRooms.concat(floor.rooms);
                }
            });
        }
        
        console.log(`[DEBUG] Dormitory ${req.params.id} (${dormitory.name}) has ${allRooms.length} rooms total`);
        res.json({ success: true, rooms: allRooms });
    } catch (error) {
        logger.error('Error fetching rooms', { error: error.message });
        console.error('[ERROR] Fetching rooms:', error);
        res.status(500).json({ success: false, error: 'Không thể lấy dữ liệu phòng' });
    }
});

// API endpoint for student profile
app.get("/api/student/profile", isAuthenticated, async (req, res) => {
    try {
        const student = await StudentCollection.findById(req.session.userId).lean();
        if (!student) {
            return res.status(404).json({ success: false, error: 'Sinh viên không tìm thấy' });
        }
        res.json({ 
            success: true, 
            student: {
                studentId: student.studentId,
                name: student.name,
                major: student.major,
                cohort: student.cohort,
                email: student.email,
                phone: student.phone
            }
        });
    } catch (error) {
        logger.error('Error fetching student profile', { error: error.message });
        res.status(500).json({ success: false, error: 'Không thể lấy thông tin sinh viên' });
    }
});

// Dormitory Detail Page
app.get("/dormitory/:id", async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id);
        if (!dormitory) {
            return res.status(404).render("404", { message: "Ký túc xá không tìm thấy" });
        }
        res.render("public/dormitory-detail", { dormitory });
    } catch (error) {
        logger.error('Error fetching dormitory detail', { error: error.message });
        res.status(500).render("404", { message: "Lỗi khi tải thông tin ký túc xá" });
    }
});

// ============================================
// AUTH ROUTES
// ============================================

app.get("/login", (req, res) => {
    res.render("auth/login");
});

app.get("/signup", (req, res) => {
    res.render("auth/signup");
});

app.get("/forgot-password", (req, res) => {
    res.render("auth/forgot-password");
});

app.post("/signup", authLimiter, async (req, res) => {
    try {
        const {
            username,
            password,
            name,
            email,
            phone,
            studentId,
            gender,
            faculty,
            academicYear
        } = req.body;

        const existingUser = await StudentCollection.findOne({ username });
        if (existingUser) {
            return res.render("auth/signup", { 
                error: "Tên đăng nhập đã tồn tại. Vui lòng chọn tên đăng nhập khác." 
            });
        }

        if (email) {
            const existingEmail = await StudentCollection.findOne({ email });
            if (existingEmail) {
                return res.render("auth/signup", { 
                    error: "Email đã được sử dụng. Vui lòng sử dụng email khác." 
                });
            }
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newStudent = await StudentCollection.create({
            username,
            password: hashedPassword,
            name,
            email,
            phone,
            studentId,
            gender,
            faculty,
            academicYear,
            role: 'user'
        });

        req.session.userId = newStudent._id;
        req.session.name = newStudent.name;
        req.session.role = newStudent.role;

        await sendNotificationOnEvent('welcome', newStudent._id, {
            name: newStudent.name
        });

        res.redirect('/');
    } catch (error) {
        console.error("Error during signup:", error);
        res.render("auth/signup", { 
            error: "Đã xảy ra lỗi trong quá trình đăng ký. Vui lòng thử lại."
        });
    }
});

// ============================================
// AUTH ENDPOINTS WITH STRICT RATE LIMITING
// ============================================
app.post("/login", authLimiter, async (req, res) => {
    try {
        const { username, password, remember } = req.body;

        const student = await StudentCollection.findOne({ username });
        if (!student) {
            logSecurityEvent(null, 'LOGIN_FAILED', { username, reason: 'user_not_found', ip: req.ip });
            return res.render("auth/login", { 
                error: "Tên đăng nhập hoặc mật khẩu không đúng" 
            });
        }

        const isPasswordValid = await bcrypt.compare(password, student.password);
        if (!isPasswordValid) {
            logSecurityEvent(student._id, 'LOGIN_FAILED', { reason: 'invalid_password', ip: req.ip });
            return res.render("auth/login", { 
                error: "Tên đăng nhập hoặc mật khẩu không đúng" 
            });
        }

        // ✅ Check if 2FA is enabled
        const TwoFactor = require('./src/schemas/TwoFactorSchema');
        const twoFactorRecord = await TwoFactor.findOne({ userId: student._id });
        const twoFAEnabled = twoFactorRecord && (twoFactorRecord.totpEnabled || twoFactorRecord.smsOtpEnabled);

        // If 2FA enabled, show 2FA verification page
        if (twoFAEnabled) {
            req.session.tempUserId = student._id;
            req.session.tempName = student.name;
            req.session.tempRole = student.role;
            req.session.tempStudentId = student.studentId;
            req.session.tempRemember = remember;
            
            logSecurityEvent(student._id, 'LOGIN_2FA_REQUIRED', { ip: req.ip });
            return res.render('auth/2fa-login', {
                twoFAMethods: {
                    totp: twoFactorRecord.totpEnabled,
                    sms: twoFactorRecord.smsOtpEnabled
                }
            });
        }

        // If no 2FA, proceed with normal login
        req.session.userId = student._id;
        req.session.name = student.name;
        req.session.role = student.role;
        req.session.studentId = student.studentId;
        
        if (remember) {
            req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 ngày
        }

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.render("auth/login", { 
                    error: "Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại."
                });
            }

            logSecurityEvent(student._id, 'LOGIN_SUCCESS', { ip: req.ip });

            if (student.role === "admin") {
                return res.redirect("/admin/dormitories");
            } else {
                return res.redirect("/");
            }
        });

    } catch (error) {
        console.error("Error during login:", error);
        res.render("auth/login", { 
            error: "Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại."
        });
    }
});

// ✅ NEW: 2FA Verification endpoint (after login)
app.post("/api/auth/verify-2fa", async (req, res) => {
    try {
        const { code, useBackupCode } = req.body;
        
        if (!req.session.tempUserId) {
            logSecurityEvent(null, '2FA_INVALID_SESSION', { ip: req.ip });
            return res.status(401).json({ error: 'Session không hợp lệ' });
        }

        const TwoFactor = require('./src/schemas/TwoFactorSchema');
        const TwoFactorService = require('./src/services/twoFactorService');
        
        const twoFactorRecord = await TwoFactor.findOne({ userId: req.session.tempUserId });
        if (!twoFactorRecord) {
            return res.status(400).json({ error: '2FA chưa được cấu hình' });
        }

        let verified = false;

        if (useBackupCode) {
            // Verify backup code
            verified = TwoFactorService.verifyBackupCode(twoFactorRecord.backupCodes, code);
            if (verified) {
                TwoFactorService.markBackupCodeAsUsed(twoFactorRecord.backupCodes, code);
                await twoFactorRecord.save();
                logSecurityEvent(req.session.tempUserId, '2FA_BACKUP_CODE_USED', { ip: req.ip });
            }
        } else {
            // Verify TOTP or OTP
            if (twoFactorRecord.totpEnabled) {
                verified = TwoFactorService.verifyTOTPToken(twoFactorRecord.totpSecret, code);
            } else if (twoFactorRecord.smsOtpEnabled) {
                verified = TwoFactorService.verifyOTPValidity(twoFactorRecord, code);
            }
        }

        if (!verified) {
            const attempts = TwoFactorService.checkOTPAttempts(twoFactorRecord);
            const attemptsRemaining = Math.max(0, process.env.OTP_MAX_ATTEMPTS - twoFactorRecord.otpAttempts);
            
            if (twoFactorRecord.otpAttemptsLocked) {
                logSecurityEvent(req.session.tempUserId, '2FA_LOCKED', { ip: req.ip });
                return res.status(429).json({ 
                    error: `Quá nhiều lần thử sai. Vui lòng thử lại sau ${process.env.OTP_LOCK_DURATION_MINUTES} phút`,
                    locked: true 
                });
            }

            TwoFactorService.incrementOTPAttempts(twoFactorRecord);
            await twoFactorRecord.save();

            logSecurityEvent(req.session.tempUserId, '2FA_VERIFICATION_FAILED', { 
                attemptsRemaining,
                ip: req.ip
            });
            
            return res.status(401).json({ 
                error: `Mã xác minh không đúng. Còn ${attemptsRemaining} lần thử`,
                attemptsRemaining 
            });
        }

        // ✅ 2FA verified successfully
        TwoFactorService.resetOTPAttempts(twoFactorRecord);
        await twoFactorRecord.save();

        // Move session from temp to permanent
        req.session.userId = req.session.tempUserId;
        req.session.name = req.session.tempName;
        req.session.role = req.session.tempRole;
        req.session.studentId = req.session.tempStudentId;

        delete req.session.tempUserId;
        delete req.session.tempName;
        delete req.session.tempRole;
        delete req.session.tempStudentId;
        delete req.session.tempRemember;

        if (req.session.tempRemember) {
            req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
        }

        req.session.save((err) => {
            if (err) {
                logSecurityEvent(req.session.userId, '2FA_SESSION_SAVE_ERROR', { ip: req.ip });
                return res.status(500).json({ error: 'Lỗi hệ thống' });
            }

            logSecurityEvent(req.session.userId, 'LOGIN_SUCCESS_2FA', { ip: req.ip });

            const redirectUrl = req.session.role === 'admin' ? '/admin/dormitories' : '/';
            res.json({ success: true, redirectUrl });
        });

    } catch (error) {
        logger.error('2FA verification error', { error: error.message });
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

app.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        const student = await StudentCollection.findOne({ email });
        if (!student) {
            return res.render("auth/forgot-password", { 
                error: "Email không tồn tại trong hệ thống" 
            });
        }

        res.render("auth/forgot-password", { 
            success: "Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn" 
        });
    } catch (error) {
        console.error("Error during forgot password:", error);
        res.render("auth/forgot-password", { 
            error: "Đã xảy ra lỗi. Vui lòng thử lại."
        });
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

// ============================================
// STUDENT ROUTES
// ============================================

app.get("/register", isAuthenticated, (req, res) => {
    res.render("student/register", {
        user: {
            name: req.session.name,
            role: req.session.role,
            id: req.session.userId
        }
    });
});

app.get("/profile", isAuthenticated, async (req, res) => {
    try {
        const success = req.query.success;
        const error = req.query.error;
        
        let message = null;
        if (success) {
            switch (success) {
                case 'profile_updated':
                    message = { type: 'success', text: 'Thông tin cá nhân đã được cập nhật thành công.' };
                    break;
                case 'password_changed':
                    message = { type: 'success', text: 'Mật khẩu đã được thay đổi thành công.' };
                    break;
            }
        } else if (error) {
            switch (error) {
                case 'email_exists':
                    message = { type: 'error', text: 'Email này đã được sử dụng bởi tài khoản khác.' };
                    break;
                case 'update_failed':
                    message = { type: 'error', text: 'Có lỗi xảy ra khi cập nhật thông tin.' };
                    break;
                case 'passwords_dont_match':
                    message = { type: 'error', text: 'Mật khẩu mới và xác nhận mật khẩu không khớp.' };
                    break;
                case 'incorrect_password':
                    message = { type: 'error', text: 'Mật khẩu hiện tại không đúng.' };
                    break;
                case 'password_change_failed':
                    message = { type: 'error', text: 'Có lỗi xảy ra khi thay đổi mật khẩu.' };
                    break;
            }
        }
        
        const student = await StudentCollection.findById(req.session.userId);
        if (!student) {
            return res.redirect('/login');
        }
        
        let dormitory = null;
        let room = null;
        if (student.dormitoryId) {
            dormitory = await DormitoryCollection.findById(student.dormitoryId);
            
            if (dormitory && student.roomNumber) {
                for (const floor of dormitory.floors) {
                    const foundRoom = floor.rooms.find(r => r.roomNumber === student.roomNumber);
                    if (foundRoom) {
                        room = foundRoom;
                        break;
                    }
                }
            }
        }
        
        const applications = await PendingApplicationCollection.find({
            studentId: student.studentId
        }).sort({ createdAt: -1 }).limit(5);
        
        res.render("student/profile", {
            student,
            dormitory,
            room,
            applications,
            message,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).send("Internal server error");
    }
});

// Route: 2FA Setup Page
app.get("/profile/2fa", isAuthenticated, async (req, res) => {
    try {
        const student = await StudentCollection.findById(req.session.userId);
        if (!student) {
            return res.redirect('/login');
        }

        res.render("2fa-setup", {
            user: { 
                name: req.session.name, 
                role: req.session.role,
                email: student.email
            }
        });
    } catch (error) {
        console.error("Error loading 2FA setup:", error);
        res.status(500).send("Internal server error");
    }
});

app.post('/update-profile', isAuthenticated, async (req, res) => {
    try {
        const {
            name,
            studentId,
            email,
            phone,
            faculty,
            academicYear,
            gender
        } = req.body;

        const student = await StudentCollection.findById(req.session.userId);
        if (!student) {
            return res.redirect('/login');
        }

        if (name && name !== student.name) {
            req.session.name = name;
        }

        if (email && email !== student.email) {
            const existingEmail = await StudentCollection.findOne({ email, _id: { $ne: req.session.userId } });
            if (existingEmail) {
                return res.redirect('/profile?error=email_exists');
            }
        }

        await StudentCollection.findByIdAndUpdate(req.session.userId, {
            name,
            studentId,
            email,
            phone,
            faculty,
            academicYear,
            gender
        });

        res.redirect('/profile?success=profile_updated');
    } catch (error) {
        console.error('Error updating profile:', error);
        res.redirect('/profile?error=update_failed');
    }
});

app.post('/change-password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (newPassword !== confirmPassword) {
            return res.redirect('/profile?error=passwords_dont_match');
        }

        const student = await StudentCollection.findById(req.session.userId);
        if (!student) {
            return res.redirect('/login');
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, student.password);
        if (!isPasswordValid) {
            return res.redirect('/profile?error=incorrect_password');
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        await StudentCollection.findByIdAndUpdate(req.session.userId, {
            password: hashedPassword
        });

        res.redirect('/profile?success=password_changed');
    } catch (error) {
        console.error('Error changing password:', error);
        res.redirect('/profile?error=password_change_failed');
    }
});

app.post("/register-room", isAuthenticated, async (req, res) => {
    try {
        const { dormitoryId, roomNumber, preferences } = req.body;
        const userId = req.session.userId;

        const success = Math.random() > 0.3; // 70% thành công

        if (success) {
            await StudentCollection.findByIdAndUpdate(userId, {
                dormitoryId: dormitoryId,
                roomNumber: roomNumber
            });

            await sendNotificationOnEvent('registration_success', userId, {
                roomNumber: roomNumber,
                dormitoryName: "KTX Trung tâm"
            });

            res.json({ 
                success: true, 
                message: "Đăng ký phòng thành công!",
                roomNumber: roomNumber 
            });
        } else {
            await sendNotificationOnEvent('registration_failed', userId, {
                reason: "Phòng đã đầy",
                roomNumber: roomNumber
            });

            res.json({ 
                success: false, 
                message: "Đăng ký thất bại - Phòng đã đầy!" 
            });
        }

    } catch (error) {
        console.error("Error registering room:", error);
        
        await sendNotificationOnEvent('registration_failed', req.session.userId, {
            reason: "Lỗi hệ thống"
        });

        res.status(500).json({ 
            success: false, 
            message: "Lỗi hệ thống" 
        });
    }
});

// ============================================
// ADMIN ROUTES
// ============================================

app.get("/admin/dashboard", isAdmin, (req, res) => {
    res.render("admin/dashboard", { 
        user: { 
            name: req.session.name, 
            role: req.session.role 
        } 
    });
});

app.get("/admin/logs", isAdmin, (req, res) => {
    res.render("admin/logs", { 
        user: { 
            name: req.session.name, 
            role: req.session.role 
        } 
    });
});

app.get("/admin/dormitories", isAdmin, async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find({
            $or: [
                { isDeleted: false },
                { isDeleted: { $exists: false } }
            ]
        });
        res.render("admin/dormitory/admin-dormitories", { 
            dormitories, 
            user: { name: req.session.name, role: req.session.role } 
        });
    } catch (error) {
        console.error("Error fetching dormitories:", error);
        res.render("admin/dormitory/admin-dormitories", { 
            dormitories: [], 
            error: "Không thể lấy dữ liệu ký túc xá",
            user: { name: req.session.name, role: req.session.role }
        });
    }
});

app.get("/admin/application", isAdmin, async (req, res) => {
    try {
        res.type('html');
        res.render("admin/application/admin-application", { 
            user: { name: req.session.name, role: req.session.role } 
        });
    } catch (error) {
        console.error("Error rendering application page:", error);
        res.status(500).send("Internal server error");
    }
});

// Route /admin/application/:id được xử lý bởi adminApplicationRoutes

app.get("/admin/dormitories/trash", isAdmin, async (req, res) => {
    try {
        const deletedDormitories = await DormitoryCollection.find({ isDeleted: true });
        res.render("admin/dormitory/admin-trash", { 
            deletedDormitories,
            message: req.query.message || null,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        console.error("Error fetching trash:", error);
        res.render("admin/dormitory/admin-trash", { 
            deletedDormitories: [],
            error: "Không thể lấy dữ liệu",
            user: { name: req.session.name, role: req.session.role }
        });
    }
});

app.get("/admin/dormitories/add", isAdmin, (req, res) => {
    res.render("admin/dormitory/admin-dormitory-form", { 
        action: "add",
        dormitory: null,
        user: { name: req.session.name, role: req.session.role }
    });
});

app.get("/admin/dormitories/edit/:id", isAdmin, async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id);
        if (!dormitory) {
            return res.redirect('/admin/dormitories');
        }
        res.render("admin/dormitory/admin-dormitory-form", { 
            action: "edit",
            dormitory,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        console.error("Error fetching dormitory for edit:", error);
        res.redirect('/admin/dormitories');
    }
});

app.get("/admin/dormitories/view/:id", isAdmin, async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id);
        if (!dormitory) {
            return res.redirect('/admin/dormitories');
        }
        res.render("admin/dormitory/admin-dormitory-view", { 
            dormitory,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        console.error("Error fetching dormitory details:", error);
        res.redirect('/admin/dormitories');
    }
});

// Route to view room details
app.get("/admin/dormitories/:dormId/rooms/:floorNumber/:roomNumber", isAdmin, async (req, res) => {
    try {
        res.render("admin/dormitory/room-detail", { 
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        console.error("Error rendering room details:", error);
        res.redirect('/admin/dormitories');
    }
});

// Route for cleanup page
app.get("/admin/cleanup", isAdmin, (req, res) => {
    try {
        res.render("admin/cleanup", { 
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        console.error("Error rendering cleanup page:", error);
        res.redirect('/admin/dormitories');
    }
});

app.post("/admin/approve-application", isAdmin, async (req, res) => {
    try {
        const { applicationId, action, rejectionReason } = req.body;
        const adminId = req.session.userId;

        console.log(`[ADMIN-APPROVE] Admin ${adminId} processing application ${applicationId} with action: ${action}`);

        const application = await PendingApplicationCollection.findById(applicationId);
        if (!application) {
            console.log(`[ERROR] Application ${applicationId} not found`);
            return res.status(404).json({ 
                success: false, 
                message: "Không tìm thấy đơn đăng ký" 
            });
        }

        console.log(`[DEBUG] Found application:`, {
            id: application._id,
            studentId: application.studentId,
            status: application.status,
            roomNumber: application.roomNumber,
            fullName: application.fullName
        });

        if (application.status !== 'pending') {
            return res.status(400).json({ 
                success: false, 
                message: `Đơn đăng ký đã được xử lý (${application.status})` 
            });
        }

        if (action === 'approve') {
            console.log(`[DEBUG] Checking if student already exists in system...`);
            
            const existingStudent = await checkStudentExistsInSystem(application.studentId, application.fullName);
            
            if (existingStudent.exists) {
                const location = existingStudent.location;
                const fieldType = existingStudent.type === 'studentId' ? 'Mã sinh viên' : 'Tên sinh viên';
                const fieldValue = existingStudent.type === 'studentId' ? application.studentId : application.fullName;
                
                console.log(`[ERROR] Student already exists:`, location);
                
                return res.status(400).json({ 
                    success: false, 
                    message: `${fieldType} "${fieldValue}" đã được đăng ký tại ${location.dormitoryName} - Tầng ${location.floorNumber} - Phòng ${location.roomNumber}. Không thể duyệt đơn đăng ký này!` 
                });
            }

            const dormitory = await DormitoryCollection.findById(application.dormitoryId);
            if (!dormitory) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Không tìm thấy ký túc xá" 
                });
            }

            let targetRoom = null;
            let targetFloor = null;

            for (const floor of dormitory.floors) {
                const room = floor.rooms.find(r => r.roomNumber === application.roomNumber);
                if (room) {
                    targetRoom = room;
                    targetFloor = floor;
                    break;
                }
            }

            if (!targetRoom) {
                return res.status(404).json({ 
                    success: false, 
                    message: `Không tìm thấy phòng ${application.roomNumber} trong ký túc xá` 
                });
            }

            const activeOccupants = targetRoom.occupants.filter(o => o.active);
            if (activeOccupants.length >= targetRoom.maxCapacity) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Phòng ${application.roomNumber} đã đầy (${activeOccupants.length}/${targetRoom.maxCapacity}). Không thể duyệt đơn đăng ký!` 
                });
            }

            console.log(`[DEBUG] All validation passed, approving application...`);

            const updatedApplication = await PendingApplicationCollection.findByIdAndUpdate(
                applicationId, 
                {
                    status: 'approved',
                    approvedBy: adminId,
                    approvedAt: new Date(),
                    updatedAt: new Date()
                },
                { new: true }
            );

            console.log(`[DEBUG] Application updated:`, updatedApplication.status);

            const student = await StudentCollection.findOne({ studentId: application.studentId });
            if (!student) {
                console.log(`[ERROR] Student not found for studentId: ${application.studentId}`);
                return res.status(404).json({ 
                    success: false, 
                    message: "Không tìm thấy sinh viên trong hệ thống" 
                });
            }

            console.log(`[DEBUG] Found student:`, {
                id: student._id,
                name: student.name,
                studentId: student.studentId
            });

            await StudentCollection.findByIdAndUpdate(student._id, {
                dormitoryId: application.dormitoryId,
                roomNumber: application.roomNumber,
                updatedAt: new Date()
            });

            targetRoom.occupants.push({
                studentId: application.studentId,
                name: application.fullName,
                phone: application.phone || '',
                email: application.email || '',
                checkInDate: new Date(),
                active: true
            });

            if (!dormitory.details.totalFloors) {
                dormitory.details.totalFloors = dormitory.floors.length;
            }

            await dormitory.save();

            console.log(`[DEBUG] Student room assigned: ${application.roomNumber}`);

            const notificationResult = await sendNotificationOnEvent('registration_approved', student._id, {
                roomNumber: application.roomNumber,
                dormitoryName: application.dormitoryName || dormitory.name,
                applicationId: applicationId
            });

            console.log(`[DEBUG] Notification result:`, notificationResult ? 'SUCCESS' : 'FAILED');

            await createActivityLog(student._id, 'application_approved', 
                `Đơn đăng ký phòng ${application.roomNumber} đã được duyệt`, {
                applicationId: applicationId,
                approvedBy: adminId
            });

            res.json({ 
                success: true, 
                message: "Đã duyệt đơn đăng ký thành công!",
                data: {
                    applicationId: applicationId,
                    studentName: student.name,
                    roomNumber: application.roomNumber,
                    dormitoryName: dormitory.name,
                    notificationSent: !!notificationResult
                }
            });

        } else if (action === 'reject') {
            await PendingApplicationCollection.findByIdAndUpdate(applicationId, {
                status: 'rejected',
                rejectedBy: adminId,
                rejectedAt: new Date(),
                rejectionReason: rejectionReason || "Không đáp ứng yêu cầu",
                updatedAt: new Date()
            });

            const student = await StudentCollection.findOne({ studentId: application.studentId });
            if (student) {
                await sendNotificationOnEvent('registration_rejected', student._id, {
                    roomNumber: application.roomNumber,
                    reason: rejectionReason || "Không đáp ứng yêu cầu",
                    applicationId: applicationId
                });

                await createActivityLog(student._id, 'application_rejected', 
                    `Đơn đăng ký phòng ${application.roomNumber} đã bị từ chối`, {
                    applicationId: applicationId,
                    rejectedBy: adminId,
                    reason: rejectionReason
                });
            }

            res.json({ 
                success: true, 
                message: "Đã từ chối đơn đăng ký!" 
            });
        } else {
            res.status(400).json({ 
                success: false, 
                message: "Hành động không hợp lệ (phải là 'approve' hoặc 'reject')" 
            });
        }

    } catch (error) {
        console.error("[ERROR] Error processing application:", error);
        res.status(500).json({ 
            success: false, 
            message: "Lỗi hệ thống khi xử lý đơn đăng ký",
            error: error.message
        });
    }
});

app.put("/api/admin/applications/:id/update-status", isAdmin, async (req, res) => {
    try {
        const { status, comments } = req.body;
        const applicationId = req.params.id;
        const adminId = req.session.userId;

        if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                error: "Trạng thái không hợp lệ" 
            });
        }

        const application = await PendingApplicationCollection.findById(applicationId);
        if (!application) {
            return res.status(404).json({ 
                success: false, 
                error: "Không tìm thấy đơn đăng ký" 
            });
        }

        const student = await StudentCollection.findOne({ studentId: application.studentId });
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: "Không tìm thấy sinh viên" 
            });
        }

        if (status === 'approved') {
            await PendingApplicationCollection.findByIdAndUpdate(applicationId, {
                status: 'approved',
                approvedBy: adminId,
                approvedAt: new Date(),
                comments: comments || '',
                updatedAt: new Date()
            });

            await StudentCollection.findByIdAndUpdate(student._id, {
                dormitoryId: application.dormitoryId,
                roomNumber: application.roomNumber,
                updatedAt: new Date()
            });

            await sendNotificationOnEvent('registration_approved', student._id, {
                roomNumber: application.roomNumber,
                dormitoryName: application.dormitoryName || "KTX HUST",
                applicationId: applicationId
            });

            res.json({ 
                success: true, 
                message: "Đã duyệt đơn đăng ký thành công!"
            });

        } else if (status === 'rejected') {
            await PendingApplicationCollection.findByIdAndUpdate(applicationId, {
                status: 'rejected',
                rejectedBy: adminId,
                rejectedAt: new Date(),
                rejectionReason: comments || "Không đáp ứng yêu cầu",
                comments: comments || '',
                updatedAt: new Date()
            });

            await sendNotificationOnEvent('registration_rejected', student._id, {
                roomNumber: application.roomNumber,
                reason: comments || "Không đáp ứng yêu cầu",
                applicationId: applicationId
            });

            res.json({ 
                success: true, 
                message: "Đã từ chối đơn đăng ký!"
            });

        } else {
            await PendingApplicationCollection.findByIdAndUpdate(applicationId, {
                status: 'pending',
                comments: comments || '',
                updatedAt: new Date()
            });

            res.json({ 
                success: true, 
                message: "Đã cập nhật trạng thái thành công!" 
            });
        }

    } catch (error) {
        console.error("Error updating application status:", error);
        res.status(500).json({ 
            success: false, 
            error: "Lỗi hệ thống khi cập nhật trạng thái"
        });
    }
});

// Route này được xử lý bởi adminApplicationRoutes

app.get("/admin/applications/stats", isAdmin, async (req, res) => {
    try {
        const stats = await PendingApplicationCollection.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = {
            pending: 0,
            approved: 0,
            rejected: 0,
            total: 0
        };

        stats.forEach(stat => {
            result[stat._id] = stat.count;
            result.total += stat.count;
        });

        res.json({ success: true, stats: result });

    } catch (error) {
        console.error("Error fetching application stats:", error);
        res.status(500).json({ 
            success: false, 
            message: "Lỗi khi lấy thống kê đơn đăng ký" 
        });
    }
});

app.post("/admin/send-announcement", isAdmin, async (req, res) => {
    try {
        const { title, message, type, targetRole, priority } = req.body;
        
        const notification = await createNotification({
            title: title,
            message: message,
            type: type || 'info',
            isGlobal: true,
            targetRole: targetRole || 'all',
            priority: priority || 'normal',
            createdBy: req.session.userId
        });
        
        res.json({ 
            success: true, 
            message: "Đã gửi thông báo thành công!",
            notificationId: notification._id 
        });
        
    } catch (error) {
        console.error("Error sending announcement:", error);
        res.status(500).json({ error: "Không thể gửi thông báo" });
    }
});

// ============================================
// API ROUTES
// ============================================

app.get("/api/featured-dormitories", async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find().limit(5);
        res.json(dormitories);
    } catch (error) {
        console.error("Error fetching featured dormitories:", error);
        res.status(500).json({ error: "Không thể lấy dữ liệu ký túc xá nổi bật" });
    }
});

app.get("/api/notifications", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const userId = req.session.userId;
        const userRole = req.session.role || 'user';

        const notifications = await NotificationCollection.find({
            $or: [
                { isGlobal: true },
                { targetUsers: userId },
                { targetRole: userRole },
                { targetRole: 'all' }
            ],
            $or: [
                { expiresAt: { $exists: false } },
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } }
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
        console.error("Error fetching notifications:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/notifications/:id/read", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const notificationId = req.params.id;
        const userId = req.session.userId;

        const notification = await NotificationCollection.findById(notificationId);
        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }

        const alreadyRead = notification.readBy.some(read => 
            read.userId.toString() === userId.toString()
        );

        if (!alreadyRead) {
            await NotificationCollection.findByIdAndUpdate(
                notificationId,
                {
                    $push: {
                        readBy: {
                            userId: userId,
                            readAt: new Date()
                        }
                    }
                }
            );
        }

        res.json({ success: true, message: "Notification marked as read" });

    } catch (error) {
        console.error("Error marking notification as read:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/notifications/mark-all-read", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const userId = req.session.userId;
        
        const unreadNotifications = await NotificationCollection.find({
            $or: [
                { isGlobal: true },
                { targetUsers: userId },
                { targetRole: req.session.role || 'user' },
                { targetRole: 'all' }
            ],
            'readBy.userId': { $ne: userId }
        });

        const updatePromises = unreadNotifications.map(notification => 
            NotificationCollection.findByIdAndUpdate(
                notification._id,
                {
                    $push: {
                        readBy: {
                            userId: userId,
                            readAt: new Date()
                        }
                    }
                }
            )
        );

        await Promise.all(updatePromises);

        res.json({ 
            success: true, 
            message: `Đã đánh dấu ${unreadNotifications.length} thông báo là đã đọc` 
        });

    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/admin/notifications", isAdmin, async (req, res) => {
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
            res.status(500).json({ error: "Failed to create notification" });
        }

    } catch (error) {
        console.error("Error creating notification:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ============================================
// DEBUG ROUTES
// ============================================

app.use('/debug-session', (req, res) => {
    res.json({
        sessionData: req.session,
        hasUserId: !!req.session.userId,
        role: req.session.role,
        name: req.session.name
    });
});

app.get("/check-session", (req, res) => {
    res.json({
        sessionExists: !!req.session,
        sessionData: req.session
    });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function createNotification(data) {
    try {
        const notification = new NotificationCollection(data);
        await notification.save();
        return notification;
    } catch (error) {
        console.error("Error creating notification:", error);
        return null;
    }
}

async function createActivityLog(userId, action, description, details = {}) {
    try {
        const log = new ActivityLogCollection({
            userId,
            action,
            description,
            details
        });
        await log.save();
        return log;
    } catch (error) {
        console.error("Error creating activity log:", error);
        return null;
    }
}

async function sendNotificationOnEvent(eventType, userId, details = {}) {
    try {
        let notificationData = { createdBy: userId };

        switch (eventType) {
            case 'welcome':
                notificationData = {
                    ...notificationData,
                    title: 'Chào mừng đến với hệ thống KTX HUST!',
                    message: `Xin chào ${details.name}! Tài khoản của bạn đã được tạo thành công. Hãy khám phá các tính năng của hệ thống.`,
                    type: 'success',
                    targetUsers: [userId],
                    priority: 'normal'
                };
                await createActivityLog(userId, 'register_success', 'Tạo tài khoản thành công', details);
                break;

            case 'registration_approved':
                notificationData = {
                    ...notificationData,
                    title: 'Đơn đăng ký ký túc xá đã được duyệt!',
                    message: `Đơn đăng ký phòng ${details.roomNumber} tại ${details.dormitoryName} của bạn đã được admin phê duyệt. Vui lòng kiểm tra thông tin chi tiết trong hồ sơ cá nhân.`,
                    type: 'success',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'registration_approved', 'Đơn đăng ký được duyệt', details);
                break;

            case 'registration_rejected':
                notificationData = {
                    ...notificationData,
                    title: 'Đơn đăng ký ký túc xá bị từ chối',
                    message: `Đơn đăng ký phòng ${details.roomNumber} của bạn đã bị từ chối. Lý do: ${details.reason}. Bạn có thể đăng ký lại phòng khác hoặc liên hệ ban quản lý để biết thêm chi tiết.`,
                    type: 'error',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'registration_rejected', 'Đơn đăng ký bị từ chối', details);
                break;

            case 'registration_success':
                notificationData = {
                    ...notificationData,
                    title: 'Đăng ký ký túc xá thành công',
                    message: `Bạn đã đăng ký ký túc xá thành công. Phòng: ${details.roomNumber || 'Chưa xác định'}, ${details.dormitoryName || ''}`,
                    type: 'success',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'register_success', 'Đăng ký ký túc xá thành công', details);
                break;

            case 'registration_failed':
                notificationData = {
                    ...notificationData,
                    title: 'Đăng ký ký túc xá thất bại',
                    message: `Đăng ký không thành công. Lý do: ${details.reason || 'Không xác định'}${details.roomNumber ? `. Phòng: ${details.roomNumber}` : ''}`,
                    type: 'error',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'register_failed', 'Đăng ký ký túc xá thất bại', details);
                break;

            case 'payment_success':
                notificationData = {
                    ...notificationData,
                    title: 'Thanh toán thành công',
                    message: `Thanh toán ${details.type || 'phí'} đã được xử lý thành công. Số tiền: ${details.amount || '0'} VND${details.transactionId ? `. Mã GD: ${details.transactionId}` : ''}`,
                    type: 'success',
                    targetUsers: [userId],
                    priority: 'normal'
                };
                await createActivityLog(userId, 'payment_success', 'Thanh toán thành công', details);
                break;

            case 'payment_failed':
                notificationData = {
                    ...notificationData,
                    title: 'Thanh toán thất bại',
                    message: `Giao dịch thanh toán không thành công${details.reason ? `. Lý do: ${details.reason}` : ''}. Vui lòng thử lại sau.`,
                    type: 'error',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'payment_failed', 'Thanh toán thất bại', details);
                break;

            case 'room_assigned':
                notificationData = {
                    ...notificationData,
                    title: 'Phân phòng thành công',
                    message: `Bạn đã được phân phòng ${details.roomNumber}${details.dormitoryName ? ` tại ${details.dormitoryName}` : ''}. Vui lòng xem thông tin chi tiết.`,
                    type: 'info',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'room_assigned', 'Được phân phòng', details);
                break;

            case 'room_changed':
                notificationData = {
                    ...notificationData,
                    title: 'Chuyển phòng thành công',
                    message: `Bạn đã được chuyển từ phòng ${details.oldRoom} sang phòng ${details.newRoom}. Vui lòng cập nhật thông tin cá nhân.`,
                    type: 'info',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'room_changed', 'Chuyển phòng', details);
                break;

            case 'profile_updated':
                notificationData = {
                    ...notificationData,
                    title: 'Cập nhật thông tin thành công',
                    message: `Thông tin cá nhân của bạn đã được cập nhật thành công.`,
                    type: 'success',
                    targetUsers: [userId],
                    priority: 'low'
                };
                await createActivityLog(userId, 'profile_updated', 'Cập nhật thông tin cá nhân', details);
                break;

            case 'password_changed':
                notificationData = {
                    ...notificationData,
                    title: 'Thay đổi mật khẩu thành công',
                    message: `Mật khẩu của bạn đã được thay đổi thành công vào lúc ${new Date().toLocaleString('vi-VN')}.`,
                    type: 'info',
                    targetUsers: [userId],
                    priority: 'normal'
                };
                await createActivityLog(userId, 'password_changed', 'Thay đổi mật khẩu', details);
                break;

            case 'maintenance_notice':
                notificationData = {
                    ...notificationData,
                    title: 'Thông báo bảo trì hệ thống',
                    message: details.message || 'Hệ thống sẽ được bảo trì trong thời gian tới. Vui lòng theo dõi thông báo.',
                    type: 'warning',
                    isGlobal: true,
                    targetRole: 'all',
                    priority: 'normal'
                };
                break;

            case 'announcement':
                notificationData = {
                    ...notificationData,
                    title: details.title || 'Thông báo từ Ban Quản lý',
                    message: details.message,
                    type: details.type || 'info',
                    isGlobal: true,
                    targetRole: details.targetRole || 'all',
                    priority: details.priority || 'normal'
                };
                break;

            case 'reminder':
                notificationData = {
                    ...notificationData,
                    title: details.title || 'Nhắc nhở',
                    message: details.message,
                    type: 'warning',
                    targetUsers: [userId],
                    priority: 'normal'
                };
                break;

            default:
                console.log(`Unknown notification event type: ${eventType}`);
                return null;
        }

        const notification = await createNotification(notificationData);
        return notification;

    } catch (error) {
        console.error("Error sending notification:", error);
        return null;
    }
}

async function checkStudentExistsInSystem(studentId, fullName) {
    try {
        const dormitories = await DormitoryCollection.find({});
        
        for (const dorm of dormitories) {
            for (const floor of dorm.floors) {
                for (const room of floor.rooms) {
                    const occupant = room.occupants.find(o => 
                        o.active && 
                        (o.studentId === studentId || o.name === fullName)
                    );
                    
                    if (occupant) {
                        return {
                            exists: true,
                            type: occupant.studentId === studentId ? 'studentId' : 'name',
                            location: {
                                dormitoryName: dorm.name,
                                floorNumber: floor.floorNumber,
                                roomNumber: room.roomNumber
                            }
                        };
                    }
                }
            }
        }
        
        return { exists: false };
    } catch (error) {
        console.error('Error checking student exists:', error);
        return { exists: false };
    }
}

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
            
            console.log('✓ Default admin account created');
        }
    } catch (error) {
        console.error('Error creating admin account:', error);
    }
}

// Academic Policies Page
app.get("/admin/academic/policies", isAdmin, async (req, res) => {
    try {
        res.render("admin/academic/admin-academic-policies", { 
            user: { 
                name: req.session.name, 
                role: req.session.role 
            } 
        });
    } catch (error) {
        console.error("Error rendering academic policies page:", error);
        res.status(500).send("Internal server error");
    }
});

// Priority Queue Page
app.get("/admin/academic/priority-queue", isAdmin, async (req, res) => {
    try {
        res.render("admin/academic/admin-priority-queue", { 
            user: { 
                name: req.session.name, 
                role: req.session.role 
            } 
        });
    } catch (error) {
        console.error("Error rendering priority queue page:", error);
        res.status(500).send("Internal server error");
    }
});

// Academic Windows Management Page
app.get("/admin/academic-windows", isAdmin, async (req, res) => {
    try {
        console.log('🔴 Rendering admin/registration-cycles');
        res.render("admin/registration-cycles", { 
            user: { 
                name: req.session.name, 
                role: req.session.role 
            } 
        });
        console.log('🟢 Successfully rendered');
    } catch (error) {
        console.error("🔴 Error rendering academic windows page:", error);
        res.status(500).send("Internal server error");
    }
});

// API: Get academic windows with application statistics by priority
app.get("/api/admin/academic-windows", isAdmin, async (req, res) => {
    try {
        const AllocationCycleModel = require('./src/schemas/AllocationCycleSchema');
        
        const windows = await AllocationCycleModel.find({})
            .sort({ academicYear: -1 })
            .lean();
        
        // For each window, get application statistics by priority
        const windowsWithStats = await Promise.all(windows.map(async (window) => {
            // Count applications by priority type for this academic year
            const priorityStats = {
                dantoc: 0,        // Dân tộc
                hongho: 0,        // Hộ nghèo  
                khuyettat: 0,     // Khuyết tật
                mocoι: 0,         // Mồ côi
                total: 0
            };
            
            // Count applications with each priority type
            const applicationStats = await PendingApplicationCollection.aggregate([
                { 
                    $match: { 
                        createdAt: {
                            $gte: window.registrationStart || new Date(0),
                            $lte: window.registrationEnd || new Date()
                        }
                    } 
                },
                { $unwind: '$priorityPolicies' },
                { 
                    $group: {
                        _id: '$priorityPolicies.type',
                        count: { $sum: 1 }
                    }
                }
            ]);
            
            applicationStats.forEach(stat => {
                if (stat._id === 'ethnic') priorityStats.dantoc = stat.count;
                else if (stat._id === 'poor') priorityStats.hongho = stat.count;
                else if (stat._id === 'disability') priorityStats.khuyettat = stat.count;
                else if (stat._id === 'orphan') priorityStats.mocoι = stat.count;
                priorityStats.total += stat.count;
            });
            
            return {
                ...window,
                priorityStats
            };
        }));
        
        res.json(windowsWithStats);
    } catch (error) {
        console.error('Error fetching academic windows:', error);
        res.status(500).json({ error: 'Failed to fetch academic windows' });
    }
});

// API: Get all allocation policies
app.get("/api/admin/allocation-policies", isAdmin, async (req, res) => {
    try {
        const AllocationPolicyModel = require('./src/schemas/AllocationPolicySchema');
        
        const policies = await AllocationPolicyModel.find({})
            .sort({ academicYear: -1, createdAt: -1 })
            .lean();
        
        res.json({ success: true, policies });
    } catch (error) {
        console.error('Error fetching allocation policies:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch policies' });
    }
});

// API: Create allocation policy
app.post("/api/admin/allocation-policies", isAdmin, async (req, res) => {
    try {
        const AllocationPolicyModel = require('./src/schemas/AllocationPolicySchema');
        
        const { academicYear, name, priorityRules, rebalanceThresholds, status } = req.body;
        
        // Check if policy already exists for this academic year
        const existing = await AllocationPolicyModel.findOne({ academicYear, name });
        if (existing) {
            return res.status(400).json({ 
                success: false, 
                error: 'Chính sách với năm học và tên này đã tồn tại' 
            });
        }
        
        const newPolicy = await AllocationPolicyModel.create({
            academicYear,
            name,
            priorityRules,
            rebalanceThresholds,
            status: status || 'ACTIVE',
            createdBy: req.session.userId
        });
        
        res.json({ success: true, policy: newPolicy });
    } catch (error) {
        console.error('Error creating allocation policy:', error);
        res.status(500).json({ success: false, error: 'Failed to create policy' });
    }
});

// API: Update allocation policy
app.put("/api/admin/allocation-policies/:id", isAdmin, async (req, res) => {
    try {
        const AllocationPolicyModel = require('./src/schemas/AllocationPolicySchema');
        
        const { academicYear, name, priorityRules, rebalanceThresholds, status } = req.body;
        
        const updatedPolicy = await AllocationPolicyModel.findByIdAndUpdate(
            req.params.id,
            {
                academicYear,
                name,
                priorityRules,
                rebalanceThresholds,
                status,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        if (!updatedPolicy) {
            return res.status(404).json({ success: false, error: 'Policy not found' });
        }
        
        res.json({ success: true, policy: updatedPolicy });
    } catch (error) {
        console.error('Error updating allocation policy:', error);
        res.status(500).json({ success: false, error: 'Failed to update policy' });
    }
});

// API: Delete allocation policy
app.delete("/api/admin/allocation-policies/:id", isAdmin, async (req, res) => {
    try {
        const AllocationPolicyModel = require('./src/schemas/AllocationPolicySchema');
        const AllocationCycleModel = require('./src/schemas/AllocationCycleSchema');
        
        // Check if policy is being used by any cycle
        const cyclesUsingPolicy = await AllocationCycleModel.countDocuments({ policyId: req.params.id });
        if (cyclesUsingPolicy > 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Không thể xóa chính sách đang được sử dụng bởi chu kỳ phân bổ' 
            });
        }
        
        const deletedPolicy = await AllocationPolicyModel.findByIdAndDelete(req.params.id);
        
        if (!deletedPolicy) {
            return res.status(404).json({ success: false, error: 'Policy not found' });
        }
        
        res.json({ success: true, message: 'Policy deleted successfully' });
    } catch (error) {
        console.error('Error deleting allocation policy:', error);
        res.status(500).json({ success: false, error: 'Failed to delete policy' });
    }
});

// API: Create academic window (cycle)
app.post("/api/admin/academic-windows", isAdmin, async (req, res) => {
    try {
        const AllocationCycleModel = require('./src/schemas/AllocationCycleSchema');
        
        const { academicYear, policyId, startDate, endDate, status, description, allowedAcademicYears } = req.body;
        
        const newCycle = await AllocationCycleModel.create({
            academicYear,
            policyId,
            name: 'Main Registration', // Default name
            registrationStart: new Date(startDate),
            registrationEnd: new Date(endDate),
            status: status || 'PENDING',
            description,
            allowedAcademicYears
        });
        
        res.json({ success: true, cycle: newCycle });
    } catch (error) {
        console.error('Error creating academic window:', error);
        res.status(500).json({ success: false, error: 'Failed to create window' });
    }
});

// API: Update academic window (cycle)
app.put("/api/admin/academic-windows/:id", isAdmin, async (req, res) => {
    try {
        const AllocationCycleModel = require('./src/schemas/AllocationCycleSchema');
        
        const { academicYear, policyId, startDate, endDate, status, description, allowedAcademicYears } = req.body;
        
        const updatedCycle = await AllocationCycleModel.findByIdAndUpdate(
            req.params.id,
            {
                academicYear,
                policyId,
                registrationStart: new Date(startDate),
                registrationEnd: new Date(endDate),
                status,
                description,
                allowedAcademicYears,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        if (!updatedCycle) {
            return res.status(404).json({ success: false, error: 'Window not found' });
        }
        
        res.json({ success: true, cycle: updatedCycle });
    } catch (error) {
        console.error('Error updating academic window:', error);
        res.status(500).json({ success: false, error: 'Failed to update window' });
    }
});

// API: Activate academic window (cycle)
app.post("/api/admin/academic-windows/:id/activate", isAdmin, async (req, res) => {
    try {
        const AllocationCycleModel = require('./src/schemas/AllocationCycleSchema');
        
        const updatedCycle = await AllocationCycleModel.findByIdAndUpdate(
            req.params.id,
            { status: 'active', updatedAt: new Date() },
            { new: true }
        );
        
        if (!updatedCycle) {
            return res.status(404).json({ success: false, error: 'Window not found' });
        }
        
        res.json({ success: true, cycle: updatedCycle });
    } catch (error) {
        console.error('Error activating window:', error);
        res.status(500).json({ success: false, error: 'Failed to activate window' });
    }
});

// API: Deactivate academic window (cycle)
app.post("/api/admin/academic-windows/:id/deactivate", isAdmin, async (req, res) => {
    try {
        const AllocationCycleModel = require('./src/schemas/AllocationCycleSchema');
        
        const updatedCycle = await AllocationCycleModel.findByIdAndUpdate(
            req.params.id,
            { status: 'closed', updatedAt: new Date() },
            { new: true }
        );
        
        if (!updatedCycle) {
            return res.status(404).json({ success: false, error: 'Window not found' });
        }
        
        res.json({ success: true, cycle: updatedCycle });
    } catch (error) {
        console.error('Error deactivating window:', error);
        res.status(500).json({ success: false, error: 'Failed to deactivate window' });
    }
});

// API: Delete academic window (cycle)
app.delete("/api/admin/academic-windows/:id", isAdmin, async (req, res) => {
    try {
        const AllocationCycleModel = require('./src/schemas/AllocationCycleSchema');
        
        const deletedCycle = await AllocationCycleModel.findByIdAndDelete(req.params.id);
        
        if (!deletedCycle) {
            return res.status(404).json({ success: false, error: 'Window not found' });
        }
        
        res.json({ success: true, message: 'Window deleted successfully' });
    } catch (error) {
        console.error('Error deleting window:', error);
        res.status(500).json({ success: false, error: 'Failed to delete window' });
    }
});

// Violations Page
app.get("/admin/violations", isAdmin, async (req, res) => {
    try {
        res.render("admin/violations/admin-violations", { 
            user: { 
                name: req.session.name, 
                role: req.session.role 
            } 
        });
    } catch (error) {
        console.error("Error rendering violations page:", error);
        res.status(500).send("Internal server error");
    }
});

// Student Registration Portal
app.get("/student/registration-portal", isAuthenticated, async (req, res) => {
    try {
        res.render("student/student-registration-portal", { 
            user: { 
                name: req.session.name, 
                role: req.session.role,
                id: req.session.userId
            } 
        });
    } catch (error) {
        console.error("Error rendering registration portal:", error);
        res.status(500).send("Internal server error");
    }
});

// Priority Claims Form (Student)
app.get("/student/priority-claims", isAuthenticated, async (req, res) => {
    try {
        res.render("student/priority-claims", { 
            user: { 
                name: req.session.name, 
                role: req.session.role,
                id: req.session.userId
            } 
        });
    } catch (error) {
        console.error("Error rendering priority claims:", error);
        res.status(500).send("Internal server error");
    }
});

// Priority Claims Review (Admin)
app.get("/admin/priority-claims-review", isAuthenticated, async (req, res) => {
    try {
        if (req.session.role !== 'admin') {
            return res.status(403).send("Chỉ admin có thể truy cập");
        }
        res.render("admin/priority-claims-review", { 
            user: { 
                name: req.session.name, 
                role: req.session.role,
                id: req.session.userId
            } 
        });
    } catch (error) {
        console.error("Error rendering admin priority claims review:", error);
        res.status(500).send("Internal server error");
    }
});

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
            console.log(`✓ Auto-migrated ${result.modifiedCount} violations from 'investigating' → 'pending'`);
        }
    } catch (error) {
        logger.error('Auto migration failed:', { error: error.message });
    }
}

// Run migration on startup
autoMigrateViolations();

// ============================================
// GLOBAL FUNCTIONS
// ============================================

global.sendNotificationOnEvent = sendNotificationOnEvent;
global.createActivityLog = createActivityLog;

// ============================================
// ERROR HANDLING & 404
// ============================================

// 404 Handler
app.use((req, res) => {
    // Check if it's an API request
    if (req.path.startsWith('/api/') || req.accepts('json')) {
        return res.status(404).json({ 
            error: "Not Found",
            message: "The requested resource does not exist",
            path: req.path
        });
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
    server = app.listen(portToUse, () => {
        currentPort = portToUse;
        logger.info(`Server started successfully on port ${portToUse}`, {
            env: process.env.NODE_ENV,
            nodeVersion: process.version,
        });
        console.log('🚀 Server listening on port ' + portToUse);
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

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

// Catch unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
        promise: promise.toString(),
        reason: reason.toString(),
    });
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
        message: error.message,
        stack: error.stack,
    });
    process.exit(1);
});