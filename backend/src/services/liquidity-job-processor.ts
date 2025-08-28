import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
import { LiquidityService } from './liquidity.js';
import { CacheService } from './cache.js';
import { RealtimeService } from './realtime.js';

export interface LiquidityMonitoringJobData {
  coinId: number;
  tokenAddress: string;
  type: 'sync_pools' | 'check_alerts' | 'update_trends';
}

export interface LiquidityBatchJobData {
  coinIds: number[];
  type: 'batch_sync' | 'batch_analysis';
}

export class LiquidityJobProcessor {
  private liquidityService: LiquidityService;

  constructor(
    private prisma: PrismaClient,
    private logger: FastifyBaseLogger,
    private cacheService: CacheService,
    private realtimeService: RealtimeService
  ) {
    this.liquidityService = new LiquidityService(
      prisma,
      logger,
      cacheService,
      realtimeService
    );
  }

  /**
   * Process liquidity monitoring job
   */
  async processLiquidityMonitoring(job: Job<LiquidityMonitoringJobData>): Promise<void> {
    const { coinId, tokenAddress, type } = job.data;
    
    try {
      this.logger.info({ 
        jobId: job.id, 
        coinId, 
        tokenAddress, 
        type 
      }, 'Processing liquidity monitoring job');

      switch (type) {
        case 'sync_pools':
          await this.syncPoolsForCoin(coinId, tokenAddress);
          break;
        case 'check_alerts':
          await this.checkAlertsForCoin(coinId);
          break;
        case 'update_trends':
          await this.updateTrendsForCoin(coinId);
          break;
        default:
          throw new Error(`Unknown liquidity job type: ${type}`);
      }

      this.logger.info({ 
        jobId: job.id, 
        coinId, 
        type 
      }, 'Completed liquidity monitoring job');
    } catch (error) {
      this.logger.error({ 
        error, 
        jobId: job.id, 
        coinId, 
        type 
      }, 'Failed to process liquidity monitoring job');
      throw error;
    }
  }

  /**
   * Process batch liquidity job
   */
  async processBatchLiquidity(job: Job<LiquidityBatchJobData>): Promise<void> {
    const { coinIds, type } = job.data;
    
    try {
      this.logger.info({ 
        jobId: job.id, 
        coinCount: coinIds.length, 
        type 
      }, 'Processing batch liquidity job');

      switch (type) {
        case 'batch_sync':
          await this.batchSyncPools(coinIds);
          break;
        case 'batch_analysis':
          await this.batchAnalyzeLiquidity(coinIds);
          break;
        default:
          throw new Error(`Unknown batch liquidity job type: ${type}`);
      }

      this.logger.info({ 
        jobId: job.id, 
        coinCount: coinIds.length, 
        type 
      }, 'Completed batch liquidity job');
    } catch (error) {
      this.logger.error({ 
        error, 
        jobId: job.id, 
        coinCount: coinIds.length, 
        type 
      }, 'Failed to process batch liquidity job');
      throw error;
    }
  }

  /**
   * Sync pools for a specific coin
   */
  private async syncPoolsForCoin(coinId: number, tokenAddress: string): Promise<void> {
    try {
      const result = await this.liquidityService.syncLiquidityPools(coinId, tokenAddress);
      
      if (result.success && result.data) {
        this.logger.info({ 
          coinId, 
          tokenAddress, 
          poolCount: result.data.length 
        }, 'Successfully synced liquidity pools');

        // Send real-time update
        await this.realtimeService.broadcast({
          type: 'liquidity_pools_updated',
          data: {
            coinId,
            poolCount: result.data.length,
            pools: result.data,
          },
          timestamp: new Date().toISOString(),
          coinId: coinId.toString(),
        });
      }
    } catch (error) {
      this.logger.error({ error, coinId, tokenAddress }, 'Failed to sync pools for coin');
      throw error;
    }
  }

  /**
   * Check alerts for a specific coin
   */
  private async checkAlertsForCoin(coinId: number): Promise<void> {
    try {
      await this.liquidityService.checkLiquidityAlerts(coinId);
      this.logger.info({ coinId }, 'Checked liquidity alerts for coin');
    } catch (error) {
      this.logger.error({ error, coinId }, 'Failed to check alerts for coin');
      throw error;
    }
  }

  /**
   * Update trends for a specific coin
   */
  private async updateTrendsForCoin(coinId: number): Promise<void> {
    try {
      // Invalidate trend caches to force refresh
      await this.cacheService.delete(`liquidity:${coinId}:trends:*`);
      await this.cacheService.delete(`liquidity:${coinId}:analysis`);
      
      // Pre-warm cache with fresh data
      const timeframes: ('1h' | '24h' | '7d' | '30d')[] = ['1h', '24h', '7d', '30d'];
      
      for (const timeframe of timeframes) {
        try {
          await this.liquidityService.getLiquidityTrends(coinId, timeframe);
        } catch (error) {
          this.logger.warn({ 
            error, 
            coinId, 
            timeframe 
          }, 'Failed to update trend for timeframe');
        }
      }

      // Update analysis
      try {
        await this.liquidityService.analyzeLiquidity(coinId);
      } catch (error) {
        this.logger.warn({ error, coinId }, 'Failed to update liquidity analysis');
      }

      this.logger.info({ coinId }, 'Updated liquidity trends for coin');
    } catch (error) {
      this.logger.error({ error, coinId }, 'Failed to update trends for coin');
      throw error;
    }
  }

