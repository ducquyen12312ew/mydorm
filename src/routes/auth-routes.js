const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { StudentCollection, DormitoryCollection, PendingApplicationCollection } = require('../config/config');
const { sendNotificationOnEvent } = require('../utils/notificationHelper');
const { logger, logSecurityEvent } = require('../config/logger');
const { authLimiter, loginLimiter } = require('../middleware/security');
const { isAuthenticated } = require('../middleware/auth');
const passport = require('../config/passport');
const { sendVerificationEmail, sendWelcomeEmail } = require('../services/emailService');

const ALLOWED_DOMAIN = 'sis.hust.edu.vn';
const ALLOWED_EMAIL_SUFFIX = '@' + ALLOWED_DOMAIN;

// ============================================
// AUTH PAGE RENDERS
// ============================================

router.get('/login', (req, res) => {
    const oauthError = req.session.oauthError || null;
    const success = req.session.oauthSuccess || null;
    delete req.session.oauthError;
    delete req.session.oauthSuccess;
    res.render('auth/login', { oauthError, success });
});

// Signup now redirects to onboarding or shows info page
router.get('/signup', (req, res) => res.render('auth/signup'));

// ============================================
// GOOGLE OAUTH
// ============================================

router.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'], hostedDomain: ALLOWED_DOMAIN })
);

router.get('/auth/google/callback',
    (req, res, next) => {
        passport.authenticate('google', { session: false }, (err, result, info) => {
            if (err) {
                logger.error('Google OAuth callback error', { error: err.message });
                req.session.oauthError = 'Đăng nhập Google thất bại. Vui lòng thử lại.';
                return res.redirect('/login');
            }
            if (!result) {
                req.session.oauthError = (info && info.message) || `Chỉ chấp nhận email @${ALLOWED_DOMAIN}.`;
                return res.redirect('/login');
            }
            if (result.isNew) {
                req.session.oauthPending = result;
                return res.redirect('/auth/onboarding');
            }
            const { student } = result;
            req.session.userId = student._id;
            req.session.name = student.name;
            req.session.role = student.role;
            req.session.isSuperAdmin = student.isSuperAdmin === true;
            req.session.studentId = student.studentId;
            logSecurityEvent(student._id, 'LOGIN_GOOGLE', { ip: req.ip });
            req.session.save(() => res.redirect(student.role === 'admin' ? '/admin/dormitories' : '/'));
        })(req, res, next);
    }
);

// ============================================
// MICROSOFT OAUTH
// ============================================

router.get('/auth/microsoft', (req, res, next) => {
    const hint = req.query.hint || '';
    if (hint && !hint.toLowerCase().endsWith(ALLOWED_EMAIL_SUFFIX)) {
        req.session.oauthError = `Chỉ chấp nhận email @${ALLOWED_DOMAIN}. Vui lòng dùng email trường của bạn.`;
        return res.redirect('/login');
    }
    const options = { session: false };
    if (hint) options.login_hint = hint;
    passport.authenticate('microsoft', options)(req, res, next);
});

router.get('/auth/microsoft/callback',
    (req, res, next) => {
        passport.authenticate('microsoft', { session: false }, (err, result, info) => {
            if (err) {
                logger.error('Microsoft OAuth callback error', { error: err.message });
                req.session.oauthError = 'Đăng nhập Microsoft thất bại. Vui lòng thử lại.';
                return res.redirect('/login');
            }
            if (!result) {
                req.session.oauthError = (info && info.message) || `Chỉ chấp nhận email @${ALLOWED_DOMAIN}.`;
                return res.redirect('/login');
            }
            if (result.isNew) {
                req.session.oauthPending = result;
                return res.redirect('/auth/onboarding');
            }
            const { student } = result;
            req.session.userId = student._id;
            req.session.name = student.name;
            req.session.role = student.role;
            req.session.isSuperAdmin = student.isSuperAdmin === true;
            req.session.studentId = student.studentId;
            logSecurityEvent(student._id, 'LOGIN_MICROSOFT', { ip: req.ip });
            req.session.save(() => res.redirect(student.role === 'admin' ? '/admin/dormitories' : '/'));
        })(req, res, next);
    }
);

