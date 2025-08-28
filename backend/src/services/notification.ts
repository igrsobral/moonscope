import { PrismaClient } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
import { NotificationDelivery, NotificationStatus } from '../schemas/alerts.js';
import { ApiResponse } from '../types/index.js';

export interface NotificationChannel {
  send(delivery: NotificationDelivery): Promise<NotificationResult>;
  validateRecipient(recipient: string): boolean;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryable?: boolean;
}

export interface NotificationHistory {
  id: number;
  alertId: number;
  method: string;
  recipient: string;
  subject: string;
  content: string;
  status: string;
  messageId?: string;
  error?: string;
  retryCount: number;
  sentAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class EmailNotificationChannel implements NotificationChannel {
  constructor(
    private config: {
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPassword: string;
      fromEmail: string;
      fromName: string;
    },
    private logger: FastifyBaseLogger
  ) { }

  validateRecipient(recipient: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(recipient);
  }

  async send(delivery: NotificationDelivery): Promise<NotificationResult> {
    try {
      // In a real implementation, you would use a library like nodemailer
      // For now, we'll simulate the email sending
      this.logger.info({
        method: 'email',
        recipient: delivery.recipient,
        subject: delivery.subject,
        alertId: delivery.alertId,
      }, 'Sending email notification');

      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Simulate occasional failures for testing retry logic
      if (Math.random() < 0.05) { // 5% failure rate
        throw new Error('SMTP server temporarily unavailable');
      }

      const messageId = `email_${Date.now()}_${Math.random().toString(36).substring(2)}`;

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        method: 'email',
        recipient: delivery.recipient,
        alertId: delivery.alertId,
      }, 'Failed to send email notification');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      };
    }
  }
}

export class PushNotificationChannel implements NotificationChannel {
  constructor(
    private config: {
      fcmServerKey: string;
      apnsCertificate?: string;
    },
    private logger: FastifyBaseLogger
  ) { }

  validateRecipient(recipient: string): boolean {
    // Push notification recipient should be a device token
    return recipient.length > 10 && /^[a-zA-Z0-9_-]+$/.test(recipient);
  }

  async send(delivery: NotificationDelivery): Promise<NotificationResult> {
    try {
      this.logger.info({
        method: 'push',
        recipient: delivery.recipient,
        subject: delivery.subject,
        alertId: delivery.alertId,
      }, 'Sending push notification');

      // Simulate push notification sending
      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate occasional failures
      if (Math.random() < 0.03) { // 3% failure rate
        throw new Error('Push service unavailable');
      }

      const messageId = `push_${Date.now()}_${Math.random().toString(36).substring(2)}`;

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        method: 'push',
        recipient: delivery.recipient,
        alertId: delivery.alertId,
      }, 'Failed to send push notification');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      };
    }
  }
}

export class SMSNotificationChannel implements NotificationChannel {
  constructor(
    private config: {
      twilioAccountSid: string;
      twilioAuthToken: string;
      fromPhoneNumber: string;
    },
    private logger: FastifyBaseLogger
  ) { }

  validateRecipient(recipient: string): boolean {
    // Basic phone number validation
    const phoneRegex = /^\+?[1-9]\d{4,14}$/;
    return phoneRegex.test(recipient.replace(/[\s-()]/g, ''));
  }

  async send(delivery: NotificationDelivery): Promise<NotificationResult> {
    try {
      this.logger.info({
        method: 'sms',
        recipient: delivery.recipient,
        alertId: delivery.alertId,
      }, 'Sending SMS notification');

      // Simulate SMS sending
      await new Promise(resolve => setTimeout(resolve, 200));

      // Simulate occasional failures
      if (Math.random() < 0.02) { // 2% failure rate
        throw new Error('SMS service rate limit exceeded');
      }

      const messageId = `sms_${Date.now()}_${Math.random().toString(36).substring(2)}`;

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        method: 'sms',
        recipient: delivery.recipient,
        alertId: delivery.alertId,
      }, 'Failed to send SMS notification');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      };
    }
  }
}

export class NotificationService {
  private channels: Map<string, NotificationChannel> = new Map();
  private maxRetries = 3;
  private retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s

  constructor(
    private prisma: PrismaClient,
    private logger: FastifyBaseLogger,
    config: {
      email?: {
        smtpHost: string;
        smtpPort: number;
        smtpUser: string;
        smtpPassword: string;
        fromEmail: string;
        fromName: string;
      };
      push?: {
        fcmServerKey: string;
        apnsCertificate?: string;
      };
      sms?: {
        twilioAccountSid: string;
        twilioAuthToken: string;
        fromPhoneNumber: string;
      };
    }
  ) {
    // Initialize notification channels based on available configuration
    if (config.email) {
      this.channels.set('email', new EmailNotificationChannel(config.email, logger));
    }
    if (config.push) {
      this.channels.set('push', new PushNotificationChannel(config.push, logger));
    }
    if (config.sms) {
      this.channels.set('sms', new SMSNotificationChannel(config.sms, logger));
    }
  }

