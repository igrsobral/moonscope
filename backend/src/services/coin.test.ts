import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
import { CoinService } from './coin.js';
import { CacheService } from './cache.js';
import { ExternalApiService } from './external-api-service.js';

// Mock dependencies
const mockPrisma = {
  coin: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  priceData: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
} as unknown as PrismaClient;

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as unknown as FastifyBaseLogger;

const mockCache = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
} as unknown as CacheService;

const mockExternalApi = {
  getTrendingMemeCoins: vi.fn(),
} as unknown as ExternalApiService;

describe('CoinService', () => {
  let coinService: CoinService;

  beforeEach(() => {
    vi.clearAllMocks();

    coinService = new CoinService(mockPrisma, mockLogger, mockCache, mockExternalApi);
  });

  describe('getCoins', () => {
    it('should return paginated coins list', async () => {
      const mockCoins = [
        {
          id: 1,
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'DOGE',
          name: 'Dogecoin',
          network: 'ethereum',
          contractVerified: true,
          logoUrl: 'https://example.com/logo.png',
          description: 'A meme coin',
          website: 'https://dogecoin.com',
          socialLinks: { twitter: 'https://twitter.com/dogecoin' },
          createdAt: new Date(),
          updatedAt: new Date(),
          priceData: [
            {
              id: 1,
              coinId: 1,
              price: 0.08,
              marketCap: BigInt(11000000000),
              volume24h: BigInt(500000000),
              liquidity: BigInt(1000000),
              priceChange24h: 5.2,
              volumeChange24h: 10.5,
              timestamp: new Date(),
            },
          ],
          riskAssessments: [
            {
              id: 1,
              coinId: 1,
              overallScore: 65,
              liquidityScore: 70,
              holderDistributionScore: 60,
              contractSecurityScore: 80,
              socialScore: 50,
              factors: {},
              timestamp: new Date(),
            },
          ],
        },
      ];

      vi.mocked(mockPrisma.coin.count).mockResolvedValue(1);
      vi.mocked(mockPrisma.coin.findMany).mockResolvedValue(mockCoins as any);

      const query = {
        page: 1,
        limit: 20,
        sortBy: 'marketCap' as const,
        sortOrder: 'desc' as const,
      };

      const result = await coinService.getCoins(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].symbol).toBe('DOGE');
      expect(result.data![0].latestPrice).toBeDefined();
      expect(result.data![0].riskScore).toBe(65);
      expect(result.meta?.pagination).toBeDefined();
      expect(result.meta?.pagination?.total).toBe(1);
    });

    it('should filter coins by network', async () => {
      vi.mocked(mockPrisma.coin.count).mockResolvedValue(0);
      vi.mocked(mockPrisma.coin.findMany).mockResolvedValue([]);

      const query = {
        page: 1,
        limit: 20,
        sortBy: 'marketCap' as const,
        sortOrder: 'desc' as const,
        network: 'ethereum' as const,
      };

      await coinService.getCoins(query);

      expect(mockPrisma.coin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            network: 'ethereum',
          }),
        })
      );
    });

    it('should search coins by name, symbol, or address', async () => {
      vi.mocked(mockPrisma.coin.count).mockResolvedValue(0);
      vi.mocked(mockPrisma.coin.findMany).mockResolvedValue([]);

      const query = {
        page: 1,
        limit: 20,
        sortBy: 'marketCap' as const,
        sortOrder: 'desc' as const,
        search: 'doge',
      };

      await coinService.getCoins(query);

      expect(mockPrisma.coin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: 'doge', mode: 'insensitive' } },
              { symbol: { contains: 'doge', mode: 'insensitive' } },
              { address: { contains: 'doge', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });
  });

  describe('getCoinById', () => {
    it('should return coin detail from cache if available', async () => {
      const mockCoinDetail = {
        id: 1,
        symbol: 'DOGE',
        name: 'Dogecoin',
        priceHistory: [],
      };

      vi.mocked(mockCache.get).mockResolvedValue(mockCoinDetail);

      const result = await coinService.getCoinById(1);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCoinDetail);
      expect(mockPrisma.coin.findUnique).not.toHaveBeenCalled();
    });

    it('should return coin detail from database if not cached', async () => {
      const mockCoin = {
        id: 1,
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'DOGE',
        name: 'Dogecoin',
        network: 'ethereum',
        contractVerified: true,
        logoUrl: null,
        description: null,
        website: null,
        socialLinks: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        priceData: [],
        socialMetrics: [],
        riskAssessments: [],
      };

      vi.mocked(mockCache.get).mockResolvedValue(null);
      vi.mocked(mockPrisma.coin.findUnique).mockResolvedValue(mockCoin as any);
      vi.mocked(mockCache.set).mockResolvedValue(undefined);

      const result = await coinService.getCoinById(1);

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('DOGE');
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should return error if coin not found', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      vi.mocked(mockPrisma.coin.findUnique).mockResolvedValue(null);

      const result = await coinService.getCoinById(999);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('COIN_NOT_FOUND');
    });
  });

  describe('createCoin', () => {
    it('should create a new coin successfully', async () => {
      const coinData = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'TEST',
        name: 'Test Coin',
        network: 'ethereum' as const,
        contractVerified: false,
      };

      const mockCreatedCoin = {
        id: 1,
        ...coinData,
        logoUrl: null,
        description: null,
        website: null,
        socialLinks: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrisma.coin.findUnique).mockResolvedValue(null);
      vi.mocked(mockPrisma.coin.create).mockResolvedValue(mockCreatedCoin as any);
      vi.mocked(mockCache.delete).mockResolvedValue(1);

      const result = await coinService.createCoin(coinData);

      expect(result.success).toBe(true);
      expect(result.data?.symbol).toBe('TEST');
      expect(mockCache.delete).toHaveBeenCalledWith('coins:*');
    });

    it('should return error if coin already exists', async () => {
      const coinData = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'TEST',
        name: 'Test Coin',
        network: 'ethereum' as const,
        contractVerified: false,
      };

      const existingCoin = { id: 1, address: coinData.address };
      vi.mocked(mockPrisma.coin.findUnique).mockResolvedValue(existingCoin as any);

      const result = await coinService.createCoin(coinData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('COIN_ALREADY_EXISTS');
    });
  });

  describe('storePriceData', () => {
    it('should store price data successfully', async () => {
      const priceData = {
        coinId: 1,
        price: 0.08,
        marketCap: 11000000000,
        volume24h: 500000000,
        liquidity: 1000000,
        priceChange24h: 5.2,
        volumeChange24h: 10.5,
      };

      const mockStoredPriceData = {
        id: 1,
        ...priceData,
        timestamp: new Date(),
      };

      vi.mocked(mockPrisma.priceData.create).mockResolvedValue(mockStoredPriceData as any);
      vi.mocked(mockCache.delete).mockResolvedValue(1);

      const result = await coinService.storePriceData(priceData);

      expect(result.success).toBe(true);
      expect(result.data?.price).toBe(0.08);
      expect(mockCache.delete).toHaveBeenCalledWith(`coin:${priceData.coinId}:*`);
    });
  });

  describe('getPriceHistory', () => {
    it('should return price history for specified timeframe', async () => {
      const mockPriceHistory = [
        {
          id: 1,
          coinId: 1,
          price: 0.08,
          marketCap: BigInt(11000000000),
          volume24h: BigInt(500000000),
          liquidity: BigInt(1000000),
          priceChange24h: 5.2,
          volumeChange24h: 10.5,
          timestamp: new Date(),
        },
      ];

      vi.mocked(mockPrisma.priceData.findMany).mockResolvedValue(mockPriceHistory as any);

      const result = await coinService.getPriceHistory(1, { timeframe: '24h' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockPrisma.priceData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            coinId: 1,
            timestamp: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        })
      );
    });
  });

  describe('discoverCoins', () => {
    it('should discover and import new coins', async () => {
      const mockTrendingCoins = [
        {
          id: 'dogecoin',
          symbol: 'doge',
          name: 'Dogecoin',
          image: 'https://example.com/logo.png',
          currentPrice: 0.08,
          marketCap: 11000000000,
          volume24h: 500000000,
          priceChange24h: 5.2,
          contractAddress: '0x1234567890123456789012345678901234567890',
        },
      ];

      const mockCreatedCoin = {
        id: 1,
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'DOGE',
        name: 'Dogecoin',
        network: 'ethereum',
        contractVerified: false,
        logoUrl: 'https://example.com/logo.png',
        description: null,
        website: null,
        socialLinks: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockExternalApi.getTrendingMemeCoins).mockResolvedValue(mockTrendingCoins as any);
      vi.mocked(mockPrisma.coin.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.coin.create).mockResolvedValue(mockCreatedCoin as any);
      vi.mocked(mockPrisma.priceData.create).mockResolvedValue({} as any);
      vi.mocked(mockCache.delete).mockResolvedValue(1);

      const result = await coinService.discoverCoins('ethereum');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].symbol).toBe('DOGE');
    });
  });
});
