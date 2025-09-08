import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';

describe('Coins Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/coins', () => {
    it('should return paginated coins list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/coins',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toBeInstanceOf(Array);
      expect(data.meta.pagination).toBeDefined();
      expect(data.meta.pagination.page).toBe(1);
      expect(data.meta.pagination.limit).toBe(20);
    });

    it('should accept query parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/coins?page=2&limit=10&sortBy=name&sortOrder=asc&network=ethereum',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.meta.pagination.page).toBe(2);
      expect(data.meta.pagination.limit).toBe(10);
    });

    it('should validate query parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/coins?page=0&limit=200&sortBy=invalid',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should support search functionality', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/coins?search=doge',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/v1/coins/:id', () => {
    it('should return 404 for non-existent coin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/coins/999999',
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('COIN_NOT_FOUND');
    });

    it('should validate coin ID parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/coins/invalid',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/coins/address/:address', () => {
    it('should return 404 for non-existent address', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/coins/address/0x1234567890123456789012345678901234567890',
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('COIN_NOT_FOUND');
    });

    it('should validate contract address format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/coins/address/invalid-address',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/coins', () => {
    it('should create a new coin with valid data', async () => {
      const coinData = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'TEST',
        name: 'Test Coin',
        network: 'ethereum',
        contractVerified: false,
        logoUrl: 'https://example.com/logo.png',
        description: 'A test coin',
        website: 'https://testcoin.com',
        socialLinks: {
          twitter: 'https://twitter.com/testcoin',
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/coins',
        payload: coinData,
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.symbol).toBe('TEST');
      expect(data.data.name).toBe('Test Coin');
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/coins',
        payload: {
          symbol: 'TEST',
          // Missing required fields
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate contract address format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/coins',
        payload: {
          address: 'invalid-address',
          symbol: 'TEST',
          name: 'Test Coin',
          network: 'ethereum',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate network enum', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/coins',
        payload: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'TEST',
          name: 'Test Coin',
          network: 'invalid-network',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PUT /api/v1/coins/:id', () => {
    it('should return 404 for non-existent coin', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/coins/999999',
        payload: {
          name: 'Updated Name',
        },
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('COIN_NOT_FOUND');
    });

    it('should validate update data', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/coins/1',
        payload: {
          logoUrl: 'invalid-url',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/v1/coins/:id', () => {
    it('should return 404 for non-existent coin', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/coins/999999',
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('COIN_NOT_FOUND');
    });
  });

  describe('GET /api/v1/coins/:id/price-history', () => {
    it('should return price history with default timeframe', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/coins/1/price-history',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toBeInstanceOf(Array);
    });

    it('should accept timeframe parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/coins/1/price-history?timeframe=7d',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
    });

    it('should validate timeframe parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/coins/1/price-history?timeframe=invalid',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/coins/price-data', () => {
    it('should store price data with valid data', async () => {
      const priceData = {
        coinId: 1,
        price: 0.08,
        marketCap: 11000000000,
        volume24h: 500000000,
        liquidity: 1000000,
        priceChange24h: 5.2,
        volumeChange24h: 10.5,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/coins/price-data',
        payload: priceData,
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.price).toBe(0.08);
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/coins/price-data',
        payload: {
          price: 0.08,
          // Missing required fields
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate positive numbers', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/coins/price-data',
        payload: {
          coinId: -1,
          price: -0.08,
          marketCap: 11000000000,
          volume24h: 500000000,
          liquidity: 1000000,
          priceChange24h: 5.2,
          volumeChange24h: 10.5,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/coins/discover', () => {
    it('should discover coins with default network', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/coins/discover',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toBeInstanceOf(Array);
    });

    it('should accept network parameter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/coins/discover',
        payload: {
          network: 'polygon',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
    });

    it('should validate network parameter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/coins/discover',
        payload: {
          network: 'invalid-network',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/coins/search', () => {
    it('should search coins with query parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/coins/search?q=doge',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toBeInstanceOf(Array);
    });

    it('should require query parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/coins/search',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate query parameter length', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/coins/search?q=',
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
