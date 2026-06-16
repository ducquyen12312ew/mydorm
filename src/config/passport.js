const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { StudentCollection } = require('./config');
const { logger } = require('./logger');

const ALLOWED_DOMAIN = 'sis.hust.edu.vn';

function isAllowedEmail(email) {
    return email && email.toLowerCase().endsWith('@' + ALLOWED_DOMAIN);
}

// ============================================
// GOOGLE STRATEGY
// ============================================
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL
            || (process.env.APP_URL ? `${process.env.APP_URL}/auth/google/callback` : 'http://localhost:5000/auth/google/callback'),
        scope: ['profile', 'email'],
        hostedDomain: ALLOWED_DOMAIN
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails && profile.emails[0]
                ? profile.emails[0].value.toLowerCase()
                : null;

            if (!email || !isAllowedEmail(email)) {
                return done(null, false, {
                    message: `Chỉ chấp nhận email @${ALLOWED_DOMAIN}. Email của bạn (${email || 'không rõ'}) không được phép.`
                });
            }

            let student = await StudentCollection.findOne({
                $or: [
                    { oauthId: profile.id, oauthProvider: 'google' },
                    { email }
                ]
            });

            if (student) {
                if (!student.oauthId) {
                    student.oauthId = profile.id;
                    student.oauthProvider = 'google';
                    student.emailVerified = true;
                    await student.save();
                }
                return done(null, { student, isNew: false });
            }

            // New user — pass profile to onboarding
            const pendingProfile = {
                oauthProvider: 'google',
                oauthId: profile.id,
                email,
                name: profile.displayName || '',
                avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
                isNew: true
            };
            return done(null, pendingProfile);
        } catch (err) {
            logger.error('Google OAuth error', { error: err.message });
            return done(err);
        }
    }));
} else {
    logger.warn('Google OAuth not configured — GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing');
}

// ============================================
// MICROSOFT STRATEGY
// ============================================
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
    passport.use(new MicrosoftStrategy({
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: process.env.MICROSOFT_CALLBACK_URL
            || (process.env.APP_URL ? `${process.env.APP_URL}/auth/microsoft/callback` : 'http://localhost:5000/auth/microsoft/callback'),
        scope: ['user.read', 'openid', 'profile', 'email'],
        tenant: 'common'
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = (profile.emails && profile.emails[0]
                ? profile.emails[0].value
                : profile._json && profile._json.mail
                    ? profile._json.mail
                    : null
            );
            const normalizedEmail = email ? email.toLowerCase() : null;

            if (!normalizedEmail || !isAllowedEmail(normalizedEmail)) {
                return done(null, false, {
                    message: `Chỉ chấp nhận email @${ALLOWED_DOMAIN}. Email của bạn (${normalizedEmail || 'không rõ'}) không được phép.`
                });
            }

            let student = await StudentCollection.findOne({
                $or: [
                    { oauthId: profile.id, oauthProvider: 'microsoft' },
                    { email: normalizedEmail }
                ]
            });

            if (student) {
                // Merge OAuth info if account was created without it
                if (!student.oauthId) {
                    student.oauthId = profile.id;
                    student.oauthProvider = 'microsoft';
                    student.emailVerified = true;
                    await student.save();
                }
                return done(null, { student, isNew: false });
            }

            // New user — auto-create account immediately (no onboarding form needed)
            // Microsoft is a trusted auth provider; emailVerified = true
            try {
                const randomPass = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
                const newStudent = await StudentCollection.create({
                    username: normalizedEmail,
                    email: normalizedEmail,
                    name: profile.displayName || normalizedEmail.split('@')[0],
                    password: randomPass,
                    oauthProvider: 'microsoft',
                    oauthId: profile.id,
                    emailVerified: true,
                    onboardingComplete: true,
                    role: 'user'
                });
                logger.info('Microsoft OAuth auto-created user', { email: normalizedEmail });
                return done(null, { student: newStudent, isNew: false });
            } catch (createErr) {
                logger.error('Microsoft OAuth auto-create failed', { error: createErr.message });
                return done(createErr);
            }
        } catch (err) {
            logger.error('Microsoft OAuth error', { error: err.message });
            return done(err);
        }
    }));
} else {
    logger.warn('Microsoft OAuth not configured — MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET missing');
}

// Passport serialize/deserialize — not used for session (we use express-session directly)
// but passport requires these to be defined
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

module.exports = passport;
