import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Redis from 'ioredis';
import CacheService from './cache.js';

// Mock Redis
vi.mock('ioredis');

describe('CacheService', () => {
  let mockRedis: any;
  let mockLogger: any;
  let cacheService: CacheService;

  beforeEach(() => {
    mockRedis = {
      setex: vi.fn(),
      set: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
      exists: vi.fn(),
      expire: vi.fn(),
      ttl: vi.fn(),
      incrby: vi.fn(),
      mget: vi.fn(),
      keys: vi.fn(),
      pipeline: vi.fn(() => ({
        setex: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        del: vi.fn().mockReturnThis(),
        exec: vi.fn(),
      })),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };

    cacheService = new CacheService(mockRedis as any, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('set', () => {
    it('should set value with TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const result = await cacheService.set('test-key', { data: 'test' }, { ttl: 300 });

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'mca:test-key',
        300,
        JSON.stringify({ data: 'test' })
      );
    });

    it('should set value without TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await cacheService.set('test-key', { data: 'test' });

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'mca:test-key',
        JSON.stringify({ data: 'test' })
      );
    });

    it('should set value with prefix', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const result = await cacheService.set('test-key', { data: 'test' }, { 
        ttl: 300, 
        prefix: 'coins' 
      });

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'mca:coins:test-key',
        300,
        JSON.stringify({ data: 'test' })
      );
    });

    it('should handle Redis errors', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.set('test-key', { data: 'test' }, { ttl: 300 });

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should get value successfully', async () => {
      const testData = { data: 'test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cacheService.get('test-key');

      expect(result).toEqual(testData);
      expect(mockRedis.get).toHaveBeenCalledWith('mca:test-key');
    });

    it('should return null for non-existent key', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
    });

    it('should get value with prefix', async () => {
      const testData = { data: 'test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cacheService.get('test-key', 'coins');

      expect(result).toEqual(testData);
      expect(mockRedis.get).toHaveBeenCalledWith('mca:coins:test-key');
    });

    it('should handle Redis errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete value successfully', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheService.delete('test-key');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('mca:test-key');
    });

    it('should return false for non-existent key', async () => {
      mockRedis.del.mockResolvedValue(0);

      const result = await cacheService.delete('test-key');

      expect(result).toBe(false);
    });

    it('should handle Redis errors', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.delete('test-key');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await cacheService.exists('test-key');

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('mca:test-key');
    });

    it('should return false for non-existent key', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await cacheService.exists('test-key');

      expect(result).toBe(false);
    });
  });

  describe('mset', () => {
    it('should set multiple values successfully', async () => {
      const mockPipeline = {
        setex: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 'OK'],
          [null, 'OK'],
        ]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const entries = [
        { key: 'key1', value: { data: 'test1' }, ttl: 300 },
        { key: 'key2', value: { data: 'test2' } },
      ];

      const result = await cacheService.mset(entries);

      expect(result).toBe(true);
      expect(mockPipeline.setex).toHaveBeenCalledWith(
        'mca:key1',
        300,
        JSON.stringify({ data: 'test1' })
      );
      expect(mockPipeline.set).toHaveBeenCalledWith(
        'mca:key2',
        JSON.stringify({ data: 'test2' })
      );
    });
  });

  describe('mget', () => {
    it('should get multiple values successfully', async () => {
      const testData1 = { data: 'test1' };
      const testData2 = { data: 'test2' };
      mockRedis.mget.mockResolvedValue([
        JSON.stringify(testData1),
        null,
        JSON.stringify(testData2),
      ]);

      const result = await cacheService.mget(['key1', 'key2', 'key3']);

      expect(result).toEqual([testData1, null, testData2]);
      expect(mockRedis.mget).toHaveBeenCalledWith('mca:key1', 'mca:key2', 'mca:key3');
    });
  });

  describe('warmCache', () => {
    it('should warm cache with multiple items', async () => {
      const mockPipeline = {
        setex: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 'OK'],
          [null, 'OK'],
        ]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const warmingData = [
        { key: 'key1', value: { data: 'test1' }, ttl: 300 },
        { key: 'key2', value: { data: 'test2' }, ttl: 600 },
      ];

      const result = await cacheService.warmCache(warmingData);

      expect(result).toBe(2);
      expect(mockPipeline.setex).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearPrefix', () => {
    it('should clear all keys with prefix', async () => {
      mockRedis.keys.mockResolvedValue(['mca:coins:key1', 'mca:coins:key2']);
      mockRedis.del.mockResolvedValue(2);

      const result = await cacheService.clearPrefix('coins');

      expect(result).toBe(2);
      expect(mockRedis.keys).toHaveBeenCalledWith('mca:coins:*');
      expect(mockRedis.del).toHaveBeenCalledWith('mca:coins:key1', 'mca:coins:key2');
    });

    it('should return 0 when no keys found', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await cacheService.clearPrefix('coins');

      expect(result).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('statistics', () => {
    it('should track cache statistics', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ data: 'test' }));
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.del.mockResolvedValue(1);

      await cacheService.set('key1', { data: 'test' }, { ttl: 300 });
      await cacheService.get('key1');
      await cacheService.get('key2');
      await cacheService.delete('key1');

      const stats = cacheService.getStats();

      expect(stats.sets).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.deletes).toBe(1);
      expect(stats.errors).toBe(0);
    });

    it('should calculate hit ratio correctly', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ data: 'test' }));
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ data: 'test2' }));

      await cacheService.get('key1'); // hit
      await cacheService.get('key2'); // miss
      await cacheService.get('key3'); // hit

      const hitRatio = cacheService.getHitRatio();

      expect(hitRatio).toBe(2/3); // 2 hits out of 3 total
    });

    it('should reset statistics', () => {
      cacheService.resetStats();
      const stats = cacheService.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.deletes).toBe(0);
      expect(stats.errors).toBe(0);
    });
  });

  describe('TTL strategies', () => {
    it('should have predefined TTL strategies', () => {
      expect(CacheService.TTL_STRATEGIES.PRICE_DATA).toBe(30);
      expect(CacheService.TTL_STRATEGIES.USER_SESSIONS).toBe(86400);
      expect(CacheService.TTL_STRATEGIES.COIN_METADATA).toBe(86400);
      expect(CacheService.TTL_STRATEGIES.RISK_SCORES).toBe(1800);
    });
  });
});