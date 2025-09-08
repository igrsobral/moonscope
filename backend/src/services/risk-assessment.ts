import { PrismaClient, RiskAssessment } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
import { MoralisClient, MoralisChain } from './moralis-client.js';
import { CoinGeckoClient } from './coingecko-client.js';
import { CacheService } from './cache.js';
import {
  RiskFactors,
  LiquidityRisk,
  HolderDistributionRisk,
  ContractSecurityRisk,
  SocialMetricsRisk,
} from '../types/index.js';

export interface RiskAssessmentConfig {
  weights: {
    liquidity: number;
    holderDistribution: number;
    contractSecurity: number;
    socialMetrics: number;
  };
  thresholds: {
    liquidity: {
      excellent: number;
      good: number;
      fair: number;
      poor: number;
    };
    holderDistribution: {
      maxTopHoldersPercentage: number;
      minHolderCount: number;
    };
    contractSecurity: {
      verificationRequired: boolean;
      proxyContractPenalty: number;
      ownershipRenouncedBonus: number;
    };
    socialMetrics: {
      minSentimentScore: number;
      minCommunitySize: number;
    };
  };
}

export interface LiquidityData {
  totalLiquidity: number;
  dexLiquidity: Array<{
    exchange: string;
    pairAddress: string;
    liquidity: number;
    volume24h: number;
  }>;
  liquidityChange24h: number;
}

export interface HolderData {
  totalHolders: number;
  topHoldersPercentage: number;
  holderDistribution: Array<{
    address: string;
    balance: string;
    percentage: number;
  }>;
  contractHolders: number;
}

export interface ContractSecurityData {
  isVerified: boolean;
  hasProxyContract: boolean;
  hasOwnershipRenounced: boolean;
  hasMintFunction: boolean;
  hasBlacklistFunction: boolean;
  hasPauseFunction: boolean;
  maxSupply?: number;
  totalSupply: number;
  contractAge: number; // in days
}

export interface SocialData {
  sentimentScore: number;
  communitySize: number;
  mentions24h: number;
  influencerMentions: number;
  trendingScore: number;
}

export interface RiskAssessmentInput {
  coinId: number;
  contractAddress: string;
  network: string;
  forceRefresh?: boolean;
}

export interface RiskAssessmentResult {
  coinId: number;
  overallScore: number;
  factors: RiskFactors;
  timestamp: Date;
  confidence: number;
  warnings: string[];
}

export class RiskAssessmentService {
  private config: RiskAssessmentConfig;

  constructor(
    private prisma: PrismaClient,
    private logger: FastifyBaseLogger,
    private cacheService: CacheService,
    private moralisClient: MoralisClient,
    private _coinGeckoClient: CoinGeckoClient,
    config?: Partial<RiskAssessmentConfig>
  ) {
    // Default configuration with sensible weights and thresholds
    this.config = {
      weights: {
        liquidity: 0.35,
        holderDistribution: 0.25,
        contractSecurity: 0.25,
        socialMetrics: 0.15,
        ...config?.weights,
      },
      thresholds: {
        liquidity: {
          excellent: 10000000, // $10M+
          good: 1000000, // $1M+
          fair: 100000, // $100K+
          poor: 10000, // $10K+
        },
        holderDistribution: {
          maxTopHoldersPercentage: 50, // Top 10 holders should own <50%
          minHolderCount: 100,
        },
        contractSecurity: {
          verificationRequired: true,
          proxyContractPenalty: 20,
          ownershipRenouncedBonus: 15,
        },
        socialMetrics: {
          minSentimentScore: 0.3,
          minCommunitySize: 1000,
        },
        ...config?.thresholds,
      },
    };
  }

