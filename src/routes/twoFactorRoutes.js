const express = require('express');
const router = express.Router();
const TwoFactor = require('../schemas/TwoFactorSchema');
const TwoFactorService = require('../services/twoFactorService');
const notificationService = require('../services/notificationService');
const { logger, logSecurityEvent } = require('../config/logger');

// Middleware: Check if user is authenticated
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

/**
 * GET /2fa/status - Get user's 2FA status
 */
router.get('/status', requireAuth, async (req, res) => {
    try {
        let twoFactor = await TwoFactor.findOne({ userId: req.session.userId });

        if (!twoFactor) {
            return res.json({
                enabled: false,
                methods: {
                    totp: false,
                    smsOtp: false,
                    emailOtp: false
                }
            });
        }

        res.json({
            enabled: twoFactor.totpEnabled || twoFactor.smsOtpEnabled || twoFactor.emailOtpEnabled,
            methods: TwoFactorService.getEnabledMethods(twoFactor),
            hasBackupCodes: twoFactor.backupCodes && twoFactor.backupCodes.length > 0,
            recoveryEmail: twoFactor.recoveryEmail ? twoFactor.recoveryEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3') : null
        });
    } catch (error) {
        logger.error('2FA status check failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to check 2FA status' });
    }
});

/**
 * POST /2fa/backup-codes - Get backup codes (requires password verification)
 */
router.post('/backup-codes', requireAuth, async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        // Verify password
        const StudentCollection = require('../config/config').StudentCollection;
        const bcrypt = require('bcryptjs');
        const student = await StudentCollection.findById(req.session.userId);

        if (!student || !(await bcrypt.compare(password, student.password))) {
            return res.status(401).json({ error: 'Mật khẩu không đúng' });
        }

        // Get backup codes
        const twoFactor = await TwoFactor.findOne({ userId: req.session.userId });

        if (!twoFactor || !twoFactor.totpEnabled) {
            return res.status(400).json({ error: '2FA chưa được bật' });
        }

        logSecurityEvent(req.session.userId, '2FA_BACKUP_CODES_VIEWED', {
            ip: req.ip
        });

        res.json({
            success: true,
            backupCodes: twoFactor.backupCodes
        });
    } catch (error) {
        logger.error('Backup codes retrieval failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to get backup codes' });
    }
});

/**
 * POST /2fa/setup/totp - Setup TOTP (Google Authenticator)
 */
router.post('/setup/totp', requireAuth, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Generate TOTP secret
        const { secret, qrCode } = await TwoFactorService.generateTOTPSecret(email);

        // Store temporary secret (not enabled yet)
        let twoFactor = await TwoFactor.findOne({ userId: req.session.userId });
        if (!twoFactor) {
            twoFactor = new TwoFactor({ userId: req.session.userId });
        }

        twoFactor.totpSecret = secret;

        await twoFactor.save();

        logger.info('TOTP setup initiated', { userId: req.session.userId });

        res.json({
            secret: secret,
            qrCode: qrCode,
            manualEntry: secret,
            message: 'Quét mã QR bằng ứng dụng authenticator của bạn hoặc nhập khóa thủ công'
        });
    } catch (error) {
        logger.error('TOTP setup failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to setup TOTP' });
    }
});

/**
 * POST /2fa/verify/totp - Verify and enable TOTP
 */
router.post('/verify/totp', requireAuth, async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        let twoFactor = await TwoFactor.findOne({ userId: req.session.userId });

        if (!twoFactor || !twoFactor.totpSecret) {
            return res.status(400).json({ error: 'TOTP not setup. Please setup first' });
        }

        // Verify token
        const verified = TwoFactorService.verifyTOTPToken(twoFactor.totpSecret, token);

        if (!verified) {
            return res.status(400).json({ error: 'Invalid token' });
        }

        // Enable TOTP
        twoFactor.totpEnabled = true;

        // Generate backup codes
        const backupCodes = TwoFactorService.generateBackupCodes();
        twoFactor.backupCodes = backupCodes;

        await twoFactor.save();

        logSecurityEvent(req.session.userId, '2FA_TOTP_ENABLED', { ip: req.ip || 'unknown' });

        // Send notification email
        try {
            await notificationService.send2FAEnabledNotification(req.body.email, 'totp');
        } catch (e) {
            logger.warn('Failed to send 2FA notification email', { error: e.message });
        }

        res.json({
            success: true,
            message: 'TOTP enabled successfully',
            backupCodes: backupCodes.map(bc => bc.code),
            warning: 'Lưu các mã backup này ở nơi an toàn. Bạn sẽ cần chúng nếu mất quyền truy cập vào authenticator'
        });
    } catch (error) {
        logger.error('TOTP verification failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to verify TOTP' });
    }
});

/**
 * POST /2fa/setup/sms - Setup SMS OTP
 */
