import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { JobProcessors } from '../services/job-processors.js';
import { JobScheduler } from '../services/job-scheduler.js';
import { JobMonitor } from '../services/job-monitor.js';
import { CoinService } from '../services/coin.js';
import { SocialService } from '../services/social.js';
import { CacheService } from '../services/cache.js';

declare module 'fastify' {
  interface FastifyInstance {
    jobProcessors: JobProcessors;
    jobScheduler: JobScheduler;
    jobMonitor: JobMonitor;
  }
}

const jobsPlugin: FastifyPluginAsync = async (fastify) => {
  // Initialize services that job processors depend on
  const coinService = new CoinService(
    fastify.prisma,
    fastify.log,
    fastify.cache,
    fastify.externalApi
  );

  const socialService = new SocialService(
    fastify.prisma,
    fastify.redis,
    {
      twitter: {
        apiKey: fastify.config.TWITTER_BEARER_TOKEN || '',
        apiSecret: '',
        bearerToken: fastify.config.TWITTER_BEARER_TOKEN || '',
      },
      reddit: {
        clientId: fastify.config.REDDIT_CLIENT_ID || '',
        clientSecret: fastify.config.REDDIT_CLIENT_SECRET || '',
        userAgent: 'meme-coin-analyzer/1.0',
      },
      telegram: {
        botToken: '',
      },
    }
  );

  const cacheService = new CacheService(fastify.redis, fastify.log);

  // Initialize job processors
  const jobProcessors = new JobProcessors({
    prisma: fastify.prisma,
    redis: fastify.redis,
    logger: fastify.log,
    coinService,
    socialService,
    externalApiService: fastify.externalApi,
    cacheService,
    realtimeService: fastify.realtime,
  });

  // Initialize job scheduler
  const jobScheduler = new JobScheduler(
    fastify.prisma,
    fastify.queue,
    fastify.log
  );

  // Initialize job monitor
  const jobMonitor = new JobMonitor(
    fastify.prisma,
    fastify.redis,
    fastify.queue,
    fastify.log
  );

  // Register services
  fastify.decorate('jobProcessors', jobProcessors);
  fastify.decorate('jobScheduler', jobScheduler);
  fastify.decorate('jobMonitor', jobMonitor);

  // Initialize all job-related services
  await jobProcessors.initialize();
  await jobMonitor.initialize();

  // Initialize scheduled jobs only in production or when explicitly enabled
  if (fastify.config.NODE_ENV === 'production' || fastify.config.ENABLE_SCHEDULED_JOBS === 'true') {
    await jobScheduler.initialize();
    fastify.log.info('Scheduled jobs initialized');
  } else {
    fastify.log.info('Scheduled jobs disabled (set ENABLE_SCHEDULED_JOBS=true to enable)');
  }

  // Health check for job system
  fastify.addHook('onReady', async () => {
    try {
      const healthStatus = await jobMonitor.getHealthStatus();
      fastify.log.info({ 
        jobSystemHealth: healthStatus.overall,
        queueCount: Object.keys(healthStatus.queues).length 
      }, 'Job system health check completed');
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Job system health check failed');
    }
  });

  // Graceful shutdown
  fastify.addHook('onClose', async (instance) => {
    instance.log.info('Shutting down job system...');
    
    try {
      // Close job processors (this will close all workers)
      await jobProcessors.close();
      instance.log.info('Job processors closed');
    } catch (error) {
      instance.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Error closing job processors');
    }

    instance.log.info('Job system shutdown complete');
  });

  fastify.log.info('Jobs plugin registered');
};

export default fp(jobsPlugin, {
  name: 'jobs',
  dependencies: ['database', 'redis', 'queue', 'external-api', 'websocket', 'realtime'],
});