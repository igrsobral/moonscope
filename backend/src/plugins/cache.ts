import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import CacheService from '../services/cache.js';
import SessionService from '../services/session.js';
import CacheWarmingService from '../services/cache-warming.js';

declare module 'fastify' {
  interface FastifyInstance {
    cache: CacheService;
    session: SessionService;
    cacheWarming: CacheWarmingService;
  }
}

const cachePlugin: FastifyPluginAsync = async fastify => {
  const cacheService = new CacheService(fastify.redis, fastify.log);

  const sessionService = new SessionService(fastify.redis, fastify.log);

  const cacheWarmingService = new CacheWarmingService(cacheService, fastify.log);

  fastify.decorate('cache', cacheService);
  fastify.decorate('session', sessionService);
  fastify.decorate('cacheWarming', cacheWarmingService);

  fastify.addHook('onReady', async () => {
    try {
      cacheWarmingService.startAllStrategies();

      const results = await cacheWarmingService.warmAllCaches();
      const successfulWarmings = results.filter(r => r.success).length;

      fastify.log.info(
        {
          totalStrategies: results.length,
          successfulWarmings,
        },
        'Initial cache warming completed'
      );
    } catch (error) {
      fastify.log.error({ error }, 'Failed to start cache warming');
    }
  });

  // Schedule periodic session cleanup
  const sessionCleanupInterval = setInterval(
    async () => {
      try {
        const cleanedCount = await sessionService.cleanupExpiredSessions();
        if (cleanedCount > 0) {
          fastify.log.info({ cleanedCount }, 'Session cleanup completed');
        }
      } catch (error) {
        fastify.log.error({ error }, 'Session cleanup failed');
      }
    },
    60 * 60 * 1000
  ); // Run every hour

  // Graceful shutdown
  fastify.addHook('onClose', async instance => {
    instance.log.info('Shutting down cache services...');

    // Stop cache warming
    cacheWarmingService.stopAllStrategies();

    // Clear session cleanup interval
    clearInterval(sessionCleanupInterval);

    // Log final statistics
    const cacheStats = cacheService.getStats();
    const sessionStats = await sessionService.getSessionStats();
    const warmingStats = cacheWarmingService.getWarmingStats();

    instance.log.info(
      {
        cache: {
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          hitRatio: cacheService.getHitRatio(),
          operations: cacheStats.sets + cacheStats.deletes,
          errors: cacheStats.errors,
        },
        sessions: sessionStats,
        warming: {
          totalStrategies: warmingStats.totalStrategies,
          enabledStrategies: warmingStats.enabledStrategies,
        },
      },
      'Cache services shutdown complete'
    );
  });

  // Add health check endpoints for cache services
  fastify.get('/health/cache', async (request, reply) => {
    try {
      // Test Redis connection
      const pingResult = await fastify.redis.ping();
      if (pingResult !== 'PONG') {
        throw new Error('Redis ping failed');
      }

      // Test cache operations
      const testKey = 'health_check_test';
      const testValue = { timestamp: Date.now() };

      const setResult = await cacheService.set(testKey, testValue, { ttl: 10 });
      if (!setResult) {
        throw new Error('Cache set operation failed');
      }

      const getValue = await cacheService.get<{ timestamp: number }>(testKey);
      if (!getValue || getValue.timestamp !== testValue.timestamp) {
        throw new Error('Cache get operation failed');
      }

      await cacheService.delete(testKey);

      // Get statistics
      const cacheStats = cacheService.getStats();
      const sessionStats = await sessionService.getSessionStats();
      const warmingStats = cacheWarmingService.getWarmingStats();

      return reply.send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          redis: 'connected',
          cache: 'operational',
          sessions: 'operational',
          warming: 'operational',
        },
        statistics: {
          cache: {
            hits: cacheStats.hits,
            misses: cacheStats.misses,
            hitRatio: Math.round(cacheService.getHitRatio() * 10000) / 100, // Percentage with 2 decimals
            totalOperations:
              cacheStats.sets + cacheStats.deletes + cacheStats.hits + cacheStats.misses,
            errors: cacheStats.errors,
          },
          sessions: sessionStats,
          warming: {
            totalStrategies: warmingStats.totalStrategies,
            enabledStrategies: warmingStats.enabledStrategies,
          },
        },
      });
    } catch (error) {
      request.log.error({ error }, 'Cache health check failed');

      return reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        services: {
          redis: 'unknown',
          cache: 'unknown',
          sessions: 'unknown',
          warming: 'unknown',
        },
      });
    }
  });

  // Cache statistics endpoint
  fastify.get('/health/cache/stats', async (request, reply) => {
    try {
      const cacheStats = cacheService.getStats();
      const sessionStats = await sessionService.getSessionStats();
      const warmingStats = cacheWarmingService.getWarmingStats();

      return reply.send({
        timestamp: new Date().toISOString(),
        cache: {
          ...cacheStats,
          hitRatio: Math.round(cacheService.getHitRatio() * 10000) / 100,
        },
        sessions: sessionStats,
        warming: warmingStats,
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to get cache statistics');

      return reply.status(500).send({
        error: 'Failed to retrieve cache statistics',
        timestamp: new Date().toISOString(),
      });
    }
  });

  fastify.log.info('Cache plugin registered successfully');
};

export default fp(cachePlugin, {
  name: 'cache',
  dependencies: ['redis'],
});
