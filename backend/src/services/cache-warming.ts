import { FastifyInstance } from 'fastify';
import CacheService from './cache.js';

export interface WarmingStrategy {
  name: string;
  priority: number; // 1-10, higher is more important
  interval: number; // How often to warm in milliseconds
  enabled: boolean;
  execute: () => Promise<any[]>;
}

export interface WarmingResult {
  strategy: string;
  itemsWarmed: number;
  duration: number;
  success: boolean;
  error?: string;
}

export class CacheWarmingService {
  private cacheService: CacheService;
  private logger: FastifyInstance['log'];
  private strategies: Map<string, WarmingStrategy> = new Map();
  private warmingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isWarming = false;

  constructor(cacheService: CacheService, logger: FastifyInstance['log']) {
    this.cacheService = cacheService;
    this.logger = logger;
    this.initializeDefaultStrategies();
  }

  /**
   * Initialize default warming strategies
   */
  private initializeDefaultStrategies(): void {
    // Top coins by market cap - highest priority
    this.addStrategy({
      name: 'top_coins',
      priority: 10,
      interval: 5 * 60 * 1000, // 5 minutes
      enabled: true,
      execute: async () => {
        // Mock data - in real implementation, this would fetch from external APIs
        return [
          {
            key: 'coin:bitcoin',
            value: {
              id: 'bitcoin',
              symbol: 'BTC',
              name: 'Bitcoin',
              price: 45000,
              marketCap: 850000000000,
              volume24h: 25000000000,
            },
            ttl: CacheService.TTL_STRATEGIES.COIN_DETAILS,
            prefix: 'coins',
          },
          {
            key: 'coin:ethereum',
            value: {
              id: 'ethereum',
              symbol: 'ETH',
              name: 'Ethereum',
              price: 2800,
              marketCap: 340000000000,
              volume24h: 15000000000,
            },
            ttl: CacheService.TTL_STRATEGIES.COIN_DETAILS,
            prefix: 'coins',
          },
        ];
      },
    });

    // Popular meme coins - high priority
    this.addStrategy({
      name: 'popular_meme_coins',
      priority: 9,
      interval: 3 * 60 * 1000, // 3 minutes
      enabled: true,
      execute: async () => {
        return [
          {
            key: 'coin:dogecoin',
            value: {
              id: 'dogecoin',
              symbol: 'DOGE',
              name: 'Dogecoin',
              price: 0.08,
              marketCap: 11000000000,
              volume24h: 500000000,
              riskScore: 65,
            },
            ttl: CacheService.TTL_STRATEGIES.COIN_DETAILS,
            prefix: 'coins',
          },
          {
            key: 'coin:shiba-inu',
            value: {
              id: 'shiba-inu',
              symbol: 'SHIB',
              name: 'Shiba Inu',
              price: 0.000009,
              marketCap: 5300000000,
              volume24h: 200000000,
              riskScore: 72,
            },
            ttl: CacheService.TTL_STRATEGIES.COIN_DETAILS,
            prefix: 'coins',
          },
        ];
      },
    });

    // Market overview data - medium priority
    this.addStrategy({
      name: 'market_overview',
      priority: 7,
      interval: 2 * 60 * 1000, // 2 minutes
      enabled: true,
      execute: async () => {
        return [
          {
            key: 'market:overview',
            value: {
              totalMarketCap: 1700000000000,
              total24hVolume: 65000000000,
              btcDominance: 50.2,
              ethDominance: 20.1,
              memeCoinsMarketCap: 45000000000,
              activeCryptocurrencies: 2800,
            },
            ttl: CacheService.TTL_STRATEGIES.MARKET_CAP,
            prefix: 'market',
          },
          {
            key: 'trending:coins',
            value: [
              { id: 'pepe', symbol: 'PEPE', priceChange24h: 15.2 },
              { id: 'floki', symbol: 'FLOKI', priceChange24h: 12.8 },
              { id: 'bonk', symbol: 'BONK', priceChange24h: 8.5 },
            ],
            ttl: CacheService.TTL_STRATEGIES.TRENDING_DATA,
            prefix: 'trending',
          },
        ];
      },
    });

    // Social sentiment data - medium priority
    this.addStrategy({
      name: 'social_sentiment',
      priority: 6,
      interval: 10 * 60 * 1000, // 10 minutes
      enabled: true,
      execute: async () => {
        return [
          {
            key: 'sentiment:dogecoin',
            value: {
              overall: 0.72,
              twitter: 0.68,
              reddit: 0.75,
              telegram: 0.73,
              mentions24h: 15420,
              trendingScore: 85,
            },
            ttl: CacheService.TTL_STRATEGIES.SENTIMENT_SCORES,
            prefix: 'sentiment',
          },
          {
            key: 'sentiment:shiba-inu',
            value: {
              overall: 0.65,
              twitter: 0.62,
              reddit: 0.68,
              telegram: 0.66,
              mentions24h: 8930,
              trendingScore: 78,
            },
            ttl: CacheService.TTL_STRATEGIES.SENTIMENT_SCORES,
            prefix: 'sentiment',
          },
        ];
      },
    });

    // Risk assessment data - lower priority but important
    this.addStrategy({
      name: 'risk_assessments',
      priority: 5,
      interval: 30 * 60 * 1000, // 30 minutes
      enabled: true,
      execute: async () => {
        return [
          {
            key: 'risk:dogecoin',
            value: {
              overallScore: 65,
              liquidity: { score: 85, value: 1200000000 },
              holderDistribution: { score: 70, topHoldersPercentage: 15 },
              contractSecurity: { score: 90, isVerified: true },
              socialMetrics: { score: 75, sentimentScore: 0.72 },
            },
            ttl: CacheService.TTL_STRATEGIES.RISK_SCORES,
            prefix: 'risk',
          },
        ];
      },
    });

    // Exchange and liquidity data - lower priority
    this.addStrategy({
      name: 'liquidity_data',
      priority: 4,
      interval: 15 * 60 * 1000, // 15 minutes
      enabled: true,
      execute: async () => {
        return [
          {
            key: 'liquidity:uniswap:doge-eth',
            value: {
              exchange: 'uniswap',
              pair: 'DOGE/ETH',
              totalLiquidity: 25000000,
              volume24h: 2500000,
              priceImpact1k: 0.02,
              priceImpact10k: 0.18,
            },
            ttl: CacheService.TTL_STRATEGIES.LIQUIDITY_DATA,
            prefix: 'liquidity',
          },
        ];
      },
    });

    // API response templates - lowest priority
    this.addStrategy({
      name: 'api_templates',
      priority: 2,
      interval: 60 * 60 * 1000, // 1 hour
      enabled: true,
      execute: async () => {
        return [
          {
            key: 'template:coin_list',
            value: {
              success: true,
              data: [],
              meta: {
                pagination: {
                  page: 1,
                  limit: 20,
                  total: 0,
                  totalPages: 0,
                },
              },
            },
            ttl: CacheService.TTL_STRATEGIES.COIN_LIST,
            prefix: 'templates',
          },
        ];
      },
    });
  }

