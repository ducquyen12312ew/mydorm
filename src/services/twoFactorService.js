const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { logger, logSecurityEvent } = require('../config/logger');

/**
 * 2FA Service - TOTP, OTP, Backup codes management
 */
class TwoFactorService {
    /**
     * Generate TOTP secret & QR code
     */
    static async generateTOTPSecret(userEmail, appName = 'DormitoryGraduationApp') {
        try {
            const secret = speakeasy.generateSecret({
                name: `${appName} (${userEmail})`,
                issuer: appName,
                length: 32
            });

            // Generate QR code
            const qrCode = await QRCode.toDataURL(secret.otpauth_url);

            return {
                secret: secret.base32,
                qrCode: qrCode,
                manualEntry: secret.base32,
                success: true
            };
        } catch (error) {
            logger.error('TOTP secret generation failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Verify TOTP token
     */
    static verifyTOTPToken(secret, token) {
        try {
            const verified = speakeasy.totp.verify({
                secret: secret,
                encoding: 'base32',
                token: token,
                window: 2  // Allow 2 time windows (30 second window)
            });

            return verified;
        } catch (error) {
            logger.error('TOTP verification failed', { error: error.message });
            return false;
        }
    }

    /**
     * Generate OTP code (6 digits)
     */
    static generateOTPCode() {
        return crypto.randomInt(100000, 999999).toString();
    }

    /**
     * Generate backup codes (10 codes)
     */
    static generateBackupCodes(count = 10) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            codes.push({
                code: crypto.randomBytes(4).toString('hex').toUpperCase(),
                used: false
            });
        }
        return codes;
    }

    /**
     * Verify backup code
     */
    static verifyBackupCode(backupCodes, code) {
        const backupCode = backupCodes.find(
            bc => bc.code === code.toUpperCase() && !bc.used
        );

        if (!backupCode) {
            return { valid: false, message: 'Backup code không hợp lệ hoặc đã sử dụng' };
        }

        return { valid: true, backupCode: backupCode };
    }

    /**
     * Mark backup code as used
     */
    static markBackupCodeAsUsed(backupCode) {
        backupCode.used = true;
        backupCode.usedAt = new Date();
        return backupCode;
    }

    /**
     * Check OTP attempts
     */
    static checkOTPAttempts(twoFactor) {
        const maxAttempts = 5;
        const lockDuration = 15 * 60 * 1000; // 15 minutes

        if (twoFactor.otpAttemptsLocked) {
            const now = new Date();
            if (now < twoFactor.otpLockedUntil) {
                const remainingTime = Math.ceil(
                    (twoFactor.otpLockedUntil - now) / 1000
                );
                return {
                    locked: true,
                    message: `Tài khoản bị khóa. Vui lòng thử lại sau ${remainingTime} giây`,
                    remainingTime: remainingTime
                };
            } else {
                // Unlock after timeout
                twoFactor.otpAttemptsLocked = false;
                twoFactor.otpAttempts = 0;
                return { locked: false };
            }
        }

        return { locked: false };
    }

    /**
     * Increment OTP attempts
     */
    static incrementOTPAttempts(twoFactor) {
        twoFactor.otpAttempts += 1;

        if (twoFactor.otpAttempts >= 5) {
            twoFactor.otpAttemptsLocked = true;
            twoFactor.otpLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
            logSecurityEvent('2FA_LOCKED', {
                userId: twoFactor.userId,
                reason: 'Too many OTP attempts'
            });
        }

        return twoFactor;
    }

    /**
     * Reset OTP attempts
     */
    static resetOTPAttempts(twoFactor) {
        twoFactor.otpAttempts = 0;
        twoFactor.otpAttemptsLocked = false;
        twoFactor.otpLockedUntil = null;
        twoFactor.currentOtp = null;
        return twoFactor;
    }

    /**
     * Generate and store OTP
     */
    static generateAndStoreOTP(twoFactor, expirationMinutes = 10) {
        const code = this.generateOTPCode();
        twoFactor.currentOtp = {
            code: code,
            expiresAt: new Date(Date.now() + expirationMinutes * 60 * 1000)
        };
        return code;
    }

    /**
     * Verify OTP validity
     */
    static verifyOTPValidity(twoFactor, code) {
        if (!twoFactor.currentOtp || !twoFactor.currentOtp.code) {
            return { valid: false, message: 'OTP không tồn tại' };
        }

        if (new Date() > twoFactor.currentOtp.expiresAt) {
            return { valid: false, message: 'OTP đã hết hạn' };
        }

        if (twoFactor.currentOtp.code !== code) {
            return { valid: false, message: 'OTP không chính xác' };
        }

        return { valid: true };
    }

    /**
     * Get enabled 2FA methods
     */
    static getEnabledMethods(twoFactor) {
        return {
            totp: twoFactor.totpEnabled,
            smsOtp: twoFactor.smsOtpEnabled,
            emailOtp: twoFactor.emailOtpEnabled,
            hasAny: twoFactor.totpEnabled || twoFactor.smsOtpEnabled || twoFactor.emailOtpEnabled
        };
    }
}

module.exports = TwoFactorService;
