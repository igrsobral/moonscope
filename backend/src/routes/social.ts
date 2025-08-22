import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  SocialMetricsQuerySchema,
  SocialDataCollectionRequestSchema,
  SentimentAnalysisRequestSchema,
  type SocialMetricsQuery,
  type SocialDataCollectionRequest,
  type SentimentAnalysisRequest,
  type SocialPlatform
} from '../schemas/social.js';
import { SocialService } from '../services/social.js';

export default async function socialRoutes(fastify: FastifyInstance) {
  const socialService = new SocialService(
    fastify.prisma,
    fastify.redis,
    {
      twitter: {
        apiKey: process.env.TWITTER_API_KEY || '',
        apiSecret: process.env.TWITTER_API_SECRET || '',
        bearerToken: process.env.TWITTER_BEARER_TOKEN || '',
      },
      reddit: {
        clientId: process.env.REDDIT_CLIENT_ID || '',
        clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
        userAgent: process.env.REDDIT_USER_AGENT || 'MemeAnalyzer/1.0',
      },
      telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      },
    }
  );

  // Get social metrics for a coin
  fastify.get<{
    Querystring: SocialMetricsQuery;
  }>('/metrics', {
    schema: {
      description: 'Get social metrics with optional filtering',
      tags: ['social'],
      querystring: SocialMetricsQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'number' },
                      coinId: { type: 'number' },
                      platform: { type: 'string', enum: ['twitter', 'reddit', 'telegram'] },
                      followers: { type: 'number' },
                      mentions24h: { type: 'number' },
                      sentimentScore: { type: 'number' },
                      trendingScore: { type: 'number' },
                      influencerMentions: { type: 'number' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
                total: { type: 'number' },
                hasMore: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    handler: async (request: FastifyRequest<{ Querystring: SocialMetricsQuery }>, reply: FastifyReply) => {
      try {
        const result = await socialService.getSocialMetrics(request.query);
        
        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        request.log.error(error, 'Error getting social metrics');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SOCIAL_METRICS_ERROR',
            message: 'Failed to get social metrics',
          },
        });
      }
    },
  });

  // Collect social metrics for a coin
  fastify.post<{
    Body: SocialDataCollectionRequest;
  }>('/collect', {
    schema: {
      description: 'Collect social metrics for a coin from various platforms',
      tags: ['social'],
      body: SocialDataCollectionRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  coinId: { type: 'number' },
                  platform: { type: 'string', enum: ['twitter', 'reddit', 'telegram'] },
                  followers: { type: 'number' },
                  mentions24h: { type: 'number' },
                  sentimentScore: { type: 'number' },
                  trendingScore: { type: 'number' },
                  influencerMentions: { type: 'number' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
    preHandler: [fastify.authenticate], // Require authentication
    handler: async (request: FastifyRequest<{ Body: SocialDataCollectionRequest }>, reply: FastifyReply) => {
      try {
        const result = await socialService.collectSocialMetrics(request.body);
        
        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        request.log.error(error, 'Error collecting social metrics');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SOCIAL_COLLECTION_ERROR',
            message: 'Failed to collect social metrics',
          },
        });
      }
    },
  });

  // Get aggregated social metrics for a coin
  fastify.get<{
    Params: { coinId: string };
  }>('/coins/:coinId/aggregated', {
    schema: {
      description: 'Get aggregated social metrics for a specific coin',
      tags: ['social'],
      params: {
        type: 'object',
        properties: {
          coinId: { type: 'string', pattern: '^[0-9]+$' },
        },
        required: ['coinId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                coinId: { type: 'number' },
                aggregatedSentiment: { type: 'number' },
                totalMentions24h: { type: 'number' },
                totalFollowers: { type: 'number' },
                averageTrendingScore: { type: 'number' },
                platformBreakdown: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      platform: { type: 'string', enum: ['twitter', 'reddit', 'telegram'] },
                      sentiment: { type: 'number' },
                      mentions: { type: 'number' },
                      followers: { type: 'number' },
                      trendingScore: { type: 'number' },
                    },
                  },
                },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
    handler: async (request: FastifyRequest<{ Params: { coinId: string } }>, reply: FastifyReply) => {
      try {
        const coinId = parseInt(request.params.coinId);
        if (isNaN(coinId) || coinId <= 0) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_COIN_ID',
              message: 'Invalid coin ID provided',
            },
          });
        }

        const result = await socialService.getAggregatedSocialMetrics(coinId);
        
        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        request.log.error(error, 'Error getting aggregated social metrics');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'AGGREGATED_METRICS_ERROR',
            message: 'Failed to get aggregated social metrics',
          },
        });
      }
    },
  });

  // Get trending coins based on social activity
  fastify.get<{
    Querystring: {
      platforms?: string;
      timeframe?: '1h' | '6h' | '24h';
    };
  }>('/trending', {
    schema: {
      description: 'Get trending coins based on social activity',
      tags: ['social'],
      querystring: {
        type: 'object',
        properties: {
          platforms: { 
            type: 'string',
            description: 'Comma-separated list of platforms (twitter,reddit,telegram)',
          },
          timeframe: { 
            type: 'string', 
            enum: ['1h', '6h', '24h'],
            default: '24h',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  coinId: { type: 'number' },
                  platform: { type: 'string', enum: ['twitter', 'reddit', 'telegram'] },
                  trendingScore: { type: 'number' },
                  mentionIncrease: { type: 'number' },
                  sentimentChange: { type: 'number' },
                  influencerActivity: { type: 'boolean' },
                  viralPotential: { type: 'string', enum: ['low', 'medium', 'high'] },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
    handler: async (request: FastifyRequest<{ 
      Querystring: { platforms?: string; timeframe?: '1h' | '6h' | '24h' } 
    }>, reply: FastifyReply) => {
      try {
        const { platforms: platformsParam, timeframe = '24h' } = request.query;
        
        // Parse platforms parameter
        let platforms: SocialPlatform[] = ['twitter', 'reddit', 'telegram'];
        if (platformsParam) {
          const parsedPlatforms = platformsParam.split(',').map(p => p.trim());
          const validPlatforms = parsedPlatforms.filter(p => 
            ['twitter', 'reddit', 'telegram'].includes(p)
          ) as SocialPlatform[];
          
          if (validPlatforms.length > 0) {
            platforms = validPlatforms;
          }
        }

        const result = await socialService.detectTrending(platforms, timeframe);
        
        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        request.log.error(error, 'Error detecting trending coins');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'TRENDING_DETECTION_ERROR',
            message: 'Failed to detect trending coins',
          },
        });
      }
    },
  });

  // Analyze sentiment of arbitrary text
  fastify.post<{
    Body: SentimentAnalysisRequest;
  }>('/sentiment', {
    schema: {
      description: 'Analyze sentiment of provided text',
      tags: ['social'],
      body: SentimentAnalysisRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                score: { type: 'number' },
                comparative: { type: 'number' },
                calculation: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      word: { type: 'string' },
                      score: { type: 'number' },
                    },
                  },
                },
                tokens: { type: 'array', items: { type: 'string' } },
                words: { type: 'array', items: { type: 'string' } },
                positive: { type: 'array', items: { type: 'string' } },
                negative: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    handler: async (request: FastifyRequest<{ Body: SentimentAnalysisRequest }>, reply: FastifyReply) => {
      try {
        const { text, platform } = request.body;
        const result = await socialService.analyzeSentiment(text, platform);
        
        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        request.log.error(error, 'Error analyzing sentiment');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'SENTIMENT_ANALYSIS_ERROR',
            message: 'Failed to analyze sentiment',
          },
        });
      }
    },
  });

  // Clear social data cache
  fastify.delete('/cache', {
    schema: {
      description: 'Clear social data cache',
      tags: ['social'],
      querystring: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Cache key pattern to clear' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
    preHandler: [fastify.authenticate], // Require authentication
    handler: async (request: FastifyRequest<{ 
      Querystring: { pattern?: string } 
    }>, reply: FastifyReply) => {
      try {
        await socialService.clearCache(request.query.pattern);
        
        return reply.send({
          success: true,
          message: 'Cache cleared successfully',
        });
      } catch (error) {
        request.log.error(error, 'Error clearing cache');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'CACHE_CLEAR_ERROR',
            message: 'Failed to clear cache',
          },
        });
      }
    },
  });
}