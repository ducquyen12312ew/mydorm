const { AsyncLocalStorage } = require('async_hooks');

let otelApi = null;
try {
  otelApi = require('@opentelemetry/api');
} catch (_) {
  otelApi = null;
}

const traceStorage = new AsyncLocalStorage();

function generateSpanId() {
  return Math.random().toString(16).slice(2, 18).padEnd(16, '0').slice(0, 16);
}

function generateTraceId() {
  return `${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`
    .replace(/[^a-f0-9]/gi, '')
    .padEnd(32, '0')
    .slice(0, 32);
}

function extractIncomingTrace(headers = {}) {
  const traceParent = headers.traceparent || headers.Traceparent;
  if (!traceParent || typeof traceParent !== 'string') {
    return null;
  }

  const parts = traceParent.split('-');
  if (parts.length < 4) {
    return null;
  }

  return {
    traceId: parts[1],
    parentSpanId: parts[2],
    sampled: parts[3]
  };
}

function runWithTraceContext(traceContext, callback) {
  return traceStorage.run(traceContext || {}, callback);
}

function getCurrentTraceContext() {
  return traceStorage.getStore() || null;
}

function createSpan(name, base = {}) {
  const parent = getCurrentTraceContext();
  const traceId = parent?.traceId || base.traceId || generateTraceId();
  const spanId = generateSpanId();

  const contextData = {
    traceId,
    spanId,
    parentSpanId: parent?.spanId || base.parentSpanId || null,
    spanName: name,
    startedAt: Date.now()
  };

  let otelSpan = null;
  if (otelApi?.trace) {
    try {
      otelSpan = otelApi.trace.getTracer('dormitory-graduation').startSpan(name);
    } catch (_) {
      otelSpan = null;
    }
  }

  return {
    context: contextData,
    end(attributes = {}) {
      if (otelSpan) {
        Object.entries(attributes).forEach(([key, value]) => {
          otelSpan.setAttribute(key, value);
        });
        otelSpan.end();
      }
      return {
        ...contextData,
        endedAt: Date.now(),
        durationMs: Date.now() - contextData.startedAt,
        attributes
      };
    }
  };
}

function formatTraceParent(traceContext) {
  if (!traceContext?.traceId || !traceContext?.spanId) {
    return null;
  }
  return `00-${traceContext.traceId}-${traceContext.spanId}-01`;
}

module.exports = {
  extractIncomingTrace,
  runWithTraceContext,
  getCurrentTraceContext,
  createSpan,
  formatTraceParent,
  generateTraceId,
  generateSpanId
};