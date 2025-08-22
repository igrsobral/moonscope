import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

// Request schemas
const TriggerJobSchema = z.object({
  queueName: z.enum(['price-updates', 'social-scraping', 'alert-processing', 'risk-assessment', 'maintenance']),
  jobName: z.string().min(1),
  data: z.record(z.any()).optional(),
  delay: z.number().min(0).optional(),
});

const QueueActionSchema = z.object({
  queueName: z.enum(['price-updates', 'social-scraping', 'alert-processing', 'risk-assessment', 'maintenance']),
  action: z.enum(['pause', 'resume', 'clear']),
});

// Removed unused schema

const jobsRoutes: FastifyPluginAsync = async (fastify) => {
  // Get job queue statistics
  fastify.get('/jobs/stats', {
    schema: {
      description: 'Get statistics for all job queues',
      tags: ['jobs'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  queueName: { type: 'string' },
                  jobName: { type: 'string' },
                  totalJobs: { type: 'number' },
                  completedJobs: { type: 'number' },
                  failedJobs: { type: 'number' },
                  activeJobs: { type: 'number' },
                  waitingJobs: { type: 'number' },
                  delayedJobs: { type: 'number' },
                  averageProcessingTime: { type: 'number' },
                  successRate: { type: 'number' },
                  lastProcessed: { type: 'string', format: 'date-time', nullable: true },
                  lastFailure: { type: 'string', format: 'date-time', nullable: true },
                },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const metrics = await fastify.jobMonitor.getAllQueueMetrics();

      return reply.send({
        success: true,
        data: metrics,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    } catch (error) {
      request.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get job statistics');
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get job statistics',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    }
  });

  // Get health status of job queues
  fastify.get('/jobs/health', {
    schema: {
      description: 'Get health status of job queues',
      tags: ['jobs'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                overall: { type: 'string', enum: ['healthy', 'warning', 'critical'] },
                queues: {
                  type: 'object',
                  additionalProperties: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', enum: ['healthy', 'warning', 'critical'] },
                      issues: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const healthStatus = await fastify.jobMonitor.getHealthStatus();

      return reply.send({
        success: true,
        data: healthStatus,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    } catch (error) {
      request.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get job health status');
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get job health status',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    }
  });

  // Get recent job failures
  fastify.get('/jobs/failures', {
    schema: {
      description: 'Get recent job failures',
      tags: ['jobs'],
      querystring: {
        type: 'object',
        properties: {
          queueName: {
            type: 'string',
            enum: ['price-updates', 'social-scraping', 'alert-processing', 'risk-assessment', 'maintenance'],
          },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  queueName: { type: 'string' },
                  jobName: { type: 'string' },
                  jobId: { type: 'string' },
                  error: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                  attemptsMade: { type: 'number' },
                  data: { type: 'object' },
                },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { queueName, limit = 20 } = request.query as any;

      const failures = await fastify.jobMonitor.getRecentFailures(queueName, limit);

      return reply.send({
        success: true,
        data: failures,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    } catch (error) {
      request.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get job failures');
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get job failures',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    }
  });

  // Trigger a one-time job
  fastify.post('/jobs/trigger', {
    schema: {
      description: 'Trigger a one-time job',
      tags: ['jobs'],
      body: TriggerJobSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                jobId: { type: 'string' },
                queueName: { type: 'string' },
                jobName: { type: 'string' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { queueName, jobName, data = {}, delay } = request.body as z.infer<typeof TriggerJobSchema>;

      const jobOptions: any = { attempts: 3 };
      if (delay !== undefined) {
        jobOptions.delay = delay;
      }

      const job = await fastify.queue.addJob(queueName, jobName, data, jobOptions);

      request.log.info({
        jobId: job.id,
        queueName,
        jobName
      }, 'Job triggered manually');

      return reply.send({
        success: true,
        data: {
          jobId: job.id,
          queueName,
          jobName,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    } catch (error) {
      request.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to trigger job');
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to trigger job',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    }
  });

  // Queue management actions
  fastify.post('/jobs/queue-action', {
    schema: {
      description: 'Perform actions on job queues (pause, resume, clear)',
      tags: ['jobs'],
      body: QueueActionSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                queueName: { type: 'string' },
                action: { type: 'string' },
                message: { type: 'string' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { queueName, action } = request.body as z.infer<typeof QueueActionSchema>;

      let message: string;

      switch (action) {
        case 'pause':
          await fastify.queue.pauseQueue(queueName);
          message = `Queue ${queueName} paused`;
          break;

        case 'resume':
          await fastify.queue.resumeQueue(queueName);
          message = `Queue ${queueName} resumed`;
          break;

        case 'clear':
          // Clear all jobs in the queue
          const queue = fastify.queue.getQueue(queueName);
          await queue.obliterate({ force: true });
          message = `Queue ${queueName} cleared`;
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      request.log.info({ queueName, action }, message);

      return reply.send({
        success: true,
        data: {
          queueName,
          action,
          message,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    } catch (error) {
      request.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to perform queue action');
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to perform queue action',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    }
  });

  // Trigger price update for specific coin
  fastify.post('/jobs/price-update/:coinId', {
    schema: {
      description: 'Trigger price update for a specific coin',
      tags: ['jobs'],
      params: {
        type: 'object',
        properties: {
          coinId: { type: 'number' },
        },
        required: ['coinId'],
      },
      body: {
        type: 'object',
        properties: {
          delay: { type: 'number', minimum: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                coinId: { type: 'number' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { coinId } = request.params as { coinId: number };
      const { delay } = request.body as { delay?: number };

      await fastify.jobScheduler.scheduleCoinPriceUpdate(coinId, delay);

      return reply.send({
        success: true,
        data: {
          message: 'Price update job scheduled',
          coinId,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    } catch (error) {
      request.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to schedule price update');
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to schedule price update',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    }
  });

  // Trigger social scraping for specific coin
  fastify.post('/jobs/social-scraping/:coinId', {
    schema: {
      description: 'Trigger social scraping for a specific coin',
      tags: ['jobs'],
      params: {
        type: 'object',
        properties: {
          coinId: { type: 'number' },
        },
        required: ['coinId'],
      },
      body: {
        type: 'object',
        properties: {
          delay: { type: 'number', minimum: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                coinId: { type: 'number' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { coinId } = request.params as { coinId: number };
      const { delay } = request.body as { delay?: number };

      await fastify.jobScheduler.scheduleCoinSocialScraping(coinId, delay);

      return reply.send({
        success: true,
        data: {
          message: 'Social scraping job scheduled',
          coinId,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    } catch (error) {
      request.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to schedule social scraping');
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to schedule social scraping',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    }
  });

  // Trigger risk assessment for specific coin
  fastify.post('/jobs/risk-assessment/:coinId', {
    schema: {
      description: 'Trigger risk assessment for a specific coin',
      tags: ['jobs'],
      params: {
        type: 'object',
        properties: {
          coinId: { type: 'number' },
        },
        required: ['coinId'],
      },
      body: {
        type: 'object',
        properties: {
          delay: { type: 'number', minimum: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                coinId: { type: 'number' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { coinId } = request.params as { coinId: number };
      const { delay } = request.body as { delay?: number };

      await fastify.jobScheduler.scheduleCoinRiskAssessment(coinId, delay);

      return reply.send({
        success: true,
        data: {
          message: 'Risk assessment job scheduled',
          coinId,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    } catch (error) {
      request.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to schedule risk assessment');
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to schedule risk assessment',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      });
    }
  });
};

export default jobsRoutes;