const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { StudentCollection, DormitoryCollection, PendingApplicationCollection } = require('../config/config');
const { sendNotificationOnEvent } = require('../utils/notificationHelper');
const { logger, logSecurityEvent } = require('../config/logger');
const { authLimiter, loginLimiter } = require('../middleware/security');
const { isAuthenticated } = require('../middleware/auth');

// ============================================
// AUTH PAGE RENDERS
// ============================================

router.get('/login', (req, res) => res.render('auth/login'));
router.get('/signup', (req, res) => res.render('auth/signup'));
router.get('/forgot-password', (req, res) => res.render('auth/forgot-password'));

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ============================================
// SIGNUP
// ============================================

router.post('/signup', authLimiter, async (req, res) => {
    try {
        const { username, password, name, email, phone, studentId, gender, faculty, academicYear } = req.body;

        const existingUser = await StudentCollection.findOne({ username });
        if (existingUser) {
            return res.render('auth/signup', {
                error: 'Tên đăng nhập đã tồn tại. Vui lòng chọn tên đăng nhập khác.'
            });
        }

        if (email) {
            const existingEmail = await StudentCollection.findOne({ email });
            if (existingEmail) {
                return res.render('auth/signup', {
                    error: 'Email đã được sử dụng. Vui lòng sử dụng email khác.'
                });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newStudent = await StudentCollection.create({
            username, password: hashedPassword, name, email, phone,
            studentId, gender, faculty, academicYear, role: 'user'
        });

        req.session.userId = newStudent._id;
        req.session.name = newStudent.name;
        req.session.role = newStudent.role;

        await sendNotificationOnEvent('welcome', newStudent._id, { name: newStudent.name });
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
            req.session.tempStudentId = student.studentId;
            req.session.tempRemember = remember;
            logSecurityEvent(student._id, 'LOGIN_2FA_REQUIRED', { ip: req.ip });
            return res.render('auth/2fa-login', {
                twoFAMethods: { totp: twoFactorRecord.totpEnabled, sms: twoFactorRecord.smsOtpEnabled }
            });
        }

        req.session.userId = student._id;
        req.session.name = student.name;
        req.session.role = student.role;
        req.session.studentId = student.studentId;
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
        req.session.studentId = req.session.tempStudentId;

        const tempRemember = req.session.tempRemember;
        delete req.session.tempUserId;
        delete req.session.tempName;
        delete req.session.tempRole;
        delete req.session.tempStudentId;
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
