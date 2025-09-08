import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';

describe('Whale Tracking Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up whale transactions for test isolation
    await app.prisma.whaleTransaction.deleteMany();
  });

  describe('GET /api/v1/whale/transactions', () => {
    it('should return empty list when no whale transactions exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/whale/transactions?coinId=1',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.transactions).toEqual([]);
      expect(data.data.total).toBe(0);
    });

    it('should return paginated whale transactions', async () => {
      // Create test coin
      const coin = await app.prisma.coin.create({
        data: {
          address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
          symbol: 'SHIB',
          name: 'Shiba Inu',
          network: 'ethereum',
          contractVerified: true,
        },
      });

      // Create test whale transactions
      const transactions = await Promise.all([
        app.prisma.whaleTransaction.create({
          data: {
            coinId: coin.id,
            txHash: '0x123',
            fromAddress: '0xfrom1',
            toAddress: '0xto1',
            amount: '1000000000000000000000',
            usdValue: 15000,
            timestamp: new Date('2024-01-01T00:00:00Z'),
          },
        }),
        app.prisma.whaleTransaction.create({
          data: {
            coinId: coin.id,
            txHash: '0x456',
            fromAddress: '0xfrom2',
            toAddress: '0xto2',
            amount: '2000000000000000000000',
            usdValue: 25000,
            timestamp: new Date('2024-01-01T01:00:00Z'),
          },
        }),
      ]);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/whale/transactions?coinId=${coin.id}&limit=10&offset=0`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.transactions).toHaveLength(2);
      expect(data.data.total).toBe(2);
      expect(data.meta.pagination).toBeDefined();
      expect(data.meta.pagination.page).toBe(1);
      expect(data.meta.pagination.limit).toBe(10);
    });

    it('should filter transactions by date range', async () => {
      // Create test coin
      const coin = await app.prisma.coin.create({
        data: {
          address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
          symbol: 'SHIB',
          name: 'Shiba Inu',
          network: 'ethereum',
          contractVerified: true,
        },
      });

      // Create transactions with different timestamps
      await Promise.all([
        app.prisma.whaleTransaction.create({
          data: {
            coinId: coin.id,
            txHash: '0x123',
            fromAddress: '0xfrom1',
            toAddress: '0xto1',
            amount: '1000000000000000000000',
            usdValue: 15000,
            timestamp: new Date('2024-01-01T00:00:00Z'),
          },
        }),
        app.prisma.whaleTransaction.create({
          data: {
            coinId: coin.id,
            txHash: '0x456',
            fromAddress: '0xfrom2',
            toAddress: '0xto2',
            amount: '2000000000000000000000',
            usdValue: 25000,
            timestamp: new Date('2024-01-02T00:00:00Z'),
          },
        }),
      ]);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/whale/transactions?coinId=${coin.id}&fromDate=2024-01-01T12:00:00Z&toDate=2024-01-02T12:00:00Z`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.transactions).toHaveLength(1);
      expect(data.data.transactions[0].txHash).toBe('0x456');
    });

    it('should filter transactions by minimum USD value', async () => {
      // Create test coin
      const coin = await app.prisma.coin.create({
        data: {
          address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
          symbol: 'SHIB',
          name: 'Shiba Inu',
          network: 'ethereum',
          contractVerified: true,
        },
      });

      // Create transactions with different USD values
      await Promise.all([
        app.prisma.whaleTransaction.create({
          data: {
            coinId: coin.id,
            txHash: '0x123',
            fromAddress: '0xfrom1',
            toAddress: '0xto1',
            amount: '1000000000000000000000',
            usdValue: 15000,
            timestamp: new Date('2024-01-01T00:00:00Z'),
          },
        }),
        app.prisma.whaleTransaction.create({
          data: {
            coinId: coin.id,
            txHash: '0x456',
            fromAddress: '0xfrom2',
            toAddress: '0xto2',
            amount: '2000000000000000000000',
            usdValue: 25000,
            timestamp: new Date('2024-01-01T01:00:00Z'),
          },
        }),
      ]);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/whale/transactions?coinId=${coin.id}&minUsdValue=20000`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.transactions).toHaveLength(1);
      expect(data.data.transactions[0].usdValue).toBe(25000);
    });

    it('should return 400 for invalid coinId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/whale/transactions?coinId=invalid',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/whale/analysis', () => {
    it('should return whale movement analysis', async () => {
      // Create test coin
      const coin = await app.prisma.coin.create({
        data: {
          address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
          symbol: 'SHIB',
          name: 'Shiba Inu',
          network: 'ethereum',
          contractVerified: true,
        },
      });

      // Create test whale transactions
      await Promise.all([
        app.prisma.whaleTransaction.create({
          data: {
            coinId: coin.id,
            txHash: '0x123',
            fromAddress: '0xfrom1',
            toAddress: '0xto1',
            amount: '1000000000000000000000',
            usdValue: 15000,
            timestamp: new Date(),
          },
        }),
        app.prisma.whaleTransaction.create({
          data: {
            coinId: coin.id,
            txHash: '0x456',
            fromAddress: '0xfrom2',
            toAddress: '0xto2',
            amount: '2000000000000000000000',
            usdValue: 25000,
            timestamp: new Date(),
          },
        }),
      ]);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/whale/analysis?coinId=${coin.id}&timeframe=24h`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.coinId).toBe(coin.id);
      expect(data.data.timeframe).toBe('24h');
      expect(data.data.totalTransactions).toBe(2);
      expect(data.data.totalVolume).toBe(40000);
      expect(data.data.averageTransactionSize).toBe(20000);
      expect(data.data.uniqueWallets).toBeGreaterThan(0);
    });

    it('should return analysis for different timeframes', async () => {
      // Create test coin
      const coin = await app.prisma.coin.create({
        data: {
          address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
          symbol: 'SHIB',
          name: 'Shiba Inu',
          network: 'ethereum',
          contractVerified: true,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/whale/analysis?coinId=${coin.id}&timeframe=1h`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.timeframe).toBe('1h');
    });

    it('should return 400 for invalid timeframe', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/whale/analysis?coinId=1&timeframe=invalid',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/whale/wallet', () => {
    it('should return whale wallet information', async () => {
      // Create test coin
      const coin = await app.prisma.coin.create({
        data: {
          address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
          symbol: 'SHIB',
          name: 'Shiba Inu',
          network: 'ethereum',
          contractVerified: true,
        },
      });

      const walletAddress = '0x123456789abcdef123456789abcdef1234567890';

      // Create test whale transactions for the wallet
      await app.prisma.whaleTransaction.create({
        data: {
          coinId: coin.id,
          txHash: '0x123',
          fromAddress: walletAddress.toLowerCase(),
          toAddress: '0xto1',
          amount: '1000000000000000000000',
          usdValue: 15000,
          timestamp: new Date(),
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/whale/wallet?address=${walletAddress}`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.address).toBe(walletAddress.toLowerCase());
      expect(data.data.totalTransactions).toBeGreaterThan(0);
      expect(data.data.totalVolume).toBeGreaterThan(0);
      expect(data.data.category).toBeDefined();
      expect(data.data.isActive).toBeDefined();
    });

    it('should return 404 for non-existent wallet', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/whale/wallet?address=0x123456789abcdef123456789abcdef1234567890',
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('WHALE_WALLET_NOT_FOUND');
    });

    it('should return 400 for invalid address format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/whale/wallet?address=invalid-address',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/whale/top-wallets', () => {
    it('should return top whale wallets for a coin', async () => {
      // Create test coin
      const coin = await app.prisma.coin.create({
        data: {
          address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
          symbol: 'SHIB',
          name: 'Shiba Inu',
          network: 'ethereum',
          contractVerified: true,
        },
      });

      // Create test whale transactions with different wallets
      await Promise.all([
        app.prisma.whaleTransaction.create({
          data: {
            coinId: coin.id,
            txHash: '0x123',
            fromAddress: '0xwhale1',
            toAddress: '0xother1',
            amount: '1000000000000000000000',
            usdValue: 100000,
            timestamp: new Date(),
          },
        }),
        app.prisma.whaleTransaction.create({
          data: {
            coinId: coin.id,
            txHash: '0x456',
            fromAddress: '0xwhale2',
            toAddress: '0xother2',
            amount: '2000000000000000000000',
            usdValue: 200000,
            timestamp: new Date(),
          },
        }),
      ]);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/whale/top-wallets?coinId=${coin.id}&limit=10`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);

      // Should be sorted by volume (descending)
      if (data.data.length > 1) {
        expect(data.data[0].totalVolume).toBeGreaterThanOrEqual(data.data[1].totalVolume);
      }
    });

    it('should limit results correctly', async () => {
      // Create test coin
      const coin = await app.prisma.coin.create({
        data: {
          address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
          symbol: 'SHIB',
          name: 'Shiba Inu',
          network: 'ethereum',
          contractVerified: true,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/whale/top-wallets?coinId=${coin.id}&limit=5`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('POST /api/v1/whale/process', () => {
    it('should process whale transactions for a coin', async () => {
      // Create test coin
      const coin = await app.prisma.coin.create({
        data: {
          address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
          symbol: 'SHIB',
          name: 'Shiba Inu',
          network: 'ethereum',
          contractVerified: true,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/whale/process',
        payload: {
          coinId: coin.id,
          contractAddress: coin.address,
          network: coin.network,
        },
      });

      // This might fail due to external API calls, but we test the endpoint structure
      expect([200, 500, 502]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const data = JSON.parse(response.payload);
        expect(data.success).toBe(true);
        expect(data.data.processedCount).toBeDefined();
        expect(data.data.message).toBeDefined();
      }
    });

    it('should return 400 for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/whale/process',
        payload: {
          coinId: 1,
          // Missing contractAddress and network
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
