import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { NotificationService } from '../services/notification.js';

declare module 'fastify' {
  interface FastifyInstance {
    notification: NotificationService;
  }
}

/**
 * Notification plugin for Fastify
 * Provides notification service for sending alerts via multiple channels
 */
async function notificationPlugin(fastify: FastifyInstance): Promise<void> {
  // Initialize notification service with configuration
  const notificationService = new NotificationService(fastify.prisma, fastify.log, {
    email: {
      smtpHost: fastify.config.SMTP_HOST || 'localhost',
      smtpPort: parseInt(fastify.config.SMTP_PORT || '587'),
      smtpUser: fastify.config.SMTP_USER || '',
      smtpPassword: fastify.config.SMTP_PASSWORD || '',
      fromEmail: fastify.config.FROM_EMAIL || 'noreply@memecoin-analyzer.com',
      fromName: fastify.config.FROM_NAME || 'Meme Coin Analyzer',
    },
    push: fastify.config.FCM_SERVER_KEY
      ? {
          fcmServerKey: fastify.config.FCM_SERVER_KEY,
          apnsCertificate: fastify.config.APNS_CERTIFICATE,
        }
      : undefined,
    sms: fastify.config.TWILIO_ACCOUNT_SID
      ? {
          twilioAccountSid: fastify.config.TWILIO_ACCOUNT_SID,
          twilioAuthToken: fastify.config.TWILIO_AUTH_TOKEN || '',
          fromPhoneNumber: fastify.config.TWILIO_FROM_PHONE || '',
        }
      : undefined,
  });

  // Decorate fastify instance with notification service
  fastify.decorate('notification', notificationService);

  fastify.log.info('Notification plugin registered successfully');
}

export default fp(notificationPlugin, {
  name: 'notification',
  dependencies: ['database'],
});