  /**
   * Perform comprehensive risk assessment for a coin
   */
  async assessRisk(input: RiskAssessmentInput): Promise<RiskAssessmentResult> {
    try {
      this.logger.info(
        { coinId: input.coinId, contractAddress: input.contractAddress },
        'Starting risk assessment'
      );

      // Check cache first unless force refresh is requested
      if (!input.forceRefresh) {
        const cacheKey = `risk:${input.coinId}`;
        const cached = await this.cacheService.get<RiskAssessmentResult>(cacheKey);

        if (cached) {
          this.logger.info({ coinId: input.coinId }, 'Retrieved risk assessment from cache');
          return cached;
        }
      }

      const warnings: string[] = [];
      let confidence = 100;

      // Gather data from multiple sources
      const [liquidityData, holderData, contractData, socialData] = await Promise.allSettled([
        this.analyzeLiquidity(input.contractAddress, input.network),
        this.analyzeHolderDistribution(input.contractAddress, input.network),
        this.analyzeContractSecurity(input.contractAddress, input.network),
        this.analyzeSocialMetrics(input.coinId),
      ]);

      // Calculate individual risk scores
      const liquidityRisk = this.calculateLiquidityRisk(
        liquidityData.status === 'fulfilled' ? liquidityData.value : null,
        warnings
      );

      const holderRisk = this.calculateHolderDistributionRisk(
        holderData.status === 'fulfilled' ? holderData.value : null,
        warnings
      );

      const contractRisk = this.calculateContractSecurityRisk(
        contractData.status === 'fulfilled' ? contractData.value : null,
        warnings
      );

      const socialRisk = this.calculateSocialMetricsRisk(
        socialData.status === 'fulfilled' ? socialData.value : null,
        warnings
      );

      // Adjust confidence based on failed data sources
      if (liquidityData.status === 'rejected') confidence -= 25;
      if (holderData.status === 'rejected') confidence -= 25;
      if (contractData.status === 'rejected') confidence -= 25;
      if (socialData.status === 'rejected') confidence -= 15;

      // Calculate weighted overall score
      const overallScore = Math.round(
        liquidityRisk.score * this.config.weights.liquidity +
          holderRisk.score * this.config.weights.holderDistribution +
          contractRisk.score * this.config.weights.contractSecurity +
          socialRisk.score * this.config.weights.socialMetrics
      );

      const factors: RiskFactors = {
        liquidity: liquidityRisk,
        holderDistribution: holderRisk,
        contractSecurity: contractRisk,
        socialMetrics: socialRisk,
      };

      const result: RiskAssessmentResult = {
        coinId: input.coinId,
        overallScore: Math.max(1, Math.min(100, overallScore)),
        factors,
        timestamp: new Date(),
        confidence: Math.max(0, confidence),
        warnings,
      };

      // Store in database
      await this.storeRiskAssessment(result);

      // Cache result for 15 minutes
      await this.cacheService.set(`risk:${input.coinId}`, result, { ttl: 900 });

      this.logger.info(
        {
          coinId: input.coinId,
          overallScore: result.overallScore,
          confidence: result.confidence,
          warningCount: warnings.length,
        },
        'Risk assessment completed'
      );

      return result;
    } catch (error) {
      this.logger.error({ error, coinId: input.coinId }, 'Failed to assess risk');
      throw error;
    }
  }

  /**
   * Analyze liquidity across multiple DEXs
   */
  private async analyzeLiquidity(contractAddress: string, network: string): Promise<LiquidityData> {
    try {
      const chain = this.networkToMoralisChain(network);

      // Get token transfers to identify DEX interactions
      const transfers = await this.moralisClient.getTokenTransfers(contractAddress, chain, {
        limit: 100,
        order: 'DESC',
      });

      // Analyze DEX liquidity (simplified - in production would integrate with DEX APIs)
      const dexAddresses = new Set<string>();
      let totalVolume24h = 0;

      transfers.result.forEach(transfer => {
        // Identify known DEX addresses (simplified)
        if (
          this.isKnownDexAddress(transfer.to_address) ||
          this.isKnownDexAddress(transfer.from_address)
        ) {
          dexAddresses.add(transfer.to_address);
          totalVolume24h += parseFloat(transfer.value) || 0;
        }
      });

      // Get current price data for liquidity calculation
      const tokenPrice = await this.moralisClient.getTokenPrice(contractAddress, chain);
      const totalLiquidity = totalVolume24h * (tokenPrice.usdPrice || 0);

      const liquidityData: LiquidityData = {
        totalLiquidity,
        dexLiquidity: Array.from(dexAddresses).map(address => ({
          exchange: this.identifyDexName(address),
          pairAddress: address,
          liquidity: totalLiquidity / dexAddresses.size, // Simplified distribution
          volume24h: totalVolume24h / dexAddresses.size,
        })),
        liquidityChange24h: 0, // Would need historical data
      };

      return liquidityData;
    } catch (error) {
      this.logger.error({ error, contractAddress, network }, 'Failed to analyze liquidity');
      throw error;
    }
  }

