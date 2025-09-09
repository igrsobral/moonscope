// Core type definitions for the frontend application

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    pagination?: PaginationMeta;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface User {
  id: number;
  walletAddress: string;
  email?: string;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  notifications: NotificationPreferences;
  defaultCurrency: string;
  theme: 'light' | 'dark';
  riskTolerance: 'low' | 'medium' | 'high';
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  priceAlerts: boolean;
  whaleMovements: boolean;
  socialSpikes: boolean;
}

export interface Coin {
  id: number;
  address: string;
  symbol: string;
  name: string;
  network: 'ethereum' | 'bsc' | 'polygon' | 'solana';
  contractVerified: boolean;
  logoUrl?: string;
  description?: string;
  website?: string;
  socialLinks: SocialLinks;
  price?: PriceData;
  risk?: RiskAssessment;
  social?: SocialMetrics[];
  createdAt: string;
  updatedAt: string;
}

export interface SocialLinks {
  twitter?: string;
  telegram?: string;
  discord?: string;
}

export interface PriceData {
  id: number;
  coinId: number;
  price: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  priceChange24h: number;
  volumeChange24h: number;
  timestamp: string;
}

export interface RiskAssessment {
  id: number;
  coinId: number;
  overallScore: number;
  factors: RiskFactors;
  timestamp: string;
}

export interface RiskFactors {
  liquidity: LiquidityRisk;
  holderDistribution: HolderDistributionRisk;
  contractSecurity: ContractSecurityRisk;
  socialMetrics: SocialMetricsRisk;
}

export interface LiquidityRisk {
  score: number;
  value: number;
  threshold: number;
}

export interface HolderDistributionRisk {
  score: number;
  topHoldersPercentage: number;
  holderCount: number;
}

export interface ContractSecurityRisk {
  score: number;
  isVerified: boolean;
  hasProxyContract: boolean;
  hasOwnershipRenounced: boolean;
}

export interface SocialMetricsRisk {
  score: number;
  sentimentScore: number;
  communitySize: number;
}

export interface SocialMetrics {
  id: number;
  coinId: number;
  platform: 'twitter' | 'reddit' | 'telegram';
  followers: number;
  mentions24h: number;
  sentimentScore: number;
  trendingScore: number;
  influencerMentions: number;
  timestamp: string;
}

export interface Portfolio {
  id: number;
  userId: number;
  coinId: number;
  coin?: Coin;
  amount: number;
  avgPrice: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: number;
  userId: number;
  coinId: number;
  coin?: Coin;
  type: 'price_above' | 'price_below' | 'volume_spike' | 'whale_movement' | 'social_spike';
  condition: AlertCondition;
  notificationMethods: ('email' | 'push' | 'sms')[];
  isActive: boolean;
  name?: string;
  description?: string;
  lastTriggered?: string;
  createdAt: string;
}

export interface AlertCondition {
  targetPrice?: number;
  percentageChange?: number;
  volumeThreshold?: number;
  socialThreshold?: number;
}

export interface WhaleTransaction {
  id: number;
  coinId: number;
  coin?: Coin;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  usdValue: number;
  timestamp: string;
}

export interface WebSocketEvent {
  type: 'price_update' | 'alert_triggered' | 'whale_movement' | 'social_spike';
  data: unknown;
  timestamp: string;
  coinId?: string;
  userId?: string;
}

export interface CoinQuery {
  page?: number;
  limit?: number;
  sortBy?: 'price' | 'marketCap' | 'volume' | 'riskScore';
  sortOrder?: 'asc' | 'desc';
  network?: 'ethereum' | 'bsc' | 'polygon' | 'solana';
  minMarketCap?: number;
  maxRiskScore?: number;
  search?: string;
}

export interface ChartDataPoint {
  timestamp: string;
  price: number;
  volume?: number;
  marketCap?: number;
}

export interface TrendingCoin {
  coin: Coin;
  trendingScore: number;
  priceChange24h: number;
  volumeChange24h: number;
  socialMentions: number;
}

// Analytics specific types
export interface MarketOverviewData {
  totalMarketCap: number;
  totalVolume24h: number;
  activeCoins: number;
  marketCapChange24h: number;
  volumeChange24h: number;
  topGainers: TrendingCoin[];
  topLosers: TrendingCoin[];
  mostActive: TrendingCoin[];
}

export interface WhaleMovementData {
  recentTransactions: WhaleTransaction[];
  topWhales: {
    address: string;
    totalValue: number;
    transactionCount: number;
    coins: string[];
  }[];
  marketImpact: {
    priceImpactTransactions: WhaleTransaction[];
    totalImpactValue: number;
  };
  statistics: {
    totalTransactions24h: number;
    totalValue24h: number;
    averageTransactionSize: number;
    uniqueWhales: number;
  };
}

export interface LiquidityData {
  overview: {
    totalLiquidity: number;
    liquidityChange24h: number;
    averageLiquidity: number;
    lowLiquidityCoins: number;
  };
  chartData: {
    timestamp: string;
    totalLiquidity: number;
    averageLiquidity: number;
    coinCount: number;
  }[];
  topPools: {
    coinId: number;
    coinSymbol: string;
    coinName: string;
    dex: string;
    liquidity: number;
    volume24h: number;
    apy: number;
    riskScore: number;
  }[];
  liquidityDistribution: {
    range: string;
    count: number;
    percentage: number;
  }[];
  riskAnalysis: {
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
}

export interface CorrelationData {
  correlationMatrix: {
    coinA: string;
    coinB: string;
    correlation: number;
    significance: number;
  }[];
  topCorrelations: {
    positive: {
      coinA: string;
      coinB: string;
      correlation: number;
      priceChangeA: number;
      priceChangeB: number;
    }[];
    negative: {
      coinA: string;
      coinB: string;
      correlation: number;
      priceChangeA: number;
      priceChangeB: number;
    }[];
  };
  marketSegments: {
    segment: string;
    coins: string[];
    avgCorrelation: number;
    performance24h: number;
  }[];
  statistics: {
    avgCorrelation: number;
    strongCorrelations: number;
    weakCorrelations: number;
    negativeCorrelations: number;
  };
}

export interface SentimentData {
  overview: {
    overallSentiment: number;
    sentimentChange24h: number;
    totalMentions24h: number;
    mentionsChange24h: number;
    influencerMentions: number;
    trendingCoins: number;
  };
  sentimentTrends: {
    timestamp: string;
    sentiment: number;
    mentions: number;
    positiveRatio: number;
    negativeRatio: number;
  }[];
  platformBreakdown: {
    platform: 'twitter' | 'reddit' | 'telegram';
    sentiment: number;
    mentions: number;
    engagement: number;
    topHashtags: string[];
  }[];
  topSentimentCoins: {
    positive: {
      coinSymbol: string;
      coinName: string;
      sentiment: number;
      mentions: number;
      priceChange24h: number;
    }[];
    negative: {
      coinSymbol: string;
      coinName: string;
      sentiment: number;
      mentions: number;
      priceChange24h: number;
    }[];
  };
  sentimentDistribution: {
    range: string;
    count: number;
    percentage: number;
  }[];
  keywordAnalysis: {
    bullish: { keyword: string; count: number; sentiment: number }[];
    bearish: { keyword: string; count: number; sentiment: number }[];
  };
}
