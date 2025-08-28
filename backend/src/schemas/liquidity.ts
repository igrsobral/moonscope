import { z } from 'zod';

// Liquidity pool query schema
export const LiquidityPoolQuerySchema = z.object({
  exchange: z.string().optional(),
  minLiquidity: z.coerce.number().positive().optional(),
  sortBy: z.enum(['liquidity', 'volume', 'fees', 'apr']).default('liquidity'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Liquidity analysis query schema
export const LiquidityAnalysisQuerySchema = z.object({});

// Liquidity trends query schema
export const LiquidityTrendsQuerySchema = z.object({
  timeframe: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
});

// Liquidity alert creation schema
export const CreateLiquidityAlertSchema = z.object({
  coinId: z.number().positive(),
  poolId: z.number().positive().optional(),
  type: z.enum([
    'liquidity_drop',
    'liquidity_spike',
    'volume_drop',
    'volume_spike',
    'price_impact_high',
    'pool_count_low',
    'liquidity_change'
  ]),
  condition: z.object({
    liquidityThreshold: z.number().positive().optional(),
    liquidityChangePercentage: z.number().min(-100).max(1000).optional(),
    volumeThreshold: z.number().positive().optional(),
    priceImpactThreshold: z.number().min(0).max(100).optional(),
    poolCountThreshold: z.number().positive().optional(),
  }),
  notificationMethods: z.array(z.enum(['email', 'push', 'sms'])).min(1),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

// Liquidity alert update schema
export const UpdateLiquidityAlertSchema = z.object({
  condition: z.object({
    liquidityThreshold: z.number().positive().optional(),
    liquidityChangePercentage: z.number().min(-100).max(1000).optional(),
    volumeThreshold: z.number().positive().optional(),
    priceImpactThreshold: z.number().min(0).max(100).optional(),
    poolCountThreshold: z.number().positive().optional(),
  }).optional(),
  notificationMethods: z.array(z.enum(['email', 'push', 'sms'])).min(1).optional(),
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

// Pool sync schema
export const SyncPoolsSchema = z.object({
  coinId: z.number().positive(),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address'),
  exchanges: z.array(z.enum(['uniswap-v2', 'sushiswap', 'pancakeswap'])).optional(),
});

// DEX pool search schema
export const DexPoolSearchSchema = z.object({
  query: z.string().min(1).max(100),
  exchange: z.enum(['uniswap-v2', 'sushiswap', 'pancakeswap']).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// Liquidity risk assessment schema
export const LiquidityRiskAssessmentSchema = z.object({
  coinId: z.number().positive(),
  includeHistorical: z.boolean().default(false),
  timeframe: z.enum(['24h', '7d', '30d']).default('24h'),
});

// Pool comparison schema
export const PoolComparisonSchema = z.object({
  poolIds: z.array(z.number().positive()).min(2).max(10),
  metrics: z.array(z.enum(['liquidity', 'volume', 'fees', 'apr', 'priceImpact'])).default(['liquidity', 'volume']),
});

// Liquidity monitoring schema
export const LiquidityMonitoringSchema = z.object({
  coinIds: z.array(z.number().positive()).min(1).max(50),
  interval: z.enum(['1m', '5m', '15m', '1h']).default('5m'),
  alertThresholds: z.object({
    liquidityDropPercentage: z.number().min(0).max(100).default(20),
    volumeDropPercentage: z.number().min(0).max(100).default(30),
    priceImpactThreshold: z.number().min(0).max(100).default(10),
  }).optional(),
});

// Parameter schemas
export const CoinIdParamsSchema = z.object({
  coinId: z.coerce.number().positive(),
});

export const PoolIdParamsSchema = z.object({
  poolId: z.coerce.number().positive(),
});

export const AlertIdParamsSchema = z.object({
  alertId: z.coerce.number().positive(),
});

export const TokenAddressParamsSchema = z.object({
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address'),
});

// Export types
export type LiquidityPoolQuery = z.infer<typeof LiquidityPoolQuerySchema>;
export type LiquidityAnalysisQuery = z.infer<typeof LiquidityAnalysisQuerySchema>;
export type LiquidityTrendsQuery = z.infer<typeof LiquidityTrendsQuerySchema>;
export type CreateLiquidityAlert = z.infer<typeof CreateLiquidityAlertSchema>;
export type UpdateLiquidityAlert = z.infer<typeof UpdateLiquidityAlertSchema>;
export type SyncPools = z.infer<typeof SyncPoolsSchema>;
export type DexPoolSearch = z.infer<typeof DexPoolSearchSchema>;
export type LiquidityRiskAssessment = z.infer<typeof LiquidityRiskAssessmentSchema>;
export type PoolComparison = z.infer<typeof PoolComparisonSchema>;
export type LiquidityMonitoring = z.infer<typeof LiquidityMonitoringSchema>;
export type CoinIdParams = z.infer<typeof CoinIdParamsSchema>;
export type PoolIdParams = z.infer<typeof PoolIdParamsSchema>;
export type AlertIdParams = z.infer<typeof AlertIdParamsSchema>;
export type TokenAddressParams = z.infer<typeof TokenAddressParamsSchema>;