  /**
   * Analyze holder distribution from blockchain data
   */
  private async analyzeHolderDistribution(
    contractAddress: string,
    network: string
  ): Promise<HolderData> {
    try {
      const chain = this.networkToMoralisChain(network);

      // Get token holders
      const holders = await this.moralisClient.getTokenHolders(contractAddress, chain, {
        limit: 100,
        order: 'DESC',
      });

      const totalSupply = holders.result.reduce(
        (sum, holder) => sum + parseFloat(holder.balance_formatted),
        0
      );

      // Calculate top holders percentage (top 10)
      const topHolders = holders.result.slice(0, 10);
      const topHoldersBalance = topHolders.reduce(
        (sum, holder) => sum + parseFloat(holder.balance_formatted),
        0
      );
      const topHoldersPercentage = (topHoldersBalance / totalSupply) * 100;

      // Count contract holders (addresses that are contracts)
      let contractHolders = 0;
      // Note: In production, would need to check if addresses are contracts
      // This is simplified for the implementation

      const holderData: HolderData = {
        totalHolders: holders.result.length,
        topHoldersPercentage,
        holderDistribution: holders.result.slice(0, 20).map(holder => ({
          address: holder.address,
          balance: holder.balance_formatted,
          percentage: holder.percentage_relative_to_total_supply || 0,
        })),
        contractHolders,
      };

      return holderData;
    } catch (error) {
      this.logger.error(
        { error, contractAddress, network },
        'Failed to analyze holder distribution'
      );
      throw error;
    }
  }

  /**
   * Analyze contract security features
   */
  private async analyzeContractSecurity(
    contractAddress: string,
    network: string
  ): Promise<ContractSecurityData> {
    try {
      const chain = this.networkToMoralisChain(network);

      // Get token metadata
      const metadata = await this.moralisClient.getTokenMetadata(contractAddress, chain);
      const tokenInfo = metadata[0];

      if (!tokenInfo) {
        throw new Error('Token metadata not found');
      }

      // Basic contract analysis (simplified)
      const contractData: ContractSecurityData = {
        isVerified: tokenInfo.validated === 1,
        hasProxyContract: false, // Would need contract code analysis
        hasOwnershipRenounced: false, // Would need contract code analysis
        hasMintFunction: false, // Would need contract code analysis
        hasBlacklistFunction: false, // Would need contract code analysis
        hasPauseFunction: false, // Would need contract code analysis
        totalSupply: parseFloat(tokenInfo.decimals) || 0,
        contractAge: this.calculateContractAge(tokenInfo.created_at),
      };

      return contractData;
    } catch (error) {
      this.logger.error({ error, contractAddress, network }, 'Failed to analyze contract security');
      throw error;
    }
  }

  /**
   * Analyze social metrics from database
   */
  private async analyzeSocialMetrics(coinId: number): Promise<SocialData> {
    try {
      // Get latest social metrics from database
      const socialMetrics = await this.prisma.socialMetrics.findMany({
        where: { coinId },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });

      if (socialMetrics.length === 0) {
        throw new Error('No social metrics found');
      }

      const latest = socialMetrics[0];
      const avgSentiment =
        socialMetrics.reduce(
          (sum, metric) => sum + parseFloat(metric.sentimentScore.toString()),
          0
        ) / socialMetrics.length;

      const socialData: SocialData = {
        sentimentScore: avgSentiment,
        communitySize: latest?.followers || 0,
        mentions24h: latest?.mentions24h || 0,
        influencerMentions: latest?.influencerMentions || 0,
        trendingScore: latest ? parseFloat(latest.trendingScore.toString()) : 0,
      };

      return socialData;
    } catch (error) {
      this.logger.error({ error, coinId }, 'Failed to analyze social metrics');
      throw error;
    }
  }

