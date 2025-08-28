import { FastifyBaseLogger } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { QueueManager } from '../plugins/queue.js';

export interface ScheduledJobConfig {
  name: string;
  queue: string;
  jobName: string;
  schedule: string; // Cron pattern
  data?: any;
  enabled: boolean;
}

export class JobScheduler {
  private prisma: PrismaClient;
  private queueManager: QueueManager;
  private logger: FastifyBaseLogger;
  // private scheduledJobs: Map<string, any> = new Map(); // Unused for now

  constructor(
    prisma: PrismaClient,
    queueManager: QueueManager,
    logger: FastifyBaseLogger
  ) {
    this.prisma = prisma;
    this.queueManager = queueManager;
    this.logger = logger;
  }

  /**
   * Initialize scheduled jobs
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing job scheduler...');

    // Schedule price update jobs
    await this.schedulePriceUpdateJobs();

    // Schedule social data scraping jobs
    await this.scheduleSocialScrapingJobs();

    // Schedule risk assessment jobs
    await this.scheduleRiskAssessmentJobs();

    // Schedule alert processing jobs
    await this.scheduleAlertProcessingJobs();

    // Schedule whale tracking jobs
    await this.scheduleWhaleTrackingJobs();

    // Schedule cleanup jobs
    await this.scheduleCleanupJobs();

    this.logger.info('Job scheduler initialized');
  }

  /**
   * Schedule price update jobs for all active coins
   */
  private async schedulePriceUpdateJobs(): Promise<void> {
    try {
      // Get all active coins
      const coins = await this.prisma.coin.findMany({
        select: { id: true, symbol: true, address: true },
      });

      this.logger.info({ coinCount: coins.length }, 'Scheduling price update jobs');

      for (const coin of coins) {
        // Schedule price updates every 5 minutes
        await this.queueManager.addJob(
          'price-updates',
          'update-coin-price',
          {
            coinId: coin.id,
            coinAddress: coin.address,
            symbol: coin.symbol,
          },
          {
            repeat: {
              pattern: '*/5 * * * *', // Every 5 minutes
            },
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          }
        );
      }

      this.logger.info({ coinCount: coins.length }, 'Price update jobs scheduled');
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to schedule price update jobs');
      throw error;
    }
  }

  /**
   * Schedule social data scraping jobs
   */
  private async scheduleSocialScrapingJobs(): Promise<void> {
    try {
      // Get coins with social tracking enabled
      const coins = await this.prisma.coin.findMany({
        select: { id: true, symbol: true, name: true },
      });

      this.logger.info({ coinCount: coins.length }, 'Scheduling social scraping jobs');

      for (const coin of coins) {
        const keywords = [coin.symbol, coin.name];

        // Schedule social scraping every 30 minutes
        await this.queueManager.addJob(
          'social-scraping',
          'scrape-social-data',
          {
            coinId: coin.id,
            keywords,
            platforms: ['twitter', 'reddit', 'telegram'],
            timeframe: '24h',
          },
          {
            repeat: {
              pattern: '*/30 * * * *', // Every 30 minutes
            },
            attempts: 2,
            backoff: {
              type: 'exponential',
              delay: 10000,
            },
          }
        );
      }

      this.logger.info({ coinCount: coins.length }, 'Social scraping jobs scheduled');
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to schedule social scraping jobs');
      throw error;
    }
  }

  /**
   * Schedule risk assessment jobs
   */
  private async scheduleRiskAssessmentJobs(): Promise<void> {
    try {
      // Get all coins for risk assessment
      const coins = await this.prisma.coin.findMany({
        select: { id: true, symbol: true },
      });

      this.logger.info({ coinCount: coins.length }, 'Scheduling risk assessment jobs');

      for (const coin of coins) {
        // Schedule risk assessment every 2 hours
        await this.queueManager.addJob(
          'risk-assessment',
          'assess-coin-risk',
          {
            coinId: coin.id,
            symbol: coin.symbol,
          },
          {
            repeat: {
              pattern: '0 */2 * * *', // Every 2 hours
            },
            attempts: 2,
            backoff: {
              type: 'exponential',
              delay: 15000,
            },
          }
        );
      }

      this.logger.info({ coinCount: coins.length }, 'Risk assessment jobs scheduled');
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to schedule risk assessment jobs');
      throw error;
    }
  }