  async sendNotification(delivery: NotificationDelivery): Promise<ApiResponse<NotificationHistory>> {
    try {
      const channel = this.channels.get(delivery.method);
      if (!channel) {
        return {
          success: false,
          error: {
            code: 'CHANNEL_NOT_AVAILABLE',
            message: `Notification channel '${delivery.method}' is not configured`,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: `notif_${Date.now()}`,
          },
        };
      }

      // Validate recipient
      if (!channel.validateRecipient(delivery.recipient)) {
        return {
          success: false,
          error: {
            code: 'INVALID_RECIPIENT',
            message: `Invalid recipient format for ${delivery.method}: ${delivery.recipient}`,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: `notif_${Date.now()}`,
          },
        };
      }

      // Create notification history record
      const notificationHistory = await this.prisma.notificationHistory.create({
        data: {
          alertId: delivery.alertId,
          method: delivery.method,
          recipient: delivery.recipient,
          subject: delivery.subject,
          content: delivery.content,
          status: 'pending',
          retryCount: 0,
          metadata: delivery.metadata as any || {},
        },
      });

      // Send notification
      const result = await this.sendWithRetry(channel, delivery, notificationHistory.id);

      return {
        success: result.success,
        data: result.history,
        error: result.success ? undefined : {
          code: 'NOTIFICATION_FAILED',
          message: result.error || 'Failed to send notification',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `notif_${notificationHistory.id}`,
        },
      };
    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        delivery,
      }, 'Error in sendNotification');

      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error while sending notification',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `notif_error_${Date.now()}`,
        },
      };
    }
  }

  private async sendWithRetry(
    channel: NotificationChannel,
    delivery: NotificationDelivery,
    historyId: number
  ): Promise<{ success: boolean; error?: string; history: NotificationHistory }> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Add delay for retries
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelays[attempt - 1] || 15000));
        }

        const result = await channel.send(delivery);

        if (result.success) {
          // Update notification history with success
          const updatedHistory = await this.prisma.notificationHistory.update({
            where: { id: historyId },
            data: {
              status: 'sent',
              messageId: result.messageId,
              sentAt: new Date(),
              retryCount: attempt,
            },
          });

          return {
            success: true,
            history: updatedHistory as NotificationHistory,
          };
        } else {
          lastError = result.error;

          // Update retry count
          await this.prisma.notificationHistory.update({
            where: { id: historyId },
            data: {
              status: attempt < this.maxRetries && result.retryable ? 'retrying' : 'failed',
              error: result.error,
              retryCount: attempt,
            },
          });

          // If not retryable, break early
          if (!result.retryable) {
            break;
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';

        await this.prisma.notificationHistory.update({
          where: { id: historyId },
          data: {
            status: attempt < this.maxRetries ? 'retrying' : 'failed',
            error: lastError,
            retryCount: attempt,
          },
        });
      }
    }

    // Final update with failed status
    const finalHistory = await this.prisma.notificationHistory.update({
      where: { id: historyId },
      data: {
        status: 'failed',
        error: lastError,
      },
    });

    return {
      success: false,
      error: lastError,
      history: finalHistory as NotificationHistory,
    };
  }

  async getNotificationHistory(
    alertId: number,
    options: { page?: number; limit?: number } = {}
  ): Promise<ApiResponse<NotificationHistory[]>> {
    try {
      const page = options.page || 1;
      const limit = Math.min(options.limit || 20, 100);
      const skip = (page - 1) * limit;

      const [notifications, total] = await Promise.all([
        this.prisma.notificationHistory.findMany({
          where: { alertId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.notificationHistory.count({
          where: { alertId },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: notifications as NotificationHistory[],
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `history_${Date.now()}`,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        },
      };
    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        alertId,
      }, 'Error getting notification history');

      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to retrieve notification history',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `history_error_${Date.now()}`,
        },
      };
    }
  }

  async retryFailedNotification(historyId: number): Promise<ApiResponse<NotificationHistory>> {
    try {
      const notification = await this.prisma.notificationHistory.findUnique({
        where: { id: historyId },
      });

      if (!notification) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Notification history not found',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: `retry_${historyId}`,
          },
        };
      }

      if (notification.status !== 'failed') {
        return {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Only failed notifications can be retried',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: `retry_${historyId}`,
          },
        };
      }

      // Create new delivery request
      const delivery: NotificationDelivery = {
        alertId: notification.alertId,
        method: notification.method as 'email' | 'push' | 'sms',
        recipient: notification.recipient,
        subject: notification.subject,
        content: notification.content,
        metadata: notification.metadata as Record<string, unknown>,
      };

      // Send notification
      return await this.sendNotification(delivery);
    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        historyId,
      }, 'Error retrying notification');

      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error while retrying notification',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `retry_error_${historyId}`,
        },
      };
    }
  }
}