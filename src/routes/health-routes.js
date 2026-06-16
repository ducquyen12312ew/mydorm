/**
 * Health check endpoints.
 * These endpoints are unauthenticated — they expose only operational state,
 * no user data. Safe to expose to load balancers and monitoring tools.
 *
 * GET /health          — overall application health
 * GET /health/db       — MongoDB connectivity
 * GET /health/redis    — Redis connectivity
 * GET /health/sentry   — Sentry SDK status
 */
const express = require('express');
const mongoose = require('mongoose');
const { createClient } = require('redis');
const { logger } = require('../config/logger');

const router = express.Router();

// ── MongoDB state labels ──────────────────────────────────────────────────────
const MONGO_STATES = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized',
};

// ── Redis probe (singleton client, lazy-created) ──────────────────────────────
let _redisProbeClient = null;

async function probeRedis() {
    const url = process.env.REDIS_URL;
    if (!url) {
        return { status: 'unconfigured', latencyMs: null, message: 'REDIS_URL not set' };
    }

    try {
        if (!_redisProbeClient) {
            _redisProbeClient = createClient({ url, socket: { connectTimeout: 3000 } });
            _redisProbeClient.on('error', () => {}); // suppress unhandled errors on probe client
            await _redisProbeClient.connect();
        }

        const t0 = Date.now();
        await _redisProbeClient.ping();
        const latencyMs = Date.now() - t0;

        return { status: 'healthy', latencyMs };
    } catch (err) {
        // Reset probe client on failure so next call re-attempts
        _redisProbeClient = null;
        return { status: 'unhealthy', latencyMs: null, message: err.message };
    }
}

// ── MongoDB probe ─────────────────────────────────────────────────────────────
async function probeMongo() {
    const state = mongoose.connection.readyState;
    const stateLabel = MONGO_STATES[state] ?? 'unknown';

    if (state !== 1) {
        return { status: 'unhealthy', state: stateLabel, latencyMs: null };
    }

    try {
        const t0 = Date.now();
        await mongoose.connection.db.admin().ping();
        const latencyMs = Date.now() - t0;
        return { status: 'healthy', state: stateLabel, latencyMs };
    } catch (err) {
        return { status: 'unhealthy', state: stateLabel, latencyMs: null, message: err.message };
    }
}

// ── Sentry probe ──────────────────────────────────────────────────────────────
function probeSentry() {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        return { status: 'unconfigured', message: 'SENTRY_DSN not set' };
    }
    try {
        const Sentry = require('@sentry/node');
        const client = Sentry.getClient();
        if (!client) {
            return { status: 'unhealthy', message: 'Sentry client not initialized' };
        }
        return {
            status: 'configured',
            environment: process.env.NODE_ENV || 'development',
            dsn: dsn.replace(/\/\/[^@]+@/, '//***@'), // mask credentials in DSN
        };
    } catch (err) {
        return { status: 'error', message: err.message };
    }
}

// ── GET /health — combined summary ───────────────────────────────────────────
router.get('/', async (req, res) => {
    const [db, redis] = await Promise.all([probeMongo(), probeRedis()]);
    const sentry = probeSentry();

    const allHealthy =
        db.status === 'healthy' &&
        (redis.status === 'healthy' || redis.status === 'unconfigured') &&
        (sentry.status === 'configured' || sentry.status === 'unconfigured');

    const overall = allHealthy ? 'healthy' : 'degraded';
    const httpStatus = allHealthy ? 200 : 503;

    res.status(httpStatus).json({
        status: overall,
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        services: { db, redis, sentry },
    });
});

// ── GET /health/db ────────────────────────────────────────────────────────────
router.get('/db', async (req, res) => {
    const result = await probeMongo();
    const status = result.status === 'healthy' ? 200 : 503;
    res.status(status).json(result);
});

// ── GET /health/redis ─────────────────────────────────────────────────────────
router.get('/redis', async (req, res) => {
    const result = await probeRedis();
    const status = result.status === 'healthy' ? 200 : (result.status === 'unconfigured' ? 200 : 503);
    res.status(status).json(result);
});

// ── GET /health/sentry ────────────────────────────────────────────────────────
router.get('/sentry', (req, res) => {
    const result = probeSentry();
    res.json(result);
});

// ── GET /health/sentry/test — send a test event to Sentry ────────────────────
// Only enabled in non-production to avoid polluting production Sentry with test noise.
router.get('/sentry/test', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Test events disabled in production' });
    }
    try {
        const Sentry = require('@sentry/node');
        const eventId = Sentry.captureMessage('Health check test event from /health/sentry/test');
        res.json({ sent: true, eventId, message: 'Test event sent to Sentry' });
    } catch (err) {
        res.status(500).json({ sent: false, error: err.message });
    }
});

module.exports = router;
