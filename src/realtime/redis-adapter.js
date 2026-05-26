const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const { logger } = require('../config/logger');

async function attachRedisAdapter(io) {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn('REDIS_URL is not configured; Socket.IO will run without a cluster adapter');
    return null;
  }

  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (error) => logger.error('Redis pub client error', { error: error.message }));
  subClient.on('error', (error) => logger.error('Redis sub client error', { error: error.message }));

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));

    logger.info('Socket.IO Redis adapter attached');
    return { pubClient, subClient };
  } catch (error) {
    logger.warn('Redis adapter unavailable, falling back to local Socket.IO broadcasts', { error: error.message });
    try {
      await Promise.allSettled([pubClient.quit(), subClient.quit()]);
    } catch (_) {
      // ignore cleanup errors
    }
    return null;
  }
}

module.exports = {
  attachRedisAdapter
};