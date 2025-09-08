import { PrismaClient, LiquidityPool, LiquidityData, LiquidityAlert } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
import { CacheService } from './cache.js';
import { RealtimeService } from './realtime.js';
import {
  BaseDexClient,
  UniswapV2Client,
  SushiSwapClient,
  PancakeSwapClient,
  DexPoolData,
} from './dex-clients.js';
import { ApiResponse } from '../types/index.js';

export interface LiquidityPoolWithData extends LiquidityPool {
  latestData?: LiquidityData;
  liquidityData?: LiquidityData[];
}

export interface LiquidityAnalysis {
  totalLiquidity: number;
  poolCount: number;
  averageVolume24h: number;
  topExchange: string;
  riskScore: number;
  priceImpactAnalysis: {
    impact1k: number;
    impact10k: number;
    impact100k: number;
  };
  liquidityDistribution: {
    exchange: string;
    liquidity: number;
    percentage: number;
  }[];
}

export interface LiquidityTrend {
  timestamp: Date;
  totalLiquidity: number;
  volume24h: number;
  change24h: number;
  poolCount: number;
}

export interface LiquidityAlertCondition {
  liquidityThreshold?: number;
  liquidityChangePercentage?: number;
  volumeThreshold?: number;
  priceImpactThreshold?: number;
  poolCountThreshold?: number;
}

export class LiquidityService {
  private dexClients: Map<string, BaseDexClient>;

  constructor(
    private prisma: PrismaClient,
    private logger: FastifyBaseLogger,
    private cacheService: CacheService,
    private realtimeService: RealtimeService
  ) {
    this.dexClients = new Map();
    this.initializeDexClients();
  }

  private initializeDexClients() {
    // Initialize DEX clients
    this.dexClients.set('uniswap-v2', new UniswapV2Client({ logger: this.logger }));
    this.dexClients.set('sushiswap', new SushiSwapClient({ logger: this.logger }));
    this.dexClients.set('pancakeswap', new PancakeSwapClient({ logger: this.logger }));
  }

