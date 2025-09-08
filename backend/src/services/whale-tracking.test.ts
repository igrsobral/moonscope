import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import { WhaleTrackingService } from './whale-tracking.js';
import { ExternalApiService } from './external-api-service.js';
import { CacheService } from './cache.js';
import { RealtimeService } from './realtime.js';

describe('WhaleTrackingService', () => {
  let service: WhaleTrackingService;
  let mockPrisma: any;
  let mockExternalApiService: any;
  let mockCacheService: any;
  let mockRealtimeService: any;
  let mockLogger: any;

  beforeEach(() => {
    mockPrisma = {
      whaleTransaction: {
        findUnique: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };

    mockExternalApiService = {
      getWhaleTransactions: vi.fn(),
    };

    mockCacheService = {
      get: vi.fn(),
      set: vi.fn(),
      TTL: {
        WHALE_TRANSACTIONS: 900,
      },
    };

    mockRealtimeService = {
      broadcastWhaleMovement: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    service = new WhaleTrackingService(
      mockPrisma,
      mockExternalApiService,
      mockCacheService,
      mockRealtimeService,
      mockLogger
    );
  });

  describe('processWhaleTransactions', () => {
    it('should process and store new whale transactions', async () => {
      const coinId = 1;
      const contractAddress = '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce';
      const network = 'ethereum';

      const mockExternalTransactions = [
        {
          hash: '0x123',
          tokenAddress: contractAddress,
          tokenSymbol: 'SHIB',
          fromAddress: '0xfrom1',
          toAddress: '0xto1',
          value: '1000000000000000000000',
          usdValue: 15000,
          timestamp: '2024-01-01T00:00:00Z',
          blockNumber: '12345',
        },
        {
          hash: '0x456',
          tokenAddress: contractAddress,
          tokenSymbol: 'SHIB',
          fromAddress: '0xfrom2',
          toAddress: '0xto2',
          value: '2000000000000000000000',
          usdValue: 25000,
          timestamp: '2024-01-01T01:00:00Z',
          blockNumber: '12346',
        },
      ];

      const mockCreatedTransactions = [
        {
          id: 1,
          coinId,
          txHash: '0x123',
          fromAddress: '0xfrom1',
          toAddress: '0xto1',
          amount: '1000000000000000000000',
          usdValue: 15000,
          timestamp: new Date('2024-01-01T00:00:00Z'),
        },
        {
          id: 2,
          coinId,
          txHash: '0x456',
          fromAddress: '0xfrom2',
          toAddress: '0xto2',
          amount: '2000000000000000000000',
          usdValue: 25000,
          timestamp: new Date('2024-01-01T01:00:00Z'),
        },
      ];

      mockExternalApiService.getWhaleTransactions.mockResolvedValue(mockExternalTransactions);
      mockPrisma.whaleTransaction.findUnique.mockResolvedValue(null); // No existing transactions
      mockPrisma.whaleTransaction.create
        .mockResolvedValueOnce(mockCreatedTransactions[0] as any)
        .mockResolvedValueOnce(mockCreatedTransactions[1] as any);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.processWhaleTransactions(coinId, contractAddress, network);

      expect(result).toHaveLength(2);
      expect(result[0].txHash).toBe('0x123');
      expect(result[1].txHash).toBe('0x456');
      expect(mockPrisma.whaleTransaction.create).toHaveBeenCalledTimes(2);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `whale_transactions:${coinId}`,
        result,
        expect.any(Number)
      );
      expect(mockRealtimeService.broadcastWhaleMovement).toHaveBeenCalledTimes(2);
    });

    it('should skip existing transactions', async () => {
      const coinId = 1;
      const contractAddress = '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce';
      const network = 'ethereum';

      const mockExternalTransactions = [
        {
          hash: '0x123',
          tokenAddress: contractAddress,
          tokenSymbol: 'SHIB',
          fromAddress: '0xfrom1',
          toAddress: '0xto1',
          value: '1000000000000000000000',
          usdValue: 15000,
          timestamp: '2024-01-01T00:00:00Z',
          blockNumber: '12345',
        },
      ];

      const existingTransaction = {
        id: 1,
        coinId,
        txHash: '0x123',
        fromAddress: '0xfrom1',
        toAddress: '0xto1',
        amount: '1000000000000000000000',
        usdValue: 15000,
        timestamp: new Date('2024-01-01T00:00:00Z'),
      };

      mockExternalApiService.getWhaleTransactions.mockResolvedValue(mockExternalTransactions);
      mockPrisma.whaleTransaction.findUnique.mockResolvedValue(existingTransaction as any);

      const result = await service.processWhaleTransactions(coinId, contractAddress, network);

      expect(result).toHaveLength(0);
      expect(mockPrisma.whaleTransaction.create).not.toHaveBeenCalled();
    });

    it('should handle external API errors', async () => {
      const coinId = 1;
      const contractAddress = '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce';
      const network = 'ethereum';

      mockExternalApiService.getWhaleTransactions.mockRejectedValue(new Error('API Error'));

      await expect(
        service.processWhaleTransactions(coinId, contractAddress, network)
      ).rejects.toThrow('API Error');
    });
  });

  describe('analyzeWhaleMovements', () => {
    it('should analyze whale movements correctly', async () => {
      const coinId = 1;
      const timeframe = '24h';

      const mockTransactions = [
        {
          id: 1,
          coinId,
          txHash: '0x123',
          fromAddress: '0xexchange1', // Exchange address
          toAddress: '0xwhale1',
          amount: '1000000000000000000000',
          usdValue: 15000,
          timestamp: new Date('2024-01-01T00:00:00Z'),
        },
        {
          id: 2,
          coinId,
          txHash: '0x456',
          fromAddress: '0xwhale2',
          toAddress: '0xexchange2', // Exchange address
          amount: '2000000000000000000000',
          usdValue: 25000,
          timestamp: new Date('2024-01-01T01:00:00Z'),
        },
      ];

      mockPrisma.whaleTransaction.findMany.mockResolvedValue(mockTransactions as any);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.analyzeWhaleMovements(coinId, timeframe);

      expect(result.coinId).toBe(coinId);
      expect(result.timeframe).toBe(timeframe);
      expect(result.totalTransactions).toBe(2);
      expect(result.totalVolume).toBe(40000);
      expect(result.averageTransactionSize).toBe(20000);
      expect(result.uniqueWallets).toBe(4); // 4 unique addresses
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `whale_analysis:${coinId}:${timeframe}`,
        result,
        expect.any(Number)
      );
    });

    it('should handle empty transaction data', async () => {
      const coinId = 1;
      const timeframe = '24h';

      mockPrisma.whaleTransaction.findMany.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.analyzeWhaleMovements(coinId, timeframe);

      expect(result.totalTransactions).toBe(0);
      expect(result.totalVolume).toBe(0);
      expect(result.averageTransactionSize).toBe(0);
      expect(result.uniqueWallets).toBe(0);
    });
  });

  describe('getWhaleTransactions', () => {
    it('should return paginated whale transactions', async () => {
      const coinId = 1;
      const options = { limit: 10, offset: 0 };

      const mockTransactions = [
        {
          id: 1,
          coinId,
          txHash: '0x123',
          fromAddress: '0xfrom1',
          toAddress: '0xto1',
          amount: '1000000000000000000000',
          usdValue: 15000,
          timestamp: new Date('2024-01-01T00:00:00Z'),
        },
      ];

      mockPrisma.whaleTransaction.findMany.mockResolvedValue(mockTransactions as any);
      mockPrisma.whaleTransaction.count.mockResolvedValue(1);

      const result = await service.getWhaleTransactions(coinId, options);

      expect(result.transactions).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.transactions[0].txHash).toBe('0x123');
    });

    it('should apply date filters correctly', async () => {
      const coinId = 1;
      const fromDate = new Date('2024-01-01T00:00:00Z');
      const toDate = new Date('2024-01-02T00:00:00Z');
      const options = { fromDate, toDate };

      mockPrisma.whaleTransaction.findMany.mockResolvedValue([]);
      mockPrisma.whaleTransaction.count.mockResolvedValue(0);

      await service.getWhaleTransactions(coinId, options);

      expect(mockPrisma.whaleTransaction.findMany).toHaveBeenCalledWith({
        where: {
          coinId,
          timestamp: {
            gte: fromDate,
            lte: toDate,
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 50,
        skip: 0,
      });
    });
  });

  describe('getWhaleWallet', () => {
    it('should return whale wallet from cache', async () => {
      const address = '0x123456789abcdef';
      const mockWhaleWallet = {
        address: address.toLowerCase(),
        category: 'whale' as const,
        totalTransactions: 5,
        totalVolume: 100000,
        firstSeen: new Date('2024-01-01T00:00:00Z'),
        lastSeen: new Date('2024-01-01T12:00:00Z'),
        isActive: true,
      };

      mockCacheService.get.mockResolvedValue(mockWhaleWallet);

      const result = await service.getWhaleWallet(address);

      expect(result).toEqual(mockWhaleWallet);
      expect(mockCacheService.get).toHaveBeenCalledWith(`whale_wallet:${address.toLowerCase()}`);
    });

    it('should rebuild whale wallet from database if not cached', async () => {
      const address = '0x123456789abcdef';
      const mockTransactions = [
        {
          id: 1,
          coinId: 1,
          txHash: '0x123',
          fromAddress: address.toLowerCase(),
          toAddress: '0xother',
          amount: '1000000000000000000000',
          usdValue: 50000,
          timestamp: new Date('2024-01-01T00:00:00Z'),
        },
        {
          id: 2,
          coinId: 1,
          txHash: '0x456',
          fromAddress: '0xother',
          toAddress: address.toLowerCase(),
          amount: '2000000000000000000000',
          usdValue: 75000,
          timestamp: new Date('2024-01-01T12:00:00Z'),
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockPrisma.whaleTransaction.findMany.mockResolvedValue(mockTransactions as any);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getWhaleWallet(address);

      expect(result).toBeDefined();
      expect(result!.address).toBe(address.toLowerCase());
      expect(result!.totalTransactions).toBe(2);
      expect(result!.totalVolume).toBe(125000);
      expect(result!.firstSeen).toEqual(mockTransactions[0].timestamp);
      expect(result!.lastSeen).toEqual(mockTransactions[1].timestamp);
    });

    it('should return null for non-existent wallet', async () => {
      const address = '0x123456789abcdef';

      mockCacheService.get.mockResolvedValue(null);
      mockPrisma.whaleTransaction.findMany.mockResolvedValue([]);

      const result = await service.getWhaleWallet(address);

      expect(result).toBeNull();
    });
  });

  describe('getTopWhaleWallets', () => {
    it('should return top whale wallets sorted by volume', async () => {
      const coinId = 1;
      const limit = 5;

      const mockTransactions = [
        {
          fromAddress: '0xwhale1',
          toAddress: '0xother1',
          usdValue: 100000,
          timestamp: new Date('2024-01-01T00:00:00Z'),
        },
        {
          fromAddress: '0xwhale2',
          toAddress: '0xother2',
          usdValue: 200000,
          timestamp: new Date('2024-01-01T01:00:00Z'),
        },
        {
          fromAddress: '0xwhale1',
          toAddress: '0xother3',
          usdValue: 50000,
          timestamp: new Date('2024-01-01T02:00:00Z'),
        },
      ];

      mockPrisma.whaleTransaction.findMany.mockResolvedValue(mockTransactions as any);

      const result = await service.getTopWhaleWallets(coinId, limit);

      expect(result.length).toBeGreaterThan(0); // Should have unique addresses
      expect(result[0].totalVolume).toBeGreaterThanOrEqual(result[1].totalVolume);
      // Check that results are sorted by volume (descending)
      if (result.length > 1) {
        expect(result[0].totalVolume).toBeGreaterThanOrEqual(result[1].totalVolume);
      }
    });
  });
});
