const { domainEvents, EVENT_TYPES } = require('../events/domain-events');
const { runWithTraceContext, createSpan, formatTraceParent } = require('../observability/tracing');

const handledEventIds = new Set();

function shouldHandle(payload) {
  const eventId = payload?.eventId;
  if (!eventId) {
    return true;
  }

  if (handledEventIds.has(eventId)) {
    return false;
  }

  handledEventIds.add(eventId);
  if (handledEventIds.size > 1000) {
    const [first] = handledEventIds;
    handledEventIds.delete(first);
  }

  return true;
}

function registerDomainEventBridge(io) {
  domainEvents.on(EVENT_TYPES.STUDENT_ASSIGNED, (payload) => {
    if (!payload?.studentId || !shouldHandle(payload)) return;
    runWithTraceContext(payload?._trace || null, () => {
      const span = createSpan('socket.emit.student_assigned');
      const traceparent = formatTraceParent(span.context);
      io.to(`student:${String(payload.studentId)}`).emit('student:assigned', {
        ...payload,
        traceparent
      });
      io.to(`student:${String(payload.studentId)}`).emit('student:dashboard:refresh', {
        reason: 'student_assigned',
        at: new Date().toISOString(),
        traceparent
      });
      span.end({ 'socket.event': 'student:assigned' });
    });
  });

  domainEvents.on(EVENT_TYPES.STUDENT_ALLOCATION_REVOKED, (payload) => {
    if (!payload?.studentId || !shouldHandle(payload)) return;
    runWithTraceContext(payload?._trace || null, () => {
      const span = createSpan('socket.emit.student_allocation_revoked');
      const traceparent = formatTraceParent(span.context);
      io.to(`student:${String(payload.studentId)}`).emit('student:allocation-revoked', {
        ...payload,
        traceparent
      });
      io.to(`student:${String(payload.studentId)}`).emit('student:dashboard:refresh', {
        reason: 'allocation_revoked',
        at: new Date().toISOString(),
        traceparent
      });
      span.end({ 'socket.event': 'student:allocation-revoked' });
    });
  });

  domainEvents.on(EVENT_TYPES.APPLICATION_UPDATED, (payload) => {
    if (!payload?.studentId || !shouldHandle(payload)) return;
    runWithTraceContext(payload?._trace || null, () => {
      const span = createSpan('socket.emit.application_updated');
      const traceparent = formatTraceParent(span.context);
      io.to(`student:${String(payload.studentId)}`).emit('application:updated', {
        ...payload,
        traceparent
      });
      io.to(`student:${String(payload.studentId)}`).emit('student:dashboard:refresh', {
        reason: 'application_updated',
        at: new Date().toISOString(),
        traceparent
      });
      span.end({ 'socket.event': 'application:updated' });
    });
  });
}

module.exports = {
  registerDomainEventBridge
};
