import { z } from 'zod';

// Risk assessment input schema
export const RiskAssessmentInputSchema = z.object({
  coinId: z.number().positive(),
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address'),
  network: z.enum(['ethereum', 'bsc', 'polygon', 'solana']),
  forceRefresh: z.boolean().optional().default(false),
});

// Risk assessment configuration schema
export const RiskAssessmentConfigSchema = z.object({
  weights: z
    .object({
      liquidity: z.number().min(0).max(1),
      holderDistribution: z.number().min(0).max(1),
      contractSecurity: z.number().min(0).max(1),
      socialMetrics: z.number().min(0).max(1),
    })
    .refine(
      weights => {
        const sum =
          weights.liquidity +
          weights.holderDistribution +
          weights.contractSecurity +
          weights.socialMetrics;
        return Math.abs(sum - 1) < 0.001; // Allow for floating point precision
      },
      {
        message: 'Weights must sum to 1.0',
      }
    ),
  thresholds: z.object({
    liquidity: z
      .object({
        excellent: z.number().positive(),
        good: z.number().positive(),
        fair: z.number().positive(),
        poor: z.number().positive(),
      })
      .refine(
        thresholds => {
          return (
            thresholds.excellent > thresholds.good &&
            thresholds.good > thresholds.fair &&
            thresholds.fair > thresholds.poor
          );
        },
        {
          message: 'Liquidity thresholds must be in descending order',
        }
      ),
    holderDistribution: z.object({
      maxTopHoldersPercentage: z.number().min(0).max(100),
      minHolderCount: z.number().positive(),
    }),
    contractSecurity: z.object({
      verificationRequired: z.boolean(),
      proxyContractPenalty: z.number().min(0).max(100),
      ownershipRenouncedBonus: z.number().min(0).max(100),
    }),
    socialMetrics: z.object({
      minSentimentScore: z.number().min(-1).max(1),
      minCommunitySize: z.number().nonnegative(),
    }),
  }),
});

// Risk history query schema
export const RiskHistoryQuerySchema = z.object({
  coinId: z.coerce.number().positive(),
  limit: z.coerce.number().min(1).max(100).default(30),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

// Risk factor schema
export const RiskFactorSchema = z.object({
  score: z.number().min(1).max(100),
});

// Liquidity risk schema
export const LiquidityRiskSchema = RiskFactorSchema.extend({
  value: z.number().nonnegative(),
  threshold: z.number().positive(),
});

// Holder distribution risk schema
export const HolderDistributionRiskSchema = RiskFactorSchema.extend({
  topHoldersPercentage: z.number().min(0).max(100),
  holderCount: z.number().nonnegative(),
});

// Contract security risk schema
export const ContractSecurityRiskSchema = RiskFactorSchema.extend({
  isVerified: z.boolean(),
  hasProxyContract: z.boolean(),
  hasOwnershipRenounced: z.boolean(),
});

// Social metrics risk schema
export const SocialMetricsRiskSchema = RiskFactorSchema.extend({
  sentimentScore: z.number().min(-1).max(1),
  communitySize: z.number().nonnegative(),
});

// Risk factors schema
export const RiskFactorsSchema = z.object({
  liquidity: LiquidityRiskSchema,
  holderDistribution: HolderDistributionRiskSchema,
  contractSecurity: ContractSecurityRiskSchema,
  socialMetrics: SocialMetricsRiskSchema,
});

// Risk assessment result schema
export const RiskAssessmentResultSchema = z.object({
  coinId: z.number().positive(),
  overallScore: z.number().min(1).max(100),
  factors: RiskFactorsSchema,
  timestamp: z.date(),
  confidence: z.number().min(0).max(100),
  warnings: z.array(z.string()),
});

// Bulk risk assessment schema
export const BulkRiskAssessmentSchema = z.object({
  coins: z.array(RiskAssessmentInputSchema).min(1).max(50),
  forceRefresh: z.boolean().optional().default(false),
});

// Risk comparison schema
export const RiskComparisonSchema = z.object({
  coinIds: z.array(z.number().positive()).min(2).max(10),
  metrics: z
    .array(
      z.enum(['overall', 'liquidity', 'holderDistribution', 'contractSecurity', 'socialMetrics'])
    )
    .optional(),
});

// Risk alert threshold schema
export const RiskAlertThresholdSchema = z.object({
  coinId: z.number().positive(),
  thresholds: z.object({
    overallScore: z
      .object({
        min: z.number().min(1).max(100).optional(),
        max: z.number().min(1).max(100).optional(),
      })
      .optional(),
    liquidityScore: z
      .object({
        min: z.number().min(1).max(100).optional(),
        max: z.number().min(1).max(100).optional(),
      })
      .optional(),
    holderDistributionScore: z
      .object({
        min: z.number().min(1).max(100).optional(),
        max: z.number().min(1).max(100).optional(),
      })
      .optional(),
    contractSecurityScore: z
      .object({
        min: z.number().min(1).max(100).optional(),
        max: z.number().min(1).max(100).optional(),
      })
      .optional(),
    socialScore: z
      .object({
        min: z.number().min(1).max(100).optional(),
        max: z.number().min(1).max(100).optional(),
      })
      .optional(),
  }),
  notificationMethods: z.array(z.enum(['email', 'push', 'sms'])).min(1),
});

// Export types
export type RiskAssessmentInput = z.infer<typeof RiskAssessmentInputSchema>;
export type RiskAssessmentConfig = z.infer<typeof RiskAssessmentConfigSchema>;
export type RiskHistoryQuery = z.infer<typeof RiskHistoryQuerySchema>;
export type RiskFactor = z.infer<typeof RiskFactorSchema>;
export type LiquidityRisk = z.infer<typeof LiquidityRiskSchema>;
export type HolderDistributionRisk = z.infer<typeof HolderDistributionRiskSchema>;
export type ContractSecurityRisk = z.infer<typeof ContractSecurityRiskSchema>;
export type SocialMetricsRisk = z.infer<typeof SocialMetricsRiskSchema>;
export type RiskFactors = z.infer<typeof RiskFactorsSchema>;
export type RiskAssessmentResult = z.infer<typeof RiskAssessmentResultSchema>;
export type BulkRiskAssessment = z.infer<typeof BulkRiskAssessmentSchema>;
export type RiskComparison = z.infer<typeof RiskComparisonSchema>;
export type RiskAlertThreshold = z.infer<typeof RiskAlertThresholdSchema>;