  /**
   * Calculate liquidity risk score
   */
  private calculateLiquidityRisk(data: LiquidityData | null, warnings: string[]): LiquidityRisk {
    if (!data) {
      warnings.push('Liquidity data unavailable');
      return {
        score: 20, // Low score for missing data
        value: 0,
        threshold: this.config.thresholds.liquidity.fair,
      };
    }

    let score = 0;
    const { totalLiquidity } = data;
    const thresholds = this.config.thresholds.liquidity;

    if (totalLiquidity >= thresholds.excellent) {
      score = 90;
    } else if (totalLiquidity >= thresholds.good) {
      score = 75;
    } else if (totalLiquidity >= thresholds.fair) {
      score = 50;
    } else if (totalLiquidity >= thresholds.poor) {
      score = 25;
    } else {
      score = 10;
      warnings.push('Very low liquidity detected');
    }

    // Bonus for multiple DEX listings
    if (data.dexLiquidity.length > 3) {
      score += 5;
    }

    // Penalty for concentrated liquidity
    const maxDexLiquidity = Math.max(...data.dexLiquidity.map(dex => dex.liquidity));
    if (maxDexLiquidity > totalLiquidity * 0.8) {
      score -= 10;
      warnings.push('Liquidity concentrated in single DEX');
    }

    return {
      score: Math.max(1, Math.min(100, score)),
      value: totalLiquidity,
      threshold: thresholds.fair,
    };
  }

  /**
   * Calculate holder distribution risk score
   */
  private calculateHolderDistributionRisk(
    data: HolderData | null,
    warnings: string[]
  ): HolderDistributionRisk {
    if (!data) {
      warnings.push('Holder distribution data unavailable');
      return {
        score: 20,
        topHoldersPercentage: 100,
        holderCount: 0,
      };
    }

    let score = 50; // Base score
    const thresholds = this.config.thresholds.holderDistribution;

    // Score based on top holders concentration
    if (data.topHoldersPercentage <= 20) {
      score += 30;
    } else if (data.topHoldersPercentage <= 35) {
      score += 15;
    } else if (data.topHoldersPercentage <= 50) {
      score += 5;
    } else {
      score -= 20;
      warnings.push('High concentration among top holders');
    }

    // Score based on total holder count
    if (data.totalHolders >= 10000) {
      score += 20;
    } else if (data.totalHolders >= 1000) {
      score += 10;
    } else if (data.totalHolders >= thresholds.minHolderCount) {
      score += 5;
    } else {
      score -= 15;
      warnings.push('Low number of token holders');
    }

    // Penalty for high contract holder ratio
    const contractRatio = data.contractHolders / data.totalHolders;
    if (contractRatio > 0.3) {
      score -= 10;
      warnings.push('High ratio of contract holders');
    }

    return {
      score: Math.max(1, Math.min(100, score)),
      topHoldersPercentage: data.topHoldersPercentage,
      holderCount: data.totalHolders,
    };
  }

  /**
   * Calculate contract security risk score
   */
  private calculateContractSecurityRisk(
    data: ContractSecurityData | null,
    warnings: string[]
  ): ContractSecurityRisk {
    if (!data) {
      warnings.push('Contract security data unavailable');
      return {
        score: 20,
        isVerified: false,
        hasProxyContract: false,
        hasOwnershipRenounced: false,
      };
    }

    let score = 30; // Base score
    const thresholds = this.config.thresholds.contractSecurity;

    // Verification bonus
    if (data.isVerified) {
      score += 25;
    } else if (thresholds.verificationRequired) {
      score -= 20;
      warnings.push('Contract not verified');
    }

    // Ownership renounced bonus
    if (data.hasOwnershipRenounced) {
      score += thresholds.ownershipRenouncedBonus;
    }

    // Proxy contract penalty
    if (data.hasProxyContract) {
      score -= thresholds.proxyContractPenalty;
      warnings.push('Proxy contract detected');
    }

    // Dangerous functions penalties
    if (data.hasMintFunction) {
      score -= 15;
      warnings.push('Mint function present');
    }

    if (data.hasBlacklistFunction) {
      score -= 20;
      warnings.push('Blacklist function present');
    }

    if (data.hasPauseFunction) {
      score -= 10;
      warnings.push('Pause function present');
    }

    // Contract age bonus
    if (data.contractAge > 365) {
      score += 10;
    } else if (data.contractAge < 30) {
      score -= 10;
      warnings.push('Very new contract');
    }

    return {
      score: Math.max(1, Math.min(100, score)),
      isVerified: data.isVerified,
      hasProxyContract: data.hasProxyContract,
      hasOwnershipRenounced: data.hasOwnershipRenounced,
    };
  }

