import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
import { PortfolioService } from './portfolio.js';
import { CacheService } from './cache.js';
import { ExternalApiService } from './external-api-service.js';

describe('PortfolioService', () => {
  let portfolioService: PortfolioService;
  let mockPrisma: any;
  let mockLogger: any;
  let mockCacheService: any;
  let mockExternalApiService: any;

  beforeEach(() => {
    mockPrisma = {
      portfolio: {
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      coin: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    mockCacheService = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };

    mockExternalApiService = {
      getTrendingMemeCoins: vi.fn(),
    };

    portfolioService = new PortfolioService(
      mockPrisma as PrismaClient,
      mockLogger as FastifyBaseLogger,
      mockCacheService as CacheService,
      mockExternalApiService as ExternalApiService
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getPortfolio', () => {
    it('should return user portfolio with pagination', async () => {
      const userId = 1;
      const query = {
        page: 1,
        limit: 10,
        sortBy: 'currentValue' as const,
        sortOrder: 'desc' as const,
      };

      const mockHoldings = [
        {
          id: 1,
          userId: 1,
          coinId: 1,
          amount: 1000,
          avgPrice: 0.001,
          currentValue: 1.5,
          profitLoss: 0.5,
          profitLossPercentage: 50,
          createdAt: new Date(),
          updatedAt: new Date(),
          coin: {
            id: 1,
            address: '0x123',
            symbol: 'TEST',
            name: 'Test Token',
            network: 'ethereum',
            contractVerified: true,
            logoUrl: null,
            description: null,
            website: null,
            socialLinks: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            priceData: [
              {
                id: 1,
                coinId: 1,
                price: 0.0015,
                marketCap: BigInt(1000000),
                volume24h: BigInt(50000),
                liquidity: BigInt(10000),
                priceChange24h: 5.0,
                volumeChange24h: 10.0,
                timestamp: new Date(),
              },
            ],
          },
        },
      ];

      mockPrisma.portfolio.count.mockResolvedValue(1);
      mockPrisma.portfolio.findMany.mockResolvedValue(mockHoldings as any);

      const result = await portfolioService.getPortfolio(userId, query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].coin.symbol).toBe('TEST');
      expect(result.meta?.pagination?.total).toBe(1);
      expect(mockPrisma.portfolio.count).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('should filter portfolio by coinId when provided', async () => {
      const userId = 1;
      const coinId = 1;
      const query = {
        page: 1,
        limit: 10,
        sortBy: 'currentValue' as const,
        sortOrder: 'desc' as const,
        coinId,
      };

      mockPrisma.portfolio.count.mockResolvedValue(0);
      mockPrisma.portfolio.findMany.mockResolvedValue([]);

      await portfolioService.getPortfolio(userId, query);

      expect(mockPrisma.portfolio.count).toHaveBeenCalledWith({
        where: { userId, coinId },
      });
    });
  });

  describe('addOrUpdateHolding', () => {
    it('should create new holding when none exists', async () => {
      const userId = 1;
      const data = {
        coinId: 1,
        amount: 1000,
        avgPrice: 0.001,
      };

      const mockCreatedHolding = {
        id: 1,
        userId: 1,
        coinId: 1,
        amount: 1000,
        avgPrice: 0.001,
        currentValue: 1.0,
        profitLoss: 0,
        profitLossPercentage: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockHoldingWithCoin = {
        ...mockCreatedHolding,
        coin: {
          id: 1,
          address: '0x123',
          symbol: 'TEST',
          name: 'Test Token',
          network: 'ethereum',
          contractVerified: true,
          logoUrl: null,
          description: null,
          website: null,
          socialLinks: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          priceData: [
            {
              id: 1,
              coinId: 1,
              price: 0.001,
              marketCap: BigInt(1000000),
              volume24h: BigInt(50000),
              liquidity: BigInt(10000),
              priceChange24h: 0,
              volumeChange24h: 0,
              timestamp: new Date(),
            },
          ],
        },
      };

      mockPrisma.portfolio.findUnique
        .mockResolvedValueOnce(null) // First call for checking existing holding
        .mockResolvedValueOnce(mockHoldingWithCoin as any); // Second call for getting updated holding
      mockPrisma.portfolio.create.mockResolvedValue(mockCreatedHolding as any);
      mockPrisma.portfolio.update.mockResolvedValue(mockCreatedHolding as any);
      mockPrisma.portfolio.findMany.mockResolvedValue([]); // Mock for updatePortfolioValues
      mockCacheService.delete.mockResolvedValue(undefined);

      const result = await portfolioService.addOrUpdateHolding(userId, data);

      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(1000);
      expect(result.data?.avgPrice).toBe(0.001);
      expect(mockPrisma.portfolio.create).toHaveBeenCalledWith({
        data: {
          userId,
          coinId: data.coinId,
          amount: data.amount,
          avgPrice: data.avgPrice,
        },
      });
    });

    it('should update existing holding with new average price', async () => {
      const userId = 1;
      const data = {
        coinId: 1,
        amount: 500, // Adding 500 more
        avgPrice: 0.002, // At higher price
      };

      const existingHolding = {
        id: 1,
        userId: 1,
        coinId: 1,
        amount: 1000, // Existing 1000
        avgPrice: 0.001, // At lower price
        currentValue: 1.0,
        profitLoss: 0,
        profitLossPercentage: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedHolding = {
        ...existingHolding,
        amount: 1500, // 1000 + 500
        avgPrice: 0.00133, // Weighted average: (1000*0.001 + 500*0.002) / 1500
      };

      const mockHoldingWithCoin = {
        ...updatedHolding,
        coin: {
          id: 1,
          address: '0x123',
          symbol: 'TEST',
          name: 'Test Token',
          network: 'ethereum',
          contractVerified: true,
          logoUrl: null,
          description: null,
          website: null,
          socialLinks: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          priceData: [],
        },
      };

      mockPrisma.portfolio.findUnique
        .mockResolvedValueOnce(existingHolding as any)
        .mockResolvedValueOnce(mockHoldingWithCoin as any);
      mockPrisma.portfolio.update.mockResolvedValue(updatedHolding as any);
      mockPrisma.portfolio.findMany.mockResolvedValue([]); // Mock for updatePortfolioValues
      mockCacheService.delete.mockResolvedValue(undefined);

      const result = await portfolioService.addOrUpdateHolding(userId, data);

      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(1500);
      expect(result.data?.avgPrice).toBeCloseTo(0.00133, 5);
      expect(mockPrisma.portfolio.update).toHaveBeenCalledWith({
        where: { id: existingHolding.id },
        data: {
          amount: 1500,
          avgPrice: expect.closeTo(0.00133, 5),
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('updateHolding', () => {
    it('should update existing holding', async () => {
      const userId = 1;
      const holdingId = 1;
      const data = {
        amount: 2000,
        avgPrice: 0.0015,
      };

      const existingHolding = {
        id: 1,
        userId: 1,
        coinId: 1,
        amount: 1000,
        avgPrice: 0.001,
        currentValue: 1.0,
        profitLoss: 0,
        profitLossPercentage: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedHolding = {
        ...existingHolding,
        amount: 2000,
        avgPrice: 0.0015,
      };

      const mockHoldingWithCoin = {
        ...updatedHolding,
        coin: {
          id: 1,
          address: '0x123',
          symbol: 'TEST',
          name: 'Test Token',
          network: 'ethereum',
          contractVerified: true,
          logoUrl: null,
          description: null,
          website: null,
          socialLinks: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          priceData: [],
        },
      };

      mockPrisma.portfolio.findFirst.mockResolvedValue(existingHolding as any);
      mockPrisma.portfolio.update.mockResolvedValue(updatedHolding as any);
      mockPrisma.portfolio.findUnique.mockResolvedValue(mockHoldingWithCoin as any);
      mockPrisma.portfolio.findMany.mockResolvedValue([]); // Mock for updatePortfolioValues
      mockCacheService.delete.mockResolvedValue(undefined);

      const result = await portfolioService.updateHolding(userId, holdingId, data);

      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(2000);
      expect(result.data?.avgPrice).toBe(0.0015);
    });

    it('should return error when holding not found', async () => {
      const userId = 1;
      const holdingId = 999;
      const data = { amount: 2000 };

      mockPrisma.portfolio.findFirst.mockResolvedValue(null);

      const result = await portfolioService.updateHolding(userId, holdingId, data);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HOLDING_NOT_FOUND');
    });
  });

  describe('deleteHolding', () => {
    it('should delete existing holding', async () => {
      const userId = 1;
      const holdingId = 1;

      const existingHolding = {
        id: 1,
        userId: 1,
        coinId: 1,
        amount: 1000,
        avgPrice: 0.001,
        currentValue: 1.0,
        profitLoss: 0,
        profitLossPercentage: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.portfolio.findFirst.mockResolvedValue(existingHolding as any);
      mockPrisma.portfolio.delete.mockResolvedValue(existingHolding as any);
      mockCacheService.delete.mockResolvedValue(undefined);

      const result = await portfolioService.deleteHolding(userId, holdingId);

      expect(result.success).toBe(true);
      expect(mockPrisma.portfolio.delete).toHaveBeenCalledWith({
        where: { id: holdingId },
      });
    });

    it('should return error when holding not found', async () => {
      const userId = 1;
      const holdingId = 999;

      mockPrisma.portfolio.findFirst.mockResolvedValue(null);

      const result = await portfolioService.deleteHolding(userId, holdingId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HOLDING_NOT_FOUND');
    });
  });

  describe('getPortfolioAnalytics', () => {
    it('should calculate portfolio analytics correctly', async () => {
      const userId = 1;
      const query = { timeframe: '30d' as const };

      const mockHoldings = [
        {
          id: 1,
          userId: 1,
          coinId: 1,
          amount: 1000,
          avgPrice: 0.001,
          currentValue: 1.5,
          profitLoss: 0.5,
          profitLossPercentage: 50,
          createdAt: new Date(),
          updatedAt: new Date(),
          coin: {
            id: 1,
            address: '0x123',
            symbol: 'TEST1',
            name: 'Test Token 1',
            network: 'ethereum',
            contractVerified: true,
            logoUrl: null,
            description: null,
            website: null,
            socialLinks: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            priceData: [
              {
                id: 1,
                coinId: 1,
                price: 0.0015,
                marketCap: BigInt(1000000),
                volume24h: BigInt(50000),
                liquidity: BigInt(10000),
                priceChange24h: 50,
                volumeChange24h: 10,
                timestamp: new Date(),
              },
            ],
          },
        },
        {
          id: 2,
          userId: 1,
          coinId: 2,
          amount: 500,
          avgPrice: 0.002,
          currentValue: 0.8,
          profitLoss: -0.2,
          profitLossPercentage: -20,
          createdAt: new Date(),
          updatedAt: new Date(),
          coin: {
            id: 2,
            address: '0x456',
            symbol: 'TEST2',
            name: 'Test Token 2',
            network: 'ethereum',
            contractVerified: true,
            logoUrl: null,
            description: null,
            website: null,
            socialLinks: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            priceData: [
              {
                id: 2,
                coinId: 2,
                price: 0.0016,
                marketCap: BigInt(500000),
                volume24h: BigInt(25000),
                liquidity: BigInt(5000),
                priceChange24h: -20,
                volumeChange24h: 5,
                timestamp: new Date(),
              },
            ],
          },
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockPrisma.portfolio.findMany.mockResolvedValue(mockHoldings as any);
      mockPrisma.portfolio.update.mockResolvedValue({} as any);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await portfolioService.getPortfolioAnalytics(userId, query);

      expect(result.success).toBe(true);
      expect(result.data?.totalValue).toBe(2.3); // 1.5 + 0.8
      expect(result.data?.totalInvested).toBe(2.0); // (1000 * 0.001) + (500 * 0.002)
      expect(result.data?.totalProfitLoss).toBeCloseTo(0.3, 10); // 2.3 - 2.0
      expect(result.data?.totalProfitLossPercentage).toBeCloseTo(15, 10); // (0.3 / 2.0) * 100
      expect(result.data?.topPerformers).toHaveLength(2);
      expect(result.data?.allocation).toHaveLength(2);
    });

    it('should return empty analytics for user with no holdings', async () => {
      const userId = 1;
      const query = { timeframe: '30d' as const };

      mockCacheService.get.mockResolvedValue(null);
      mockPrisma.portfolio.findMany.mockResolvedValue([]);

      const result = await portfolioService.getPortfolioAnalytics(userId, query);

      expect(result.success).toBe(true);
      expect(result.data?.totalValue).toBe(0);
      expect(result.data?.totalInvested).toBe(0);
      expect(result.data?.totalProfitLoss).toBe(0);
      expect(result.data?.topPerformers).toHaveLength(0);
      expect(result.data?.allocation).toHaveLength(0);
    });
  });

  describe('getPortfolioPerformance', () => {
    it('should return portfolio performance over time', async () => {
      const userId = 1;
      const query = { timeframe: '24h' as const, interval: '1h' as const };

      const mockHoldings = [
        {
          id: 1,
          userId: 1,
          coinId: 1,
          amount: 1000,
          avgPrice: 0.001,
          currentValue: 1.5,
          profitLoss: 0.5,
          profitLossPercentage: 50,
          createdAt: new Date(),
          updatedAt: new Date(),
          coin: {
            id: 1,
            address: '0x123',
            symbol: 'TEST',
            name: 'Test Token',
            network: 'ethereum',
            contractVerified: true,
            logoUrl: null,
            description: null,
            website: null,
            socialLinks: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            priceData: [
              {
                id: 1,
                coinId: 1,
                price: 0.001,
                marketCap: BigInt(1000000),
                volume24h: BigInt(50000),
                liquidity: BigInt(10000),
                priceChange24h: 0,
                volumeChange24h: 0,
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
              },
              {
                id: 2,
                coinId: 1,
                price: 0.0015,
                marketCap: BigInt(1500000),
                volume24h: BigInt(75000),
                liquidity: BigInt(15000),
                priceChange24h: 50,
                volumeChange24h: 50,
                timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
              },
            ],
          },
        },
      ];

      mockPrisma.portfolio.findMany.mockResolvedValue(mockHoldings as any);

      const result = await portfolioService.getPortfolioPerformance(userId, query);

      expect(result.success).toBe(true);
      expect(result.data?.timestamps).toHaveLength(2);
      expect(result.data?.values).toHaveLength(2);
      expect(result.data?.profitLoss).toHaveLength(2);
      expect(result.data?.profitLossPercentage).toHaveLength(2);

      // Check that values are calculated correctly
      expect(result.data?.values[0]).toBe(1.0); // 1000 * 0.001
      expect(result.data?.values[1]).toBe(1.5); // 1000 * 0.0015
    });

    it('should return empty performance for user with no holdings', async () => {
      const userId = 1;
      const query = { timeframe: '24h' as const, interval: '1h' as const };

      mockPrisma.portfolio.findMany.mockResolvedValue([]);

      const result = await portfolioService.getPortfolioPerformance(userId, query);

      expect(result.success).toBe(true);
      expect(result.data?.timestamps).toHaveLength(0);
      expect(result.data?.values).toHaveLength(0);
      expect(result.data?.profitLoss).toHaveLength(0);
      expect(result.data?.profitLossPercentage).toHaveLength(0);
    });
  });

  describe('integrateWallet', () => {
    it('should integrate wallet and return empty holdings for mock implementation', async () => {
      const userId = 1;
      const data = {
        walletAddress: '0x1234567890123456789012345678901234567890',
        networks: ['ethereum' as const],
      };

      mockPrisma.user.update.mockResolvedValue({} as any);
      mockCacheService.delete.mockResolvedValue(undefined);

      const result = await portfolioService.integrateWallet(userId, data);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { walletAddress: data.walletAddress },
      });
    });
  });

  describe('updatePortfolioValues', () => {
    it('should update portfolio values for all holdings', async () => {
      const userId = 1;

      const mockHoldings = [
        {
          id: 1,
          userId: 1,
          coinId: 1,
          amount: 1000,
          avgPrice: 0.001,
          currentValue: 1.0,
          profitLoss: 0,
          profitLossPercentage: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          coin: {
            id: 1,
            address: '0x123',
            symbol: 'TEST',
            name: 'Test Token',
            network: 'ethereum',
            contractVerified: true,
            logoUrl: null,
            description: null,
            website: null,
            socialLinks: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            priceData: [
              {
                id: 1,
                coinId: 1,
                price: 0.0015, // Price increased
                marketCap: BigInt(1500000),
                volume24h: BigInt(75000),
                liquidity: BigInt(15000),
                priceChange24h: 50,
                volumeChange24h: 50,
                timestamp: new Date(),
              },
            ],
          },
        },
      ];

      mockPrisma.portfolio.findMany.mockResolvedValue(mockHoldings as any);
      mockPrisma.portfolio.update.mockResolvedValue({} as any);

      await portfolioService.updatePortfolioValues(userId);

      expect(mockPrisma.portfolio.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          currentValue: expect.any(Object), // Prisma.Decimal
          profitLoss: expect.any(Object), // Prisma.Decimal
          profitLossPercentage: expect.any(Object), // Prisma.Decimal
        },
      });
    });

    it('should update portfolio values for specific coin', async () => {
      const userId = 1;
      const coinId = 1;

      const mockHoldings = [
        {
          id: 1,
          userId: 1,
          coinId: 1,
          amount: 1000,
          avgPrice: 0.001,
          currentValue: 1.0,
          profitLoss: 0,
          profitLossPercentage: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          coin: {
            id: 1,
            address: '0x123',
            symbol: 'TEST',
            name: 'Test Token',
            network: 'ethereum',
            contractVerified: true,
            logoUrl: null,
            description: null,
            website: null,
            socialLinks: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            priceData: [
              {
                id: 1,
                coinId: 1,
                price: 0.0008, // Price decreased
                marketCap: BigInt(800000),
                volume24h: BigInt(40000),
                liquidity: BigInt(8000),
                priceChange24h: -20,
                volumeChange24h: -20,
                timestamp: new Date(),
              },
            ],
          },
        },
      ];

      mockPrisma.portfolio.findMany.mockResolvedValue(mockHoldings as any);
      mockPrisma.portfolio.update.mockResolvedValue({} as any);

      await portfolioService.updatePortfolioValues(userId, coinId);

      expect(mockPrisma.portfolio.findMany).toHaveBeenCalledWith({
        where: { userId, coinId },
        include: expect.any(Object),
      });

      expect(mockPrisma.portfolio.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          currentValue: expect.any(Object), // Prisma.Decimal
          profitLoss: expect.any(Object), // Prisma.Decimal
          profitLossPercentage: expect.any(Object), // Prisma.Decimal
        },
      });
    });
  });
});
