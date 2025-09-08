import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyRedis from '@fastify/redis';

const redisPlugin: FastifyPluginAsync = async fastify => {
  // Skip if already decorated (hot reload protection)
  if (fastify.hasDecorator('redis')) {
    fastify.log.info('Redis decorator already exists, skipping registration');
    return;
  }

  if (fastify.config.NODE_ENV === 'test' || fastify.config.NODE_ENV === 'development') {
    // In development/test, create mock Redis directly to avoid connection timeouts
    fastify.log.warn('Development/test mode: creating mock Redis instance...');

    const mockRedis = {
      ping: async () => 'PONG',
      get: async () => null,
      set: async () => 'OK',
      del: async () => 1,
      exists: async () => 0,
      expire: async () => 1,
      ttl: async () => -1,
      keys: async () => [],
      flushall: async () => 'OK',
      quit: async () => 'OK',
      on: () => {},
      off: () => {},
      removeAllListeners: () => {},
    };

    if (!fastify.hasDecorator('redis')) {
      fastify.decorate('redis', mockRedis as any);
    }
    fastify.log.info('Mock Redis instance created for development/testing');
  } else {
    try {
      await fastify.register(fastifyRedis, {
        url: fastify.config.REDIS_URL,
      });

      // Test connection
      await fastify.redis.ping();
      fastify.log.info('Redis connected successfully');
    } catch (error) {
      fastify.log.error({ error }, 'Failed to connect to Redis');
      throw error;
    }
  }

  // Only add event listeners if we have a real Redis connection
  if (fastify.redis && typeof fastify.redis.on === 'function') {
    fastify.redis.on('connect', () => {
      fastify.log.info('Redis connection established');
    });

    fastify.redis.on('ready', () => {
      fastify.log.info('Redis ready to receive commands');
    });

    fastify.redis.on('error', error => {
      fastify.log.error({ error }, 'Redis connection error');
    });

    fastify.redis.on('close', () => {
      fastify.log.info('Redis connection closed');
    });

    fastify.redis.on('reconnecting', (delay: number) => {
      fastify.log.info({ delay }, 'Redis reconnecting...');
    });
  }

  // Graceful shutdown
  fastify.addHook('onClose', async instance => {
    if (instance.redis && typeof instance.redis.quit === 'function') {
      instance.log.info('Disconnecting from Redis...');
      try {
        await instance.redis.quit();
        instance.log.info('Redis disconnected');
      } catch (error) {
        instance.log.warn({ error }, 'Error during Redis disconnect');
      }
    }
  });

  // Health check
  fastify.addHook('onReady', async () => {
    try {
      const result = await fastify.redis.ping();
      if (result === 'PONG') {
        fastify.log.info('Redis health check passed');
      } else {
        throw new Error('Redis ping returned unexpected result');
      }
    } catch (error) {
      fastify.log.error({ error }, 'Redis health check failed');

      if (fastify.config.NODE_ENV === 'production') {
        throw error;
      }
    }
  });
};

export default fp(redisPlugin, {
  name: 'redis',
});
