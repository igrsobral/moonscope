import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CacheService from './cache.js';
import CacheWarmingService, { type WarmingStrategy } from './cache-warming.js';

describe('CacheWarmingService', () => {
  let mockCacheService: any;
  let mockLogger: any;
  let cacheWarmingService: CacheWarmingService;

  beforeEach(() => {
    mockCacheService = {
      warmCache: vi.fn(),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    cacheWarmingService = new CacheWarmingService(mockCacheService, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
    cacheWarmingService.stopAllStrategies();
  });

  describe('Strategy Management', () => {
    it('should add a new warming strategy', () => {
      const strategy: WarmingStrategy = {
        name: 'test_strategy',
        priority: 5,
        interval: 60000,
        enabled: true,
        execute: vi.fn().mockResolvedValue([]),
      };

      cacheWarmingService.addStrategy(strategy);

      const stats = cacheWarmingService.getWarmingStats();
      expect(stats.totalStrategies).toBeGreaterThan(0);
      expect(stats.strategies.some(s => s.name === 'test_strategy')).toBe(true);
    });

    it('should remove a warming strategy', () => {
      const strategy: WarmingStrategy = {
        name: 'test_strategy',
        priority: 5,
        interval: 60000,
        enabled: true,
        execute: vi.fn().mockResolvedValue([]),
      };

      cacheWarmingService.addStrategy(strategy);
      const removed = cacheWarmingService.removeStrategy('test_strategy');

      expect(removed).toBe(true);
      
      const stats = cacheWarmingService.getWarmingStats();
      expect(stats.strategies.some(s => s.name === 'test_strategy')).toBe(false);
    });

    it('should return false when removing non-existent strategy', () => {
      const removed = cacheWarmingService.removeStrategy('non_existent');
      expect(removed).toBe(false);
    });

    it('should toggle strategy enabled state', () => {
      const strategy: WarmingStrategy = {
        name: 'test_strategy',
        priority: 5,
        interval: 60000,
        enabled: true,
        execute: vi.fn().mockResolvedValue([]),
      };

      cacheWarmingService.addStrategy(strategy);
      
      // Disable strategy
      const disabled = cacheWarmingService.toggleStrategy('test_strategy', false);
      expect(disabled).toBe(true);
      
      const stats = cacheWarmingService.getWarmingStats();
      const testStrategy = stats.strategies.find(s => s.name === 'test_strategy');
      expect(testStrategy?.enabled).toBe(false);
      
      // Re-enable strategy
      const enabled = cacheWarmingService.toggleStrategy('test_strategy', true);
      expect(enabled).toBe(true);
    });

    it('should return false when toggling non-existent strategy', () => {
      const result = cacheWarmingService.toggleStrategy('non_existent', true);
      expect(result).toBe(false);
    });
  });

  describe('Strategy Execution', () => {
    it('should execute a strategy successfully', async () => {
      const mockWarmingData = [
        {
          key: 'test_key',
          value: { data: 'test' },
          ttl: 300,
          prefix: 'test',
        },
      ];

      const strategy: WarmingStrategy = {
        name: 'test_strategy',
        priority: 5,
        interval: 60000,
        enabled: true,
        execute: vi.fn().mockResolvedValue(mockWarmingData),
      };

      mockCacheService.warmCache.mockResolvedValue(1);

      cacheWarmingService.addStrategy(strategy);
      const result = await cacheWarmingService.executeStrategy('test_strategy');

      expect(result.success).toBe(true);
      expect(result.itemsWarmed).toBe(1);
      expect(result.strategy).toBe('test_strategy');
      expect(strategy.execute).toHaveBeenCalled();
      expect(mockCacheService.warmCache).toHaveBeenCalledWith(mockWarmingData);
    });

    it('should handle strategy execution failure', async () => {
      const strategy: WarmingStrategy = {
        name: 'test_strategy',
        priority: 5,
        interval: 60000,
        enabled: true,
        execute: vi.fn().mockRejectedValue(new Error('Strategy failed')),
      };

      cacheWarmingService.addStrategy(strategy);
      const result = await cacheWarmingService.executeStrategy('test_strategy');

      expect(result.success).toBe(false);
      expect(result.itemsWarmed).toBe(0);
      expect(result.error).toBe('Strategy failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should return failure for non-existent strategy', async () => {
      const result = await cacheWarmingService.executeStrategy('non_existent');

      expect(result.success).toBe(false);
      expect(result.itemsWarmed).toBe(0);
      expect(result.error).toBe('Strategy not found or disabled');
    });

    it('should return failure for disabled strategy', async () => {
      const strategy: WarmingStrategy = {
        name: 'test_strategy',
        priority: 5,
        interval: 60000,
        enabled: false,
        execute: vi.fn().mockResolvedValue([]),
      };

      cacheWarmingService.addStrategy(strategy);
      const result = await cacheWarmingService.executeStrategy('test_strategy');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Strategy not found or disabled');
    });
  });

  describe('Warm All Caches', () => {
    it('should execute all enabled strategies in priority order', async () => {
      // Create a fresh service without default strategies for this test
      const freshService = new CacheWarmingService(mockCacheService, mockLogger);
      
      // Stop default strategies and clear them
      freshService.stopAllStrategies();
      
      const strategy1: WarmingStrategy = {
        name: 'low_priority',
        priority: 3,
        interval: 60000,
        enabled: true,
        execute: vi.fn().mockResolvedValue([{ key: 'key1', value: {}, ttl: 300 }]),
      };

      const strategy2: WarmingStrategy = {
        name: 'high_priority',
        priority: 8,
        interval: 60000,
        enabled: true,
        execute: vi.fn().mockResolvedValue([{ key: 'key2', value: {}, ttl: 300 }]),
      };

      const strategy3: WarmingStrategy = {
        name: 'disabled_strategy',
        priority: 10,
        interval: 60000,
        enabled: false,
        execute: vi.fn().mockResolvedValue([]),
      };

      mockCacheService.warmCache.mockResolvedValue(1);

      // Remove all default strategies first
      const defaultStats = freshService.getWarmingStats();
      for (const strategy of defaultStats.strategies) {
        freshService.removeStrategy(strategy.name);
      }

      freshService.addStrategy(strategy1);
      freshService.addStrategy(strategy2);
      freshService.addStrategy(strategy3);

      const results = await freshService.warmAllCaches();

      expect(results).toHaveLength(2); // Only enabled strategies
      expect(results[0].strategy).toBe('high_priority'); // Higher priority first
      expect(results[1].strategy).toBe('low_priority');
      expect(strategy3.execute).not.toHaveBeenCalled(); // Disabled strategy not executed
      
      // Clean up
      freshService.stopAllStrategies();
    });

    it('should handle concurrent warming prevention', async () => {
      const strategy: WarmingStrategy = {
        name: 'test_strategy',
        priority: 5,
        interval: 60000,
        enabled: true,
        execute: vi.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve([]), 100))
        ),
      };

      cacheWarmingService.addStrategy(strategy);

      // Start first warming
      const firstWarmingPromise = cacheWarmingService.warmAllCaches();
      
      // Try to start second warming while first is in progress
      const secondWarmingResult = await cacheWarmingService.warmAllCaches();
      
      // Second warming should be skipped
      expect(secondWarmingResult).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cache warming already in progress, skipping'
      );

      // Wait for first warming to complete
      await firstWarmingPromise;
    });
  });

  describe('Default Strategies', () => {
    it('should initialize with default strategies', () => {
      const stats = cacheWarmingService.getWarmingStats();
      
      expect(stats.totalStrategies).toBeGreaterThan(0);
      expect(stats.enabledStrategies).toBeGreaterThan(0);
      
      // Check for some expected default strategies
      const strategyNames = stats.strategies.map(s => s.name);
      expect(strategyNames).toContain('top_coins');
      expect(strategyNames).toContain('popular_meme_coins');
      expect(strategyNames).toContain('market_overview');
      expect(strategyNames).toContain('social_sentiment');
    });

    it('should execute default strategies successfully', async () => {
      mockCacheService.warmCache.mockResolvedValue(2);

      const result = await cacheWarmingService.executeStrategy('top_coins');

      expect(result.success).toBe(true);
      expect(result.itemsWarmed).toBe(2);
      expect(mockCacheService.warmCache).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should return warming statistics', () => {
      const strategy: WarmingStrategy = {
        name: 'test_strategy',
        priority: 5,
        interval: 60000,
        enabled: true,
        execute: vi.fn().mockResolvedValue([]),
      };

      cacheWarmingService.addStrategy(strategy);
      const stats = cacheWarmingService.getWarmingStats();

      expect(stats).toHaveProperty('totalStrategies');
      expect(stats).toHaveProperty('enabledStrategies');
      expect(stats).toHaveProperty('strategies');
      expect(Array.isArray(stats.strategies)).toBe(true);
      
      const testStrategy = stats.strategies.find(s => s.name === 'test_strategy');
      expect(testStrategy).toBeDefined();
      expect(testStrategy?.priority).toBe(5);
      expect(testStrategy?.enabled).toBe(true);
      expect(testStrategy?.interval).toBe(60000);
    });
  });

  describe('Strategy Lifecycle', () => {
    it('should start all enabled strategies', () => {
      const strategy: WarmingStrategy = {
        name: 'test_strategy',
        priority: 5,
        interval: 1000, // Short interval for testing
        enabled: true,
        execute: vi.fn().mockResolvedValue([]),
      };

      cacheWarmingService.addStrategy(strategy);
      cacheWarmingService.startAllStrategies();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ count: expect.any(Number) }),
        'All enabled cache warming strategies started'
      );
    });

    it('should stop all strategies', () => {
      const strategy: WarmingStrategy = {
        name: 'test_strategy',
        priority: 5,
        interval: 1000,
        enabled: true,
        execute: vi.fn().mockResolvedValue([]),
      };

      cacheWarmingService.addStrategy(strategy);
      cacheWarmingService.startAllStrategies();
      cacheWarmingService.stopAllStrategies();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'All cache warming strategies stopped'
      );
    });
  });
});