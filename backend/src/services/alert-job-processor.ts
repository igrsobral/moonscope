import { Job } from 'bullmq';
import { FastifyBaseLogger } from 'fastify';
import {
  AlertTriggerService,
  PriceUpdateEvent,
  WhaleMovementEvent,
  SocialSpikeEvent,
  VolumeSpike,
} from './alert-trigger.js';

export interface AlertJobData {
  type: 'price_update' | 'whale_movement' | 'social_spike' | 'volume_spike';
  data: PriceUpdateEvent | WhaleMovementEvent | SocialSpikeEvent | VolumeSpike;
}

export class AlertJobProcessor {
  constructor(
    private alertTriggerService: AlertTriggerService,
    private logger: FastifyBaseLogger
  ) {}

  async processAlertJob(job: Job<AlertJobData>): Promise<void> {
    try {
      const { type, data } = job.data;

      this.logger.info(
        {
          jobId: job.id,
          type,
          coinId: data.coinId,
        },
        'Processing alert job'
      );

      switch (type) {
        case 'price_update':
          await this.alertTriggerService.processPriceUpdate(data as PriceUpdateEvent);
          break;

        case 'whale_movement':
          await this.alertTriggerService.processWhaleMovement(data as WhaleMovementEvent);
          break;

        case 'social_spike':
          await this.alertTriggerService.processSocialSpike(data as SocialSpikeEvent);
          break;

        case 'volume_spike':
          await this.alertTriggerService.processVolumeSpike(data as VolumeSpike);
          break;

        default:
          throw new Error(`Unknown alert job type: ${type}`);
      }

      this.logger.info(
        {
          jobId: job.id,
          type,
          coinId: data.coinId,
        },
        'Alert job processed successfully'
      );
    } catch (error) {
      this.logger.error(
        {
          jobId: job.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          jobData: job.data,
        },
        'Error processing alert job'
      );

      throw error; // Re-throw to mark job as failed
    }
  }

  async processAlertCleanup(job: Job): Promise<void> {
    try {
      this.logger.info(
        {
          jobId: job.id,
        },
        'Processing alert cleanup job'
      );

      const [cleanedNotifications, retriedNotifications] = await Promise.all([
        this.alertTriggerService.cleanupNotificationHistory(30), // Clean up 30+ day old notifications
        this.alertTriggerService.retryFailedNotifications(3), // Retry failed notifications up to 3 times
      ]);

      this.logger.info(
        {
          jobId: job.id,
          cleanedNotifications,
          retriedNotifications,
        },
        'Alert cleanup job completed'
      );
    } catch (error) {
      this.logger.error(
        {
          jobId: job.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Error processing alert cleanup job'
      );

      throw error;
    }
  }

  async processAlertStatistics(job: Job): Promise<void> {
    try {
      this.logger.info(
        {
          jobId: job.id,
        },
        'Processing alert statistics job'
      );

      const statistics = await this.alertTriggerService.getAlertStatistics();

      this.logger.info(
        {
          jobId: job.id,
          statistics,
        },
        'Alert statistics collected'
      );

      // You could store these statistics in a database or send to monitoring service
      // For now, we just log them
    } catch (error) {
      this.logger.error(
        {
          jobId: job.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Error processing alert statistics job'
      );

      throw error;
    }
  }
}