  /**
   * Schedule whale tracking jobs
   */
  private async scheduleWhaleTrackingJobs(): Promise<void> {
    try {
      // Get all coins for whale tracking
      const coins = await this.prisma.coin.findMany({
        select: { id: true, address: true, network: true, symbol: true },
      });

      this.logger.info({ coinCount: coins.length }, 'Scheduling whale tracking jobs');

      for (const coin of coins) {
        // Schedule whale transaction processing every 15 minutes
        await this.queueManager.addJob(
          'whale-tracking',
          'process-whale-transactions',
          {
            type: 'process_whale_transactions',
            coinId: coin.id,
            contractAddress: coin.address,
            network: coin.network,
            options: {
              minUsdValue: 10000, // $10k minimum for whale transactions
            }
          },
          {
            repeat: {
              pattern: '*/15 * * * *', // Every 15 minutes
            },
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 10000,
            },
          }
        );

        // Schedule whale impact analysis every hour
        await this.queueManager.addJob(
          'whale-tracking',
          'analyze-whale-impact',
          {
            type: 'analyze_whale_impact',
            coinId: coin.id,
            contractAddress: coin.address,
            network: coin.network,
            options: {
              timeframe: '24h',
            }
          },
          {
            repeat: {
              pattern: '0 * * * *', // Every hour
            },
            attempts: 2,
            backoff: {
              type: 'exponential',
              delay: 15000,
            },
          }
        );
      }

      this.logger.info({ coinCount: coins.length }, 'Whale tracking jobs scheduled');
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to schedule whale tracking jobs');
      throw error;
    }
  }

  /**
   * Schedule alert processing jobs
   */
  private async scheduleAlertProcessingJobs(): Promise<void> {
    try {
      // Schedule alert checking every minute
      await this.queueManager.addJob(
        'alert-processing',
        'check-alerts',
        {},
        {
          repeat: {
            pattern: '* * * * *', // Every minute
          },
          attempts: 1,
        }
      );

      this.logger.info('Alert processing jobs scheduled');
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to schedule alert processing jobs');
      throw error;
    }
  }

  /**
   * Schedule cleanup jobs
   */
  private async scheduleCleanupJobs(): Promise<void> {
    try {
      // Schedule old price data cleanup daily at 2 AM
      await this.queueManager.addJob(
        'maintenance',
        'cleanup-old-price-data',
        {
          retentionDays: 90, // Keep 90 days of price data
        },
        {
          repeat: {
            pattern: '0 2 * * *', // Daily at 2 AM
          },
          attempts: 1,
        }
      );

      // Schedule old social metrics cleanup daily at 3 AM
      await this.queueManager.addJob(
        'maintenance',
        'cleanup-old-social-metrics',
        {
          retentionDays: 30, // Keep 30 days of social metrics
        },
        {
          repeat: {
            pattern: '0 3 * * *', // Daily at 3 AM
          },
          attempts: 1,
        }
      );

      // Schedule cache warming every 6 hours
      await this.queueManager.addJob(
        'maintenance',
        'warm-cache',
        {},
        {
          repeat: {
            pattern: '0 */6 * * *', // Every 6 hours
          },
          attempts: 1,
        }
      );

      this.logger.info('Cleanup jobs scheduled');
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to schedule cleanup jobs');
      throw error;
    }
  }

  /**
   * Add a one-time job
   */
  async addOneTimeJob(
    queueName: string,
    jobName: string,
    data: any,
    options?: any
  ): Promise<void> {
    try {
      await this.queueManager.addJob(queueName, jobName, data, options);
      
      this.logger.info({ 
        queueName, 
        jobName, 
        data: Object.keys(data) 
      }, 'One-time job added');
    } catch (error) {
      this.logger.error({ 
        queueName, 
        jobName, 
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to add one-time job');
      throw error;
    }
  }

  /**
   * Schedule price update for specific coin
   */
  async scheduleCoinPriceUpdate(coinId: number, delay?: number): Promise<void> {
    const coin = await this.prisma.coin.findUnique({
      where: { id: coinId },
      select: { id: true, symbol: true, address: true },
    });

    if (!coin) {
      throw new Error(`Coin with ID ${coinId} not found`);
    }

    await this.queueManager.addJob(
      'price-updates',
      'update-coin-price',
      {
        coinId: coin.id,
        coinAddress: coin.address,
        symbol: coin.symbol,
      },
      {
        delay: delay || 0,
        attempts: 3,
      }
    );

    this.logger.info({ coinId, symbol: coin.symbol }, 'Price update job scheduled for coin');
  }

  /**
   * Schedule social scraping for specific coin
   */
  async scheduleCoinSocialScraping(coinId: number, delay?: number): Promise<void> {
    const coin = await this.prisma.coin.findUnique({
      where: { id: coinId },
      select: { id: true, symbol: true, name: true },
    });

    if (!coin) {
      throw new Error(`Coin with ID ${coinId} not found`);
    }

    await this.queueManager.addJob(
      'social-scraping',
      'scrape-social-data',
      {
        coinId: coin.id,
        keywords: [coin.symbol, coin.name],
        platforms: ['twitter', 'reddit', 'telegram'],
        timeframe: '24h',
      },
      {
        delay: delay || 0,
        attempts: 2,
      }
    );

    this.logger.info({ coinId, symbol: coin.symbol }, 'Social scraping job scheduled for coin');
  }

  /**
   * Schedule risk assessment for specific coin
   */
  async scheduleCoinRiskAssessment(coinId: number, delay?: number): Promise<void> {
    const coin = await this.prisma.coin.findUnique({
      where: { id: coinId },
      select: { id: true, symbol: true },
    });

    if (!coin) {
      throw new Error(`Coin with ID ${coinId} not found`);
    }

    await this.queueManager.addJob(
      'risk-assessment',
      'assess-coin-risk',
      {
        coinId: coin.id,
        symbol: coin.symbol,
      },
      {
        delay: delay || 0,
        attempts: 2,
      }
    );

    this.logger.info({ coinId, symbol: coin.symbol }, 'Risk assessment job scheduled for coin');
  }

  /**
   * Schedule alert check for specific alert
   */
  async scheduleAlertCheck(alertId: number, condition: any): Promise<void> {
    await this.queueManager.addJob(
      'alert-processing',
      'check-specific-alert',
      {
        alertId,
        condition,
      },
      {
        attempts: 1,
      }
    );

    this.logger.info({ alertId }, 'Alert check job scheduled');
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<Record<string, any>> {
    const queues = ['price-updates', 'social-scraping', 'alert-processing', 'risk-assessment', 'maintenance'];
    const stats: Record<string, any> = {};

    for (const queueName of queues) {
      try {
        stats[queueName] = await this.queueManager.getQueueStatus(queueName);
      } catch (error) {
        this.logger.error({ queueName, error: error instanceof Error ? error.message : String(error) }, 'Failed to get queue stats');
        stats[queueName] = { error: error instanceof Error ? error.message : String(error) };
      }
    }

    return stats;
  }

  /**
   * Pause all scheduled jobs
   */
  async pauseAllJobs(): Promise<void> {
    const queues = ['price-updates', 'social-scraping', 'alert-processing', 'risk-assessment', 'maintenance'];
    
    for (const queueName of queues) {
      try {
        await this.queueManager.pauseQueue(queueName);
        this.logger.info({ queueName }, 'Queue paused');
      } catch (error) {
        this.logger.error({ queueName, error: error instanceof Error ? error.message : String(error) }, 'Failed to pause queue');
      }
    }
  }

  /**
   * Resume all scheduled jobs
   */
  async resumeAllJobs(): Promise<void> {
    const queues = ['price-updates', 'social-scraping', 'alert-processing', 'risk-assessment', 'maintenance'];
    
    for (const queueName of queues) {
      try {
        await this.queueManager.resumeQueue(queueName);
        this.logger.info({ queueName }, 'Queue resumed');
      } catch (error) {
        this.logger.error({ queueName, error: error instanceof Error ? error.message : String(error) }, 'Failed to resume queue');
      }
    }
  }
}