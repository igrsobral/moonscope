import { z } from 'zod';

// Social platform enum
export const SocialPlatformSchema = z.enum(['twitter', 'reddit', 'telegram']);

// Social metrics input schema
export const SocialMetricsInputSchema = z.object({
  coinId: z.number().positive(),
  platform: SocialPlatformSchema,
  followers: z.number().min(0).default(0),
  mentions24h: z.number().min(0).default(0),
  sentimentScore: z.number().min(-1).max(1),
  trendingScore: z.number().min(0).max(100),
  influencerMentions: z.number().min(0).default(0),
});

// Social metrics response schema
export const SocialMetricsResponseSchema = z.object({
  id: z.number(),
  coinId: z.number(),
  platform: SocialPlatformSchema,
  followers: z.number(),
  mentions24h: z.number(),
  sentimentScore: z.number(),
  trendingScore: z.number(),
  influencerMentions: z.number(),
  timestamp: z.date(),
});

// Social metrics query schema
export const SocialMetricsQuerySchema = z.object({
  coinId: z.number().positive().optional(),
  platform: SocialPlatformSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

// Sentiment analysis request schema
export const SentimentAnalysisRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  platform: SocialPlatformSchema.optional(),
});

// Sentiment analysis response schema
export const SentimentAnalysisResponseSchema = z.object({
  score: z.number().min(-1).max(1),
  comparative: z.number(),
  calculation: z.array(z.object({
    word: z.string(),
    score: z.number(),
  })),
  tokens: z.array(z.string()),
  words: z.array(z.string()),
  positive: z.array(z.string()),
  negative: z.array(z.string()),
});

// Social data collection request schema
export const SocialDataCollectionRequestSchema = z.object({
  coinId: z.number().positive(),
  platforms: z.array(SocialPlatformSchema).min(1),
  keywords: z.array(z.string()).min(1),
  timeframe: z.enum(['1h', '6h', '24h', '7d']).default('24h'),
});

// Trending detection response schema
export const TrendingDetectionResponseSchema = z.object({
  coinId: z.number(),
  platform: SocialPlatformSchema,
  trendingScore: z.number().min(0).max(100),
  mentionIncrease: z.number(),
  sentimentChange: z.number(),
  influencerActivity: z.boolean(),
  viralPotential: z.enum(['low', 'medium', 'high']),
  timestamp: z.date(),
});

// Social aggregation response schema
export const SocialAggregationResponseSchema = z.object({
  coinId: z.number(),
  aggregatedSentiment: z.number().min(-1).max(1),
  totalMentions24h: z.number(),
  totalFollowers: z.number(),
  averageTrendingScore: z.number(),
  platformBreakdown: z.array(z.object({
    platform: SocialPlatformSchema,
    sentiment: z.number(),
    mentions: z.number(),
    followers: z.number(),
    trendingScore: z.number(),
  })),
  timestamp: z.date(),
});

// Export types
export type SocialPlatform = z.infer<typeof SocialPlatformSchema>;
export type SocialMetricsInput = z.infer<typeof SocialMetricsInputSchema>;
export type SocialMetricsResponse = z.infer<typeof SocialMetricsResponseSchema>;
export type SocialMetricsQuery = z.infer<typeof SocialMetricsQuerySchema>;
export type SentimentAnalysisRequest = z.infer<typeof SentimentAnalysisRequestSchema>;
export type SentimentAnalysisResponse = z.infer<typeof SentimentAnalysisResponseSchema>;
export type SocialDataCollectionRequest = z.infer<typeof SocialDataCollectionRequestSchema>;
export type TrendingDetectionResponse = z.infer<typeof TrendingDetectionResponseSchema>;
export type SocialAggregationResponse = z.infer<typeof SocialAggregationResponseSchema>;