  /**
   * Sync liquidity pools for a specific coin from all DEXs
   */
  async syncLiquidityPools(
    coinId: number,
    tokenAddress: string
  ): Promise<ApiResponse<LiquidityPool[]>> {
    try {
      this.logger.info({ coinId, tokenAddress }, 'Starting liquidity pool sync');

      const syncedPools: LiquidityPool[] = [];

      // Fetch pool data from all DEX clients
      for (const [exchange, client] of this.dexClients) {
        try {
          const poolsData = await client.getPoolData(tokenAddress);

          for (const poolData of poolsData) {
            // Check if pool already exists
            let pool = await this.prisma.liquidityPool.findFirst({
              where: {
                exchange,
                pairAddress: poolData.pairAddress,
              },
            });

            if (pool) {
              // Update existing pool
              pool = await this.prisma.liquidityPool.update({
                where: { id: pool.id },
                data: {
                  totalLiquidity: poolData.totalLiquidity,
                  baseReserve: poolData.baseReserve,
                  quoteReserve: poolData.quoteReserve,
                  volume24h: poolData.volume24h,
                  fees24h: poolData.fees24h,
                  apr: poolData.apr,
                  updatedAt: new Date(),
                },
              });
            } else {
              // Create new pool
              pool = await this.prisma.liquidityPool.create({
                data: {
                  coinId,
                  exchange,
                  pairAddress: poolData.pairAddress,
                  baseToken: poolData.baseToken,
                  quoteToken: poolData.quoteToken,
                  baseSymbol: poolData.baseSymbol,
                  quoteSymbol: poolData.quoteSymbol,
                  totalLiquidity: poolData.totalLiquidity,
                  baseReserve: poolData.baseReserve,
                  quoteReserve: poolData.quoteReserve,
                  volume24h: poolData.volume24h,
                  fees24h: poolData.fees24h,
                  apr: poolData.apr,
                },
              });
            }

            // Store historical liquidity data
            await this.storeLiquidityData(pool.id, poolData);
            syncedPools.push(pool);
          }
        } catch (error) {
          this.logger.warn(
            {
              error,
              exchange,
              tokenAddress,
            },
            `Failed to sync pools from ${exchange}`
          );
        }
      }

      // Invalidate cache
      await this.cacheService.delete(`liquidity:${coinId}:*`);

      this.logger.info(
        {
          coinId,
          tokenAddress,
          syncedCount: syncedPools.length,
        },
        'Completed liquidity pool sync'
      );

      return {
        success: true,
        data: syncedPools,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    } catch (error) {
      this.logger.error({ error, coinId, tokenAddress }, 'Failed to sync liquidity pools');
      throw error;
    }
  }

  /**
   * Store historical liquidity data
   */
  private async storeLiquidityData(poolId: number, poolData: DexPoolData): Promise<void> {
    try {
      // Get previous data to calculate changes
      const previousData = await this.prisma.liquidityData.findFirst({
        where: { poolId },
        orderBy: { timestamp: 'desc' },
      });

      let liquidityChange24h = 0;
      let volumeChange24h = 0;

      if (previousData) {
        const timeDiff = Date.now() - previousData.timestamp.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        // Only calculate change if previous data is within reasonable timeframe
        if (hoursDiff <= 25) {
          // Within 25 hours for 24h change
          liquidityChange24h =
            ((poolData.totalLiquidity - Number(previousData.totalLiquidity)) /
              Number(previousData.totalLiquidity)) *
            100;
          volumeChange24h =
            ((poolData.volume24h - Number(previousData.volume24h)) /
              Number(previousData.volume24h)) *
            100;
        }
      }

      await this.prisma.liquidityData.create({
        data: {
          poolId,
          totalLiquidity: poolData.totalLiquidity,
          baseReserve: poolData.baseReserve,
          quoteReserve: poolData.quoteReserve,
          volume24h: poolData.volume24h,
          fees24h: poolData.fees24h,
          liquidityChange24h,
          volumeChange24h,
          priceImpact1k: poolData.priceImpact1k,
          priceImpact10k: poolData.priceImpact10k,
          priceImpact100k: poolData.priceImpact100k,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error({ error, poolId }, 'Failed to store liquidity data');
      throw error;
    }
  }

  /**
   * Get liquidity pools for a coin
   */
  async getLiquidityPools(coinId: number): Promise<ApiResponse<LiquidityPoolWithData[]>> {
    try {
      const cacheKey = `liquidity:${coinId}:pools`;
      const cached = await this.cacheService.get<LiquidityPoolWithData[]>(cacheKey);

      if (cached) {
        return {
          success: true,
          data: cached,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: '',
          },
        };
      }

      const pools = await this.prisma.liquidityPool.findMany({
        where: {
          coinId,
          isActive: true,
        },
        include: {
          liquidityData: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
        orderBy: { totalLiquidity: 'desc' },
      });

      const poolsWithData: LiquidityPoolWithData[] = pools.map(pool => ({
        ...pool,
        latestData: pool.liquidityData[0] || undefined,
        liquidityData: undefined, // Remove the array to avoid confusion
      }));

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, poolsWithData, { ttl: 300 });

      this.logger.info({ coinId, poolCount: pools.length }, 'Retrieved liquidity pools');

      return {
        success: true,
        data: poolsWithData,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    } catch (error) {
      this.logger.error({ error, coinId }, 'Failed to get liquidity pools');
      throw error;
    }
  }

  /**
   * Analyze liquidity for a coin across all pools
   */
  async analyzeLiquidity(coinId: number): Promise<ApiResponse<LiquidityAnalysis>> {
    try {
      const cacheKey = `liquidity:${coinId}:analysis`;
      const cached = await this.cacheService.get<LiquidityAnalysis>(cacheKey);

      if (cached) {
        return {
          success: true,
          data: cached,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: '',
          },
        };
      }

      const pools = await this.prisma.liquidityPool.findMany({
        where: {
          coinId,
          isActive: true,
        },
        include: {
          liquidityData: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      if (pools.length === 0) {
        return {
          success: false,
          error: {
            code: 'NO_LIQUIDITY_DATA',
            message: 'No liquidity data found for this coin',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: '',
          },
        };
      }

      // Calculate analysis metrics
      const totalLiquidity = pools.reduce((sum, pool) => sum + Number(pool.totalLiquidity), 0);
      const totalVolume = pools.reduce((sum, pool) => sum + Number(pool.volume24h), 0);
      const averageVolume24h = totalVolume / pools.length;

      // Find top exchange by liquidity
      const exchangeLiquidity = new Map<string, number>();
      pools.forEach(pool => {
        const current = exchangeLiquidity.get(pool.exchange) || 0;
        exchangeLiquidity.set(pool.exchange, current + Number(pool.totalLiquidity));
      });

      const topExchange =
        Array.from(exchangeLiquidity.entries()).sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown';

      // Calculate price impact analysis (weighted average)
      let weightedImpact1k = 0;
      let weightedImpact10k = 0;
      let weightedImpact100k = 0;

      pools.forEach(pool => {
        const weight = Number(pool.totalLiquidity) / totalLiquidity;
        const latestData = pool.liquidityData[0];
        if (latestData) {
          weightedImpact1k += Number(latestData.priceImpact1k) * weight;
          weightedImpact10k += Number(latestData.priceImpact10k) * weight;
          weightedImpact100k += Number(latestData.priceImpact100k) * weight;
        }
      });

      // Calculate risk score based on liquidity metrics
      const riskScore = this.calculateLiquidityRiskScore({
        totalLiquidity,
        poolCount: pools.length,
        averageVolume24h,
        priceImpact10k: weightedImpact10k,
      });

      // Create liquidity distribution
      const liquidityDistribution = Array.from(exchangeLiquidity.entries())
        .map(([exchange, liquidity]) => ({
          exchange,
          liquidity,
          percentage: (liquidity / totalLiquidity) * 100,
        }))
        .sort((a, b) => b.liquidity - a.liquidity);

      const analysis: LiquidityAnalysis = {
        totalLiquidity,
        poolCount: pools.length,
        averageVolume24h,
        topExchange,
        riskScore,
        priceImpactAnalysis: {
          impact1k: weightedImpact1k,
          impact10k: weightedImpact10k,
          impact100k: weightedImpact100k,
        },
        liquidityDistribution,
      };

      // Cache for 10 minutes
      await this.cacheService.set(cacheKey, analysis, { ttl: 600 });

      this.logger.info({ coinId, analysis }, 'Completed liquidity analysis');

      return {
        success: true,
        data: analysis,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    } catch (error) {
      this.logger.error({ error, coinId }, 'Failed to analyze liquidity');
      throw error;
    }
  }

  /**
   * Calculate liquidity-based risk score
   */
  private calculateLiquidityRiskScore(metrics: {
    totalLiquidity: number;
    poolCount: number;
    averageVolume24h: number;
    priceImpact10k: number;
  }): number {
    let score = 100; // Start with lowest risk

    // Liquidity amount factor (higher liquidity = lower risk)
    if (metrics.totalLiquidity < 10000) score -= 40;
    else if (metrics.totalLiquidity < 100000) score -= 25;
    else if (metrics.totalLiquidity < 1000000) score -= 10;

    // Pool count factor (more pools = lower risk)
    if (metrics.poolCount < 2) score -= 20;
    else if (metrics.poolCount < 5) score -= 10;

    // Volume factor (higher volume = lower risk)
    const volumeToLiquidityRatio = metrics.averageVolume24h / metrics.totalLiquidity;
    if (volumeToLiquidityRatio < 0.1) score -= 15;
    else if (volumeToLiquidityRatio < 0.5) score -= 5;

    // Price impact factor (higher impact = higher risk)
    if (metrics.priceImpact10k > 10) score -= 20;
    else if (metrics.priceImpact10k > 5) score -= 10;
    else if (metrics.priceImpact10k > 2) score -= 5;

    return Math.max(1, Math.min(100, score));
  }

  /**
   * Get liquidity trends over time
   */
  async getLiquidityTrends(
    coinId: number,
    timeframe: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<ApiResponse<LiquidityTrend[]>> {
    try {
      const cacheKey = `liquidity:${coinId}:trends:${timeframe}`;
      const cached = await this.cacheService.get<LiquidityTrend[]>(cacheKey);

      if (cached) {
        return {
          success: true,
          data: cached,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: '',
          },
        };
      }

      // Calculate date range
      const now = new Date();
      let fromDate: Date;
      let interval: string;

      switch (timeframe) {
        case '1h':
          fromDate = new Date(now.getTime() - 60 * 60 * 1000);
          interval = '5 minutes';
          break;
        case '24h':
          fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          interval = '1 hour';
          break;
        case '7d':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          interval = '6 hours';
          break;
        case '30d':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          interval = '1 day';
          break;
        default:
          fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          interval = '1 hour';
      }

      // Get aggregated liquidity data
      const liquidityData = await this.prisma.$queryRaw<any[]>`
        SELECT 
          DATE_TRUNC(${interval}, ld.timestamp) as timestamp,
          SUM(ld.total_liquidity) as total_liquidity,
          SUM(ld.volume_24h) as volume_24h,
          COUNT(DISTINCT lp.id) as pool_count,
          AVG(ld.liquidity_change_24h) as avg_change_24h
        FROM liquidity_data ld
        JOIN liquidity_pools lp ON ld.pool_id = lp.id
        WHERE lp.coin_id = ${coinId}
          AND ld.timestamp >= ${fromDate}
          AND lp.is_active = true
        GROUP BY DATE_TRUNC(${interval}, ld.timestamp)
        ORDER BY timestamp ASC
      `;

      const trends: LiquidityTrend[] = liquidityData.map(row => ({
        timestamp: new Date(row.timestamp),
        totalLiquidity: Number(row.total_liquidity),
        volume24h: Number(row.volume_24h),
        change24h: Number(row.avg_change_24h),
        poolCount: Number(row.pool_count),
      }));

      // Cache based on timeframe
      const ttl = timeframe === '1h' ? 60 : timeframe === '24h' ? 300 : 600;
      await this.cacheService.set(cacheKey, trends, { ttl });

      this.logger.info(
        {
          coinId,
          timeframe,
          dataPoints: trends.length,
        },
        'Retrieved liquidity trends'
      );

      return {
        success: true,
        data: trends,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    } catch (error) {
      this.logger.error({ error, coinId, timeframe }, 'Failed to get liquidity trends');
      throw error;
    }
  }

  /**
   * Create liquidity alert
   */
  async createLiquidityAlert(
    userId: number,
    coinId: number,
    type: string,
    condition: LiquidityAlertCondition,
    notificationMethods: string[],
    options: {
      poolId?: number;
      name?: string;
      description?: string;
    } = {}
  ): Promise<ApiResponse<LiquidityAlert>> {
    try {
      const alert = await this.prisma.liquidityAlert.create({
        data: {
          userId,
          coinId,
          poolId: options.poolId || null,
          type,
          condition: condition as any,
          notificationMethods: notificationMethods as any,
          name: options.name || null,
          description: options.description || null,
        },
      });

      this.logger.info(
        {
          alertId: alert.id,
          userId,
          coinId,
          type,
        },
        'Created liquidity alert'
      );

      return {
        success: true,
        data: alert,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    } catch (error) {
      this.logger.error({ error, userId, coinId, type }, 'Failed to create liquidity alert');
      throw error;
    }
  }

  /**
   * Check and trigger liquidity alerts
   */
  async checkLiquidityAlerts(coinId: number): Promise<void> {
    try {
      const alerts = await this.prisma.liquidityAlert.findMany({
        where: {
          coinId,
          isActive: true,
        },
        include: {
          user: true,
          coin: true,
          pool: true,
        },
      });

      if (alerts.length === 0) return;

      // Get current liquidity analysis
      const analysisResult = await this.analyzeLiquidity(coinId);
      if (!analysisResult.success || !analysisResult.data) return;

      const analysis = analysisResult.data;

      for (const alert of alerts) {
        const condition = alert.condition as LiquidityAlertCondition;
        let shouldTrigger = false;
        let triggerReason = '';

        // Check different alert conditions
        if (
          condition.liquidityThreshold &&
          analysis.totalLiquidity <= condition.liquidityThreshold
        ) {
          shouldTrigger = true;
          triggerReason = `Total liquidity dropped to $${analysis.totalLiquidity.toLocaleString()}`;
        }

        if (
          condition.priceImpactThreshold &&
          analysis.priceImpactAnalysis.impact10k >= condition.priceImpactThreshold
        ) {
          shouldTrigger = true;
          triggerReason = `Price impact for $10k trade reached ${analysis.priceImpactAnalysis.impact10k.toFixed(2)}%`;
        }

        if (condition.poolCountThreshold && analysis.poolCount <= condition.poolCountThreshold) {
          shouldTrigger = true;
          triggerReason = `Pool count dropped to ${analysis.poolCount}`;
        }

        if (shouldTrigger) {
          // Update alert trigger time
          await this.prisma.liquidityAlert.update({
            where: { id: alert.id },
            data: { lastTriggered: new Date() },
          });

          // Send real-time notification
          await this.realtimeService.sendToUser(alert.userId, {
            type: 'liquidity_alert_triggered',
            data: {
              alertId: alert.id,
              coinId,
              coinSymbol: alert.coin.symbol,
              reason: triggerReason,
              analysis,
            },
            timestamp: new Date().toISOString(),
          });

          this.logger.info(
            {
              alertId: alert.id,
              userId: alert.userId,
              coinId,
              reason: triggerReason,
            },
            'Triggered liquidity alert'
          );
        }
      }
    } catch (error) {
      this.logger.error({ error, coinId }, 'Failed to check liquidity alerts');
    }
  }

  /**
   * Get liquidity alerts for a user
   */
  async getUserLiquidityAlerts(userId: number): Promise<ApiResponse<LiquidityAlert[]>> {
    try {
      const alerts = await this.prisma.liquidityAlert.findMany({
        where: { userId },
        include: {
          coin: true,
          pool: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        data: alerts,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to get user liquidity alerts');
      throw error;
    }
  }

  /**
   * Update liquidity alert
   */
  async updateLiquidityAlert(
    alertId: number,
    updates: {
      condition?: LiquidityAlertCondition;
      notificationMethods?: string[];
      isActive?: boolean;
      name?: string;
      description?: string;
    }
  ): Promise<ApiResponse<LiquidityAlert>> {
    try {
      const updateData: any = {};

      if (updates.condition !== undefined) updateData.condition = updates.condition;
      if (updates.notificationMethods !== undefined)
        updateData.notificationMethods = updates.notificationMethods;
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;

      const alert = await this.prisma.liquidityAlert.update({
        where: { id: alertId },
        data: updateData,
      });

      this.logger.info({ alertId }, 'Updated liquidity alert');

      return {
        success: true,
        data: alert,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    } catch (error) {
      this.logger.error({ error, alertId }, 'Failed to update liquidity alert');
      throw error;
    }
  }

  /**
   * Delete liquidity alert
   */
  async deleteLiquidityAlert(alertId: number): Promise<ApiResponse<void>> {
    try {
      await this.prisma.liquidityAlert.delete({
        where: { id: alertId },
      });

      this.logger.info({ alertId }, 'Deleted liquidity alert');

      return {
        success: true,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    } catch (error) {
      this.logger.error({ error, alertId }, 'Failed to delete liquidity alert');
      throw error;
    }
  }
}