  /**
   * Add a warming strategy
   */
  addStrategy(strategy: WarmingStrategy): void {
    this.strategies.set(strategy.name, strategy);

    if (strategy.enabled) {
      this.scheduleStrategy(strategy);
    }

    this.logger.info(
      {
        strategy: strategy.name,
        priority: strategy.priority,
        interval: strategy.interval,
        enabled: strategy.enabled,
      },
      'Cache warming strategy added'
    );
  }

  /**
   * Remove a warming strategy
   */
  removeStrategy(name: string): boolean {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      return false;
    }

    this.unscheduleStrategy(name);
    this.strategies.delete(name);

    this.logger.info({ strategy: name }, 'Cache warming strategy removed');
    return true;
  }

  /**
   * Enable/disable a strategy
   */
  toggleStrategy(name: string, enabled: boolean): boolean {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      return false;
    }

    strategy.enabled = enabled;

    if (enabled) {
      this.scheduleStrategy(strategy);
    } else {
      this.unscheduleStrategy(name);
    }

    this.logger.info(
      {
        strategy: name,
        enabled,
      },
      'Cache warming strategy toggled'
    );

    return true;
  }

  /**
   * Schedule a strategy to run at intervals
   */
  private scheduleStrategy(strategy: WarmingStrategy): void {
    // Clear existing interval if any
    this.unscheduleStrategy(strategy.name);

    const interval = setInterval(async () => {
      await this.executeStrategy(strategy.name);
    }, strategy.interval);

    this.warmingIntervals.set(strategy.name, interval);

    // Execute immediately on first schedule
    setImmediate(() => this.executeStrategy(strategy.name));
  }

  /**
   * Unschedule a strategy
   */
  private unscheduleStrategy(name: string): void {
    const interval = this.warmingIntervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.warmingIntervals.delete(name);
    }
  }

  /**
   * Execute a specific warming strategy
   */
  async executeStrategy(name: string): Promise<WarmingResult> {
    const strategy = this.strategies.get(name);
    if (!strategy || !strategy.enabled) {
      return {
        strategy: name,
        itemsWarmed: 0,
        duration: 0,
        success: false,
        error: 'Strategy not found or disabled',
      };
    }

    const startTime = Date.now();

    try {
      this.logger.debug({ strategy: name }, 'Executing cache warming strategy');

      const warmingData = await strategy.execute();
      const itemsWarmed = await this.cacheService.warmCache(warmingData);
      const duration = Date.now() - startTime;

      const result: WarmingResult = {
        strategy: name,
        itemsWarmed,
        duration,
        success: true,
      };

      this.logger.info(
        {
          strategy: name,
          itemsWarmed,
          duration,
          priority: strategy.priority,
        },
        'Cache warming strategy executed successfully'
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const result: WarmingResult = {
        strategy: name,
        itemsWarmed: 0,
        duration,
        success: false,
        error: errorMessage,
      };

      this.logger.error(
        {
          error,
          strategy: name,
          duration,
        },
        'Cache warming strategy failed'
      );

      return result;
    }
  }

  /**
   * Execute all enabled strategies once
   */
  async warmAllCaches(): Promise<WarmingResult[]> {
    if (this.isWarming) {
      this.logger.warn('Cache warming already in progress, skipping');
      return [];
    }

    this.isWarming = true;

    try {
      const enabledStrategies = Array.from(this.strategies.values())
        .filter(s => s.enabled)
        .sort((a, b) => b.priority - a.priority); // Sort by priority (highest first)

      this.logger.info(
        {
          strategiesCount: enabledStrategies.length,
        },
        'Starting cache warming for all strategies'
      );

      const results: WarmingResult[] = [];

      // Execute strategies in priority order
      for (const strategy of enabledStrategies) {
        const result = await this.executeStrategy(strategy.name);
        results.push(result);

        // Small delay between strategies to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const totalItemsWarmed = results.reduce((sum, r) => sum + r.itemsWarmed, 0);
      const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
      const successfulStrategies = results.filter(r => r.success).length;

      this.logger.info(
        {
          totalStrategies: results.length,
          successfulStrategies,
          totalItemsWarmed,
          totalDuration,
        },
        'Cache warming completed for all strategies'
      );

      return results;
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Get warming statistics
   */
  getWarmingStats(): {
    totalStrategies: number;
    enabledStrategies: number;
    strategies: Array<{
      name: string;
      priority: number;
      enabled: boolean;
      interval: number;
    }>;
  } {
    const strategies = Array.from(this.strategies.values());

    return {
      totalStrategies: strategies.length,
      enabledStrategies: strategies.filter(s => s.enabled).length,
      strategies: strategies.map(s => ({
        name: s.name,
        priority: s.priority,
        enabled: s.enabled,
        interval: s.interval,
      })),
    };
  }

  /**
   * Stop all warming strategies
   */
  stopAllStrategies(): void {
    for (const name of this.warmingIntervals.keys()) {
      this.unscheduleStrategy(name);
    }

    this.logger.info('All cache warming strategies stopped');
  }

  /**
   * Start all enabled strategies
   */
  startAllStrategies(): void {
    const enabledStrategies = Array.from(this.strategies.values()).filter(s => s.enabled);

    for (const strategy of enabledStrategies) {
      this.scheduleStrategy(strategy);
    }

    this.logger.info(
      {
        count: enabledStrategies.length,
      },
      'All enabled cache warming strategies started'
    );
  }
}

export default CacheWarmingService;