// ============================================
// ONBOARDING (after first OAuth login)
// ============================================

router.get('/auth/onboarding', (req, res) => {
    if (!req.session.oauthPending) return res.redirect('/login');
    const { email, name, oauthProvider } = req.session.oauthPending;
    res.render('auth/onboarding', { email, name, oauthProvider, error: null });
});

router.post('/auth/onboarding', authLimiter, async (req, res) => {
    if (!req.session.oauthPending) return res.redirect('/login');

    const pending = req.session.oauthPending;
    const { studentId, name, phone, gender, faculty, academicYear } = req.body;

    if (!studentId || !name) {
        return res.render('auth/onboarding', {
            email: pending.email,
            name: pending.name,
            oauthProvider: pending.oauthProvider,
            error: 'Vui lòng điền đầy đủ MSSV và họ tên.'
        });
    }

    // Validate @sis.hust.edu.vn
    if (!pending.email.endsWith(ALLOWED_EMAIL_SUFFIX)) {
        delete req.session.oauthPending;
        req.session.oauthError = `Chỉ chấp nhận email @${ALLOWED_DOMAIN}.`;
        return res.redirect('/login');
    }

    try {
        const existing = await StudentCollection.findOne({
            $or: [{ studentId }, { email: pending.email }]
        });
        if (existing) {
            return res.render('auth/onboarding', {
                email: pending.email,
                name,
                oauthProvider: pending.oauthProvider,
                error: existing.studentId === studentId
                    ? 'MSSV này đã được đăng ký. Liên hệ quản trị viên nếu có vấn đề.'
                    : 'Email này đã được đăng ký. Hãy đăng nhập bình thường.'
            });
        }

        const verifyToken = crypto.randomBytes(32).toString('hex');
        const randomPass = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

        const student = await StudentCollection.create({
            username: pending.email,
            password: randomPass,
            name,
            email: pending.email,
            phone,
            studentId,
            gender,
            faculty,
            academicYear,
            oauthProvider: pending.oauthProvider,
            oauthId: pending.oauthId,
            emailVerified: true,   // OAuth provider already verified the email
            onboardingComplete: true,
            role: 'user'
        });

        delete req.session.oauthPending;

        // Send welcome email (non-blocking, best-effort)
        sendWelcomeEmail(student.email, student.name).catch(e =>
            logger.warn('Welcome email send failed (non-fatal)', { error: e.message })
        );

        req.session.userId = student._id;
        req.session.name = student.name;
        req.session.role = student.role;
        req.session.studentId = student.studentId;

        // Non-blocking welcome notification
        sendNotificationOnEvent('welcome', student._id, { name: student.name }).catch(e =>
            logger.warn('Welcome notification failed (non-fatal)', { error: e.message })
        );
        logSecurityEvent(student._id, 'REGISTER_OAUTH', { provider: pending.oauthProvider, ip: req.ip });

        req.session.save(() => res.redirect('/'));
    } catch (err) {
        logger.error('Onboarding error', { error: err.message });
        res.render('auth/onboarding', {
            email: pending.email,
            name,
            oauthProvider: pending.oauthProvider,
            error: 'Có lỗi xảy ra. Vui lòng thử lại.'
        });
    }
});

// ============================================
// EMAIL VERIFICATION
// ============================================

router.get('/auth/verify-email', async (req, res) => {
    // Token-based verification is simplified: mark as verified
    // In production, store token in DB and validate here
    res.render('auth/verify-email', { verified: true });
});
router.get('/forgot-password', (req, res) => res.render('auth/forgot-password'));

router.get('/logout', async (req, res) => {
    const userId = req.session?.userId;
    const username = req.session?.username;

    // Archive simulation workspace for admintest on logout
    if (username === 'admintest' && userId) {
        try {
            const SimulationWorkspaceService = require('../services/simulationWorkspaceService');
            await SimulationWorkspaceService.archiveExistingWorkspaces(userId);
        } catch (err) {
            logger.warn('Failed to archive simulation workspace on logout', { error: err.message });
        }
    }

    req.session.destroy();
    res.redirect('/login');
});

