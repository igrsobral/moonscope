import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { SentimentAnalysisService } from './sentiment-analysis.js';
import { SocialMediaClientManager, type SocialPost } from './social-media-clients.js';
import type { 
  SocialPlatform,
  SocialMetricsInput,
  SocialMetricsResponse,
  SocialMetricsQuery,
  SocialDataCollectionRequest,
  TrendingDetectionResponse,
  SocialAggregationResponse
} from '../schemas/social.js';

export class SocialService {
  private prisma: PrismaClient;
  private redis: Redis;
  private sentimentService: SentimentAnalysisService;
  private socialClients: SocialMediaClientManager;

  // Cache TTL values (in seconds)
  private readonly CACHE_TTL = {
    SOCIAL_METRICS: 30 * 60, // 30 minutes
    SENTIMENT_ANALYSIS: 60 * 60, // 1 hour
    TRENDING_DATA: 15 * 60, // 15 minutes
    AGGREGATED_DATA: 20 * 60, // 20 minutes
  };

  constructor(
    prisma: PrismaClient, 
    redis: Redis,
    socialConfig: {
      twitter?: {
        apiKey: string;
        apiSecret: string;
        bearerToken: string;
      };
      reddit?: {
        clientId: string;
        clientSecret: string;
        userAgent: string;
      };
      telegram?: {
        botToken: string;
      };
    }
  ) {
    this.prisma = prisma;
    this.redis = redis;
    this.sentimentService = new SentimentAnalysisService();
    this.socialClients = new SocialMediaClientManager(socialConfig);
  }

  /**
   * Collect and store social metrics for a coin
   */
  async collectSocialMetrics(request: SocialDataCollectionRequest): Promise<SocialMetricsResponse[]> {
    const { coinId, platforms, keywords, timeframe } = request;

    // Check cache first
    const cacheKey = `social:collect:${coinId}:${platforms.join(',')}:${timeframe}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Collect data from social media platforms
      const socialData = await this.socialClients.collectSocialData(keywords, {
        platforms,
        timeframe,
        limit: 200,
      });

      const results: SocialMetricsResponse[] = [];

      // Process each platform's data
      for (const platformData of socialData) {
        const { platform, posts, mentions24h } = platformData;

        // Analyze sentiment of collected posts
        const texts = posts.map(post => post.text);
        const sentimentResult = await this.sentimentService.analyzeBatchSentiment(texts, platform);

        // Calculate trending score
        const engagementRate = this.calculateEngagementRate(posts);
        const influencerMentions = posts.filter(post => post.isInfluencer).length;
        const trendingScore = this.sentimentService.calculateTrendingScore(
          sentimentResult.aggregatedScore,
          mentions24h,
          engagementRate,
          influencerMentions
        );

        // Create social metrics input
        const metricsInput: SocialMetricsInput = {
          coinId,
          platform,
          followers: platformData.followers,
          mentions24h,
          sentimentScore: sentimentResult.aggregatedScore,
          trendingScore,
          influencerMentions,
        };

        // Store in database
        const savedMetrics = await this.prisma.socialMetrics.create({
          data: {
            ...metricsInput,
            timestamp: new Date(),
          },
        });

        results.push({
          id: savedMetrics.id,
          coinId: savedMetrics.coinId,
          platform: savedMetrics.platform as SocialPlatform,
          followers: savedMetrics.followers,
          mentions24h: savedMetrics.mentions24h,
          sentimentScore: Number(savedMetrics.sentimentScore),
          trendingScore: Number(savedMetrics.trendingScore),
          influencerMentions: savedMetrics.influencerMentions,
          timestamp: savedMetrics.timestamp,
        });
      }

      // Cache results
      await this.redis.setex(cacheKey, this.CACHE_TTL.SOCIAL_METRICS, JSON.stringify(results));

      return results;
    } catch (error) {
      console.error('Error collecting social metrics:', error);
      throw new Error('Failed to collect social metrics');
    }
  }

  /**
   * Get social metrics for a coin with optional filtering
   */
  async getSocialMetrics(query: SocialMetricsQuery): Promise<{
    data: SocialMetricsResponse[];
    total: number;
    hasMore: boolean;
  }> {
    const { coinId, platform, startDate, endDate, limit, offset } = query;

    // Build cache key
    const cacheKey = `social:metrics:${JSON.stringify(query)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Build where clause
      const where: any = {};
      if (coinId) where.coinId = coinId;
      if (platform) where.platform = platform;
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate);
        if (endDate) where.timestamp.lte = new Date(endDate);
      }

