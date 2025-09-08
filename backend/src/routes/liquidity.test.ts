import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import liquidityRoutes from './liquidity.js';

// Mock the services
vi.mock('../services/liquidity.js', () => ({
  LiquidityService: vi.fn().mockImplementation(() => ({
    getLiquidityPools: vi.fn(),
    analyzeLiquidity: vi.fn(),
    getLiquidityTrends: vi.fn(),
    syncLiquidityPools: vi.fn(),
    createLiquidityAlert: vi.fn(),
    getUserLiquidityAlerts: vi.fn(),
    updateLiquidityAlert: vi.fn(),
    deleteLiquidityAlert: vi.fn(),
  })),
}));

describe('Liquidity Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });

    // Mock required plugins
    app.decorate('prisma', {
      liquidityPool: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
    });

    app.decorate('cache', {});
    app.decorate('realtime', {});

    // Mock authentication
    app.decorate('authenticate', async (request: any) => {
      request.user = { id: 1 };
    });

    await app.register(liquidityRoutes, { prefix: '/api/v1/liquidity' });
    await app.ready();
  });

  describe('Route Registration', () => {
    it('should register all liquidity routes', async () => {
      const routes = app.printRoutes();

      // Check that key routes are registered
      expect(routes).toContain('GET /api/v1/liquidity/coins/:coinId/pools');
      expect(routes).toContain('GET /api/v1/liquidity/coins/:coinId/analysis');
      expect(routes).toContain('GET /api/v1/liquidity/coins/:coinId/trends');
      expect(routes).toContain('POST /api/v1/liquidity/sync');
      expect(routes).toContain('POST /api/v1/liquidity/alerts');
      expect(routes).toContain('GET /api/v1/liquidity/alerts');
      expect(routes).toContain('PUT /api/v1/liquidity/alerts/:alertId');
      expect(routes).toContain('DELETE /api/v1/liquidity/alerts/:alertId');
      expect(routes).toContain('GET /api/v1/liquidity/pools/:poolId');
      expect(routes).toContain('POST /api/v1/liquidity/pools/compare');
    });
  });

  describe('Parameter Validation', () => {
    it('should validate coinId parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/liquidity/coins/invalid/pools',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate timeframe query parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/liquidity/coins/1/trends?timeframe=invalid',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate alert creation payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/liquidity/alerts',
        payload: {
          coinId: 'invalid',
          type: 'invalid_type',
          condition: {},
          notificationMethods: [],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate pool comparison payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/liquidity/pools/compare',
        payload: {
          poolIds: [1], // Need at least 2
          metrics: ['liquidity'],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Pool Details Route', () => {
    it('should return 404 for non-existent pool', async () => {
      // Mock prisma to return null
      app.prisma.liquidityPool.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/liquidity/pools/99999',
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('POOL_NOT_FOUND');
    });

    it('should return pool details when pool exists', async () => {
      const mockPool = {
        id: 1,
        coinId: 1,
        exchange: 'uniswap-v2',
        pairAddress: '0x123',
        totalLiquidity: 1000000,
        coin: {
          id: 1,
          symbol: 'TEST',
          name: 'Test Coin',
        },
        liquidityData: [],
      };

      app.prisma.liquidityPool.findUnique.mockResolvedValue(mockPool);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/liquidity/pools/1',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(1);
      expect(data.data.exchange).toBe('uniswap-v2');
    });
  });

  describe('Pool Comparison Route', () => {
    it('should return 404 when no pools found', async () => {
      app.prisma.liquidityPool.findMany.mockResolvedValue([]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/liquidity/pools/compare',
        payload: {
          poolIds: [1, 2],
          metrics: ['liquidity', 'volume'],
        },
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('POOLS_NOT_FOUND');
    });

    it('should return comparison data when pools exist', async () => {
      const mockPools = [
        {
          id: 1,
          exchange: 'uniswap-v2',
          pairAddress: '0x123',
          baseSymbol: 'TEST',
          quoteSymbol: 'USDC',
          totalLiquidity: 1000000,
          volume24h: 50000,
          fees24h: 150,
          apr: 25.5,
          coin: {
            id: 1,
            symbol: 'TEST',
            name: 'Test Coin',
          },
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
          exchange: 'sushiswap',
          pairAddress: '0x456',
          baseSymbol: 'TEST',
          quoteSymbol: 'USDT',
          totalLiquidity: 750000,
          volume24h: 30000,
          fees24h: 75,
          apr: 18.2,
          coin: {
            id: 1,
            symbol: 'TEST',
            name: 'Test Coin',
          },
          liquidityData: [
            {
              priceImpact1k: 0.15,
              priceImpact10k: 1.5,
              priceImpact100k: 15.0,
            },
          ],
        },
      ];

      app.prisma.liquidityPool.findMany.mockResolvedValue(mockPools);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/liquidity/pools/compare',
        payload: {
          poolIds: [1, 2],
          metrics: ['liquidity', 'volume', 'priceImpact'],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.pools).toHaveLength(2);
      expect(data.data.pools[0].liquidity).toBe(1000000);
      expect(data.data.pools[0].volume24h).toBe(50000);
      expect(data.data.pools[0].priceImpact).toBeDefined();
      expect(data.data.metrics).toEqual(['liquidity', 'volume', 'priceImpact']);
    });
  });
});
