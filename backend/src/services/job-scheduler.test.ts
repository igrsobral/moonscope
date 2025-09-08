import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobScheduler } from './job-scheduler.js';

// Mock dependencies
const mockPrisma = {
  coin: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
} as any;

const mockQueueManager = {
  addJob: vi.fn(),
  getQueueStatus: vi.fn(),
  pauseQueue: vi.fn(),
  resumeQueue: vi.fn(),
} as any;

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as any;

describe('JobScheduler', () => {
  let jobScheduler: JobScheduler;

  beforeEach(() => {
    jobScheduler = new JobScheduler(mockPrisma, mockQueueManager, mockLogger);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('schedulePriceUpdateJobs', () => {
    it('should schedule price update jobs for all coins', async () => {
      // Arrange
      const mockCoins = [
        { id: 1, symbol: 'DOGE', address: '0x123' },
        { id: 2, symbol: 'SHIB', address: '0x456' },
      ];

      mockPrisma.coin.findMany.mockResolvedValue(mockCoins);
      mockQueueManager.addJob.mockResolvedValue({ id: 'job-123' });

      // Act
      await (jobScheduler as any).schedulePriceUpdateJobs();

      // Assert
      expect(mockPrisma.coin.findMany).toHaveBeenCalledWith({
        select: { id: true, symbol: true, address: true },
      });

      expect(mockQueueManager.addJob).toHaveBeenCalledTimes(2);

      expect(mockQueueManager.addJob).toHaveBeenCalledWith(
        'price-updates',
        'update-coin-price',
        {
          coinId: 1,
          coinAddress: '0x123',
          symbol: 'DOGE',
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

      expect(mockQueueManager.addJob).toHaveBeenCalledWith(
        'price-updates',
        'update-coin-price',
        {
          coinId: 2,
          coinAddress: '0x456',
          symbol: 'SHIB',
        },
        {
          repeat: {
            pattern: '*/5 * * * *',
          },
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        }
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        { coinCount: 2 },
        'Scheduling price update jobs'
      );
      expect(mockLogger.info).toHaveBeenCalledWith({ coinCount: 2 }, 'Price update jobs scheduled');
    });

    it('should handle errors when scheduling price update jobs', async () => {
      // Arrange
      const error = new Error('Database error');
      mockPrisma.coin.findMany.mockRejectedValue(error);

      // Act & Assert
      await expect((jobScheduler as any).schedulePriceUpdateJobs()).rejects.toThrow(
        'Database error'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: 'Database error' },
        'Failed to schedule price update jobs'
      );
    });
  });

  describe('scheduleSocialScrapingJobs', () => {
    it('should schedule social scraping jobs for all coins', async () => {
      // Arrange
      const mockCoins = [
        { id: 1, symbol: 'DOGE', name: 'Dogecoin' },
        { id: 2, symbol: 'SHIB', name: 'Shiba Inu' },
      ];

      mockPrisma.coin.findMany.mockResolvedValue(mockCoins);
      mockQueueManager.addJob.mockResolvedValue({ id: 'job-456' });

      // Act
      await (jobScheduler as any).scheduleSocialScrapingJobs();

      // Assert
      expect(mockPrisma.coin.findMany).toHaveBeenCalledWith({
        select: { id: true, symbol: true, name: true },
      });

      expect(mockQueueManager.addJob).toHaveBeenCalledTimes(2);

      expect(mockQueueManager.addJob).toHaveBeenCalledWith(
        'social-scraping',
        'scrape-social-data',
        {
          coinId: 1,
          keywords: ['DOGE', 'Dogecoin'],
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
    });
  });

  describe('scheduleRiskAssessmentJobs', () => {
    it('should schedule risk assessment jobs for all coins', async () => {
      // Arrange
      const mockCoins = [
        { id: 1, symbol: 'DOGE' },
        { id: 2, symbol: 'SHIB' },
      ];

      mockPrisma.coin.findMany.mockResolvedValue(mockCoins);
      mockQueueManager.addJob.mockResolvedValue({ id: 'job-789' });

      // Act
      await (jobScheduler as any).scheduleRiskAssessmentJobs();

      // Assert
      expect(mockQueueManager.addJob).toHaveBeenCalledWith(
        'risk-assessment',
        'assess-coin-risk',
        {
          coinId: 1,
          symbol: 'DOGE',
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
    });
  });

  describe('scheduleAlertProcessingJobs', () => {
    it('should schedule alert processing jobs', async () => {
      // Arrange
      mockQueueManager.addJob.mockResolvedValue({ id: 'job-alert' });

      // Act
      await (jobScheduler as any).scheduleAlertProcessingJobs();

      // Assert
      expect(mockQueueManager.addJob).toHaveBeenCalledWith(
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
    });
  });

  describe('scheduleCleanupJobs', () => {
    it('should schedule cleanup jobs', async () => {
      // Arrange
      mockQueueManager.addJob.mockResolvedValue({ id: 'job-cleanup' });

      // Act
      await (jobScheduler as any).scheduleCleanupJobs();

      // Assert
      expect(mockQueueManager.addJob).toHaveBeenCalledWith(
        'maintenance',
        'cleanup-old-price-data',
        {
          retentionDays: 90,
        },
        {
          repeat: {
            pattern: '0 2 * * *', // Daily at 2 AM
          },
          attempts: 1,
        }
      );

      expect(mockQueueManager.addJob).toHaveBeenCalledWith(
        'maintenance',
        'cleanup-old-social-metrics',
        {
          retentionDays: 30,
        },
        {
          repeat: {
            pattern: '0 3 * * *', // Daily at 3 AM
          },
          attempts: 1,
        }
      );

      expect(mockQueueManager.addJob).toHaveBeenCalledWith(
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
    });
  });

  describe('scheduleCoinPriceUpdate', () => {
    it('should schedule price update for specific coin', async () => {
      // Arrange
      const mockCoin = { id: 1, symbol: 'DOGE', address: '0x123' };
      mockPrisma.coin.findUnique.mockResolvedValue(mockCoin);
      mockQueueManager.addJob.mockResolvedValue({ id: 'job-specific' });

      // Act
      await jobScheduler.scheduleCoinPriceUpdate(1, 5000);

      // Assert
      expect(mockPrisma.coin.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true, symbol: true, address: true },
      });

      expect(mockQueueManager.addJob).toHaveBeenCalledWith(
        'price-updates',
        'update-coin-price',
        {
          coinId: 1,
          coinAddress: '0x123',
          symbol: 'DOGE',
        },
        {
          delay: 5000,
          attempts: 3,
        }
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        { coinId: 1, symbol: 'DOGE' },
        'Price update job scheduled for coin'
      );
    });

    it('should throw error for non-existent coin', async () => {
      // Arrange
      mockPrisma.coin.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(jobScheduler.scheduleCoinPriceUpdate(999)).rejects.toThrow(
        'Coin with ID 999 not found'
      );
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      // Arrange
      const mockStats = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
      };

      mockQueueManager.getQueueStatus.mockResolvedValue(mockStats);

      // Act
      const result = await jobScheduler.getQueueStats();

      // Assert
      expect(result).toEqual({
        'price-updates': mockStats,
        'social-scraping': mockStats,
        'alert-processing': mockStats,
        'risk-assessment': mockStats,
        maintenance: mockStats,
      });
    });

    it('should handle errors when getting queue stats', async () => {
      // Arrange
      mockQueueManager.getQueueStatus.mockRejectedValue(new Error('Queue error'));

      // Act
      const result = await jobScheduler.getQueueStats();

      // Assert
      expect(result['price-updates']).toEqual({ error: 'Queue error' });
      expect(mockLogger.error).toHaveBeenCalledWith(
        { queueName: 'price-updates', error: 'Queue error' },
        'Failed to get queue stats'
      );
    });
  });

  describe('pauseAllJobs', () => {
    it('should pause all job queues', async () => {
      // Arrange
      mockQueueManager.pauseQueue.mockResolvedValue(undefined);

      // Act
      await jobScheduler.pauseAllJobs();

      // Assert
      expect(mockQueueManager.pauseQueue).toHaveBeenCalledTimes(5);
      expect(mockQueueManager.pauseQueue).toHaveBeenCalledWith('price-updates');
      expect(mockQueueManager.pauseQueue).toHaveBeenCalledWith('social-scraping');
      expect(mockQueueManager.pauseQueue).toHaveBeenCalledWith('alert-processing');
      expect(mockQueueManager.pauseQueue).toHaveBeenCalledWith('risk-assessment');
      expect(mockQueueManager.pauseQueue).toHaveBeenCalledWith('maintenance');
    });
  });

  describe('resumeAllJobs', () => {
    it('should resume all job queues', async () => {
      // Arrange
      mockQueueManager.resumeQueue.mockResolvedValue(undefined);

      // Act
      await jobScheduler.resumeAllJobs();

      // Assert
      expect(mockQueueManager.resumeQueue).toHaveBeenCalledTimes(5);
      expect(mockQueueManager.resumeQueue).toHaveBeenCalledWith('price-updates');
      expect(mockQueueManager.resumeQueue).toHaveBeenCalledWith('social-scraping');
      expect(mockQueueManager.resumeQueue).toHaveBeenCalledWith('alert-processing');
      expect(mockQueueManager.resumeQueue).toHaveBeenCalledWith('risk-assessment');
      expect(mockQueueManager.resumeQueue).toHaveBeenCalledWith('maintenance');
    });
  });
});