router.post('/setup/sms', requireAuth, async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        let twoFactor = await TwoFactor.findOne({ userId: req.session.userId });
        if (!twoFactor) {
            twoFactor = new TwoFactor({ userId: req.session.userId });
        }

        // Generate and send OTP
        const otp = TwoFactorService.generateAndStoreOTP(twoFactor, 10);

        try {
            await notificationService.sendOTPSMS(phone, otp);
        } catch (error) {
            logger.error('Failed to send OTP SMS', { error: error.message });
            return res.status(500).json({ error: 'Failed to send OTP' });
        }

        twoFactor.smsOtpPhone = phone;
        await twoFactor.save();

        logger.info('SMS OTP sent', { userId: req.session.userId, phone });

        res.json({
            message: 'OTP đã được gửi đến số điện thoại của bạn',
            expiresIn: 600  // 10 minutes in seconds
        });
    } catch (error) {
        logger.error('SMS setup failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to setup SMS OTP' });
    }
});

/**
 * POST /2fa/verify/sms - Verify SMS OTP
 */
router.post('/verify/sms', requireAuth, async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Code is required' });
        }

        let twoFactor = await TwoFactor.findOne({ userId: req.session.userId });

        if (!twoFactor) {
            return res.status(400).json({ error: 'SMS OTP not setup' });
        }

        // Check attempts
        const attemptCheck = TwoFactorService.checkOTPAttempts(twoFactor);
        if (attemptCheck.locked) {
            return res.status(429).json({
                error: attemptCheck.message,
                locked: true
            });
        }

        // Verify OTP
        const otpValid = TwoFactorService.verifyOTPValidity(twoFactor, code);

        if (!otpValid.valid) {
            twoFactor = TwoFactorService.incrementOTPAttempts(twoFactor);
            await twoFactor.save();
            return res.status(400).json({
                error: otpValid.message,
                attemptsRemaining: 5 - twoFactor.otpAttempts
            });
        }

        // Enable SMS OTP
        twoFactor.smsOtpEnabled = true;
        twoFactor = TwoFactorService.resetOTPAttempts(twoFactor);

        // Generate backup codes
        const backupCodes = TwoFactorService.generateBackupCodes();
        twoFactor.backupCodes = backupCodes;

        await twoFactor.save();

        logSecurityEvent('2FA_SMS_ENABLED', {
            userId: req.session.userId
        });

        res.json({
            success: true,
            message: 'SMS OTP enabled successfully',
            backupCodes: backupCodes.map(bc => bc.code)
        });
    } catch (error) {
        logger.error('SMS verification failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to verify SMS OTP' });
    }
});

/**
 * POST /2fa/quick-enable - Quick enable 2FA with default TOTP (pending verification)
 */
router.post('/quick-enable', requireAuth, async (req, res) => {
    try {
        // Get student email
        const StudentCollection = require('../config/config').StudentCollection;
        const student = await StudentCollection.findById(req.session.userId);
        
        if (!student || !student.email) {
            return res.status(400).json({ error: 'Student email not found' });
        }

        // Generate TOTP secret
        const secret = await TwoFactorService.generateTOTPSecret(student.email);
        
        if (!secret || !secret.qrCode) {
            logger.error('Failed to generate QR code', { userId: req.session.userId, secret });
            return res.status(500).json({ error: 'Failed to generate QR code' });
        }
        
        let twoFactor = await TwoFactor.findOne({ userId: req.session.userId });

        if (!twoFactor) {
            twoFactor = new TwoFactor({ userId: req.session.userId });
        }

        twoFactor.totpSecret = secret.secret;
        twoFactor.totpEnabled = false; // NOT enabled yet - need verification first

        // Generate backup codes
        const backupCodes = TwoFactorService.generateBackupCodes();
        twoFactor.backupCodes = backupCodes;

        await twoFactor.save();

        logSecurityEvent(req.session.userId, '2FA_SETUP_STARTED', {
            ip: req.ip
        });

        // Return QR code and secret for Google Authenticator setup
        res.json({
            success: true,
            message: 'Quét QR code và xác nhận để hoàn tất',
            needsVerification: true,
            setup: {
                qrCode: secret.qrCode,
                secret: secret.secret
            }
        });
    } catch (error) {
        logger.error('Quick enable 2FA failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to enable 2FA' });
    }
});

/**
 * POST /2fa/verify-and-enable - Verify TOTP code and enable 2FA
 */
