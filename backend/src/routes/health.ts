import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';

// Health check response schema
const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  uptime: z.number(),
  version: z.string(),
  environment: z.string(),
  services: z.object({
    database: z.enum(['connected', 'disconnected', 'unknown']),
    redis: z.enum(['connected', 'disconnected', 'unknown']),
  }),
  memory: z.object({
    used: z.number(),
    total: z.number(),
    percentage: z.number(),
  }),
  system: z.object({
    platform: z.string(),
    nodeVersion: z.string(),
    cpuUsage: z.object({
      user: z.number(),
      system: z.number(),
    }),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/**
 * Health check plugin for monitoring application status
 */
export async function healthRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  // Basic health check endpoint
  fastify.get('/health', {
    schema: {
      description: 'Basic health check endpoint',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok'] },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  // Detailed health check endpoint
  fastify.get('/health/detailed', {
    schema: {
      description: 'Detailed health check with system information',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded', 'unhealthy'] },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            version: { type: 'string' },
            environment: { type: 'string' },
            services: {
              type: 'object',
              properties: {
                database: { type: 'string', enum: ['connected', 'disconnected', 'unknown'] },
                redis: { type: 'string', enum: ['connected', 'disconnected', 'unknown'] },
              },
            },
            memory: {
              type: 'object',
              properties: {
                used: { type: 'number' },
                total: { type: 'number' },
                percentage: { type: 'number' },
              },
            },
            system: {
              type: 'object',
              properties: {
                platform: { type: 'string' },
                nodeVersion: { type: 'string' },
                cpuUsage: {
                  type: 'object',
                  properties: {
                    user: { type: 'number' },
                    system: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const startTime = process.hrtime();
    
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal + memoryUsage.external;
    const usedMemory = memoryUsage.heapUsed;
    const memoryPercentage = Math.round((usedMemory / totalMemory) * 100);

    // Get CPU usage
    const cpuUsage = process.cpuUsage();

    // Check service health (placeholder for now - will be implemented in later tasks)
    const services = {
      database: 'unknown' as 'connected' | 'disconnected' | 'unknown',
      redis: 'unknown' as 'connected' | 'disconnected' | 'unknown',
    };

    // Determine overall status
    let status: 'ok' | 'degraded' | 'unhealthy' = 'ok';
    
    // Consider degraded if memory usage is high
    if (memoryPercentage > 85) {
      status = 'degraded';
    }

    // Consider unhealthy if critical services are down
    if (services.database === 'disconnected' || services.redis === 'disconnected') {
      status = 'unhealthy';
    }

    const healthData: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: fastify.config.NODE_ENV,
      services,
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: memoryPercentage,
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        cpuUsage: {
          user: cpuUsage.user / 1000000, // Convert to milliseconds
          system: cpuUsage.system / 1000000,
        },
      },
    };

    const endTime = process.hrtime(startTime);
    const responseTime = endTime[0] * 1000 + endTime[1] / 1000000;

    // Log health check performance
    request.log.debug({
      healthCheck: {
        status,
        responseTime: `${responseTime.toFixed(2)}ms`,
        memoryUsage: `${memoryPercentage}%`,
      },
    }, 'Health check completed');

    // Set appropriate status code based on health
    if (status === 'unhealthy') {
      reply.code(503);
    } else if (status === 'degraded') {
      reply.code(200);
    }

    return healthData;
  });

  // Readiness probe endpoint (for Kubernetes/Docker)
  fastify.get('/health/ready', {
    schema: {
      description: 'Readiness probe endpoint',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
            timestamp: { type: 'string' },
          },
        },
        503: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
            timestamp: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
    },
  }, async (_request, reply) => {
    // Check if application is ready to serve requests
    // This will be enhanced when database and redis connections are added
    const isReady = true; // Placeholder

    if (!isReady) {
      reply.code(503);
      return {
        ready: false,
        timestamp: new Date().toISOString(),
        reason: 'Application not ready',
      };
    }

    return {
      ready: true,
      timestamp: new Date().toISOString(),
    };
  });

  // Liveness probe endpoint (for Kubernetes/Docker)
  fastify.get('/health/live', {
    schema: {
      description: 'Liveness probe endpoint',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            alive: { type: 'boolean' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    return {
      alive: true,
      timestamp: new Date().toISOString(),
    };
  });
}