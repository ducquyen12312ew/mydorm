const crypto = require('crypto');
const bcrypt = require('bcrypt');

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10');
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_VERIFY_MAX_ATTEMPTS || '5');
const OTP_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN || '60');
const BCRYPT_ROUNDS = 8;

function generateOTP() {
    const min = Math.pow(10, OTP_LENGTH - 1);
    const max = Math.pow(10, OTP_LENGTH) - 1;
    return String(crypto.randomInt(min, max + 1)).padStart(OTP_LENGTH, '0');
}

async function hashOTP(otp) {
    return bcrypt.hash(otp, BCRYPT_ROUNDS);
}

async function verifyOTP(plain, hashed) {
    if (!plain || !hashed) return false;
    return bcrypt.compare(String(plain).trim(), hashed);
}

function getExpiry(minutes = OTP_EXPIRY_MINUTES) {
    return new Date(Date.now() + minutes * 60 * 1000);
}

function isExpired(expiresAt) {
    return !expiresAt || new Date() > new Date(expiresAt);
}

function canResend(lastSentAt) {
    if (!lastSentAt) return true;
    const elapsed = (Date.now() - new Date(lastSentAt).getTime()) / 1000;
    return elapsed >= OTP_COOLDOWN_SECONDS;
}

function secondsUntilResend(lastSentAt) {
    if (!lastSentAt) return 0;
    const elapsed = (Date.now() - new Date(lastSentAt).getTime()) / 1000;
    return Math.max(0, Math.ceil(OTP_COOLDOWN_SECONDS - elapsed));
}

module.exports = {
    generateOTP,
    hashOTP,
    verifyOTP,
    getExpiry,
    isExpired,
    canResend,
    secondsUntilResend,
    OTP_LENGTH,
    OTP_EXPIRY_MINUTES,
    OTP_MAX_ATTEMPTS,
    OTP_COOLDOWN_SECONDS
};
