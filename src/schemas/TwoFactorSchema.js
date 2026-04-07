const mongoose = require('mongoose');

const TwoFactorSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
        unique: true
    },
    
    // TOTP (Google Authenticator)
    totpSecret: {
        type: String,
        default: null
    },
    totpEnabled: {
        type: Boolean,
        default: false
    },
    
    // SMS OTP
    smsOtpPhone: {
        type: String,
        default: null
    },
    smsOtpEnabled: {
        type: Boolean,
        default: false
    },
    
    // Email OTP
    emailOtpEnabled: {
        type: Boolean,
        default: false
    },
    
    // Backup codes
    backupCodes: [{
        code: String,
        used: {
            type: Boolean,
            default: false
        },
        usedAt: Date
    }],
    
    // OTP attempts
    otpAttempts: {
        type: Number,
        default: 0
    },
    otpAttemptsLocked: {
        type: Boolean,
        default: false
    },
    otpLockedUntil: Date,
    
    // Current OTP (temporary)
    currentOtp: {
        code: String,
        expiresAt: Date
    },
    
    // Recovery email/phone
    recoveryEmail: String,
    recoveryPhone: String,
    
    // Status
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('TwoFactor', TwoFactorSchema);
