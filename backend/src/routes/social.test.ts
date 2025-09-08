import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

// Mock the social service
vi.mock('../services/social.js', () => ({
  SocialService: vi.fn().mockImplementation(() => ({
    getSocialMetrics: vi.fn(),
    collectSocialMetrics: vi.fn(),
    getAggregatedSocialMetrics: vi.fn(),
    detectTrending: vi.fn(),
    analyzeSentiment: vi.fn(),
    clearCache: vi.fn(),
  })),
}));

describe('Social Routes', () => {
  let app: FastifyInstance;
  let mockSocialService: any;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    // Get the mocked service instance
    const { SocialService } = await import('../services/social.js');
    mockSocialService = new (SocialService as any)();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/social/metrics', () => {
    it('should return social metrics with default parameters', async () => {
      const mockData = {
        data: [
          {
            id: 1,
            coinId: 1,
            platform: 'twitter',
            followers: 1000,
            mentions24h: 50,
            sentimentScore: 0.5,
            trendingScore: 75,
            influencerMentions: 2,
            timestamp: new Date().toISOString(),
          },
        ],
        total: 1,
        hasMore: false,
      };

      mockSocialService.getSocialMetrics.mockResolvedValue(mockData);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/social/metrics',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockData);
    });

    it('should handle query parameters', async () => {
      const mockData = {
        data: [],
        total: 0,
        hasMore: false,
      };

      mockSocialService.getSocialMetrics.mockResolvedValue(mockData);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/social/metrics?coinId=1&platform=twitter&limit=10',
      });

      expect(response.statusCode).toBe(200);
      expect(mockSocialService.getSocialMetrics).toHaveBeenCalledWith({
        coinId: 1,
        platform: 'twitter',
        limit: 10,
        offset: 0,
      });
    });

    it('should handle service errors', async () => {
      mockSocialService.getSocialMetrics.mockRejectedValue(new Error('Service error'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/social/metrics',
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('SOCIAL_METRICS_ERROR');
    });
  });

  describe('POST /api/v1/social/collect', () => {
    it('should collect social metrics successfully', async () => {
      const mockResult = [
        {
          id: 1,
          coinId: 1,
          platform: 'twitter',
          followers: 1000,
          mentions24h: 50,
          sentimentScore: 0.5,
          trendingScore: 75,
          influencerMentions: 2,
          timestamp: new Date(),
        },
      ];

      mockSocialService.collectSocialMetrics.mockResolvedValue(mockResult);

      // Mock authentication
      const token = app.jwt.sign({ userId: 1, email: 'test@example.com' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/social/collect',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          coinId: 1,
          platforms: ['twitter', 'reddit'],
          keywords: ['bitcoin', 'BTC'],
          timeframe: '24h',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockResult);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/social/collect',
        payload: {
          coinId: 1,
          platforms: ['twitter'],
          keywords: ['bitcoin'],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate request body', async () => {
      const token = app.jwt.sign({ userId: 1, email: 'test@example.com' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/social/collect',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          coinId: 'invalid',
          platforms: [],
          keywords: [],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/social/coins/:coinId/aggregated', () => {
    it('should return aggregated social metrics', async () => {
      const mockData = {
        coinId: 1,
        aggregatedSentiment: 0.5,
        totalMentions24h: 100,
        totalFollowers: 5000,
        averageTrendingScore: 75,
        platformBreakdown: [
          {
            platform: 'twitter',
            sentiment: 0.6,
            mentions: 60,
            followers: 3000,
            trendingScore: 80,
          },
        ],
        timestamp: new Date(),
      };

      mockSocialService.getAggregatedSocialMetrics.mockResolvedValue(mockData);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/social/coins/1/aggregated',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockData);
      expect(mockSocialService.getAggregatedSocialMetrics).toHaveBeenCalledWith(1);
    });

    it('should handle invalid coin ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/social/coins/invalid/aggregated',
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_COIN_ID');
    });

    it('should handle service errors', async () => {
      mockSocialService.getAggregatedSocialMetrics.mockRejectedValue(new Error('No metrics found'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/social/coins/1/aggregated',
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AGGREGATED_METRICS_ERROR');
    });
  });

  describe('GET /api/v1/social/trending', () => {
    it('should return trending coins', async () => {
      const mockData = [
        {
          coinId: 1,
          platform: 'twitter',
          trendingScore: 85,
          mentionIncrease: 150,
          sentimentChange: 0.2,
          influencerActivity: true,
          viralPotential: 'high',
          timestamp: new Date(),
        },
      ];

      mockSocialService.detectTrending.mockResolvedValue(mockData);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/social/trending',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockData);
      expect(mockSocialService.detectTrending).toHaveBeenCalledWith(
        ['twitter', 'reddit', 'telegram'],
        '24h'
      );
    });

    it('should handle query parameters', async () => {
      mockSocialService.detectTrending.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/social/trending?platforms=twitter,reddit&timeframe=1h',
      });

      expect(response.statusCode).toBe(200);
      expect(mockSocialService.detectTrending).toHaveBeenCalledWith(['twitter', 'reddit'], '1h');
    });

    it('should filter invalid platforms', async () => {
      mockSocialService.detectTrending.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/social/trending?platforms=twitter,invalid,reddit',
      });

      expect(response.statusCode).toBe(200);
      expect(mockSocialService.detectTrending).toHaveBeenCalledWith(['twitter', 'reddit'], '24h');
    });
  });

  describe('POST /api/v1/social/sentiment', () => {
    it('should analyze sentiment successfully', async () => {
      const mockResult = {
        score: 0.5,
        comparative: 0.25,
        calculation: [{ word: 'great', score: 3 }],
        tokens: ['this', 'is', 'great'],
        words: ['great'],
        positive: ['great'],
        negative: [],
      };

      mockSocialService.analyzeSentiment.mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/social/sentiment',
        payload: {
          text: 'This is great!',
          platform: 'twitter',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockResult);
      expect(mockSocialService.analyzeSentiment).toHaveBeenCalledWith('This is great!', 'twitter');
    });

    it('should validate request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/social/sentiment',
        payload: {
          text: '', // Empty text should fail validation
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle service errors', async () => {
      mockSocialService.analyzeSentiment.mockRejectedValue(new Error('Analysis failed'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/social/sentiment',
        payload: {
          text: 'Test text',
        },
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('SENTIMENT_ANALYSIS_ERROR');
    });
  });

  describe('DELETE /api/v1/social/cache', () => {
    it('should clear cache successfully', async () => {
      mockSocialService.clearCache.mockResolvedValue();

      const token = app.jwt.sign({ userId: 1, email: 'test@example.com' });

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/social/cache',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Cache cleared successfully');
      expect(mockSocialService.clearCache).toHaveBeenCalledWith(undefined);
    });

    it('should clear cache with pattern', async () => {
      mockSocialService.clearCache.mockResolvedValue();

      const token = app.jwt.sign({ userId: 1, email: 'test@example.com' });

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/social/cache?pattern=social:trending:*',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockSocialService.clearCache).toHaveBeenCalledWith('social:trending:*');
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/social/cache',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
