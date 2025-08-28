import { Job, Worker } from 'bullmq';
import { FastifyBaseLogger } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { CoinService } from './coin.js';
import { SocialService } from './social.js';
import { ExternalApiService } from './external-api-service.js';
import { CacheService } from './cache.js';
import { RealtimeService } from './realtime.js';

export interface JobProcessorDependencies {
  prisma: PrismaClient;
  redis: Redis;
  logger: FastifyBaseLogger;
  coinService: CoinService;
  socialService: SocialService;
  externalApiService: ExternalApiService;
  cacheService: CacheService;
  realtimeService: RealtimeService;
}

export class JobProcessors {
  private dependencies: JobProcessorDependencies;
  private workers: Map<string, Worker> = new Map();

  constructor(dependencies: JobProcessorDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Initialize all job processors
   */
  async initialize(): Promise<void> {
    const { redis, logger } = this.dependencies;

    // Price update jobs
    const priceWorker = new Worker(
      'price-updates',
      async (job: Job) => await this.processPriceUpdateJob(job),
      {
        connection: redis,
        concurrency: 5,
        limiter: {
          max: 10,
          duration: 60000, // 10 jobs per minute
        },
      }
    );

    // Social data scraping jobs
    const socialWorker = new Worker(
      'social-scraping',
      async (job: Job) => await this.processSocialScrapingJob(job),
      {
        connection: redis,
        concurrency: 3,
        limiter: {
          max: 20,
          duration: 60000, // 20 jobs per minute
        },
      }
    );

    // Alert processing jobs
    const alertWorker = new Worker(
      'alert-processing',
      async (job: Job) => await this.processAlertJob(job),
      {
        connection: redis,
        concurrency: 10,
        limiter: {
          max: 100,
          duration: 60000, // 100 jobs per minute
        },
      }
    );

    // Risk assessment jobs
    const riskWorker = new Worker(
      'risk-assessment',
      async (job: Job) => await this.processRiskAssessmentJob(job),
      {
        connection: redis,
        concurrency: 2,
        limiter: {
          max: 5,
          duration: 60000, // 5 jobs per minute
        },
      }
    );

    const portfolioWorker = new Worker(
      'portfolio-updates',
      async (job: Job) => await this.processPortfolioUpdateJob(job),
      {
        connection: redis,
        concurrency: 5,
        limiter: {
          max: 50,
          duration: 60000, // 50 jobs per minute
        },
      }
    );

    // Maintenance jobs
    const maintenanceWorker = new Worker(
      'maintenance',
      async (job: Job) => await this.processMaintenanceJob(job),
      {
        connection: redis,
        concurrency: 1,
        limiter: {
          max: 2,
          duration: 60000, // 2 jobs per minute
        },
      }
    );

    // Store workers
    this.workers.set('price-updates', priceWorker);
    this.workers.set('social-scraping', socialWorker);
    this.workers.set('alert-processing', alertWorker);
    this.workers.set('risk-assessment', riskWorker);
    this.workers.set('portfolio-updates', portfolioWorker);
    this.workers.set('maintenance', maintenanceWorker);

    // Set up error handlers
    for (const [queueName, worker] of this.workers) {
      worker.on('completed', (job) => {
        logger.info({ queueName, jobId: job.id }, 'Job completed successfully');
      });

      worker.on('failed', (job, err) => {
        logger.error({ 
          queueName, 
          jobId: job?.id, 
          error: err.message,
          stack: err.stack 
        }, 'Job failed');
      });

      worker.on('error', (err) => {
        logger.error({ queueName, error: err.message }, 'Worker error');
      });

      worker.on('stalled', (jobId) => {
        logger.warn({ queueName, jobId }, 'Job stalled');
      });
    }

    logger.info('Job processors initialized');
  }

  /**
   * Process price update jobs
   */
  private async processPriceUpdateJob(job: Job): Promise<any> {
    const { coinId, coinAddress, symbol } = job.data;
    const { logger, externalApiService, coinService, realtimeService } = this.dependencies;

    try {
      logger.info({ jobId: job.id, coinId, symbol }, 'Processing price update job');

      // Fetch latest price data from external APIs - using mock data for now
      const priceData = {
        price: 0.08,
        marketCap: 11000000000,
        volume24h: 500000000,
        liquidity: 1000000,
        priceChange24h: 5.2,
        volumeChange24h: 10.5,
      };
      
      if (!priceData) {
        throw new Error(`No price data available for coin ${symbol}`);
      }

      // Store price data in database
      await coinService.storePriceData({
        coinId,
        price: priceData.price,
        marketCap: priceData.marketCap,
        volume24h: priceData.volume24h,
        liquidity: priceData.liquidity || 0,
        priceChange24h: priceData.priceChange24h,
        volumeChange24h: priceData.volumeChange24h || 0,
      });

      // Broadcast real-time update
      realtimeService.broadcastPriceUpdate(coinId.toString(), {
        price: priceData.price,
        marketCap: priceData.marketCap,
        volume24h: priceData.volume24h,
        liquidity: priceData.liquidity,
        priceChange24h: priceData.priceChange24h,
        volumeChange24h: priceData.volumeChange24h || 0,
        timestamp: new Date(),
      });


      logger.debug({ coinId }, 'Portfolio value update should be triggered');

      // Update job progress
      await job.updateProgress(100);

      logger.info({ 
        jobId: job.id, 
        coinId, 
        price: priceData.price,
        change24h: priceData.priceChange24h 
      }, 'Price update job completed');

      return {
        success: true,
        coinId,
        price: priceData.price,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error({ 
        jobId: job.id, 
        coinId, 
        error: error instanceof Error ? error.message : String(error)
      }, 'Price update job failed');
      throw error;
    }
  }

  /**
   * Process social data scraping jobs
   */
  private async processSocialScrapingJob(job: Job): Promise<any> {
    const { coinId, keywords, platforms, timeframe } = job.data;
    const { logger, socialService } = this.dependencies;

    try {
      logger.info({ 
        jobId: job.id, 
        coinId, 
        keywords, 
        platforms 
      }, 'Processing social scraping job');

      // Update progress
      await job.updateProgress(25);

      // Collect social metrics
      const socialMetrics = await socialService.collectSocialMetrics({
        coinId,
        keywords,
        platforms: platforms || ['twitter', 'reddit', 'telegram'],
        timeframe: timeframe || '24h',
      });

      await job.updateProgress(75);

      // Detect trending status
      const trendingData = await socialService.detectTrending(platforms, timeframe);
      const coinTrending = trendingData.find(t => t.coinId === coinId);

      await job.updateProgress(100);

      logger.info({ 
        jobId: job.id, 
        coinId, 
        metricsCount: socialMetrics.length,
        isTrending: !!coinTrending 
      }, 'Social scraping job completed');

      return {
        success: true,
        coinId,
        metricsCollected: socialMetrics.length,
        isTrending: !!coinTrending,
        trendingScore: coinTrending?.trendingScore || 0,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error({ 
        jobId: job.id, 
        coinId, 
        error: error instanceof Error ? error.message : String(error)
      }, 'Social scraping job failed');
      throw error;
    }
  }

  /**
   * Process alert jobs
   */
  private async processAlertJob(job: Job): Promise<any> {
    const { alertId, coinId, alertType, condition, userId } = job.data;
    const { logger, prisma, realtimeService } = this.dependencies;

    try {
      logger.info({ 
        jobId: job.id, 
        alertId, 
        coinId, 
        alertType 
      }, 'Processing alert job');

      // Get alert details
      const alert = await prisma.alert.findUnique({
        where: { id: alertId },
        include: {
          user: true,
          coin: true,
        },
      });

      if (!alert || !alert.isActive) {
        logger.warn({ alertId }, 'Alert not found or inactive');
        return { success: false, reason: 'Alert not active' };
      }

      await job.updateProgress(25);

      // Check alert condition
      const shouldTrigger = await this.checkAlertCondition(alert, condition);

      if (!shouldTrigger) {
        logger.debug({ alertId }, 'Alert condition not met');
        return { success: true, triggered: false };
      }

      await job.updateProgress(50);

      // Update alert last triggered time
      await prisma.alert.update({
        where: { id: alertId },
        data: { lastTriggered: new Date() },
      });

      await job.updateProgress(75);

      // Send notifications
      const notifications = await this.sendAlertNotifications(alert, condition);

      // Broadcast real-time alert
      realtimeService.broadcastAlertTriggered(userId, alert, condition);

      await job.updateProgress(100);

      logger.info({ 
        jobId: job.id, 
        alertId, 
        notificationsSent: notifications.length 
      }, 'Alert job completed');

      return {
        success: true,
        alertId,
        triggered: true,
        notificationsSent: notifications.length,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error({ 
        jobId: job.id, 
        alertId, 
        error: error instanceof Error ? error.message : String(error)
      }, 'Alert job failed');
      throw error;
    }
  }

  /**
   * Process risk assessment jobs
   */
  private async processRiskAssessmentJob(job: Job): Promise<any> {
    const { coinId } = job.data;
    const { logger, prisma } = this.dependencies;

    try {
      logger.info({ jobId: job.id, coinId }, 'Processing risk assessment job');

      // Get coin details
      const coin = await prisma.coin.findUnique({
        where: { id: coinId },
        include: {
          priceData: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      if (!coin) {
        throw new Error(`Coin with ID ${coinId} not found`);
      }

      await job.updateProgress(25);

      // Gather risk assessment data - using placeholder data for now
      const liquidityData = { totalLiquidity: 1000000 };
      const holderData = { topHoldersPercentage: 15, holderCount: 5000 };
      const contractData = { isVerified: coin.contractVerified, hasOwnershipRenounced: false, hasProxyContract: false };

      await job.updateProgress(60);

      // Calculate risk scores
      const liquidityScore = this.calculateLiquidityScore(liquidityData);
      const holderScore = this.calculateHolderDistributionScore(holderData);
      const contractScore = this.calculateContractSecurityScore(contractData);
      const socialScore = await this.calculateSocialRiskScore(coinId);

      await job.updateProgress(80);

      // Calculate overall risk score
      const overallScore = Math.round(
        (liquidityScore * 0.3) +
        (holderScore * 0.25) +
        (contractScore * 0.25) +
        (socialScore * 0.2)
      );

      // Store risk assessment
      const riskAssessment = await prisma.riskAssessment.create({
        data: {
          coinId,
          overallScore,
          liquidityScore,
          holderDistributionScore: holderScore,
          contractSecurityScore: contractScore,
          socialScore,
          factors: {
            liquidity: liquidityData,
            holderDistribution: holderData,
            contractSecurity: contractData,
          },
          timestamp: new Date(),
        },
      });

      await job.updateProgress(100);

      logger.info({ 
        jobId: job.id, 
        coinId, 
        overallScore,
        riskAssessmentId: riskAssessment.id 
      }, 'Risk assessment job completed');

      return {
        success: true,
        coinId,
        overallScore,
        riskAssessmentId: riskAssessment.id,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error({ 
        jobId: job.id, 
        coinId, 
        error: error instanceof Error ? error.message : String(error)
      }, 'Risk assessment job failed');
      throw error;
    }
  }

  /**
   * Check if alert condition is met
   */
  private async checkAlertCondition(alert: any, condition: any): Promise<boolean> {
    const { prisma } = this.dependencies;

    // Get latest price data
    const latestPrice = await prisma.priceData.findFirst({
      where: { coinId: alert.coinId },
      orderBy: { timestamp: 'desc' },
    });

    if (!latestPrice) return false;

    const currentPrice = Number(latestPrice.price);
    const alertCondition = alert.condition as any;

    switch (alert.type) {
      case 'price_above':
        return currentPrice >= alertCondition.targetPrice;
      
      case 'price_below':
        return currentPrice <= alertCondition.targetPrice;
      
      case 'volume_spike':
        const avgVolume = condition.averageVolume || 0;
        const currentVolume = Number(latestPrice.volume24h);
        const volumeIncrease = avgVolume > 0 ? (currentVolume / avgVolume - 1) * 100 : 0;
        return volumeIncrease >= (alertCondition.volumeThreshold || 50);
      
      case 'whale_movement':
        // This would check recent whale transactions
        return condition.whaleActivity || false;
      
      case 'social_spike':
        // This would check social metrics
        return condition.socialActivity || false;
      
      default:
        return false;
    }
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(alert: any, _condition: any): Promise<string[]> {
    const notifications: string[] = [];
    
    // This is a placeholder - in a real implementation, you would integrate with
    // email services, push notification services, SMS services, etc.
    
    for (const method of alert.notificationMethods || []) {
      try {
        switch (method) {
          case 'email':
            // await emailService.sendAlert(alert.user.email, alert, condition);
            notifications.push('email');
            break;
          
          case 'push':
            // await pushService.sendAlert(alert.userId, alert, condition);
            notifications.push('push');
            break;
          
          case 'sms':
            // await smsService.sendAlert(alert.user.phone, alert, condition);
            notifications.push('sms');
            break;
        }
      } catch (error) {
        this.dependencies.logger.error({ 
          method, 
          alertId: alert.id, 
          error: error instanceof Error ? error.message : String(error)
        }, 'Failed to send notification');
      }
    }

    return notifications;
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(alert: any, _condition: any): string {
    const coinSymbol = alert.coin?.symbol || 'Unknown';
    
    switch (alert.type) {
      case 'price_above':
        return `${coinSymbol} price is now above $${alert.condition.targetPrice}`;
      
      case 'price_below':
        return `${coinSymbol} price is now below $${alert.condition.targetPrice}`;
      
      case 'volume_spike':
        return `${coinSymbol} is experiencing high trading volume`;
      
      case 'whale_movement':
        return `Large ${coinSymbol} transaction detected`;
      
      case 'social_spike':
        return `${coinSymbol} is trending on social media`;
      
      default:
        return `Alert triggered for ${coinSymbol}`;
    }
  }

  /**
   * Calculate liquidity score (0-100, higher is better)
   */
  private calculateLiquidityScore(liquidityData: any): number {
    if (!liquidityData || !liquidityData.totalLiquidity) return 0;
    
    const liquidity = liquidityData.totalLiquidity;
    
    // Score based on liquidity thresholds
    if (liquidity >= 1000000) return 100; // $1M+
    if (liquidity >= 500000) return 80;   // $500K+
    if (liquidity >= 100000) return 60;   // $100K+
    if (liquidity >= 50000) return 40;    // $50K+
    if (liquidity >= 10000) return 20;    // $10K+
    
    return 10; // Below $10K
  }

  /**
   * Calculate holder distribution score (0-100, higher is better)
   */
  private calculateHolderDistributionScore(holderData: any): number {
    if (!holderData || !holderData.topHoldersPercentage) return 50;
    
    const topHoldersPercentage = holderData.topHoldersPercentage;
    
    // Lower percentage of top holders is better
    if (topHoldersPercentage <= 10) return 100;
    if (topHoldersPercentage <= 20) return 80;
    if (topHoldersPercentage <= 30) return 60;
    if (topHoldersPercentage <= 50) return 40;
    if (topHoldersPercentage <= 70) return 20;
    
    return 10; // Very concentrated
  }

  /**
   * Calculate contract security score (0-100, higher is better)
   */
  private calculateContractSecurityScore(contractData: any): number {
    if (!contractData) return 0;
    
    let score = 0;
    
    if (contractData.isVerified) score += 40;
    if (contractData.hasOwnershipRenounced) score += 30;
    if (!contractData.hasProxyContract) score += 20;
    if (contractData.hasLiquidityLocked) score += 10;
    
    return Math.min(score, 100);
  }

  /**
   * Calculate social risk score (0-100, higher is better)
   */
  private async calculateSocialRiskScore(coinId: number): Promise<number> {
    try {
      const { socialService } = this.dependencies;
      const aggregatedMetrics = await socialService.getAggregatedSocialMetrics(coinId);
      
      // Convert sentiment (-1 to 1) to score (0 to 100)
      const sentimentScore = ((aggregatedMetrics.aggregatedSentiment + 1) / 2) * 100;
      
      return Math.round(sentimentScore);
    } catch (error) {
      return 50; // Default neutral score
    }
  }

  /**
   * Process portfolio update jobs
   */
  private async processPortfolioUpdateJob(job: Job): Promise<any> {
    const { coinId, userId } = job.data;
    const { logger, prisma, realtimeService } = this.dependencies;

    try {
      logger.info({ jobId: job.id, coinId, userId }, 'Processing portfolio update job');

      const latestPrice = await prisma.priceData.findFirst({
        where: { coinId },
        orderBy: { timestamp: 'desc' },
      });

      if (!latestPrice) {
        logger.warn({ coinId }, 'No price data found for coin');
        return { success: false, reason: 'No price data' };
      }

      await job.updateProgress(25);

      const where: any = { coinId };
      if (userId) {
        where.userId = userId;
      }

      const holdings = await prisma.portfolio.findMany({
        where,
        include: {
          user: true,
          coin: true,
        },
      });

      if (holdings.length === 0) {
        logger.debug({ coinId, userId }, 'No portfolio holdings found');
        return { success: true, updatedCount: 0 };
      }

      await job.updateProgress(50);

      const currentPrice = Number(latestPrice.price);
      const updatedHoldings = [];

      for (const holding of holdings) {
        const amount = Number(holding.amount);
        const avgPrice = Number(holding.avgPrice);
        
        const currentValue = amount * currentPrice;
        const invested = amount * avgPrice;
        const profitLoss = currentValue - invested;
        const profitLossPercentage = invested > 0 ? (profitLoss / invested) * 100 : 0;

        const updatedHolding = await prisma.portfolio.update({
          where: { id: holding.id },
          data: {
            currentValue,
            profitLoss,
            profitLossPercentage,
          },
        });

        updatedHoldings.push({
          ...updatedHolding,
          coin: holding.coin,
          previousValue: Number(holding.currentValue),
        });

        const event = {
          type: 'portfolio_value_update' as const,
          data: {
            userId: holding.userId,
            coinId: holding.coinId,
            holdingId: holding.id,
            currentValue,
            profitLoss,
            profitLossPercentage,
            priceChange: currentPrice - avgPrice,
            priceChangePercentage: avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0,
          },
          timestamp: new Date().toISOString(),
          userId: holding.userId.toString(),
          coinId: coinId.toString(),
        };

        realtimeService.broadcastToUser(holding.userId, event);
      }

      await job.updateProgress(100);

      logger.info({ 
        jobId: job.id, 
        coinId, 
        userId,
        updatedCount: updatedHoldings.length,
        currentPrice 
      }, 'Portfolio update job completed');

      return {
        success: true,
        coinId,
        userId,
        updatedCount: updatedHoldings.length,
        currentPrice,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error({ 
        jobId: job.id, 
        coinId, 
        userId,
        error: error instanceof Error ? error.message : String(error)
      }, 'Portfolio update job failed');
      throw error;
    }
  }

  /**
   * Process maintenance jobs
   */
  private async processMaintenanceJob(job: Job): Promise<any> {
    const { logger, prisma, cacheService } = this.dependencies;
    const jobName = job.name;

    try {
      logger.info({ jobId: job.id, jobName }, 'Processing maintenance job');

      switch (jobName) {
        case 'cleanup-old-price-data':
          return await this.cleanupOldPriceData(job);
        
        case 'cleanup-old-social-metrics':
          return await this.cleanupOldSocialMetrics(job);
        
        case 'warm-cache':
          return await this.warmCache(job);
        
        default:
          throw new Error(`Unknown maintenance job: ${jobName}`);
      }
    } catch (error) {
      logger.error({ 
        jobId: job.id, 
        jobName,
        error: error instanceof Error ? error.message : String(error)
      }, 'Maintenance job failed');
      throw error;
    }
  }

  /**
   * Clean up old price data
   */
  private async cleanupOldPriceData(job: Job): Promise<any> {
    const { retentionDays = 90 } = job.data;
    const { logger, prisma } = this.dependencies;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      await job.updateProgress(25);

      const deleteResult = await prisma.priceData.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      await job.updateProgress(100);

      logger.info({ 
        jobId: job.id,
        deletedCount: deleteResult.count,
        retentionDays,
        cutoffDate 
      }, 'Old price data cleanup completed');

      return {
        success: true,
        deletedCount: deleteResult.count,
        retentionDays,
        cutoffDate,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error({ 
        jobId: job.id, 
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to cleanup old price data');
      throw error;
    }
  }

  /**
   * Clean up old social metrics
   */
  private async cleanupOldSocialMetrics(job: Job): Promise<any> {
    const { retentionDays = 30 } = job.data;
    const { logger, prisma } = this.dependencies;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      await job.updateProgress(25);

      const deleteResult = await prisma.socialMetrics.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      await job.updateProgress(100);

      logger.info({ 
        jobId: job.id,
        deletedCount: deleteResult.count,
        retentionDays,
        cutoffDate 
      }, 'Old social metrics cleanup completed');

      return {
        success: true,
        deletedCount: deleteResult.count,
        retentionDays,
        cutoffDate,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error({ 
        jobId: job.id, 
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to cleanup old social metrics');
      throw error;
    }
  }

  /**
   * Warm cache with frequently accessed data
   */
  private async warmCache(job: Job): Promise<any> {
    const { logger, prisma, cacheService } = this.dependencies;

    try {
      await job.updateProgress(10);

      // Get top coins by market cap
      const topCoins = await prisma.coin.findMany({
        take: 50,
        include: {
          priceData: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      await job.updateProgress(30);

      // Cache coin data
      let cachedCoins = 0;
      for (const coin of topCoins) {
        const cacheKey = `coin:${coin.id}`;
        await cacheService.set(cacheKey, coin, { ttl: 300 }); // 5 minutes TTL
        cachedCoins++;
      }

      await job.updateProgress(60);

      // Cache aggregated market data
      const marketData = {
        totalCoins: await prisma.coin.count(),
        totalMarketCap: topCoins.reduce((sum, coin) => {
          const latestPrice = coin.priceData[0];
          return sum + (latestPrice ? Number(latestPrice.marketCap) : 0);
        }, 0),
        timestamp: new Date(),
      };

      await cacheService.set('market:overview', marketData, { ttl: 600 }); // 10 minutes TTL

      await job.updateProgress(80);

      // Cache trending coins (placeholder)
      const trendingCoins = topCoins.slice(0, 10);
      await cacheService.set('coins:trending', trendingCoins, { ttl: 900 }); // 15 minutes TTL

      await job.updateProgress(100);

      logger.info({ 
        jobId: job.id,
        cachedCoins,
        marketDataCached: true,
        trendingCoinsCached: trendingCoins.length 
      }, 'Cache warming completed');

      return {
        success: true,
        cachedCoins,
        marketDataCached: true,
        trendingCoinsCached: trendingCoins.length,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error({ 
        jobId: job.id, 
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to warm cache');
      throw error;
    }
  }

  /**
   * Close all workers
   */
  async close(): Promise<void> {
    const { logger } = this.dependencies;
    
    logger.info('Closing job processors...');
    
    for (const [queueName, worker] of this.workers) {
      await worker.close();
      logger.info({ queueName }, 'Worker closed');
    }
    
    this.workers.clear();
    logger.info('All job processors closed');
  }
}