// ============================================
// SIGNUP
// ============================================

router.post('/signup', authLimiter, async (req, res) => {
    try {
        const { username, password, name, email, phone, studentId, gender, faculty, academicYear } = req.body;

        // ── MSSV validation (backend, required) ──
        if (!studentId || !studentId.trim()) {
            return res.render('auth/signup', { error: 'Vui lòng nhập mã số sinh viên.' });
        }
        if (!/^\d{8}$/.test(studentId.trim())) {
            return res.render('auth/signup', { error: 'Mã số sinh viên không hợp lệ. Vui lòng nhập đúng 8 chữ số.' });
        }
        if (!name || !name.trim()) {
            return res.render('auth/signup', { error: 'Vui lòng nhập họ tên.' });
        }
        if (!password || password.length < 8) {
            return res.render('auth/signup', { error: 'Mật khẩu phải có ít nhất 8 ký tự.' });
        }

        // ── Duplicate MSSV check ──
        const existingStudentId = await StudentCollection.findOne({ studentId: studentId.trim() });
        if (existingStudentId) {
            return res.render('auth/signup', { error: 'Mã số sinh viên đã được sử dụng.' });
        }

        // For manual signup: username = studentId
        const resolvedUsername = username || studentId.trim();
        const existingUser = await StudentCollection.findOne({ username: resolvedUsername });
        if (existingUser) {
            return res.render('auth/signup', { error: 'Tên đăng nhập đã tồn tại. Vui lòng chọn tên đăng nhập khác.' });
        }

        if (email) {
            const existingEmail = await StudentCollection.findOne({ email });
            if (existingEmail) {
                return res.render('auth/signup', { error: 'Email đã được sử dụng. Vui lòng sử dụng email khác.' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newStudent = await StudentCollection.create({
            username: resolvedUsername, password: hashedPassword, name: name.trim(), email, phone,
            studentId: studentId.trim(), gender, faculty, academicYear, role: 'user'
        });

        req.session.userId = newStudent._id;
        req.session.name = newStudent.name;
        req.session.role = newStudent.role;
        req.session.studentId = newStudent.studentId;

        await sendNotificationOnEvent('welcome', newStudent._id, { name: newStudent.name }).catch(() => {});
        res.redirect('/');
    } catch (error) {
        logger.error('Error during signup', { error: error.message });
        res.render('auth/signup', {
            error: 'Đã xảy ra lỗi trong quá trình đăng ký. Vui lòng thử lại.'
        });
    }
});

// ============================================
// LOGIN
// ============================================

router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { username, password, remember } = req.body;

        const student = await StudentCollection.findOne({ username });
        if (!student) {
            logSecurityEvent(null, 'LOGIN_FAILED', { username, reason: 'user_not_found', ip: req.ip });
            return res.render('auth/login', { error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
        }

        const isPasswordValid = await bcrypt.compare(password, student.password);
        if (!isPasswordValid) {
            logSecurityEvent(student._id, 'LOGIN_FAILED', { reason: 'invalid_password', ip: req.ip });
            return res.render('auth/login', { error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
        }

        const TwoFactor = require('../schemas/TwoFactorSchema');
        const twoFactorRecord = await TwoFactor.findOne({ userId: student._id });
        const twoFAEnabled = twoFactorRecord && (twoFactorRecord.totpEnabled || twoFactorRecord.smsOtpEnabled);

        if (twoFAEnabled) {
            req.session.tempUserId = student._id;
            req.session.tempName = student.name;
            req.session.tempRole = student.role;
            req.session.tempIsSuperAdmin = student.isSuperAdmin === true;
            req.session.tempStudentId = student.studentId;
            req.session.tempUsername = student.username;
            req.session.tempRemember = remember;
            logSecurityEvent(student._id, 'LOGIN_2FA_REQUIRED', { ip: req.ip });
            return res.render('auth/2fa-login', {
                twoFAMethods: { totp: twoFactorRecord.totpEnabled, sms: twoFactorRecord.smsOtpEnabled }
            });
        }

        req.session.userId = student._id;
        req.session.name = student.name;
        req.session.role = student.role;
        req.session.isSuperAdmin = student.isSuperAdmin === true;
        req.session.studentId = student.studentId;
        req.session.username = student.username;
        if (remember) {
            req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
        }

        req.session.save((err) => {
            if (err) {
                logger.error('Session save error', { error: err.message });
                return res.render('auth/login', {
                    error: 'Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại.'
                });
            }
            logSecurityEvent(student._id, 'LOGIN_SUCCESS', { ip: req.ip });
            return res.redirect(student.role === 'admin' ? '/admin/dormitories' : '/');
        });
    } catch (error) {
        logger.error('Error during login', { error: error.message });
        res.render('auth/login', {
            error: 'Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại.'
        });
    }
});

// ============================================
// 2FA VERIFICATION (after login)
// ============================================

router.post('/api/auth/verify-2fa', async (req, res) => {
    try {
        const { code, useBackupCode } = req.body;

        if (!req.session.tempUserId) {
            logSecurityEvent(null, '2FA_INVALID_SESSION', { ip: req.ip });
            return res.status(401).json({ error: 'Session không hợp lệ' });
        }

        const TwoFactor = require('../schemas/TwoFactorSchema');
        const TwoFactorService = require('../services/twoFactorService');

        const twoFactorRecord = await TwoFactor.findOne({ userId: req.session.tempUserId });
        if (!twoFactorRecord) {
            return res.status(400).json({ error: '2FA chưa được cấu hình' });
        }

        let verified = false;

        if (useBackupCode) {
            verified = TwoFactorService.verifyBackupCode(twoFactorRecord.backupCodes, code);
            if (verified) {
                TwoFactorService.markBackupCodeAsUsed(twoFactorRecord.backupCodes, code);
                await twoFactorRecord.save();
                logSecurityEvent(req.session.tempUserId, '2FA_BACKUP_CODE_USED', { ip: req.ip });
            }
        } else {
            if (twoFactorRecord.totpEnabled) {
                verified = TwoFactorService.verifyTOTPToken(twoFactorRecord.totpSecret, code);
            } else if (twoFactorRecord.smsOtpEnabled) {
                verified = TwoFactorService.verifyOTPValidity(twoFactorRecord, code);
            }
        }

        if (!verified) {
            TwoFactorService.checkOTPAttempts(twoFactorRecord);
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
            logSecurityEvent(req.session.tempUserId, '2FA_VERIFICATION_FAILED', { attemptsRemaining, ip: req.ip });
            return res.status(401).json({
                error: `Mã xác minh không đúng. Còn ${attemptsRemaining} lần thử`,
                attemptsRemaining
            });
        }

        TwoFactorService.resetOTPAttempts(twoFactorRecord);
        await twoFactorRecord.save();

        req.session.userId = req.session.tempUserId;
        req.session.name = req.session.tempName;
        req.session.role = req.session.tempRole;
        req.session.isSuperAdmin = req.session.tempIsSuperAdmin === true;
        req.session.studentId = req.session.tempStudentId;
        req.session.username = req.session.tempUsername;

        const tempRemember = req.session.tempRemember;
        delete req.session.tempUserId;
        delete req.session.tempName;
        delete req.session.tempRole;
        delete req.session.tempStudentId;
        delete req.session.tempUsername;
        delete req.session.tempRemember;

        if (tempRemember) {
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

// ============================================
// FORGOT PASSWORD
// ============================================

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const student = await StudentCollection.findOne({ email });
        if (!student) {
            return res.render('auth/forgot-password', { error: 'Email không tồn tại trong hệ thống' });
        }
        res.render('auth/forgot-password', {
            success: 'Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn'
        });
    } catch (error) {
        logger.error('Error during forgot password', { error: error.message });
        res.render('auth/forgot-password', { error: 'Đã xảy ra lỗi. Vui lòng thử lại.' });
    }
});

// ============================================
// STUDENT PAGES
// ============================================

router.get('/home', isAuthenticated, (req, res) => {
    if (req.session.role === 'admin') return res.redirect('/admin/dormitories');
    res.render('student/home', {
        user: { name: req.session.name, role: req.session.role, id: req.session.userId }
    });
});

router.get('/register', isAuthenticated, (req, res) => {
    res.render('student/register', {
        user: { name: req.session.name, role: req.session.role, id: req.session.userId }
    });
});

router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const success = req.query.success;
        const error = req.query.error;

        const msgMap = {
            profile_updated: { type: 'success', text: 'Thông tin cá nhân đã được cập nhật thành công.' },
            password_changed: { type: 'success', text: 'Mật khẩu đã được thay đổi thành công.' },
            email_exists: { type: 'error', text: 'Email này đã được sử dụng bởi tài khoản khác.' },
            update_failed: { type: 'error', text: 'Có lỗi xảy ra khi cập nhật thông tin.' },
            passwords_dont_match: { type: 'error', text: 'Mật khẩu mới và xác nhận mật khẩu không khớp.' },
            incorrect_password: { type: 'error', text: 'Mật khẩu hiện tại không đúng.' },
            password_change_failed: { type: 'error', text: 'Có lỗi xảy ra khi thay đổi mật khẩu.' }
        };
        const message = msgMap[success] || msgMap[error] || null;

        const student = await StudentCollection.findById(req.session.userId);
        if (!student) return res.redirect('/login');

        let dormitory = null;
        let room = null;
        if (student.dormitoryId) {
            dormitory = await DormitoryCollection.findById(student.dormitoryId);
            if (dormitory && student.roomNumber) {
                for (const floor of dormitory.floors) {
                    const foundRoom = floor.rooms.find(r => r.roomNumber === student.roomNumber);
                    if (foundRoom) { room = foundRoom; break; }
                }
            }
        }

        const applications = await PendingApplicationCollection.find({ studentId: student.studentId })
            .sort({ createdAt: -1 }).limit(5);

        res.render('student/profile', {
            student, dormitory, room, applications, message,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        logger.error('Error fetching profile', { error: error.message });
        res.status(500).send('Internal server error');
    }
});

router.get('/profile/2fa', isAuthenticated, async (req, res) => {
    try {
        const student = await StudentCollection.findById(req.session.userId);
        if (!student) return res.redirect('/login');
        res.render('2fa-setup', {
            user: { name: req.session.name, role: req.session.role, email: student.email }
        });
    } catch (error) {
        logger.error('Error loading 2FA setup', { error: error.message });
        res.status(500).send('Internal server error');
    }
});

router.post('/update-profile', isAuthenticated, async (req, res) => {
    try {
        const { name, studentId, email, phone, faculty, academicYear, gender } = req.body;

        const student = await StudentCollection.findById(req.session.userId);
        if (!student) return res.redirect('/login');

        if (name && name !== student.name) req.session.name = name;

        if (email && email !== student.email) {
            const existingEmail = await StudentCollection.findOne({ email, _id: { $ne: req.session.userId } });
            if (existingEmail) return res.redirect('/profile?error=email_exists');
        }

        await StudentCollection.findByIdAndUpdate(req.session.userId, {
            name, studentId, email, phone, faculty, academicYear, gender
        });

        res.redirect('/profile?success=profile_updated');
    } catch (error) {
        logger.error('Error updating profile', { error: error.message });
        res.redirect('/profile?error=update_failed');
    }
});

router.post('/change-password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (newPassword !== confirmPassword) return res.redirect('/profile?error=passwords_dont_match');

        const student = await StudentCollection.findById(req.session.userId);
        if (!student) return res.redirect('/login');

        const isPasswordValid = await bcrypt.compare(currentPassword, student.password);
        if (!isPasswordValid) return res.redirect('/profile?error=incorrect_password');

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await StudentCollection.findByIdAndUpdate(req.session.userId, { password: hashedPassword });

        res.redirect('/profile?success=password_changed');
    } catch (error) {
        logger.error('Error changing password', { error: error.message });
        res.redirect('/profile?error=password_change_failed');
    }
});

module.exports = router;
