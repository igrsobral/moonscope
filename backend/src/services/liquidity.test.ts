import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
import { LiquidityService } from './liquidity.js';
import { CacheService } from './cache.js';
import { RealtimeService } from './realtime.js';

// Mock dependencies
vi.mock('@prisma/client');
vi.mock('./cache.js');
vi.mock('./realtime.js');
vi.mock('./dex-clients.js');

describe('LiquidityService', () => {
  let liquidityService: LiquidityService;
  let mockPrisma: any;
  let mockLogger: FastifyBaseLogger;
  let mockCacheService: any;
  let mockRealtimeService: any;

  beforeEach(() => {
    mockPrisma = {
      liquidityPool: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      liquidityData: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      liquidityAlert: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      coin: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      $queryRaw: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as any;

    mockCacheService = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };

    mockRealtimeService = {
      broadcast: vi.fn(),
      sendToUser: vi.fn(),
    };

    liquidityService = new LiquidityService(
      mockPrisma as PrismaClient,
      mockLogger,
      mockCacheService as CacheService,
      mockRealtimeService as RealtimeService
    );
  });

  describe('getLiquidityPools', () => {
    it('should return cached pools if available', async () => {
      const coinId = 1;
      const cachedPools = [
        {
          id: 1,
          coinId,
          exchange: 'uniswap-v2',
          pairAddress: '0x123',
          totalLiquidity: 1000000,
          latestData: {
            totalLiquidity: 1000000,
            volume24h: 50000,
          },
        },
      ];

      mockCacheService.get.mockResolvedValue(cachedPools);

      const result = await liquidityService.getLiquidityPools(coinId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedPools);
      expect(mockCacheService.get).toHaveBeenCalledWith(`liquidity:${coinId}:pools`);
      expect(mockPrisma.liquidityPool.findMany).not.toHaveBeenCalled();
    });

    it('should fetch pools from database if not cached', async () => {
      const coinId = 1;
      const dbPools = [
        {
          id: 1,
          coinId,
          exchange: 'uniswap-v2',
          pairAddress: '0x123',
          totalLiquidity: 1000000,
          liquidityData: [
            {
              totalLiquidity: 1000000,
              volume24h: 50000,
            },
          ],
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockPrisma.liquidityPool.findMany.mockResolvedValue(dbPools);

      const result = await liquidityService.getLiquidityPools(coinId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].latestData).toBeDefined();
      expect(mockPrisma.liquidityPool.findMany).toHaveBeenCalledWith({
        where: { coinId, isActive: true },
        include: {
          liquidityData: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
        orderBy: { totalLiquidity: 'desc' },
      });
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const coinId = 1;
      const error = new Error('Database error');

      mockCacheService.get.mockResolvedValue(null);
      mockPrisma.liquidityPool.findMany.mockRejectedValue(error);

      await expect(liquidityService.getLiquidityPools(coinId)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error, coinId },
        'Failed to get liquidity pools'
      );
    });
  });

  describe('analyzeLiquidity', () => {
    it('should return cached analysis if available', async () => {
      const coinId = 1;
      const cachedAnalysis = {
        totalLiquidity: 1000000,
        poolCount: 3,
        averageVolume24h: 100000,
        topExchange: 'uniswap-v2',
        riskScore: 75,
        priceImpactAnalysis: {
          impact1k: 0.1,
          impact10k: 1.0,
          impact100k: 10.0,
        },
        liquidityDistribution: [],
      };

      mockCacheService.get.mockResolvedValue(cachedAnalysis);

      const result = await liquidityService.analyzeLiquidity(coinId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedAnalysis);
      expect(mockCacheService.get).toHaveBeenCalledWith(`liquidity:${coinId}:analysis`);
    });

    it('should calculate analysis from pools if not cached', async () => {
      const coinId = 1;
      const pools = [
        {
          id: 1,
          coinId,
          exchange: 'uniswap-v2',
          totalLiquidity: 600000,
          volume24h: 30000,
          liquidityData: [
            {
              priceImpact1k: 0.1,
              priceImpact10k: 1.0,
              priceImpact100k: 10.0,
            },
          ],
        },
        {
          id: 2,
          coinId,
          exchange: 'sushiswap',
          totalLiquidity: 400000,
          volume24h: 20000,
          liquidityData: [
            {
              priceImpact1k: 0.2,
              priceImpact10k: 2.0,
              priceImpact100k: 20.0,
            },
          ],
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockPrisma.liquidityPool.findMany.mockResolvedValue(pools);

      const result = await liquidityService.analyzeLiquidity(coinId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.totalLiquidity).toBe(1000000);
      expect(result.data!.poolCount).toBe(2);
      expect(result.data!.topExchange).toBe('uniswap-v2');
      expect(result.data!.liquidityDistribution).toHaveLength(2);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should return error if no pools found', async () => {
      const coinId = 1;

      mockCacheService.get.mockResolvedValue(null);
      mockPrisma.liquidityPool.findMany.mockResolvedValue([]);

      const result = await liquidityService.analyzeLiquidity(coinId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_LIQUIDITY_DATA');
    });
  });

  describe('createLiquidityAlert', () => {
    it('should create a new liquidity alert', async () => {
      const userId = 1;
      const coinId = 1;
      const type = 'liquidity_drop';
      const condition = { liquidityThreshold: 500000 };
      const notificationMethods = ['email', 'push'];
      const options = { name: 'Test Alert' };

      const createdAlert = {
        id: 1,
        userId,
        coinId,
        type,
        condition,
        notificationMethods,
        name: options.name,
        isActive: true,
        createdAt: new Date(),
      };

      mockPrisma.liquidityAlert.create.mockResolvedValue(createdAlert);

      const result = await liquidityService.createLiquidityAlert(
        userId,
        coinId,
        type,
        condition,
        notificationMethods,
        options
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(createdAlert);
      expect(mockPrisma.liquidityAlert.create).toHaveBeenCalledWith({
        data: {
          userId,
          coinId,
          poolId: null,
          type,
          condition,
          notificationMethods,
          name: options.name,
          description: null,
        },
      });
    });

    it('should handle creation errors', async () => {
      const error = new Error('Database error');
      mockPrisma.liquidityAlert.create.mockRejectedValue(error);

      await expect(
        liquidityService.createLiquidityAlert(1, 1, 'liquidity_drop', {}, ['email'])
      ).rejects.toThrow('Database error');
    });
  });

  describe('checkLiquidityAlerts', () => {
    it('should check and trigger alerts when conditions are met', async () => {
      const coinId = 1;
      const alerts = [
        {
          id: 1,
          userId: 1,
          coinId,
          type: 'liquidity_drop',
          condition: { liquidityThreshold: 2000000 },
          isActive: true,
          user: { id: 1 },
          coin: { symbol: 'TEST' },
          pool: null,
        },
      ];

      const analysis = {
        totalLiquidity: 1500000, // Below threshold
        poolCount: 2,
        averageVolume24h: 100000,
        topExchange: 'uniswap-v2',
        riskScore: 60,
        priceImpactAnalysis: {
          impact1k: 0.1,
          impact10k: 1.0,
          impact100k: 10.0,
        },
        liquidityDistribution: [],
      };

      mockPrisma.liquidityAlert.findMany.mockResolvedValue(alerts);
      
      // Mock the analyzeLiquidity method
      vi.spyOn(liquidityService, 'analyzeLiquidity').mockResolvedValue({
        success: true,
        data: analysis,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      });

      await liquidityService.checkLiquidityAlerts(coinId);

      expect(mockPrisma.liquidityAlert.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { lastTriggered: expect.any(Date) },
      });

      expect(mockRealtimeService.sendToUser).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: 'liquidity_alert_triggered',
          data: expect.objectContaining({
            alertId: 1,
            coinId,
            coinSymbol: 'TEST',
          }),
        })
      );
    });

    it('should not trigger alerts when conditions are not met', async () => {
      const coinId = 1;
      const alerts = [
        {
          id: 1,
          userId: 1,
          coinId,
          type: 'liquidity_drop',
          condition: { liquidityThreshold: 500000 },
          isActive: true,
          user: { id: 1 },
          coin: { symbol: 'TEST' },
          pool: null,
        },
      ];

      const analysis = {
        totalLiquidity: 1500000, // Above threshold
        poolCount: 2,
        averageVolume24h: 100000,
        topExchange: 'uniswap-v2',
        riskScore: 60,
        priceImpactAnalysis: {
          impact1k: 0.1,
          impact10k: 1.0,
          impact100k: 10.0,
        },
        liquidityDistribution: [],
      };

      mockPrisma.liquidityAlert.findMany.mockResolvedValue(alerts);
      
      vi.spyOn(liquidityService, 'analyzeLiquidity').mockResolvedValue({
        success: true,
        data: analysis,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      });

      await liquidityService.checkLiquidityAlerts(coinId);

      expect(mockPrisma.liquidityAlert.update).not.toHaveBeenCalled();
      expect(mockRealtimeService.sendToUser).not.toHaveBeenCalled();
    });
  });

  describe('getLiquidityTrends', () => {
    it('should return cached trends if available', async () => {
      const coinId = 1;
      const timeframe = '24h';
      const cachedTrends = [
        {
          timestamp: new Date(),
          totalLiquidity: 1000000,
          volume24h: 50000,
          change24h: 5.0,
          poolCount: 3,
        },
      ];

      mockCacheService.get.mockResolvedValue(cachedTrends);

      const result = await liquidityService.getLiquidityTrends(coinId, timeframe);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedTrends);
      expect(mockCacheService.get).toHaveBeenCalledWith(`liquidity:${coinId}:trends:${timeframe}`);
    });

    it('should fetch trends from database if not cached', async () => {
      const coinId = 1;
      const timeframe = '24h';
      const dbTrends = [
        {
          timestamp: new Date(),
          total_liquidity: '1000000',
          volume_24h: '50000',
          avg_change_24h: '5.0',
          pool_count: '3',
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockPrisma.$queryRaw.mockResolvedValue(dbTrends);

      const result = await liquidityService.getLiquidityTrends(coinId, timeframe);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].totalLiquidity).toBe(1000000);
      expect(result.data![0].volume24h).toBe(50000);
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe('updateLiquidityAlert', () => {
    it('should update an existing alert', async () => {
      const alertId = 1;
      const updates = {
        condition: { liquidityThreshold: 750000 },
        isActive: false,
      };

      const updatedAlert = {
        id: alertId,
        condition: updates.condition,
        isActive: updates.isActive,
      };

      mockPrisma.liquidityAlert.update.mockResolvedValue(updatedAlert);

      const result = await liquidityService.updateLiquidityAlert(alertId, updates);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedAlert);
      expect(mockPrisma.liquidityAlert.update).toHaveBeenCalledWith({
        where: { id: alertId },
        data: updates,
      });
    });
  });

  describe('deleteLiquidityAlert', () => {
    it('should delete an alert', async () => {
      const alertId = 1;

      mockPrisma.liquidityAlert.delete.mockResolvedValue({});

      const result = await liquidityService.deleteLiquidityAlert(alertId);

      expect(result.success).toBe(true);
      expect(mockPrisma.liquidityAlert.delete).toHaveBeenCalledWith({
        where: { id: alertId },
      });
    });
  });
});