  /**
   * Calculate social metrics risk score
   */
  private calculateSocialMetricsRisk(
    data: SocialData | null,
    warnings: string[]
  ): SocialMetricsRisk {
    if (!data) {
      warnings.push('Social metrics data unavailable');
      return {
        score: 50, // Neutral score for missing data
        sentimentScore: 0,
        communitySize: 0,
      };
    }

    let score = 40; // Base score
    const thresholds = this.config.thresholds.socialMetrics;

    // Sentiment score impact
    if (data.sentimentScore >= 0.7) {
      score += 25;
    } else if (data.sentimentScore >= 0.5) {
      score += 15;
    } else if (data.sentimentScore >= thresholds.minSentimentScore) {
      score += 5;
    } else {
      score -= 10;
      warnings.push('Negative social sentiment');
    }

    // Community size impact
    if (data.communitySize >= 100000) {
      score += 20;
    } else if (data.communitySize >= 10000) {
      score += 15;
    } else if (data.communitySize >= thresholds.minCommunitySize) {
      score += 10;
    } else {
      score -= 5;
      warnings.push('Small community size');
    }

    // Trending bonus
    if (data.trendingScore > 80) {
      score += 15;
    } else if (data.trendingScore > 60) {
      score += 10;
    }

    // Influencer mentions bonus
    if (data.influencerMentions > 10) {
      score += 10;
    } else if (data.influencerMentions > 5) {
      score += 5;
    }

    return {
      score: Math.max(1, Math.min(100, score)),
      sentimentScore: data.sentimentScore,
      communitySize: data.communitySize,
    };
  }

  /**
   * Store risk assessment in database
   */
  private async storeRiskAssessment(result: RiskAssessmentResult): Promise<void> {
    try {
      await this.prisma.riskAssessment.create({
        data: {
          coinId: result.coinId,
          overallScore: result.overallScore,
          liquidityScore: result.factors.liquidity.score,
          holderDistributionScore: result.factors.holderDistribution.score,
          contractSecurityScore: result.factors.contractSecurity.score,
          socialScore: result.factors.socialMetrics.score,
          factors: result.factors as any,
          timestamp: result.timestamp,
        },
      });

      this.logger.info({ coinId: result.coinId }, 'Risk assessment stored in database');
    } catch (error) {
      this.logger.error({ error, coinId: result.coinId }, 'Failed to store risk assessment');
      throw error;
    }
  }

  /**
   * Get historical risk assessments for a coin
   */
  async getRiskHistory(coinId: number, limit: number = 30): Promise<RiskAssessment[]> {
    try {
      return await this.prisma.riskAssessment.findMany({
        where: { coinId },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
    } catch (error) {
      this.logger.error({ error, coinId }, 'Failed to get risk history');
      throw error;
    }
  }

  /**
   * Update risk assessment configuration
   */
  updateConfig(newConfig: Partial<RiskAssessmentConfig>): void {
    this.config = {
      weights: { ...this.config.weights, ...newConfig.weights },
      thresholds: { ...this.config.thresholds, ...newConfig.thresholds },
    };

    this.logger.info({ config: this.config }, 'Risk assessment configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): RiskAssessmentConfig {
    return { ...this.config };
  }

  // Helper methods

  private networkToMoralisChain(network: string): MoralisChain {
    const mapping: Record<string, MoralisChain> = {
      ethereum: 'eth',
      bsc: 'bsc',
      polygon: 'polygon',
      solana: 'eth', // Fallback to eth for unsupported networks
    };
    return mapping[network] || 'eth';
  }

  private isKnownDexAddress(address: string): boolean {
    // Known DEX router addresses (simplified)
    const knownDexes = [
      '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2
      '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3
      '0x10ed43c718714eb63d5aa57b78b54704e256024e', // PancakeSwap
      '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff', // QuickSwap
    ];
    return knownDexes.includes(address.toLowerCase());
  }

  private identifyDexName(address: string): string {
    const dexMapping: Record<string, string> = {
      '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2',
      '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3',
      '0x10ed43c718714eb63d5aa57b78b54704e256024e': 'PancakeSwap',
      '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff': 'QuickSwap',
    };
    return dexMapping[address.toLowerCase()] || 'Unknown DEX';
  }

  private calculateContractAge(createdAt: string): number {
    const createdDate = new Date(createdAt);
    const now = new Date();
    return Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
  }
}
