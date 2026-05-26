const crypto = require('crypto');
const DomainEventOutbox = require('../schemas/DomainEventOutboxSchema');
const { domainEvents } = require('./domain-events');
const { logger } = require('../config/logger');
const { buildTransport } = require('./event-transport');
const { getCurrentTraceContext, runWithTraceContext, createSpan } = require('../observability/tracing');

let dispatcherStarted = false;

function stableIdempotencyKey(eventType, payload, aggregateType, aggregateId) {
  const basis = JSON.stringify({
    eventType,
    aggregateType: aggregateType || null,
    aggregateId: aggregateId || null,
    payload: payload || {}
  });
  return crypto.createHash('sha256').update(basis).digest('hex');
}

function createEventId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

async function publishDomainEvent(eventType, payload = {}, options = {}) {
  const eventId = options.eventId || createEventId();
  const aggregateType = options.aggregateType || payload.aggregateType || null;
  const aggregateId = options.aggregateId || payload.aggregateId || payload.studentId || payload.cycleId || null;
  const idempotencyKey = options.idempotencyKey || stableIdempotencyKey(eventType, payload, aggregateType, aggregateId);

  const record = {
    eventId,
    idempotencyKey,
    eventType,
    aggregateType,
    aggregateId: aggregateId ? String(aggregateId) : null,
    payload: {
      ...payload,
      eventId,
      idempotencyKey,
      _trace: payload._trace || getCurrentTraceContext() || null
    },
    maxAttempts: Number(options.maxAttempts || 5),
    nextAttemptAt: new Date()
  };

  try {
    const created = await DomainEventOutbox.create(record);
    await buildTransport().publish(eventType, created.payload);
    return created;
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await DomainEventOutbox.findOne({ idempotencyKey });
      return existing;
    }

    throw error;
  }
}

function computeBackoff(attempts) {
  const delayMs = Math.min(30000, 1000 * (2 ** Math.max(attempts - 1, 0)));
  return new Date(Date.now() + delayMs);
}

async function claimNextEvent(batchSize = 25) {
  const now = new Date();
  return DomainEventOutbox.findOneAndUpdate(
    {
      status: 'pending',
      nextAttemptAt: { $lte: now },
      attempts: { $lt: 100 },
      $or: [{ lockedAt: null }, { lockedAt: { $exists: false } }]
    },
    {
      $set: {
        status: 'processing',
        lockedAt: now,
        updatedAt: now
      }
    },
    {
      new: true,
      sort: { createdAt: 1, attempts: 1 },
      projection: { payload: 1, eventType: 1, eventId: 1, attempts: 1, maxAttempts: 1 }
    }
  );
}

async function flushDueEvents(batchSize = 25) {
  for (let index = 0; index < batchSize; index += 1) {
    const locked = await claimNextEvent(batchSize);

    if (!locked) {
      break;
    }

    try {
      await runWithTraceContext(locked.payload?._trace || null, async () => {
        const span = createSpan('outbox.dispatch');
        domainEvents.emit(locked.eventType, locked.payload);
        span.end({
          'event.type': locked.eventType,
          'event.id': locked.eventId,
          'event.status': 'done'
        });
      });

      await DomainEventOutbox.updateOne(
        { _id: locked._id },
        {
          $set: {
            status: 'done',
            deliveredAt: new Date(),
            lockedAt: null,
            error: null,
            updatedAt: new Date()
          }
        }
      );
    } catch (error) {
      const attempts = (locked.attempts || 0) + 1;
      const exhausted = attempts >= (locked.maxAttempts || 5);

      await DomainEventOutbox.updateOne(
        { _id: locked._id },
        {
          $set: {
            status: exhausted ? 'dead_letter' : 'pending',
            attempts,
            nextAttemptAt: exhausted ? null : computeBackoff(attempts),
            lockedAt: null,
            error: error.message,
            deadLetteredAt: exhausted ? new Date() : null,
            deadLetterReason: exhausted ? 'MAX_RETRY_EXCEEDED' : null,
            updatedAt: new Date()
          }
        }
      );

      logger.error('Domain event delivery failed', {
        eventId: locked.eventId,
        eventType: locked.eventType,
        attempts,
        exhausted,
        error: error.message
      });
    }
  }
}

function startDomainEventDispatcher({ intervalMs = 1000, batchSize = 25 } = {}) {
  if (dispatcherStarted) {
    return;
  }

  dispatcherStarted = true;
  const tick = async () => {
    try {
      await flushDueEvents(batchSize);
    } catch (error) {
      logger.error('Domain event dispatcher tick failed', { error: error.message });
    }
  };

  tick();
  const timer = setInterval(tick, intervalMs);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

module.exports = {
  publishDomainEvent,
  startDomainEventDispatcher
};