router.post('/verify-and-enable', requireAuth, async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: 'Mã xác thực không được để trống' });
        }

        const twoFactor = await TwoFactor.findOne({ userId: req.session.userId });

        if (!twoFactor || !twoFactor.totpSecret) {
            return res.status(400).json({ error: 'Chưa thiết lập 2FA. Vui lòng bật lại.' });
        }

        if (twoFactor.totpEnabled) {
            return res.status(400).json({ error: '2FA đã được bật rồi' });
        }

        // Verify TOTP code
        const isValid = TwoFactorService.verifyTOTPToken(twoFactor.totpSecret, code);

        if (!isValid) {
            return res.status(400).json({ error: 'Mã xác thực không đúng. Vui lòng thử lại.' });
        }

        // Enable 2FA
        twoFactor.totpEnabled = true;
        await twoFactor.save();

        logSecurityEvent(req.session.userId, '2FA_ENABLED', {
            ip: req.ip
        });

        res.json({
            success: true,
            message: '2FA đã được bật thành công!'
        });
    } catch (error) {
        logger.error('2FA verification failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to verify 2FA' });
    }
});

/**
 * POST /2fa/disable - Disable 2FA
 */
router.post('/disable', requireAuth, async (req, res) => {
    try {
        const { password } = req.body;
        // TODO: Verify password before disabling 2FA

        let twoFactor = await TwoFactor.findOne({ userId: req.session.userId });

        if (!twoFactor) {
            return res.status(400).json({ error: '2FA not enabled' });
        }

        // Get user email for notification
        const StudentCollection = require('../config/config').StudentCollection;
        const user = await StudentCollection.findById(req.session.userId);

        twoFactor.totpEnabled = false;
        twoFactor.smsOtpEnabled = false;
        twoFactor.emailOtpEnabled = false;
        twoFactor.totpSecret = null;
        twoFactor.backupCodes = [];

        await twoFactor.save();

        logSecurityEvent(req.session.userId, '2FA_DISABLED', {
            ip: req.ip
        });

        // ✅ Send 2FA disabled notification email
        try {
            const StudentCollection = require('../config/config').StudentCollection;
            const student = await StudentCollection.findById(req.session.userId);
            if (student && student.email) {
                const { sendEmail } = require('../utils/sendEmail');
                await sendEmail(
                    student.email,
                    '🔓 Two-Factor Authentication Đã Bị Tắt',
                    `
                    <html>
                        <body style="font-family: Arial, sans-serif; color: #333;">
                            <h2>Two-Factor Authentication Đã Bị Tắt</h2>
                            <p>Xin chào <strong>${student.name}</strong>,</p>
                            <p>Two-Factor Authentication (2FA) của bạn vừa bị tắt.</p>
                            <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
                                <strong>⚠️ Lưu ý:</strong> Tài khoản của bạn hiện tại chỉ được bảo vệ bằng mật khẩu. 
                                Chúng tôi khuyến nghị bạn kích hoạt lại 2FA để bảo vệ tài khoản.
                            </div>
                            <p>Nếu bạn không thực hiện tác vụ này, vui lòng liên hệ ngay với bộ phận hỗ trợ.</p>
                            <p>Thời gian: ${new Date().toLocaleString('vi-VN')}</p>
                            <p>---<br>Hệ thống Quản Lý Ký Túc Xá HUST</p>
                        </body>
                    </html>
                    `
                );
            }
        } catch (emailError) {
            logger.warn('Failed to send 2FA disabled notification', { error: emailError.message });
        }

        res.json({ success: true, message: '2FA disabled successfully' });
    } catch (error) {
        logger.error('2FA disable failed', { userId: req.session.userId, error: error.message });
        res.status(500).json({ error: 'Failed to disable 2FA' });
    }
});

/**
 * POST /2fa/login - 2FA login verification
 */
router.post('/login', async (req, res) => {
    try {
        const { userId, code, useBackupCode } = req.body;

        if (!userId || !code) {
            return res.status(400).json({ error: 'User ID and code are required' });
        }

        const twoFactor = await TwoFactor.findOne({ userId: userId });

        if (!twoFactor || !TwoFactorService.getEnabledMethods(twoFactor).hasAny) {
            return res.status(400).json({ error: '2FA not enabled for this user' });
        }

        let verified = false;

        // Check if using backup code
        if (useBackupCode) {
            const backupCodeResult = TwoFactorService.verifyBackupCode(twoFactor.backupCodes, code);
            if (backupCodeResult.valid) {
                TwoFactorService.markBackupCodeAsUsed(backupCodeResult.backupCode);
                verified = true;
            }
        } else {
            // Check TOTP
            if (twoFactor.totpEnabled && TwoFactorService.verifyTOTPToken(twoFactor.totpSecret, code)) {
                verified = true;
            }
        }

        if (!verified) {
            logSecurityEvent('2FA_LOGIN_FAILED', {
                userId: userId,
                useBackupCode: useBackupCode
            });
            return res.status(401).json({ error: 'Invalid 2FA code' });
        }

        await twoFactor.save();

        logSecurityEvent('2FA_LOGIN_SUCCESS', {
            userId: userId
        });

        // Return success - caller should set session
        res.json({
            success: true,
            verified: true,
            message: '2FA verification successful'
        });
    } catch (error) {
        logger.error('2FA login verification failed', { error: error.message });
        res.status(500).json({ error: 'Failed to verify 2FA code' });
    }
});

module.exports = router;
