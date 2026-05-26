const EventEmitter = require('events');

const EVENT_TYPES = {
  STUDENT_ASSIGNED: 'student.assigned',
  STUDENT_ALLOCATION_REVOKED: 'student.allocation_revoked',
  APPLICATION_UPDATED: 'application.updated'
};

class DomainEventBus extends EventEmitter {}

const domainEvents = new DomainEventBus();
domainEvents.setMaxListeners(100);

module.exports = {
  domainEvents,
  EVENT_TYPES
};
