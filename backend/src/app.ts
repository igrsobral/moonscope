import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import fastifyEnv from '@fastify/env';
import fp from 'fastify-plugin';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';

import { envOptions } from './config/env.js';
import { getLoggerConfig } from './config/logger.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { coinsRoutes } from './routes/coins-simple.js';
import { websocketRoutes } from './routes/websocket.js';
import riskAssessmentRoutes from './routes/risk-assessment.js';
import socialRoutes from './routes/social.js';
import jobsRoutes from './routes/jobs.js';
import { portfolioRoutes } from './routes/portfolio.js';
import { alertRoutes } from './routes/alerts.js';
import whaleRoutes from './routes/whale.js';
import liquidityRoutes from './routes/liquidity-simple.js';
import databasePlugin from './plugins/database.js';
import redisPlugin from './plugins/redis.js';
import cachePlugin from './plugins/cache.js';
import jwtPlugin from './plugins/jwt.js';
import externalApiPlugin from './plugins/external-api.js';
import websocketPlugin from './plugins/websocket.js';
import realtimePlugin from './plugins/realtime.js';
import riskAssessmentPlugin from './plugins/risk-assessment.js';
import queuePlugin from './plugins/queue.js';
import jobsPlugin from './plugins/jobs.js';
import notificationPlugin from './plugins/notification.js';
import alertTriggerPlugin from './plugins/alert-trigger.js';
import swaggerPlugin from './plugins/swagger.js';

export interface AppOptions {
  logger?: boolean;
  disableRequestLogging?: boolean;
}

/**
 * Build and configure the Fastify application
 */
export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const logLevel = process.env.LOG_LEVEL || 'info';

  const fastifyOptions: FastifyServerOptions = {
    logger: options.logger !== false ? getLoggerConfig(nodeEnv, logLevel) : false,
    disableRequestLogging: options.disableRequestLogging || false,
    trustProxy: true, // Enable if behind a proxy/load balancer
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: req => {
      // Use existing request ID or generate a new one
      return (
        (req.headers['x-request-id'] as string) ||
        `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      );
    },
  };

  const fastify = Fastify(fastifyOptions);

  await fastify.register(
    fp(
      async fastify => {
        await fastify.register(fastifyEnv, envOptions);
      },
      { name: 'env' }
    )
  );

  // Register Swagger documentation first
  await fastify.register(swaggerPlugin);

  await fastify.register(databasePlugin);
  await fastify.register(redisPlugin);
  await fastify.register(cachePlugin);
  await fastify.register(jwtPlugin);
  await fastify.register(externalApiPlugin);
  // Temporarily disable WebSocket plugin to fix type conflicts
  // await fastify.register(websocketPlugin);
  await fastify.register(realtimePlugin);
  await fastify.register(riskAssessmentPlugin);
  await fastify.register(queuePlugin);
  await fastify.register(jobsPlugin);
  await fastify.register(notificationPlugin);
  await fastify.register(alertTriggerPlugin);

  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for API server
  });

  await fastify.register(fastifyCors, {
    origin: (origin, callback) => {
      const hostname = new URL(origin || 'http://localhost').hostname;

      if (fastify.config.NODE_ENV === 'development') {
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          callback(null, true);
          return;
        }
      }

      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  });

  fastify.addHook('onRequest', async request => {
    request.log.info(
      {
        req: {
          method: request.method,
          url: request.url,
          headers: {
            'user-agent': request.headers['user-agent'],
            'content-type': request.headers['content-type'],
          },
          remoteAddress: request.ip,
        },
      },
      'Incoming request'
    );
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = reply.elapsedTime;

    request.log.info(
      {
        req: {
          method: request.method,
          url: request.url,
        },
        res: {
          statusCode: reply.statusCode,
        },
        responseTime: `${responseTime.toFixed(2)}ms`,
      },
      'Request completed'
    );
  });

  // Add error handler
  fastify.setErrorHandler(async (error, request, reply) => {
    request.log.error(
      {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        req: {
          method: request.method,
          url: request.url,
          requestId: request.id,
        },
      },
      'Request error'
    );

    if (fastify.config.NODE_ENV === 'production') {
      if (reply.statusCode >= 500) {
        return reply.send({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred',
          statusCode: reply.statusCode,
          requestId: request.id,
        });
      }
    }

    return reply.send({
      error: error.name,
      message: error.message,
      statusCode: reply.statusCode,
      requestId: request.id,
      ...(fastify.config.NODE_ENV === 'development' && { stack: error.stack }),
    });
  });

  fastify.setNotFoundHandler(async (request, reply) => {
    request.log.warn(
      {
        req: {
          method: request.method,
          url: request.url,
          requestId: request.id,
        },
      },
      'Route not found'
    );

    return reply.code(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404,
      requestId: request.id,
    });
  });

  await fastify.register(healthRoutes);
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(coinsRoutes, { prefix: '/api/v1' });
  await fastify.register(riskAssessmentRoutes, { prefix: '/api/v1' });
  await fastify.register(socialRoutes, { prefix: '/api/v1/social' });
  await fastify.register(jobsRoutes, { prefix: '/api/v1' });
  await fastify.register(portfolioRoutes, { prefix: '/api/v1' });
  await fastify.register(alertRoutes, { prefix: '/api/v1' });
  await fastify.register(whaleRoutes, { prefix: '/api/v1/whale' });
  await fastify.register(liquidityRoutes, { prefix: '/api/v1/liquidity' });
  // Temporarily disable WebSocket routes to fix type conflicts
  // await fastify.register(websocketRoutes);

  fastify.addHook('onClose', async instance => {
    instance.log.info('Application shutting down...');
  });

  fastify.addHook('onReady', async () => {
    fastify.log.info(
      {
        config: {
          nodeEnv: fastify.config.NODE_ENV,
          logLevel: fastify.config.LOG_LEVEL,
          port: fastify.config.PORT,
          host: fastify.config.HOST,
        },
      },
      'Application configured and ready'
    );
  });

  return fastify;
}
