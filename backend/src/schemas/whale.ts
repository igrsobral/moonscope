import { z } from 'zod';

// Whale transaction query schema
export const WhaleTransactionQuerySchema = z.object({
  coinId: z.number().int().positive(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  minUsdValue: z.number().positive().optional(),
});

// Whale analysis query schema
export const WhaleAnalysisQuerySchema = z.object({
  coinId: z.number().int().positive(),
  timeframe: z.enum(['1h', '24h', '7d']).default('24h'),
});

// Whale wallet query schema
export const WhaleWalletQuerySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format'),
});

// Top whale wallets query schema
export const TopWhaleWalletsQuerySchema = z.object({
  coinId: z.number().int().positive(),
  limit: z.number().int().min(1).max(50).default(20),
});

// Whale alert subscription schema
export const WhaleAlertSubscriptionSchema = z.object({
  coinId: z.number().int().positive(),
  minUsdValue: z.number().positive().default(10000),
  alertTypes: z
    .array(z.enum(['large_buy', 'large_sell', 'accumulation', 'distribution']))
    .default(['large_buy', 'large_sell']),
  notificationMethods: z.array(z.enum(['email', 'push', 'websocket'])).default(['websocket']),
});

// Whale movement impact analysis schema
export const WhaleImpactAnalysisSchema = z.object({
  coinId: z.number().int().positive(),
  transactionHash: z.string().min(1),
  timeWindowMinutes: z.number().int().min(5).max(1440).default(60), // 5 minutes to 24 hours
});

export type WhaleTransactionQuery = z.infer<typeof WhaleTransactionQuerySchema>;
export type WhaleAnalysisQuery = z.infer<typeof WhaleAnalysisQuerySchema>;
export type WhaleWalletQuery = z.infer<typeof WhaleWalletQuerySchema>;
export type TopWhaleWalletsQuery = z.infer<typeof TopWhaleWalletsQuerySchema>;
export type WhaleAlertSubscription = z.infer<typeof WhaleAlertSubscriptionSchema>;
export type WhaleImpactAnalysis = z.infer<typeof WhaleImpactAnalysisSchema>;
