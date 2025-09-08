import { FastifyInstance } from 'fastify';
import Redis from 'ioredis';

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
  compress?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

export class CacheService {
  private redis: Redis;
  private logger: FastifyInstance['log'];
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  // TTL strategies for different data types (in seconds)
  public static readonly TTL_STRATEGIES = {
    // Price data - short TTL for real-time updates
    PRICE_DATA: 30, // 30 seconds
    PRICE_HISTORY: 300, // 5 minutes

    // Market data - medium TTL
    MARKET_CAP: 60, // 1 minute
    VOLUME_DATA: 120, // 2 minutes
    LIQUIDITY_DATA: 180, // 3 minutes

    // Social data - medium to long TTL
    SOCIAL_METRICS: 600, // 10 minutes
    SENTIMENT_SCORES: 900, // 15 minutes
    TRENDING_DATA: 300, // 5 minutes

    // Risk assessments - longer TTL as they change less frequently
    RISK_SCORES: 1800, // 30 minutes
    SECURITY_ANALYSIS: 3600, // 1 hour

    // User data - session-based TTL
    USER_SESSIONS: 86400, // 24 hours
    USER_PREFERENCES: 3600, // 1 hour
    USER_PORTFOLIOS: 300, // 5 minutes

    // API responses - variable TTL
    COIN_LIST: 300, // 5 minutes
    COIN_DETAILS: 180, // 3 minutes
    SEARCH_RESULTS: 600, // 10 minutes

    // Background job results
    WHALE_TRANSACTIONS: 900, // 15 minutes
    LIQUIDITY_ANALYSIS: 1800, // 30 minutes

    // Static or rarely changing data
    COIN_METADATA: 86400, // 24 hours
    EXCHANGE_INFO: 3600, // 1 hour
  } as const;

  constructor(redis: Redis, logger: FastifyInstance['log']) {
    this.redis = redis;
    this.logger = logger;
  }

  /**
   * Generate cache key with optional prefix
   */
  private generateKey(key: string, prefix?: string): string {
    const basePrefix = 'mca'; // Meme Coin Analyzer
    const fullPrefix = prefix ? `${basePrefix}:${prefix}` : basePrefix;
    return `${fullPrefix}:${key}`;
  }