      // Get total count
      const total = await this.prisma.socialMetrics.count({ where });

      // Get paginated data
      const metrics = await this.prisma.socialMetrics.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      });

      const data: SocialMetricsResponse[] = metrics.map(metric => ({
        id: metric.id,
        coinId: metric.coinId,
        platform: metric.platform as SocialPlatform,
        followers: metric.followers,
        mentions24h: metric.mentions24h,
        sentimentScore: Number(metric.sentimentScore),
        trendingScore: Number(metric.trendingScore),
        influencerMentions: metric.influencerMentions,
        timestamp: metric.timestamp,
      }));

      const result = {
        data,
        total,
        hasMore: offset + limit < total,
      };

      // Cache results
      await this.redis.setex(cacheKey, this.CACHE_TTL.SOCIAL_METRICS, JSON.stringify(result));

      return result;
    } catch (error) {
      console.error('Error getting social metrics:', error);
      throw new Error('Failed to get social metrics');
    }
  }

  /**
   * Detect trending coins based on social activity
   */
  async detectTrending(
    platforms: SocialPlatform[] = ['twitter', 'reddit', 'telegram'],
    timeframe: '1h' | '6h' | '24h' = '24h'
  ): Promise<TrendingDetectionResponse[]> {
    const cacheKey = `social:trending:${platforms.join(',')}:${timeframe}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Calculate time range
      const now = new Date();
      const timeRanges = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
      };
      const startTime = new Date(now.getTime() - timeRanges[timeframe]);

      // Get recent social metrics
      const recentMetrics = await this.prisma.socialMetrics.findMany({
        where: {
          platform: { in: platforms },
          timestamp: { gte: startTime },
        },
        orderBy: { timestamp: 'desc' },
      });

      // Get previous period metrics for comparison
      const previousStartTime = new Date(startTime.getTime() - timeRanges[timeframe]);
      const previousMetrics = await this.prisma.socialMetrics.findMany({
        where: {
          platform: { in: platforms },
          timestamp: { gte: previousStartTime, lt: startTime },
        },
      });

      // Group by coin and platform
      const recentByKey = this.groupMetricsByKey(recentMetrics);
      const previousByKey = this.groupMetricsByKey(previousMetrics);

      const trendingResults: TrendingDetectionResponse[] = [];

      // Analyze each coin-platform combination
      for (const [key, recentData] of recentByKey.entries()) {
        const [coinId, platform] = key.split(':');
        const previousData = previousByKey.get(key);

        // Calculate mention increase
        const currentMentions = recentData.reduce((sum, m) => sum + m.mentions24h, 0);
        const previousMentions = previousData ? 
          previousData.reduce((sum, m) => sum + m.mentions24h, 0) : 0;
        const mentionIncrease = previousMentions > 0 ? 
          ((currentMentions - previousMentions) / previousMentions) * 100 : 
          currentMentions > 0 ? 100 : 0;

        // Calculate sentiment change
        const currentSentiment = recentData.reduce((sum, m) => sum + Number(m.sentimentScore), 0) / recentData.length;
        const previousSentiment = previousData ? 
          previousData.reduce((sum, m) => sum + Number(m.sentimentScore), 0) / previousData.length : 0;
        const sentimentChange = currentSentiment - previousSentiment;

        // Check influencer activity
        const influencerActivity = recentData.some(m => m.influencerMentions > 0);

        // Calculate trending score
        const avgTrendingScore = recentData.reduce((sum, m) => sum + Number(m.trendingScore), 0) / recentData.length;

        // Detect viral potential
        const viralPotential = this.sentimentService.detectViralPotential(
          mentionIncrease,
          currentSentiment,
          influencerActivity,
          avgTrendingScore
        );

        // Only include if there's significant activity
        if (mentionIncrease > 10 || avgTrendingScore > 60 || viralPotential !== 'low') {
          trendingResults.push({
            coinId: parseInt(coinId),
            platform: platform as SocialPlatform,
            trendingScore: Math.round(avgTrendingScore),
            mentionIncrease,
            sentimentChange,
            influencerActivity,
            viralPotential,
            timestamp: now,
          });
        }
      }

      // Sort by trending score
      trendingResults.sort((a, b) => b.trendingScore - a.trendingScore);

      // Cache results
      await this.redis.setex(cacheKey, this.CACHE_TTL.TRENDING_DATA, JSON.stringify(trendingResults));

      return trendingResults;
    } catch (error) {
      console.error('Error detecting trending coins:', error);
      throw new Error('Failed to detect trending coins');
    }
  }

  /**
   * Get aggregated social metrics for a coin across all platforms
   */
  async getAggregatedSocialMetrics(coinId: number): Promise<SocialAggregationResponse> {
    const cacheKey = `social:aggregated:${coinId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Get recent metrics (last 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const metrics = await this.prisma.socialMetrics.findMany({
        where: {
          coinId,
          timestamp: { gte: twentyFourHoursAgo },
        },
        orderBy: { timestamp: 'desc' },
      });

      if (metrics.length === 0) {
        throw new Error('No social metrics found for this coin');
      }

      // Group by platform
      const platformGroups = new Map<SocialPlatform, typeof metrics>();
      metrics.forEach(metric => {
        const platform = metric.platform as SocialPlatform;
        if (!platformGroups.has(platform)) {
          platformGroups.set(platform, []);
        }
        platformGroups.get(platform)!.push(metric);
      });

      // Calculate aggregated metrics
      const totalMentions24h = metrics.reduce((sum, m) => sum + m.mentions24h, 0);
      const totalFollowers = metrics.reduce((sum, m) => sum + m.followers, 0);
      const aggregatedSentiment = metrics.reduce((sum, m) => sum + Number(m.sentimentScore), 0) / metrics.length;
      const averageTrendingScore = metrics.reduce((sum, m) => sum + Number(m.trendingScore), 0) / metrics.length;

      // Create platform breakdown
      const platformBreakdown = Array.from(platformGroups.entries()).map(([platform, platformMetrics]) => {
        const latestMetric = platformMetrics[0]; // Most recent
        return {
          platform,
          sentiment: Number(latestMetric.sentimentScore),
          mentions: latestMetric.mentions24h,
          followers: latestMetric.followers,
          trendingScore: Number(latestMetric.trendingScore),
        };
      });

      const result: SocialAggregationResponse = {
        coinId,
        aggregatedSentiment,
        totalMentions24h,
        totalFollowers,
        averageTrendingScore,
        platformBreakdown,
        timestamp: new Date(),
      };

      // Cache results
      await this.redis.setex(cacheKey, this.CACHE_TTL.AGGREGATED_DATA, JSON.stringify(result));

      return result;
    } catch (error) {
      console.error('Error getting aggregated social metrics:', error);
      throw new Error('Failed to get aggregated social metrics');
    }
  }

  /**
   * Analyze sentiment for arbitrary text
   */
  async analyzeSentiment(text: string, platform?: SocialPlatform) {
    const cacheKey = `sentiment:${Buffer.from(text).toString('base64')}:${platform || 'none'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.sentimentService.analyzeSentiment({ text, platform });
    
    // Cache sentiment analysis
    await this.redis.setex(cacheKey, this.CACHE_TTL.SENTIMENT_ANALYSIS, JSON.stringify(result));
    
    return result;
  }

  /**
   * Calculate engagement rate from social posts
   */
  private calculateEngagementRate(posts: SocialPost[]): number {
    if (posts.length === 0) return 0;

    const totalEngagement = posts.reduce((sum, post) => {
      return sum + post.engagement.likes + post.engagement.shares + post.engagement.comments;
    }, 0);

    const totalPosts = posts.length;
    return totalEngagement / totalPosts / 100; // Normalize to 0-1 range
  }

  /**
   * Group metrics by coin:platform key
   */
  private groupMetricsByKey(metrics: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();
    
    metrics.forEach(metric => {
      const key = `${metric.coinId}:${metric.platform}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(metric);
    });

    return grouped;
  }

  /**
   * Clear cache for social metrics
   */
  async clearCache(pattern?: string): Promise<void> {
    const searchPattern = pattern || 'social:*';
    const keys = await this.redis.keys(searchPattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}