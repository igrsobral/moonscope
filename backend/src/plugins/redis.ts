import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyRedis from '@fastify/redis';

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyRedis, {
    url: fastify.config.REDIS_URL,
  });

  try {
    await fastify.redis.ping();
    fastify.log.info('Redis connected successfully');
  } catch (error) {
    fastify.log.error({ error }, 'Failed to connect to Redis');
    
    if (fastify.config.NODE_ENV === 'test') {
      fastify.log.warn('Redis connection failed in test environment, continuing...');
    } else {
      throw error;
    }
  }

  fastify.redis.on('connect', () => {
    fastify.log.info('Redis connection established');
  });

  fastify.redis.on('ready', () => {
    fastify.log.info('Redis ready to receive commands');
  });

  fastify.redis.on('error', (error) => {
    fastify.log.error({ error }, 'Redis connection error');
  });

  fastify.redis.on('close', () => {
    fastify.log.info('Redis connection closed');
  });

  fastify.redis.on('reconnecting', (delay: number) => {
    fastify.log.info({ delay }, 'Redis reconnecting...');
  });

  // Graceful shutdown
  fastify.addHook('onClose', async (instance) => {
    instance.log.info('Disconnecting from Redis...');
    await instance.redis.quit();
    instance.log.info('Redis disconnected');
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
      
      if (fastify.config.NODE_ENV !== 'test') {
        throw error;
      }
    }
  });
};

export default fp(redisPlugin, {
  name: 'redis',
  dependencies: ['env'],
});