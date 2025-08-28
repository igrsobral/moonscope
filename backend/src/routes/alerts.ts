import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  AlertQuerySchema,
  CreateAlertSchema,
  UpdateAlertSchema,
  AlertActionSchema,
  AlertQuery,
  CreateAlert,
  UpdateAlert,
  AlertAction
} from '../schemas/alerts.js';
import { AlertService } from '../services/alert.js';
import { NotificationService } from '../services/notification.js';

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: number;
    email: string;
  };
}

/**
 * Alert routes
 */
export async function alertRoutes(fastify: FastifyInstance): Promise<void> {
  // Initialize notification service
  const notificationService = new NotificationService(
    fastify.prisma,
    fastify.log,
    {
      email: {
        smtpHost: fastify.config.SMTP_HOST || 'localhost',
        smtpPort: parseInt(fastify.config.SMTP_PORT || '587'),
        smtpUser: fastify.config.SMTP_USER || '',
        smtpPassword: fastify.config.SMTP_PASSWORD || '',
        fromEmail: fastify.config.FROM_EMAIL || 'noreply@memecoin-analyzer.com',
        fromName: fastify.config.FROM_NAME || 'Meme Coin Analyzer',
      },
      // Add other notification channels as needed
    }
  );

  const alertService = new AlertService(
    fastify.prisma,
    fastify.log,
    fastify.cache,
    notificationService
  );

  // Get user's alerts
  fastify.get<{
    Querystring: AlertQuery;
  }>('/alerts', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: AlertQuerySchema,
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
                  id: { type: 'number' },
                  userId: { type: 'number' },
                  coinId: { type: 'number' },
                  type: { type: 'string' },
                  condition: { type: 'object' },
                  notificationMethods: { type: 'array' },
                  isActive: { type: 'boolean' },
                  lastTriggered: { type: 'string', nullable: true },
                  name: { type: 'string', nullable: true },
                  description: { type: 'string', nullable: true },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                  coin: {
                    type: 'object',
                    properties: {
                      id: { type: 'number' },
                      symbol: { type: 'string' },
                      name: { type: 'string' },
                      address: { type: 'string' },
                      network: { type: 'string' },
                      logoUrl: { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string' },
                requestId: { type: 'string' },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number' },
                    limit: { type: 'number' },
                    total: { type: 'number' },
                    totalPages: { type: 'number' },
                    hasNext: { type: 'boolean' },
                    hasPrev: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const query = AlertQuerySchema.parse(request.query);
    const result = await alertService.getAlerts(request.user.id, query);
    
    if (result.meta) {
      result.meta.requestId = request.id;
    }
    
    return reply.send(result);
  });

  // Get specific alert
  fastify.get<{
    Params: { alertId: number };
  }>('/alerts/:alertId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          alertId: { type: 'number' },
        },
        required: ['alertId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                userId: { type: 'number' },
                coinId: { type: 'number' },
                type: { type: 'string' },
                condition: { type: 'object' },
                notificationMethods: { type: 'array' },
                isActive: { type: 'boolean' },
                lastTriggered: { type: 'string', nullable: true },
                name: { type: 'string', nullable: true },
                description: { type: 'string', nullable: true },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                coin: { type: 'object' },
              },
            },
            meta: { type: 'object' },
          },
        },
      },
    },
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const alertId = Number((request.params as any).alertId);
    const result = await alertService.getAlert(request.user.id, alertId);
    
    if (result.meta) {
      result.meta.requestId = request.id;
    }
    
    return reply.send(result);
  });

  // Create new alert
  fastify.post<{
    Body: CreateAlert;
  }>('/alerts', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateAlertSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                userId: { type: 'number' },
                coinId: { type: 'number' },
                type: { type: 'string' },
                condition: { type: 'object' },
                notificationMethods: { type: 'array' },
                isActive: { type: 'boolean' },
                lastTriggered: { type: 'string', nullable: true },
                name: { type: 'string', nullable: true },
                description: { type: 'string', nullable: true },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                coin: { type: 'object' },
              },
            },
            meta: { type: 'object' },
          },
        },
      },
    },
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const data = CreateAlertSchema.parse(request.body);
    const result = await alertService.createAlert(request.user.id, data);
    
    if (result.meta) {
      result.meta.requestId = request.id;
    }

    // Broadcast alert creation via WebSocket
    if (result.success && result.data) {
      const event = {
        type: 'alert_created' as const,
        data: {
          userId: request.user.id,
          alert: result.data,
        },
        timestamp: new Date().toISOString(),
        userId: request.user.id.toString(),
      };
      
      fastify.realtime.broadcastToUser(request.user.id, event);
    }
    
    return reply.code(201).send(result);
  });

  // Update alert
  fastify.put<{
    Params: { alertId: number };
    Body: UpdateAlert;
  }>('/alerts/:alertId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          alertId: { type: 'number' },
        },
        required: ['alertId'],
      },
      body: UpdateAlertSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            meta: { type: 'object' },
          },
        },
      },
    },
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const alertId = Number((request.params as any).alertId);
    const data = UpdateAlertSchema.parse(request.body);
    const result = await alertService.updateAlert(request.user.id, alertId, data);
    
    if (result.meta) {
      result.meta.requestId = request.id;
    }

    // Broadcast alert update via WebSocket
    if (result.success && result.data) {
      const event = {
        type: 'alert_updated' as const,
        data: {
          userId: request.user.id,
          alert: result.data,
        },
        timestamp: new Date().toISOString(),
        userId: request.user.id.toString(),
      };
      
      fastify.realtime.broadcastToUser(request.user.id, event);
    }
    
    return reply.send(result);
  });

  // Delete alert
  fastify.delete<{
    Params: { alertId: number };
  }>('/alerts/:alertId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          alertId: { type: 'number' },
        },
        required: ['alertId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            meta: { type: 'object' },
          },
        },
      },
    },
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const alertId = Number((request.params as any).alertId);
    const result = await alertService.deleteAlert(request.user.id, alertId);
    
    if (result.meta) {
      result.meta.requestId = request.id;
    }

    // Broadcast alert deletion via WebSocket
    if (result.success) {
      const event = {
        type: 'alert_deleted' as const,
        data: {
          userId: request.user.id,
          alertId,
        },
        timestamp: new Date().toISOString(),
        userId: request.user.id.toString(),
      };
      
      fastify.realtime.broadcastToUser(request.user.id, event);
    }
    
    return reply.send(result);
  });

  // Perform alert action (pause, resume, test)
  fastify.post<{
    Params: { alertId: number };
    Body: AlertAction;
  }>('/alerts/:alertId/actions', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          alertId: { type: 'number' },
        },
        required: ['alertId'],
      },
      body: AlertActionSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            meta: { type: 'object' },
          },
        },
      },
    },
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const alertId = Number((request.params as any).alertId);
    const action = AlertActionSchema.parse(request.body);
    const result = await alertService.performAlertAction(request.user.id, alertId, action);
    
    if (result.meta) {
      result.meta.requestId = request.id;
    }

    // Broadcast alert action via WebSocket
    if (result.success && result.data) {
      const event = {
        type: 'alert_action_performed' as const,
        data: {
          userId: request.user.id,
          alert: result.data,
          action: action.action,
        },
        timestamp: new Date().toISOString(),
        userId: request.user.id.toString(),
      };
      
      fastify.realtime.broadcastToUser(request.user.id, event);
    }
    
    return reply.send(result);
  });

  // Get notification history for an alert
  fastify.get<{
    Params: { alertId: number };
    Querystring: { page?: number; limit?: number };
  }>('/alerts/:alertId/notifications', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          alertId: { type: 'number' },
        },
        required: ['alertId'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
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
                  id: { type: 'number' },
                  alertId: { type: 'number' },
                  method: { type: 'string' },
                  recipient: { type: 'string' },
                  subject: { type: 'string' },
                  content: { type: 'string' },
                  status: { type: 'string' },
                  messageId: { type: 'string', nullable: true },
                  error: { type: 'string', nullable: true },
                  retryCount: { type: 'number' },
                  sentAt: { type: 'string', nullable: true },
                  deliveredAt: { type: 'string', nullable: true },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
            meta: { type: 'object' },
          },
        },
      },
    },
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const alertId = Number((request.params as any).alertId);
    const { page, limit } = request.query as any;

    // Verify alert belongs to user
    const alertResult = await alertService.getAlert(request.user.id, alertId);
    if (!alertResult.success) {
      return reply.send(alertResult);
    }

    const result = await notificationService.getNotificationHistory(alertId, { page, limit });
    
    if (result.meta) {
      result.meta.requestId = request.id;
    }
    
    return reply.send(result);
  });

  // Retry failed notification
  fastify.post<{
    Params: { alertId: number; notificationId: number };
  }>('/alerts/:alertId/notifications/:notificationId/retry', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        properties: {
          alertId: { type: 'number' },
          notificationId: { type: 'number' },
        },
        required: ['alertId', 'notificationId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            meta: { type: 'object' },
          },
        },
      },
    },
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const alertId = Number((request.params as any).alertId);
    const notificationId = Number((request.params as any).notificationId);

    // Verify alert belongs to user
    const alertResult = await alertService.getAlert(request.user.id, alertId);
    if (!alertResult.success) {
      return reply.send(alertResult);
    }

    const result = await notificationService.retryFailedNotification(notificationId);
    
    if (result.meta) {
      result.meta.requestId = request.id;
    }
    
    return reply.send(result);
  });
}