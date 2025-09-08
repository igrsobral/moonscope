// Core type definitions for the backend application

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
  walletAddress?: string;
  email: string;
  password: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
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
  timestamp: Date;
}

export interface RiskAssessment {
  id: number;
  coinId: number;
  overallScore: number;
  factors: RiskFactors;
  timestamp: Date;
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
  timestamp: Date;
}

export interface Portfolio {
  id: number;
  userId: number;
  coinId: number;
  amount: number;
  avgPrice: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Alert {
  id: number;
  userId: number;
  coinId: number;
  type: 'price_above' | 'price_below' | 'volume_spike' | 'whale_movement' | 'social_spike';
  condition: AlertCondition;
  notificationMethods: ('email' | 'push' | 'sms')[];
  isActive: boolean;
  lastTriggered?: Date;
  createdAt: Date;
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
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  usdValue: number;
  timestamp: Date;
}

export interface WebSocketEvent {
  type:
    | 'price_update'
    | 'alert_triggered'
    | 'whale_movement'
    | 'social_spike'
    | 'portfolio_update'
    | 'portfolio_value_update'
    | 'wallet_integration_complete'
    | 'alert_created'
    | 'alert_updated'
    | 'alert_deleted'
    | 'alert_action_performed';
  data: unknown;
  timestamp: string;
  coinId?: string;
  userId?: string;
}
