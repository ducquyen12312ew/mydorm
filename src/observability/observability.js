const { randomUUID } = require('crypto');
const { logger, logError } = require('../config/logger');
const OperationalAlert = require('../schemas/OperationalAlertSchema');
const {
  extractIncomingTrace,
  runWithTraceContext,
  getCurrentTraceContext,
  createSpan,
  formatTraceParent,
  generateTraceId
} = require('./tracing');

const metrics = {
  requestCount: 0,
  errorCount: 0,
  totalDurationMs: 0,
  slowRequests: 0,
  lastErrors: [],
  recentRequests: [],
  recentErrors: [],
  alerts: {
    errorRate: false,
    latency: false
  }
};

function parseTraceParent(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }

  const parts = headerValue.split('-');
  if (parts.length < 4) {
    return null;
  }

  return {
    traceId: parts[1],
    parentSpanId: parts[2],
    sampled: parts[3]
  };
}

function evaluateAlerts(now = Date.now()) {
  const requestWindowMs = 5 * 60 * 1000;
  const errorWindowMs = 5 * 60 * 1000;
  metrics.recentRequests = metrics.recentRequests.filter((item) => now - item.at <= requestWindowMs);
  metrics.recentErrors = metrics.recentErrors.filter((item) => now - item.at <= errorWindowMs);

  const recentLatency = metrics.recentRequests.map((item) => item.durationMs).sort((a, b) => a - b);
  const p95Index = Math.max(0, Math.floor(recentLatency.length * 0.95) - 1);
  const p95Latency = recentLatency.length ? recentLatency[p95Index] : 0;
  const errorRate = metrics.recentRequests.length ? metrics.recentErrors.length / metrics.recentRequests.length : 0;

  if (errorRate >= 0.05 && !metrics.alerts.errorRate) {
    metrics.alerts.errorRate = true;
    logger.warn('Alert triggered: high error rate', { errorRate: Number(errorRate.toFixed(3)) });
    OperationalAlert.create({
      alertType: 'error_rate',
      state: 'TRIGGERED',
      value: Number(errorRate.toFixed(4)),
      threshold: 0.05,
      windowStart: new Date(now - errorWindowMs),
      windowEnd: new Date(now),
      traceId: getCurrentTraceContext()?.traceId || null,
      metadata: { recentRequests: metrics.recentRequests.length, recentErrors: metrics.recentErrors.length }
    }).catch(() => null);
  }

  if (errorRate < 0.03) {
    if (metrics.alerts.errorRate) {
      OperationalAlert.create({
        alertType: 'error_rate',
        state: 'CLEARED',
        value: Number(errorRate.toFixed(4)),
        threshold: 0.03,
        windowStart: new Date(now - errorWindowMs),
        windowEnd: new Date(now),
        traceId: getCurrentTraceContext()?.traceId || null,
        metadata: { recentRequests: metrics.recentRequests.length, recentErrors: metrics.recentErrors.length }
      }).catch(() => null);
    }
    metrics.alerts.errorRate = false;
  }

  if (p95Latency >= 1000 && !metrics.alerts.latency) {
    metrics.alerts.latency = true;
    logger.warn('Alert triggered: high latency', { p95Latency: Number(p95Latency.toFixed(2)) });
    OperationalAlert.create({
      alertType: 'latency_p95',
      state: 'TRIGGERED',
      value: Number(p95Latency.toFixed(2)),
      threshold: 1000,
      windowStart: new Date(now - requestWindowMs),
      windowEnd: new Date(now),
      traceId: getCurrentTraceContext()?.traceId || null,
      metadata: { sampleSize: metrics.recentRequests.length }
    }).catch(() => null);
  }

  if (p95Latency < 800) {
    if (metrics.alerts.latency) {
      OperationalAlert.create({
        alertType: 'latency_p95',
        state: 'CLEARED',
        value: Number(p95Latency.toFixed(2)),
        threshold: 800,
        windowStart: new Date(now - requestWindowMs),
        windowEnd: new Date(now),
        traceId: getCurrentTraceContext()?.traceId || null,
        metadata: { sampleSize: metrics.recentRequests.length }
      }).catch(() => null);
    }
    metrics.alerts.latency = false;
  }
}

function requestLogger(req, res, next) {
  const incomingTrace = extractIncomingTrace(req.headers) || parseTraceParent(req.headers.traceparent);
  const requestId = req.headers['x-request-id'] || randomUUID();
  const traceId = incomingTrace?.traceId || generateTraceId();

  runWithTraceContext({ traceId, parentSpanId: incomingTrace?.parentSpanId || null }, () => {
    const startedAt = process.hrtime.bigint();
    const requestSpan = createSpan('http.request', { traceId });

    req.requestId = requestId;
    req.traceId = requestSpan.context.traceId;
    req.spanId = requestSpan.context.spanId;

    res.setHeader('X-Request-Id', requestId);
    res.setHeader('traceparent', formatTraceParent(requestSpan.context));

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      metrics.requestCount += 1;
      metrics.totalDurationMs += durationMs;
      metrics.recentRequests.push({ at: Date.now(), durationMs });
      if (durationMs > 1000) {
        metrics.slowRequests += 1;
      }

      logger.info('HTTP request', {
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        traceId: requestSpan.context.traceId,
        spanId: requestSpan.context.spanId,
        userId: req.session?.userId || req.mobileAuth?.userId || null
      });

      if (res.statusCode >= 500) {
        metrics.recentErrors.push({ at: Date.now() });
      }

      requestSpan.end({
        'http.status_code': res.statusCode,
        'http.method': req.method,
        'http.route': req.originalUrl || req.url
      });

      evaluateAlerts();
    });

    next();
  });
}

function captureError(err, req) {
  const payload = {
    requestId: req?.requestId,
    method: req?.method,
    path: req?.originalUrl || req?.url,
    userId: req?.session?.userId || req?.mobileAuth?.userId || null,
    message: err?.message,
    stack: err?.stack
  };

  metrics.errorCount += 1;
  metrics.recentErrors.push({ at: Date.now() });
  metrics.lastErrors.unshift({ ...payload, at: new Date().toISOString() });
  metrics.lastErrors = metrics.lastErrors.slice(0, 20);

  logError(err, payload);
  evaluateAlerts();
}

function getMetrics() {
  const averageDurationMs = metrics.requestCount > 0 ? metrics.totalDurationMs / metrics.requestCount : 0;
  return {
    ...metrics,
    averageDurationMs: Number(averageDurationMs.toFixed(2))
  };
}

module.exports = {
  requestLogger,
  captureError,
  getMetrics
};