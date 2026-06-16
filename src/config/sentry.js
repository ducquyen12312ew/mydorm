/**
 * Sentry initialization — must be required BEFORE all other modules in index.js.
 * Sentry instruments require() calls at load time to auto-instrument mongoose,
 * http, and other modules. Late initialization misses those hooks.
 */
require('dotenv').config();
const Sentry = require('@sentry/node');

const dsn = process.env.SENTRY_DSN;
const env = process.env.NODE_ENV || 'development';

if (!dsn) {
    // Not a fatal error — app works without Sentry, just no crash reporting
    console.warn('[Sentry] SENTRY_DSN not set — error reporting disabled');
}

Sentry.init({
    dsn: dsn || undefined,
    environment: env,
    release: process.env.npm_package_version
        ? `dormitory-backend@${process.env.npm_package_version}`
        : undefined,

    integrations: [
        // Auto-instruments mongoose queries as Sentry spans
        Sentry.mongooseIntegration(),
        // Auto-instruments http module
        Sentry.httpIntegration({ breadcrumbs: true }),
    ],

    // Sample 100% of traces in dev, 10% in production to control volume
    tracesSampleRate: env === 'production' ? 0.1 : 1.0,

    // Attach request data (IP, user agent, headers) to error events
    sendDefaultPii: false, // keep PII out of Sentry by default

    // Filter out noise
    ignoreErrors: [
        'ECONNRESET',
        'ECONNREFUSED',
        'EPIPE',
        'socket hang up',
    ],

    beforeSend(event, hint) {
        // Scrub any accidentally included passwords from breadcrumbs
        if (event.request?.data) {
            const data = event.request.data;
            if (typeof data === 'object') {
                delete data.password;
                delete data.refreshToken;
                delete data.accessToken;
            }
        }
        return event;
    },
});

module.exports = Sentry;
