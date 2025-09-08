import { z } from 'zod';

export const PortfolioQuerySchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z
    .enum(['amount', 'currentValue', 'profitLoss', 'profitLossPercentage', 'createdAt'])
    .default('currentValue'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  coinId: z.number().positive().optional(),
});

export const CreatePortfolioSchema = z.object({
  coinId: z.number().positive(),
  amount: z.number().positive(),
  avgPrice: z.number().positive(),
});

export const UpdatePortfolioSchema = z.object({
  amount: z.number().positive().optional(),
  avgPrice: z.number().positive().optional(),
});

export const WalletIntegrationSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  networks: z.array(z.enum(['ethereum', 'bsc', 'polygon', 'solana'])).default(['ethereum']),
});

export const PortfolioAnalyticsQuerySchema = z.object({
  timeframe: z.enum(['24h', '7d', '30d', '90d', '1y']).default('30d'),
  includeHistorical: z.boolean().default(true),
});

export const PortfolioPerformanceQuerySchema = z.object({
  timeframe: z.enum(['1h', '24h', '7d', '30d', '90d', '1y']).default('24h'),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('1h'),
});

export type PortfolioQuery = z.infer<typeof PortfolioQuerySchema>;
export type CreatePortfolio = z.infer<typeof CreatePortfolioSchema>;
export type UpdatePortfolio = z.infer<typeof UpdatePortfolioSchema>;
export type WalletIntegration = z.infer<typeof WalletIntegrationSchema>;
export type PortfolioAnalyticsQuery = z.infer<typeof PortfolioAnalyticsQuerySchema>;
export type PortfolioPerformanceQuery = z.infer<typeof PortfolioPerformanceQuerySchema>;
