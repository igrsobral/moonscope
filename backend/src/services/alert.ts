import { PrismaClient, Alert, Coin, PriceData, Prisma } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
import { CacheService } from './cache.js';
import { NotificationService } from './notification.js';
import {
  AlertQuery,
  CreateAlert,
  UpdateAlert,
  AlertAction,
  NotificationDelivery,
} from '../schemas/alerts.js';
import { ApiResponse, PaginationMeta, WebSocketEvent } from '../types/index.js';

export interface AlertWithCoin extends Alert {
  coin: Coin;
}

export interface AlertTriggerContext {
  coinId: number;
  currentPrice?: number;
  priceChange24h?: number;
  volume24h?: number;
  socialScore?: number;
  whaleTransaction?: {
    amount: number;
    usdValue: number;
    txHash: string;
  };
}

export interface AlertTriggerResult {
  triggered: boolean;
  reason?: string;
  data?: Record<string, unknown>;
}

export class AlertService {
  constructor(
    private prisma: PrismaClient,
    private logger: FastifyBaseLogger,
    private cache: CacheService,
    private notificationService: NotificationService
  ) {}

  async getAlerts(userId: number, query: AlertQuery): Promise<ApiResponse<AlertWithCoin[]>> {
    try {
      const { page, limit, sortBy, sortOrder, coinId, type, isActive } = query;
      const skip = (page - 1) * limit;

      const where: Prisma.AlertWhereInput = {
        userId,
        ...(coinId && { coinId }),
        ...(type && { type }),
        ...(isActive !== undefined && { isActive }),
      };

      const orderBy: Prisma.AlertOrderByWithRelationInput = {
        [sortBy]: sortOrder,
      };

      const [alerts, total] = await Promise.all([
        this.prisma.alert.findMany({
          where,
          include: {
            coin: true,
          },
          orderBy,
          skip,
          take: limit,
        }),
        this.prisma.alert.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: alerts as AlertWithCoin[],
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `alerts_${Date.now()}`,
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
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          query,
        },
        'Error getting alerts'
      );

      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to retrieve alerts',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `alerts_error_${Date.now()}`,
        },
      };
    }
  }

  async getAlert(userId: number, alertId: number): Promise<ApiResponse<AlertWithCoin>> {
    try {
      const alert = await this.prisma.alert.findFirst({
        where: {
          id: alertId,
          userId,
        },
        include: {
          coin: true,
        },
      });

      if (!alert) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Alert not found',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: `alert_${alertId}`,
          },
        };
      }

      return {
        success: true,
        data: alert as AlertWithCoin,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `alert_${alertId}`,
        },
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          alertId,
        },
        'Error getting alert'
      );

      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to retrieve alert',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `alert_error_${alertId}`,
        },
      };
    }
  }

  async createAlert(userId: number, data: CreateAlert): Promise<ApiResponse<AlertWithCoin>> {
    try {
      // Verify coin exists
      const coin = await this.prisma.coin.findUnique({
        where: { id: data.coinId },
      });

      if (!coin) {
        return {
          success: false,
          error: {
            code: 'COIN_NOT_FOUND',
            message: 'Coin not found',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: `create_alert_${Date.now()}`,
          },
        };
      }

      // Validate condition based on alert type
      const validationResult = this.validateAlertCondition(data.type, data.condition);
      if (!validationResult.valid) {
        return {
          success: false,
          error: {
            code: 'INVALID_CONDITION',
            message: validationResult.message || 'Invalid alert condition',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: `create_alert_${Date.now()}`,
          },
        };
      }

      const alert = await this.prisma.alert.create({
        data: {
          userId,
          coinId: data.coinId,
          type: data.type,
          condition: data.condition,
          notificationMethods: data.notificationMethods,
          name: data.name,
          description: data.description,
        },
        include: {
          coin: true,
        },
      });

      // Clear user's alert cache
      await this.cache.delete(`alerts:user:${userId}`);

      this.logger.info(
        {
          userId,
          alertId: alert.id,
          coinId: data.coinId,
          type: data.type,
        },
        'Alert created successfully'
      );

      return {
        success: true,
        data: alert as AlertWithCoin,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `create_alert_${alert.id}`,
        },
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          data,
        },
        'Error creating alert'
      );

      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to create alert',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `create_alert_error_${Date.now()}`,
        },
      };
    }
  }

  async updateAlert(
    userId: number,
    alertId: number,
    data: UpdateAlert
  ): Promise<ApiResponse<AlertWithCoin>> {
    try {
      // Check if alert exists and belongs to user
      const existingAlert = await this.prisma.alert.findFirst({
        where: {
          id: alertId,
          userId,
        },
      });

      if (!existingAlert) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Alert not found',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: `update_alert_${alertId}`,
          },
        };
      }

      // Validate condition if provided
      if (data.condition) {
        const validationResult = this.validateAlertCondition(
          existingAlert.type as any,
          data.condition
        );
        if (!validationResult.valid) {
          return {
            success: false,
            error: {
              code: 'INVALID_CONDITION',
              message: validationResult.message || 'Invalid alert condition',
            },
            meta: {
              timestamp: new Date().toISOString(),
              requestId: `update_alert_${alertId}`,
            },
          };
        }
      }

      const alert = await this.prisma.alert.update({
        where: { id: alertId },
        data: {
          ...(data.condition && { condition: data.condition }),
          ...(data.notificationMethods && { notificationMethods: data.notificationMethods }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
        },
        include: {
          coin: true,
        },
      });

      // Clear user's alert cache
      await this.cache.delete(`alerts:user:${userId}`);

      this.logger.info(
        {
          userId,
          alertId,
          updates: Object.keys(data),
        },
        'Alert updated successfully'
      );

      return {
        success: true,
        data: alert as AlertWithCoin,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `update_alert_${alertId}`,
        },
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          alertId,
          data,
        },
        'Error updating alert'
      );

      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to update alert',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `update_alert_error_${alertId}`,
        },
      };
    }
  }

  async deleteAlert(userId: number, alertId: number): Promise<ApiResponse<void>> {
    try {
      // Check if alert exists and belongs to user
      const existingAlert = await this.prisma.alert.findFirst({
        where: {
          id: alertId,
          userId,
        },
      });

      if (!existingAlert) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Alert not found',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: `delete_alert_${alertId}`,
          },
        };
      }

      await this.prisma.alert.delete({
        where: { id: alertId },
      });

      // Clear user's alert cache
      await this.cache.delete(`alerts:user:${userId}`);

      this.logger.info(
        {
          userId,
          alertId,
        },
        'Alert deleted successfully'
      );

      return {
        success: true,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `delete_alert_${alertId}`,
        },
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          alertId,
        },
        'Error deleting alert'
      );

      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to delete alert',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `delete_alert_error_${alertId}`,
        },
      };
    }
  }

  async performAlertAction(
    userId: number,
    alertId: number,
    action: AlertAction
  ): Promise<ApiResponse<AlertWithCoin>> {
    try {
      const existingAlert = await this.prisma.alert.findFirst({
        where: {
          id: alertId,
          userId,
        },
        include: {
          coin: true,
        },
      });

      if (!existingAlert) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Alert not found',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: `action_alert_${alertId}`,
          },
        };
      }

      let updatedAlert: AlertWithCoin;

      switch (action.action) {
        case 'pause':
          updatedAlert = (await this.prisma.alert.update({
            where: { id: alertId },
            data: { isActive: false },
            include: { coin: true },
          })) as AlertWithCoin;
          break;

        case 'resume':
          updatedAlert = (await this.prisma.alert.update({
            where: { id: alertId },
            data: { isActive: true },
            include: { coin: true },
          })) as AlertWithCoin;
          break;

        case 'test':
          // Send a test notification
          await this.sendTestNotification(existingAlert as AlertWithCoin);
          updatedAlert = existingAlert as AlertWithCoin;
          break;

        default:
          return {
            success: false,
            error: {
              code: 'INVALID_ACTION',
              message: 'Invalid alert action',
            },
            meta: {
              timestamp: new Date().toISOString(),
              requestId: `action_alert_${alertId}`,
            },
          };
      }

      // Clear user's alert cache
      await this.cache.delete(`alerts:user:${userId}`);

      this.logger.info(
        {
          userId,
          alertId,
          action: action.action,
        },
        'Alert action performed successfully'
      );

      return {
        success: true,
        data: updatedAlert,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `action_alert_${alertId}`,
        },
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          alertId,
          action,
        },
        'Error performing alert action'
      );

      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to perform alert action',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: `action_alert_error_${alertId}`,
        },
      };
    }
  }

  async checkAlerts(context: AlertTriggerContext): Promise<void> {
    try {
      // Get all active alerts for this coin
      const alerts = await this.prisma.alert.findMany({
        where: {
          coinId: context.coinId,
          isActive: true,
        },
        include: {
          coin: true,
          user: true,
        },
      });

      for (const alert of alerts) {
        const triggerResult = this.evaluateAlertCondition(alert, context);

        if (triggerResult.triggered) {
          await this.triggerAlert(alert as AlertWithCoin & { user: any }, triggerResult, context);
        }
      }
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          context,
        },
        'Error checking alerts'
      );
    }
  }

  private validateAlertCondition(
    type: 'price_above' | 'price_below' | 'volume_spike' | 'whale_movement' | 'social_spike',
    condition: any
  ): { valid: boolean; message?: string } {
    switch (type) {
      case 'price_above':
      case 'price_below':
        if (!condition.targetPrice && !condition.percentageChange) {
          return { valid: false, message: 'Price alerts require targetPrice or percentageChange' };
        }
        break;

      case 'volume_spike':
        if (!condition.volumeThreshold && !condition.percentageChange) {
          return {
            valid: false,
            message: 'Volume spike alerts require volumeThreshold or percentageChange',
          };
        }
        break;

      case 'whale_movement':
        if (!condition.volumeThreshold) {
          return { valid: false, message: 'Whale movement alerts require volumeThreshold' };
        }
        break;

      case 'social_spike':
        if (!condition.socialThreshold && !condition.percentageChange) {
          return {
            valid: false,
            message: 'Social spike alerts require socialThreshold or percentageChange',
          };
        }
        break;

      default:
        return { valid: false, message: 'Invalid alert type' };
    }

    return { valid: true };
  }

  private evaluateAlertCondition(alert: Alert, context: AlertTriggerContext): AlertTriggerResult {
    const condition = alert.condition as any;

    switch (alert.type) {
      case 'price_above':
        if (
          condition.targetPrice &&
          context.currentPrice &&
          context.currentPrice >= condition.targetPrice
        ) {
          return {
            triggered: true,
            reason: `Price reached target of $${condition.targetPrice}`,
            data: { currentPrice: context.currentPrice, targetPrice: condition.targetPrice },
          };
        }
        if (
          condition.percentageChange &&
          context.priceChange24h &&
          context.priceChange24h >= condition.percentageChange
        ) {
          return {
            triggered: true,
            reason: `Price increased by ${context.priceChange24h.toFixed(2)}%`,
            data: { priceChange24h: context.priceChange24h, threshold: condition.percentageChange },
          };
        }
        break;

      case 'price_below':
        if (
          condition.targetPrice &&
          context.currentPrice &&
          context.currentPrice <= condition.targetPrice
        ) {
          return {
            triggered: true,
            reason: `Price dropped below $${condition.targetPrice}`,
            data: { currentPrice: context.currentPrice, targetPrice: condition.targetPrice },
          };
        }
        if (
          condition.percentageChange &&
          context.priceChange24h &&
          context.priceChange24h <= -Math.abs(condition.percentageChange)
        ) {
          return {
            triggered: true,
            reason: `Price decreased by ${Math.abs(context.priceChange24h).toFixed(2)}%`,
            data: { priceChange24h: context.priceChange24h, threshold: condition.percentageChange },
          };
        }
        break;

      case 'volume_spike':
        if (
          condition.volumeThreshold &&
          context.volume24h &&
          context.volume24h >= condition.volumeThreshold
        ) {
          return {
            triggered: true,
            reason: `Volume spike detected: $${context.volume24h.toLocaleString()}`,
            data: { volume24h: context.volume24h, threshold: condition.volumeThreshold },
          };
        }
        break;

      case 'whale_movement':
        if (
          context.whaleTransaction &&
          condition.volumeThreshold &&
          context.whaleTransaction.usdValue >= condition.volumeThreshold
        ) {
          return {
            triggered: true,
            reason: `Whale transaction detected: $${context.whaleTransaction.usdValue.toLocaleString()}`,
            data: {
              whaleTransaction: context.whaleTransaction,
              threshold: condition.volumeThreshold,
            },
          };
        }
        break;

      case 'social_spike':
        if (
          condition.socialThreshold &&
          context.socialScore &&
          context.socialScore >= condition.socialThreshold
        ) {
          return {
            triggered: true,
            reason: `Social activity spike detected: ${context.socialScore}`,
            data: { socialScore: context.socialScore, threshold: condition.socialThreshold },
          };
        }
        break;
    }

    return { triggered: false };
  }

  private async triggerAlert(
    alert: AlertWithCoin & { user: any },
    triggerResult: AlertTriggerResult,
    context: AlertTriggerContext
  ): Promise<void> {
    try {
      // Update last triggered timestamp
      await this.prisma.alert.update({
        where: { id: alert.id },
        data: { lastTriggered: new Date() },
      });

      // Send notifications
      const notificationMethods = alert.notificationMethods as string[];
      for (const method of notificationMethods) {
        await this.sendAlertNotification(alert, method, triggerResult, context);
      }

      this.logger.info(
        {
          alertId: alert.id,
          userId: alert.userId,
          coinId: alert.coinId,
          type: alert.type,
          reason: triggerResult.reason,
        },
        'Alert triggered successfully'
      );
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          alertId: alert.id,
          triggerResult,
          context,
        },
        'Error triggering alert'
      );
    }
  }

  private async sendAlertNotification(
    alert: AlertWithCoin & { user: any },
    method: string,
    triggerResult: AlertTriggerResult,
    context: AlertTriggerContext
  ): Promise<void> {
    try {
      const recipient = this.getNotificationRecipient(alert.user, method);
      if (!recipient) {
        this.logger.warn(
          {
            alertId: alert.id,
            method,
            userId: alert.userId,
          },
          'No recipient configured for notification method'
        );
        return;
      }

      const { subject, content } = this.formatAlertMessage(alert, triggerResult, context);

      const delivery: NotificationDelivery = {
        alertId: alert.id,
        method: method as 'email' | 'push' | 'sms',
        recipient,
        subject,
        content,
        metadata: {
          alertType: alert.type,
          coinSymbol: alert.coin.symbol,
          coinName: alert.coin.name,
          triggerReason: triggerResult.reason,
          triggerData: triggerResult.data,
        },
      };

      await this.notificationService.sendNotification(delivery);
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          alertId: alert.id,
          method,
        },
        'Error sending alert notification'
      );
    }
  }

  private async sendTestNotification(alert: AlertWithCoin): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: alert.userId },
      });

      if (!user) return;

      const notificationMethods = alert.notificationMethods as string[];
      for (const method of notificationMethods) {
        const recipient = this.getNotificationRecipient(user, method);
        if (!recipient) continue;

        const delivery: NotificationDelivery = {
          alertId: alert.id,
          method: method as 'email' | 'push' | 'sms',
          recipient,
          subject: `Test Alert: ${alert.coin.symbol} Alert`,
          content: `This is a test notification for your ${alert.type} alert on ${alert.coin.name} (${alert.coin.symbol}). Your alert is working correctly!`,
          metadata: {
            alertType: alert.type,
            coinSymbol: alert.coin.symbol,
            coinName: alert.coin.name,
            isTest: true,
          },
        };

        await this.notificationService.sendNotification(delivery);
      }
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          alertId: alert.id,
        },
        'Error sending test notification'
      );
    }
  }

  private getNotificationRecipient(user: any, method: string): string | null {
    switch (method) {
      case 'email':
        return user.email;
      case 'push':
        // In a real implementation, you would get the user's device token
        return user.deviceToken || null;
      case 'sms':
        // In a real implementation, you would get the user's phone number
        return user.phoneNumber || null;
      default:
        return null;
    }
  }

  private formatAlertMessage(
    alert: AlertWithCoin,
    triggerResult: AlertTriggerResult,
    context: AlertTriggerContext
  ): { subject: string; content: string } {
    const coinName = `${alert.coin.name} (${alert.coin.symbol})`;
    const alertName = alert.name || `${alert.type} alert`;

    const subject = `🚨 Alert Triggered: ${coinName}`;

    let content = `Your ${alertName} for ${coinName} has been triggered!\n\n`;
    content += `Reason: ${triggerResult.reason}\n`;

    if (context.currentPrice) {
      content += `Current Price: $${context.currentPrice.toFixed(6)}\n`;
    }

    if (context.priceChange24h) {
      const changeSymbol = context.priceChange24h >= 0 ? '+' : '';
      content += `24h Change: ${changeSymbol}${context.priceChange24h.toFixed(2)}%\n`;
    }

    if (context.volume24h) {
      content += `24h Volume: $${context.volume24h.toLocaleString()}\n`;
    }

    content += `\nAlert created: ${alert.createdAt.toLocaleDateString()}\n`;
    content += `\nView more details in your dashboard.`;

    return { subject, content };
  }
}
