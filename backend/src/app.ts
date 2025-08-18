import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import fastifyEnv from '@fastify/env';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';

import { envOptions } from './config/env.js';
import { getLoggerConfig } from './config/logger.js';
import { healthRoutes } from './routes/health.js';
import databasePlugin from './plugins/database.js';

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
    genReqId: (req) => {
      // Use existing request ID or generate a new one
      return req.headers['x-request-id'] as string || 
             `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    },
  };

  const fastify = Fastify(fastifyOptions);

  await fastify.register(fastifyEnv, envOptions);

  await fastify.register(databasePlugin);

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

  fastify.addHook('onRequest', async (request) => {
    request.log.info({
      req: {
        method: request.method,
        url: request.url,
        headers: {
          'user-agent': request.headers['user-agent'],
          'content-type': request.headers['content-type'],
        },
        remoteAddress: request.ip,
      },
    }, 'Incoming request');
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responseTime = reply.elapsedTime;
    
    request.log.info({
      req: {
        method: request.method,
        url: request.url,
      },
      res: {
        statusCode: reply.statusCode,
      },
      responseTime: `${responseTime.toFixed(2)}ms`,
    }, 'Request completed');
  });

  // Add error handler
  fastify.setErrorHandler(async (error, request, reply) => {
    request.log.error({
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
    }, 'Request error');

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
    request.log.warn({
      req: {
        method: request.method,
        url: request.url,
        requestId: request.id,
      },
    }, 'Route not found');

    return reply.code(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404,
      requestId: request.id,
    });
  });

  await fastify.register(healthRoutes);

  fastify.addHook('onClose', async (instance) => {
    instance.log.info('Application shutting down...');
  });

  fastify.addHook('onReady', async () => {
    fastify.log.info({
      config: {
        nodeEnv: fastify.config.NODE_ENV,
        logLevel: fastify.config.LOG_LEVEL,
        port: fastify.config.PORT,
        host: fastify.config.HOST,
      },
    }, 'Application configured and ready');
  });

  return fastify;
}