  /**
   * Set a value in cache with TTL
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key, options.prefix);
      const serializedValue = JSON.stringify(value);

      let result: string | null;
      if (options.ttl) {
        result = await this.redis.setex(cacheKey, options.ttl, serializedValue);
      } else {
        result = await this.redis.set(cacheKey, serializedValue);
      }

      this.stats.sets++;

      this.logger.debug(
        {
          key: cacheKey,
          ttl: options.ttl,
          size: serializedValue.length,
        },
        'Cache set operation'
      );

      return result === 'OK';
    } catch (error) {
      this.stats.errors++;
      this.logger.error({ error, key }, 'Cache set operation failed');
      return false;
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string, prefix?: string): Promise<T | null> {
    try {
      const cacheKey = this.generateKey(key, prefix);
      const value = await this.redis.get(cacheKey);

      if (value === null) {
        this.stats.misses++;
        this.logger.debug({ key: cacheKey }, 'Cache miss');
        return null;
      }

      this.stats.hits++;
      this.logger.debug({ key: cacheKey }, 'Cache hit');

      return JSON.parse(value) as T;
    } catch (error) {
      this.stats.errors++;
      this.logger.error({ error, key }, 'Cache get operation failed');
      return null;
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string, prefix?: string): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key, prefix);
      const result = await this.redis.del(cacheKey);

      this.stats.deletes++;
      this.logger.debug({ key: cacheKey }, 'Cache delete operation');

      return result > 0;
    } catch (error) {
      this.stats.errors++;
      this.logger.error({ error, key }, 'Cache delete operation failed');
      return false;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string, prefix?: string): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key, prefix);
      const result = await this.redis.exists(cacheKey);
      return result === 1;
    } catch (error) {
      this.logger.error({ error, key }, 'Cache exists check failed');
      return false;
    }
  }

  /**
   * Set TTL for an existing key
   */
  async expire(key: string, ttl: number, prefix?: string): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key, prefix);
      const result = await this.redis.expire(cacheKey, ttl);
      return result === 1;
    } catch (error) {
      this.logger.error({ error, key, ttl }, 'Cache expire operation failed');
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string, prefix?: string): Promise<number> {
    try {
      const cacheKey = this.generateKey(key, prefix);
      return await this.redis.ttl(cacheKey);
    } catch (error) {
      this.logger.error({ error, key }, 'Cache TTL check failed');
      return -1;
    }
  }

  /**
   * Increment a numeric value in cache
   */
  async increment(key: string, by: number = 1, prefix?: string): Promise<number | null> {
    try {
      const cacheKey = this.generateKey(key, prefix);
      const result = await this.redis.incrby(cacheKey, by);
      return result;
    } catch (error) {
      this.logger.error({ error, key, by }, 'Cache increment operation failed');
      return null;
    }
  }

  /**
   * Set multiple values at once
   */
  async mset(
    entries: Array<{ key: string; value: any; ttl?: number }>,
    prefix?: string
  ): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();

      for (const entry of entries) {
        const cacheKey = this.generateKey(entry.key, prefix);
        const serializedValue = JSON.stringify(entry.value);

        if (entry.ttl) {
          pipeline.setex(cacheKey, entry.ttl, serializedValue);
        } else {
          pipeline.set(cacheKey, serializedValue);
        }
      }

      const results = await pipeline.exec();
      this.stats.sets += entries.length;

      return results?.every(([error, result]) => error === null && result === 'OK') ?? false;
    } catch (error) {
      this.stats.errors++;
      this.logger.error({ error, count: entries.length }, 'Cache mset operation failed');
      return false;
    }
  }

  /**
   * Get multiple values at once
   */
  async mget<T>(keys: string[], prefix?: string): Promise<Array<T | null>> {
    try {
      const cacheKeys = keys.map(key => this.generateKey(key, prefix));
      const values = await this.redis.mget(...cacheKeys);

      return values.map(value => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }
        this.stats.hits++;
        return JSON.parse(value) as T;
      });
    } catch (error) {
      this.stats.errors++;
      this.logger.error({ error, keys }, 'Cache mget operation failed');
      return keys.map(() => null);
    }
  }

  /**
   * Clear all cache entries with a specific prefix
   */
  async clearPrefix(prefix: string): Promise<number> {
    try {
      const pattern = this.generateKey('*', prefix);
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redis.del(...keys);
      this.stats.deletes += result;

      this.logger.info({ prefix, count: result }, 'Cache prefix cleared');
      return result;
    } catch (error) {
      this.stats.errors++;
      this.logger.error({ error, prefix }, 'Cache clear prefix operation failed');
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  }

  /**
   * Get cache hit ratio
   */
  getHitRatio(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(
    warmingData: Array<{
      key: string;
      value: any;
      ttl: number;
      prefix?: string;
    }>
  ): Promise<number> {
    try {
      const pipeline = this.redis.pipeline();

      for (const item of warmingData) {
        const cacheKey = this.generateKey(item.key, item.prefix);
        const serializedValue = JSON.stringify(item.value);
        pipeline.setex(cacheKey, item.ttl, serializedValue);
      }

      const results = await pipeline.exec();
      const successCount =
        results?.filter(([error, result]) => error === null && result === 'OK').length ?? 0;

      this.stats.sets += successCount;

      this.logger.info(
        {
          total: warmingData.length,
          successful: successCount,
        },
        'Cache warming completed'
      );

      return successCount;
    } catch (error) {
      this.stats.errors++;
      this.logger.error({ error, count: warmingData.length }, 'Cache warming failed');
      return 0;
    }
  }
}

export default CacheService;
