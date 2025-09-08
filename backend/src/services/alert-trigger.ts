import { PrismaClient } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
import { AlertService, AlertTriggerContext } from './alert.js';
import { CacheService } from './cache.js';
import { NotificationService } from './notification.js';

export interface PriceUpdateEvent {
  coinId: number;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  timestamp: Date;
}

export interface WhaleMovementEvent {
  coinId: number;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  usdValue: number;
  timestamp: Date;
}

export interface SocialSpikeEvent {
  coinId: number;
  platform: string;
  socialScore: number;
  mentions24h: number;
  sentimentScore: number;
  timestamp: Date;
}

export interface VolumeSpike {
  coinId: number;
  volume24h: number;
  volumeChange24h: number;
  timestamp: Date;
}

export class AlertTriggerService {
  private alertService: AlertService;

  constructor(
    private prisma: PrismaClient,
    private logger: FastifyBaseLogger,
    private cache: CacheService,
    private notificationService: NotificationService
  ) {
    this.alertService = new AlertService(prisma, logger, cache, notificationService);
  }

  /**
   * Process price update and check for triggered alerts
   */
  async processPriceUpdate(event: PriceUpdateEvent): Promise<void> {
    try {
      const context: AlertTriggerContext = {
        coinId: event.coinId,
        currentPrice: event.price,
        priceChange24h: event.priceChange24h,
        volume24h: event.volume24h,
      };

      await this.alertService.checkAlerts(context);

      this.logger.debug(
        {
          coinId: event.coinId,
          price: event.price,
          priceChange24h: event.priceChange24h,
        },
        'Processed price update for alert checking'
      );
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          event,
        },
        'Error processing price update for alerts'
      );
    }
  }

  /**
   * Process whale movement and check for triggered alerts
   */
  async processWhaleMovement(event: WhaleMovementEvent): Promise<void> {
    try {
      const context: AlertTriggerContext = {
        coinId: event.coinId,
        whaleTransaction: {
          amount: event.amount,
          usdValue: event.usdValue,
          txHash: event.txHash,
        },
      };

      await this.alertService.checkAlerts(context);

      this.logger.debug(
        {
          coinId: event.coinId,
          txHash: event.txHash,
          usdValue: event.usdValue,
        },
        'Processed whale movement for alert checking'
      );
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          event,
        },
        'Error processing whale movement for alerts'
      );
    }
  }

  /**
   * Process social spike and check for triggered alerts
   */
  async processSocialSpike(event: SocialSpikeEvent): Promise<void> {
    try {
      const context: AlertTriggerContext = {
        coinId: event.coinId,
        socialScore: event.socialScore,
      };

      await this.alertService.checkAlerts(context);

      this.logger.debug(
        {
          coinId: event.coinId,
          platform: event.platform,
          socialScore: event.socialScore,
        },
        'Processed social spike for alert checking'
      );
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          event,
        },
        'Error processing social spike for alerts'
      );
    }
  }

  /**
   * Process volume spike and check for triggered alerts
   */
  async processVolumeSpike(event: VolumeSpike): Promise<void> {
    try {
      const context: AlertTriggerContext = {
        coinId: event.coinId,
        volume24h: event.volume24h,
      };

      await this.alertService.checkAlerts(context);

      this.logger.debug(
        {
          coinId: event.coinId,
          volume24h: event.volume24h,
          volumeChange24h: event.volumeChange24h,
        },
        'Processed volume spike for alert checking'
      );
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          event,
        },
        'Error processing volume spike for alerts'
      );
    }
  }

  /**
   * Get alert statistics for monitoring
   */
  async getAlertStatistics(): Promise<{
    totalAlerts: number;
    activeAlerts: number;
    alertsByType: Record<string, number>;
    recentTriggers: number;
  }> {
    try {
      const [totalAlerts, activeAlerts, alertsByType, recentTriggers] = await Promise.all([
        this.prisma.alert.count(),
        this.prisma.alert.count({ where: { isActive: true } }),
        this.prisma.alert.groupBy({
          by: ['type'],
          _count: { type: true },
        }),
        this.prisma.alert.count({
          where: {
            lastTriggered: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        }),
      ]);

      const alertTypeStats = alertsByType.reduce(
        (acc, item) => {
          acc[item.type] = item._count.type;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        totalAlerts,
        activeAlerts,
        alertsByType: alertTypeStats,
        recentTriggers,
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Error getting alert statistics'
      );

      return {
        totalAlerts: 0,
        activeAlerts: 0,
        alertsByType: {},
        recentTriggers: 0,
      };
    }
  }

  /**
   * Clean up old notification history
   */
  async cleanupNotificationHistory(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      const result = await this.prisma.notificationHistory.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          status: {
            in: ['sent', 'delivered', 'failed'],
          },
        },
      });

      this.logger.info(
        {
          deletedCount: result.count,
          cutoffDate,
        },
        'Cleaned up old notification history'
      );

      return result.count;
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          olderThanDays,
        },
        'Error cleaning up notification history'
      );

      return 0;
    }
  }

  /**
   * Retry failed notifications
   */
  async retryFailedNotifications(maxRetries: number = 3): Promise<number> {
    try {
      const failedNotifications = await this.prisma.notificationHistory.findMany({
        where: {
          status: 'failed',
          retryCount: {
            lt: maxRetries,
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Only retry from last 24 hours
          },
        },
        take: 100, // Limit to prevent overwhelming the system
      });

      let retriedCount = 0;
      for (const notification of failedNotifications) {
        try {
          await this.notificationService.retryFailedNotification(notification.id);
          retriedCount++;
        } catch (error) {
          this.logger.error(
            {
              error: error instanceof Error ? error.message : 'Unknown error',
              notificationId: notification.id,
            },
            'Error retrying failed notification'
          );
        }
      }

      this.logger.info(
        {
          retriedCount,
          totalFailed: failedNotifications.length,
        },
        'Retried failed notifications'
      );

      return retriedCount;
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          maxRetries,
        },
        'Error retrying failed notifications'
      );

      return 0;
    }
  }
}
