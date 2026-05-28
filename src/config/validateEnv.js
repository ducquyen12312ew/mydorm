/**
 * Startup environment validation.
 * Called before any other module initialization in index.js.
 *
 * In production: missing/weak secrets are fatal → process.exit(1)
 * In development: missing/weak secrets are warnings, not fatal
 */
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

const INSECURE_DEFAULTS = new Set([
    'dev-secret',
    'mobile-access-secret-dev',
    'mobile-refresh-secret-dev',
    'fallback-qr-secret-change-me',
    'change-this-to-a-long-random-string-in-production',
    'change-this-mobile-access-secret-in-production',
    'change-this-mobile-refresh-secret-in-production',
    'change-this-qr-signing-secret-in-production',
]);

const errors = [];
const warnings = [];

function check(varName, { required = false, minLength = 0, notDefault = false } = {}) {
    const value = process.env[varName];

    if (!value) {
        if (required) errors.push(`${varName} is not set`);
        else warnings.push(`${varName} is not set (optional)`);
        return;
    }

    if (minLength && value.length < minLength) {
        const msg = `${varName} is too short (${value.length} chars, minimum ${minLength})`;
        if (required) errors.push(msg);
        else warnings.push(msg);
    }

    if (notDefault && INSECURE_DEFAULTS.has(value)) {
        const msg = `${varName} is using an insecure default value — generate a new secret`;
        if (isProd) errors.push(msg);
        else warnings.push(msg);
    }
}

function checkUnique(a, b) {
    const va = process.env[a];
    const vb = process.env[b];
    if (va && vb && va === vb) {
        const msg = `${a} and ${b} must NOT be the same value — use separate secrets`;
        if (isProd) errors.push(msg);
        else warnings.push(msg);
    }
}

// ── Required always ────────────────────────────────────────────────────────────
check('NODE_ENV', { required: true });

const hasMongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!hasMongoUri) {
    errors.push('MONGO_URI or MONGODB_URI must be set');
}

// ── Required in production, warned in development ──────────────────────────────
check('SESSION_SECRET',           { required: isProd, minLength: 32, notDefault: true });
check('MOBILE_JWT_ACCESS_SECRET', { required: isProd, minLength: 32, notDefault: true });
check('MOBILE_JWT_REFRESH_SECRET',{ required: isProd, minLength: 32, notDefault: true });
check('QR_SECRET',                { required: isProd, minLength: 32, notDefault: true });

// ── Uniqueness checks ──────────────────────────────────────────────────────────
checkUnique('MOBILE_JWT_ACCESS_SECRET', 'MOBILE_JWT_REFRESH_SECRET');
checkUnique('MOBILE_JWT_ACCESS_SECRET', 'QR_SECRET');
checkUnique('MOBILE_JWT_REFRESH_SECRET', 'QR_SECRET');
checkUnique('SESSION_SECRET', 'MOBILE_JWT_ACCESS_SECRET');

// ── Optional with guidance ─────────────────────────────────────────────────────
check('SENTRY_DSN', {});
check('REDIS_URL',  {});

// ── Print results ──────────────────────────────────────────────────────────────
if (warnings.length) {
    warnings.forEach(w => console.warn(`[env] WARN: ${w}`));
}

if (errors.length) {
    errors.forEach(e => console.error(`[env] ERROR: ${e}`));
    console.error(`[env] ${errors.length} environment error(s) — cannot start in ${process.env.NODE_ENV} mode`);
    process.exit(1);
}

if (!warnings.length && !errors.length) {
    console.log('[env] Environment validation passed');
}
