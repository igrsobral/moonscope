import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { AlertTriggerService } from '../services/alert-trigger.js';

declare module 'fastify' {
  interface FastifyInstance {
    alertTrigger: AlertTriggerService;
  }
}

/**
 * Alert trigger plugin for Fastify
 * Provides alert trigger service for monitoring and triggering alerts
 */
async function alertTriggerPlugin(fastify: FastifyInstance): Promise<void> {
  // Initialize alert trigger service
  const alertTriggerService = new AlertTriggerService(
    fastify.prisma,
    fastify.log,
    fastify.cache,
    fastify.notification
  );

  // Decorate fastify instance with alert trigger service
  fastify.decorate('alertTrigger', alertTriggerService);

  fastify.log.info('Alert trigger plugin registered successfully');
}

export default fp(alertTriggerPlugin, {
  name: 'alert-trigger',
  dependencies: ['database', 'cache', 'notification'],
});