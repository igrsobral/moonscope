import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  AlertQuerySchema,
  CreateAlertSchema,
  UpdateAlertSchema,
  AlertActionSchema,
} from '../schemas/alerts.js';
import { AlertService } from '../services/alert.js';
import { NotificationService } from '../services/notification.js';

/**
 * Alert routes
 */
export async function alertRoutes(fastify: FastifyInstance): Promise<void> {
  // Initialize notification service
  const notificationService = new NotificationService(fastify.prisma, fastify.log, {
    email: {
      smtpHost: fastify.config.SMTP_HOST || 'localhost',
      smtpPort: parseInt(fastify.config.SMTP_PORT || '587'),
      smtpUser: fastify.config.SMTP_USER || '',
      smtpPassword: fastify.config.SMTP_PASSWORD || '',
      fromEmail: fastify.config.FROM_EMAIL || 'noreply@memecoin-analyzer.com',
      fromName: fastify.config.FROM_NAME || 'Meme Coin Analyzer',
    },
    // Add other notification channels as needed
  });

  const alertService = new AlertService(
    fastify.prisma,
    fastify.log,
    fastify.cache,
    notificationService
  );

  // Get user's alerts
  fastify.route({
    method: 'GET',
    url: '/alerts',
    preHandler: [fastify.authenticate],
    handler: async (request: any, reply: FastifyReply) => {
      const query = AlertQuerySchema.parse(request.query);
      const result = await alertService.getAlerts(request.user.id, query);

      if (result.meta) {
        result.meta.requestId = request.id;
      }

      return reply.send(result);
    },
  });

  // Get specific alert
  fastify.route({
    method: 'GET',
    url: '/alerts/:alertId',
    preHandler: [fastify.authenticate],
    handler: async (request: any, reply: FastifyReply) => {
      const alertId = Number((request.params as any).alertId);
      const result = await alertService.getAlert(request.user.id, alertId);

      if (result.meta) {
        result.meta.requestId = request.id;
      }

      return reply.send(result);
    },
  });

  // Create new alert
  fastify.route({
    method: 'POST',
    url: '/alerts',
    preHandler: [fastify.authenticate],
    handler: async (request: any, reply: FastifyReply) => {
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
    },
  });

  // Update alert
  fastify.route({
    method: 'PUT',
    url: '/alerts/:alertId',
    preHandler: [fastify.authenticate],
    handler: async (request: any, reply: FastifyReply) => {
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
    },
  });

  // Delete alert
  fastify.route({
    method: 'DELETE',
    url: '/alerts/:alertId',
    preHandler: [fastify.authenticate],
    handler: async (request: any, reply: FastifyReply) => {
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
    },
  });

  // Perform alert action (pause, resume, test)
  fastify.route({
    method: 'POST',
    url: '/alerts/:alertId/actions',
    preHandler: [fastify.authenticate],
    handler: async (request: any, reply: FastifyReply) => {
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
    },
  });

  // Get notification history for an alert
  fastify.route({
    method: 'GET',
    url: '/alerts/:alertId/notifications',
    preHandler: [fastify.authenticate],
    handler: async (request: any, reply: FastifyReply) => {
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
    },
  });

  // Retry failed notification
  fastify.route({
    method: 'POST',
    url: '/alerts/:alertId/notifications/:notificationId/retry',
    preHandler: [fastify.authenticate],
    handler: async (request: any, reply: FastifyReply) => {
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
    },
  });
}
