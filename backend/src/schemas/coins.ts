import { z } from 'zod';

// Network enum schema
export const NetworkSchema = z.enum(['ethereum', 'bsc', 'polygon', 'solana']);

// Coin query parameters schema
export const CoinQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['price', 'marketCap', 'volume', 'riskScore', 'name', 'symbol']).default('marketCap'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  network: NetworkSchema.optional(),
  minMarketCap: z.coerce.number().positive().optional(),
  maxRiskScore: z.coerce.number().min(1).max(100).optional(),
  search: z.string().min(1).max(100).optional(),
});

// Coin creation schema
export const CreateCoinSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address'),
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  network: NetworkSchema,
  contractVerified: z.boolean().default(false),
  logoUrl: z.string().url().optional(),
  description: z.string().max(1000).optional(),
  website: z.string().url().optional(),
  socialLinks: z.object({
    twitter: z.string().url().optional(),
    telegram: z.string().url().optional(),
    discord: z.string().url().optional(),
  }).default({}),
});

// Coin update schema
export const UpdateCoinSchema = CreateCoinSchema.partial().omit({ address: true });

// Price data creation schema
export const CreatePriceDataSchema = z.object({
  coinId: z.number().positive(),
  price: z.number().positive(),
  marketCap: z.number().nonnegative(),
  volume24h: z.number().nonnegative(),
  liquidity: z.number().nonnegative(),
  priceChange24h: z.number(),
  volumeChange24h: z.number(),
});

// Coin detail params schema
export const CoinParamsSchema = z.object({
  id: z.coerce.number().positive(),
});

// Coin address params schema
export const CoinAddressParamsSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address'),
});

// Price history query schema
export const PriceHistoryQuerySchema = z.object({
  timeframe: z.enum(['1h', '24h', '7d', '30d', '90d', '1y']).default('24h'),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).optional(),
});

// Export types
export type NetworkType = z.infer<typeof NetworkSchema>;
export type CoinQuery = z.infer<typeof CoinQuerySchema>;
export type CreateCoin = z.infer<typeof CreateCoinSchema>;
export type UpdateCoin = z.infer<typeof UpdateCoinSchema>;
export type CreatePriceData = z.infer<typeof CreatePriceDataSchema>;
export type CoinParams = z.infer<typeof CoinParamsSchema>;
export type CoinAddressParams = z.infer<typeof CoinAddressParamsSchema>;
export type PriceHistoryQuery = z.infer<typeof PriceHistoryQuerySchema>;