  /**
   * Batch sync pools for multiple coins
   */
  private async batchSyncPools(coinIds: number[]): Promise<void> {
    const batchSize = 5; // Process 5 coins at a time to avoid rate limits
    const results = [];

    for (let i = 0; i < coinIds.length; i += batchSize) {
      const batch = coinIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (coinId) => {
        try {
          // Get coin details
          const coin = await this.prisma.coin.findUnique({
            where: { id: coinId },
          });

          if (!coin) {
            this.logger.warn({ coinId }, 'Coin not found for batch sync');
            return null;
          }

          // Sync pools
          const result = await this.liquidityService.syncLiquidityPools(coinId, coin.address);
          return { coinId, success: result.success, poolCount: result.data?.length || 0 };
        } catch (error) {
          this.logger.error({ error, coinId }, 'Failed to sync pools in batch');
          return { coinId, success: false, error: error instanceof Error ? error.message : String(error) };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(Boolean));

      // Add delay between batches to respect rate limits
      if (i + batchSize < coinIds.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    const successCount = results.filter(r => r?.success).length;
    const failureCount = results.filter(r => r && !r.success).length;

    this.logger.info({ 
      totalCoins: coinIds.length,
      successCount,
      failureCount,
    }, 'Completed batch pool sync');

    // Send batch update notification
    await this.realtimeService.broadcast({
      type: 'batch_liquidity_sync_complete',
      data: {
        totalCoins: coinIds.length,
        successCount,
        failureCount,
        results: results.slice(0, 10), // Send first 10 results
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Batch analyze liquidity for multiple coins
   */
  private async batchAnalyzeLiquidity(coinIds: number[]): Promise<void> {
    const batchSize = 10; // Analyze 10 coins at a time
    const results = [];

    for (let i = 0; i < coinIds.length; i += batchSize) {
      const batch = coinIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (coinId) => {
        try {
          const result = await this.liquidityService.analyzeLiquidity(coinId);
          return { 
            coinId, 
            success: result.success, 
            analysis: result.data 
          };
        } catch (error) {
          this.logger.error({ error, coinId }, 'Failed to analyze liquidity in batch');
          return { 
            coinId, 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add small delay between batches
      if (i + batchSize < coinIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    this.logger.info({ 
      totalCoins: coinIds.length,
      successCount,
      failureCount,
    }, 'Completed batch liquidity analysis');

    // Send batch analysis notification
    await this.realtimeService.broadcast({
      type: 'batch_liquidity_analysis_complete',
      data: {
        totalCoins: coinIds.length,
        successCount,
        failureCount,
        summary: results
          .filter(r => r.success && r.analysis)
          .slice(0, 5) // Send top 5 analyses
          .map(r => ({
            coinId: r.coinId,
            totalLiquidity: r.analysis?.totalLiquidity,
            riskScore: r.analysis?.riskScore,
            poolCount: r.analysis?.poolCount,
          })),
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Schedule regular liquidity monitoring jobs
   */
  async scheduleRegularMonitoring(): Promise<void> {
    try {
      // Get all active coins with liquidity pools
      const coinsWithPools = await this.prisma.coin.findMany({
        where: {
          liquidityPools: {
            some: {
              isActive: true,
            },
          },
        },
        select: {
          id: true,
          address: true,
          symbol: true,
        },
      });

      this.logger.info({ 
        coinCount: coinsWithPools.length 
      }, 'Scheduling regular liquidity monitoring');

      // Schedule sync jobs for each coin (staggered)
      for (let i = 0; i < coinsWithPools.length; i++) {
        const coin = coinsWithPools[i];
        const delay = i * 30000; // 30 second delay between each coin

        // Schedule pool sync (every 15 minutes)
        setTimeout(async () => {
          try {
            await this.syncPoolsForCoin(coin.id, coin.address);
          } catch (error) {
            this.logger.error({ error, coinId: coin.id }, 'Failed in scheduled pool sync');
          }
        }, delay);

        // Schedule alert check (every 5 minutes)
        setTimeout(async () => {
          try {
            await this.checkAlertsForCoin(coin.id);
          } catch (error) {
            this.logger.error({ error, coinId: coin.id }, 'Failed in scheduled alert check');
          }
        }, delay + 60000); // 1 minute after sync
      }

      this.logger.info('Scheduled regular liquidity monitoring jobs');
    } catch (error) {
      this.logger.error({ error }, 'Failed to schedule regular monitoring');
      throw error;
    }
  }
}