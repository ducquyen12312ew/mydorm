const { logger } = require('../config/logger');

let cachedTransport = null;

function buildTransport() {
  if (cachedTransport) {
    return cachedTransport;
  }

  const mode = (process.env.EVENT_TRANSPORT || 'local').toLowerCase();

  if (mode === 'redis') {
    cachedTransport = {
      async publish(eventType, payload) {
        try {
          const { createClient } = require('redis');
          const client = createClient({ url: process.env.REDIS_URL });
          await client.connect();
          await client.publish(process.env.EVENT_TRANSPORT_CHANNEL || 'domain-events', JSON.stringify({ eventType, payload }));
          await client.quit();
        } catch (error) {
          logger.warn('Redis event transport unavailable, falling back to local emit', { error: error.message });
        }
      }
    };
    return cachedTransport;
  }

  if (mode === 'kafka') {
    cachedTransport = {
      async publish(eventType, payload) {
        try {
          const { Kafka } = require('kafkajs');
          const kafka = new Kafka({ brokers: String(process.env.KAFKA_BROKERS || '').split(',').filter(Boolean) });
          const producer = kafka.producer();
          await producer.connect();
          await producer.send({
            topic: process.env.KAFKA_TOPIC || 'domain-events',
            messages: [{ value: JSON.stringify({ eventType, payload }) }]
          });
          await producer.disconnect();
        } catch (error) {
          logger.warn('Kafka event transport unavailable, falling back to local emit', { error: error.message });
        }
      }
    };
    return cachedTransport;
  }

  cachedTransport = {
    async publish() {
      return null;
    }
  };

  return cachedTransport;
}

module.exports = {
  buildTransport
};