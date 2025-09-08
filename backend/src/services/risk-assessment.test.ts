import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
import { RiskAssessmentService, RiskAssessmentConfig } from './risk-assessment.js';
import { MoralisClient } from './moralis-client.js';
import { CoinGeckoClient } from './coingecko-client.js';
import { CacheService } from './cache.js';

describe('RiskAssessmentService', () => {
  let service: RiskAssessmentService;
  let mockPrisma: any;
  let mockLogger: any;
  let mockCacheService: any;
  let mockMoralisClient: any;
  let mockCoinGeckoClient: any;

  const defaultConfig: RiskAssessmentConfig = {
    weights: {
      liquidity: 0.35,
      holderDistribution: 0.25,
      contractSecurity: 0.25,
      socialMetrics: 0.15,
    },
    thresholds: {
      liquidity: {
        excellent: 10000000,
        good: 1000000,
        fair: 100000,
        poor: 10000,
      },
      holderDistribution: {
        maxTopHoldersPercentage: 50,
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
    },
  };

  beforeEach(() => {
    // Mock Prisma
    mockPrisma = {
      socialMetrics: {
        findMany: vi.fn(),
      },
      riskAssessment: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
    };

    // Mock Logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    // Mock Cache Service
    mockCacheService = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };

    // Mock Moralis Client
    mockMoralisClient = {
      getTokenTransfers: vi.fn(),
      getTokenPrice: vi.fn(),
      getTokenHolders: vi.fn(),
      getTokenMetadata: vi.fn(),
    };

    // Mock CoinGecko Client
    mockCoinGeckoClient = {
      getCoinsMarkets: vi.fn(),
      getCoinById: vi.fn(),
    };

    service = new RiskAssessmentService(
      mockPrisma,
      mockLogger,
      mockCacheService,
      mockMoralisClient,
      mockCoinGeckoClient,
      defaultConfig
    );
  });

  describe('assessRisk', () => {
    const mockInput = {
      coinId: 1,
      contractAddress: '0x1234567890123456789012345678901234567890',
      network: 'ethereum',
    };

    it('should return cached result when available', async () => {
      const cachedResult = {
        coinId: 1,
        overallScore: 75,
        factors: {
          liquidity: { score: 80, value: 5000000, threshold: 100000 },
          holderDistribution: { score: 70, topHoldersPercentage: 30, holderCount: 5000 },
          contractSecurity: {
            score: 85,
            isVerified: true,
            hasProxyContract: false,
            hasOwnershipRenounced: true,
          },
          socialMetrics: { score: 60, sentimentScore: 0.6, communitySize: 10000 },
        },
        timestamp: new Date(),
        confidence: 95,
        warnings: [],
      };

      mockCacheService.get.mockResolvedValue(cachedResult);

      const result = await service.assessRisk(mockInput);

      expect(result).toEqual(cachedResult);
      expect(mockCacheService.get).toHaveBeenCalledWith('risk:1');
      expect(mockLogger.info).toHaveBeenCalledWith(
        { coinId: 1 },
        'Retrieved risk assessment from cache'
      );
    });

    it('should perform full assessment when cache miss', async () => {
      mockCacheService.get.mockResolvedValue(null);

      // Mock Moralis responses
      mockMoralisClient.getTokenTransfers.mockResolvedValue({
        result: [
          {
            transaction_hash: '0xabc',
            address: '0x1234567890123456789012345678901234567890',
            block_timestamp: '2024-01-01T00:00:00Z',
            block_number: '12345',
            block_hash: '0xdef',
            to_address: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2
            from_address: '0x1111111111111111111111111111111111111111',
            value: '1000000000000000000',
            transaction_index: '1',
            log_index: '1',
            possible_spam: false,
            verified_contract: true,
          },
        ],
      });

      mockMoralisClient.getTokenPrice.mockResolvedValue({
        tokenName: 'Test Token',
        tokenSymbol: 'TEST',
        tokenLogo: '',
        tokenDecimals: '18',
        nativePrice: {
          value: '1000000000000000000',
          decimals: 18,
          name: 'Ethereum',
          symbol: 'ETH',
        },
        usdPrice: 1.5,
        usdPriceFormatted: '1.50',
      });

      mockMoralisClient.getTokenHolders.mockResolvedValue({
        result: [
          {
            address: '0x1111111111111111111111111111111111111111',
            balance_formatted: '1000000',
            percentage_relative_to_total_supply: 10,
          },
          {
            address: '0x2222222222222222222222222222222222222222',
            balance_formatted: '800000',
            percentage_relative_to_total_supply: 8,
          },
          {
            address: '0x3333333333333333333333333333333333333333',
            balance_formatted: '600000',
            percentage_relative_to_total_supply: 6,
          },
        ],
      });

      mockMoralisClient.getTokenMetadata.mockResolvedValue([
        {
          address: '0x1234567890123456789012345678901234567890',
          name: 'Test Token',
          symbol: 'TEST',
          decimals: '18',
          validated: 1,
          created_at: '2023-01-01T00:00:00Z',
        },
      ]);

      // Mock Prisma responses
      mockPrisma.socialMetrics.findMany.mockResolvedValue([
        {
          id: 1,
          coinId: 1,
          platform: 'twitter',
          followers: 15000,
          mentions24h: 100,
          sentimentScore: 0.7 as any,
          trendingScore: 75 as any,
          influencerMentions: 5,
          timestamp: new Date(),
        },
      ]);

      mockPrisma.riskAssessment.create.mockResolvedValue({
        id: 1,
        coinId: 1,
        overallScore: 75,
        liquidityScore: 80,
        holderDistributionScore: 70,
        contractSecurityScore: 85,
        socialScore: 60,
        factors: {},
        timestamp: new Date(),
      });

      const result = await service.assessRisk(mockInput);

      expect(result.coinId).toBe(1);
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.factors).toBeDefined();
      expect(result.factors.liquidity).toBeDefined();
      expect(result.factors.holderDistribution).toBeDefined();
      expect(result.factors.contractSecurity).toBeDefined();
      expect(result.factors.socialMetrics).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.warnings).toBeInstanceOf(Array);

      expect(mockCacheService.set).toHaveBeenCalledWith('risk:1', result, { ttl: 900 });
      expect(mockPrisma.riskAssessment.create).toHaveBeenCalled();
    });

    it('should handle force refresh by skipping cache', async () => {
      const inputWithForceRefresh = { ...mockInput, forceRefresh: true };

      // Setup minimal mocks to avoid errors
      mockMoralisClient.getTokenTransfers.mockResolvedValue({ result: [] });
      mockMoralisClient.getTokenPrice.mockResolvedValue({
        tokenName: 'Test',
        tokenSymbol: 'TEST',
        tokenLogo: '',
        tokenDecimals: '18',
        nativePrice: { value: '0', decimals: 18, name: 'ETH', symbol: 'ETH' },
        usdPrice: 0,
        usdPriceFormatted: '0',
      });
      mockMoralisClient.getTokenHolders.mockResolvedValue({ result: [] });
      mockMoralisClient.getTokenMetadata.mockResolvedValue([]);
      mockPrisma.socialMetrics.findMany.mockResolvedValue([]);
      mockPrisma.riskAssessment.create.mockResolvedValue({
        id: 1,
        coinId: 1,
        overallScore: 20,
        liquidityScore: 20,
        holderDistributionScore: 20,
        contractSecurityScore: 20,
        socialScore: 50,
        factors: {},
        timestamp: new Date(),
      });

      await service.assessRisk(inputWithForceRefresh);

      expect(mockCacheService.get).not.toHaveBeenCalled();
    });

    it('should handle API failures gracefully', async () => {
      mockCacheService.get.mockResolvedValue(null);

      // Mock all external API calls to fail
      mockMoralisClient.getTokenTransfers.mockRejectedValue(new Error('API Error'));
      mockMoralisClient.getTokenHolders.mockRejectedValue(new Error('API Error'));
      mockMoralisClient.getTokenMetadata.mockRejectedValue(new Error('API Error'));
      mockPrisma.socialMetrics.findMany.mockRejectedValue(new Error('DB Error'));

      mockPrisma.riskAssessment.create.mockResolvedValue({
        id: 1,
        coinId: 1,
        overallScore: 20,
        liquidityScore: 20,
        holderDistributionScore: 20,
        contractSecurityScore: 20,
        socialScore: 50,
        factors: {},
        timestamp: new Date(),
      });

      const result = await service.assessRisk(mockInput);

      expect(result.confidence).toBeLessThan(100);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.overallScore).toBeGreaterThan(0);
    });
  });

  describe('liquidity risk calculation', () => {
    it('should calculate high score for excellent liquidity', async () => {
      const mockInput = {
        coinId: 1,
        contractAddress: '0x1234567890123456789012345678901234567890',
        network: 'ethereum',
      };

      mockCacheService.get.mockResolvedValue(null);
      mockMoralisClient.getTokenTransfers.mockResolvedValue({
        result: [
          {
            transaction_hash: '0xabc',
            address: '0x1234567890123456789012345678901234567890',
            block_timestamp: '2024-01-01T00:00:00Z',
            block_number: '12345',
            block_hash: '0xdef',
            to_address: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
            from_address: '0x1111111111111111111111111111111111111111',
            value: '10000000000000000000000000', // Large value
            transaction_index: '1',
            log_index: '1',
            possible_spam: false,
            verified_contract: true,
          },
        ],
      });

      mockMoralisClient.getTokenPrice.mockResolvedValue({
        tokenName: 'Test Token',
        tokenSymbol: 'TEST',
        tokenLogo: '',
        tokenDecimals: '18',
        nativePrice: {
          value: '1000000000000000000',
          decimals: 18,
          name: 'Ethereum',
          symbol: 'ETH',
        },
        usdPrice: 1.0,
        usdPriceFormatted: '1.00',
      });

      // Mock other required calls
      mockMoralisClient.getTokenHolders.mockResolvedValue({ result: [] });
      mockMoralisClient.getTokenMetadata.mockResolvedValue([]);
      mockPrisma.socialMetrics.findMany.mockResolvedValue([]);
      mockPrisma.riskAssessment.create.mockResolvedValue({
        id: 1,
        coinId: 1,
        overallScore: 85,
        liquidityScore: 90,
        holderDistributionScore: 20,
        contractSecurityScore: 20,
        socialScore: 50,
        factors: {},
        timestamp: new Date(),
      });

      const result = await service.assessRisk(mockInput);

      expect(result.factors.liquidity.score).toBeGreaterThanOrEqual(80);
    });

    it('should calculate low score for poor liquidity', async () => {
      const mockInput = {
        coinId: 1,
        contractAddress: '0x1234567890123456789012345678901234567890',
        network: 'ethereum',
      };

      mockCacheService.get.mockResolvedValue(null);
      mockMoralisClient.getTokenTransfers.mockResolvedValue({
        result: [
          {
            transaction_hash: '0xabc',
            address: '0x1234567890123456789012345678901234567890',
            block_timestamp: '2024-01-01T00:00:00Z',
            block_number: '12345',
            block_hash: '0xdef',
            to_address: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
            from_address: '0x1111111111111111111111111111111111111111',
            value: '1000', // Very small value
            transaction_index: '1',
            log_index: '1',
            possible_spam: false,
            verified_contract: true,
          },
        ],
      });

      mockMoralisClient.getTokenPrice.mockResolvedValue({
        tokenName: 'Test Token',
        tokenSymbol: 'TEST',
        tokenLogo: '',
        tokenDecimals: '18',
        nativePrice: {
          value: '1000000000000000000',
          decimals: 18,
          name: 'Ethereum',
          symbol: 'ETH',
        },
        usdPrice: 0.001,
        usdPriceFormatted: '0.001',
      });

      // Mock other required calls
      mockMoralisClient.getTokenHolders.mockResolvedValue({ result: [] });
      mockMoralisClient.getTokenMetadata.mockResolvedValue([]);
      mockPrisma.socialMetrics.findMany.mockResolvedValue([]);
      mockPrisma.riskAssessment.create.mockResolvedValue({
        id: 1,
        coinId: 1,
        overallScore: 25,
        liquidityScore: 10,
        holderDistributionScore: 20,
        contractSecurityScore: 20,
        socialScore: 50,
        factors: {},
        timestamp: new Date(),
      });

      const result = await service.assessRisk(mockInput);

      expect(result.factors.liquidity.score).toBeLessThan(30);
      expect(result.warnings).toContain('Very low liquidity detected');
    });
  });

  describe('holder distribution risk calculation', () => {
    it('should calculate high score for good distribution', async () => {
      const mockInput = {
        coinId: 1,
        contractAddress: '0x1234567890123456789012345678901234567890',
        network: 'ethereum',
      };

      mockCacheService.get.mockResolvedValue(null);

      // Mock good holder distribution
      const holders = Array.from({ length: 50 }, (_, i) => ({
        address: `0x${i.toString().padStart(40, '0')}`,
        balance_formatted: (1000 - i * 10).toString(),
        percentage_relative_to_total_supply: (1000 - i * 10) / 50000,
      }));

      mockMoralisClient.getTokenHolders.mockResolvedValue({ result: holders });

      // Mock other required calls
      mockMoralisClient.getTokenTransfers.mockResolvedValue({ result: [] });
      mockMoralisClient.getTokenPrice.mockResolvedValue({
        tokenName: 'Test',
        tokenSymbol: 'TEST',
        tokenLogo: '',
        tokenDecimals: '18',
        nativePrice: { value: '0', decimals: 18, name: 'ETH', symbol: 'ETH' },
        usdPrice: 0,
        usdPriceFormatted: '0',
      });
      mockMoralisClient.getTokenMetadata.mockResolvedValue([]);
      mockPrisma.socialMetrics.findMany.mockResolvedValue([]);
      mockPrisma.riskAssessment.create.mockResolvedValue({
        id: 1,
        coinId: 1,
        overallScore: 70,
        liquidityScore: 20,
        holderDistributionScore: 85,
        contractSecurityScore: 20,
        socialScore: 50,
        factors: {},
        timestamp: new Date(),
      });

      const result = await service.assessRisk(mockInput);

      expect(result.factors.holderDistribution.score).toBeGreaterThanOrEqual(50);
      expect(result.factors.holderDistribution.topHoldersPercentage).toBeLessThan(50);
    });

    it('should calculate low score for concentrated holdings', async () => {
      const mockInput = {
        coinId: 1,
        contractAddress: '0x1234567890123456789012345678901234567890',
        network: 'ethereum',
      };

      mockCacheService.get.mockResolvedValue(null);

      // Mock concentrated holder distribution
      const holders = [
        {
          address: '0x1111111111111111111111111111111111111111',
          balance_formatted: '40000',
          percentage_relative_to_total_supply: 40,
        },
        {
          address: '0x2222222222222222222222222222222222222222',
          balance_formatted: '30000',
          percentage_relative_to_total_supply: 30,
        },
        {
          address: '0x3333333333333333333333333333333333333333',
          balance_formatted: '20000',
          percentage_relative_to_total_supply: 20,
        },
      ];

      mockMoralisClient.getTokenHolders.mockResolvedValue({ result: holders });

      // Mock other required calls
      mockMoralisClient.getTokenTransfers.mockResolvedValue({ result: [] });
      mockMoralisClient.getTokenPrice.mockResolvedValue({
        tokenName: 'Test',
        tokenSymbol: 'TEST',
        tokenLogo: '',
        tokenDecimals: '18',
        nativePrice: { value: '0', decimals: 18, name: 'ETH', symbol: 'ETH' },
        usdPrice: 0,
        usdPriceFormatted: '0',
      });
      mockMoralisClient.getTokenMetadata.mockResolvedValue([]);
      mockPrisma.socialMetrics.findMany.mockResolvedValue([]);
      mockPrisma.riskAssessment.create.mockResolvedValue({
        id: 1,
        coinId: 1,
        overallScore: 35,
        liquidityScore: 20,
        holderDistributionScore: 30,
        contractSecurityScore: 20,
        socialScore: 50,
        factors: {},
        timestamp: new Date(),
      });

      const result = await service.assessRisk(mockInput);

      expect(result.factors.holderDistribution.score).toBeLessThan(50);
      expect(result.warnings).toContain('High concentration among top holders');
    });
  });

  describe('contract security risk calculation', () => {
    it('should calculate high score for verified contract with good security', async () => {
      const mockInput = {
        coinId: 1,
        contractAddress: '0x1234567890123456789012345678901234567890',
        network: 'ethereum',
      };

      mockCacheService.get.mockResolvedValue(null);

      mockMoralisClient.getTokenMetadata.mockResolvedValue([
        {
          address: '0x1234567890123456789012345678901234567890',
          name: 'Test Token',
          symbol: 'TEST',
          decimals: '18',
          validated: 1, // Verified
          created_at: '2022-01-01T00:00:00Z', // Old contract
        },
      ]);

      // Mock other required calls
      mockMoralisClient.getTokenTransfers.mockResolvedValue({ result: [] });
      mockMoralisClient.getTokenPrice.mockResolvedValue({
        tokenName: 'Test',
        tokenSymbol: 'TEST',
        tokenLogo: '',
        tokenDecimals: '18',
        nativePrice: { value: '0', decimals: 18, name: 'ETH', symbol: 'ETH' },
        usdPrice: 0,
        usdPriceFormatted: '0',
      });
      mockMoralisClient.getTokenHolders.mockResolvedValue({ result: [] });
      mockPrisma.socialMetrics.findMany.mockResolvedValue([]);
      mockPrisma.riskAssessment.create.mockResolvedValue({
        id: 1,
        coinId: 1,
        overallScore: 65,
        liquidityScore: 20,
        holderDistributionScore: 20,
        contractSecurityScore: 85,
        socialScore: 50,
        factors: {},
        timestamp: new Date(),
      });

      const result = await service.assessRisk(mockInput);

      expect(result.factors.contractSecurity.score).toBeGreaterThan(60);
      expect(result.factors.contractSecurity.isVerified).toBe(true);
    });

    it('should calculate low score for unverified new contract', async () => {
      const mockInput = {
        coinId: 1,
        contractAddress: '0x1234567890123456789012345678901234567890',
        network: 'ethereum',
      };

      mockCacheService.get.mockResolvedValue(null);

      mockMoralisClient.getTokenMetadata.mockResolvedValue([
        {
          address: '0x1234567890123456789012345678901234567890',
          name: 'Test Token',
          symbol: 'TEST',
          decimals: '18',
          validated: 0, // Not verified
          created_at: new Date().toISOString(), // Very new contract
        },
      ]);

      // Mock other required calls
      mockMoralisClient.getTokenTransfers.mockResolvedValue({ result: [] });
      mockMoralisClient.getTokenPrice.mockResolvedValue({
        tokenName: 'Test',
        tokenSymbol: 'TEST',
        tokenLogo: '',
        tokenDecimals: '18',
        nativePrice: { value: '0', decimals: 18, name: 'ETH', symbol: 'ETH' },
        usdPrice: 0,
        usdPriceFormatted: '0',
      });
      mockMoralisClient.getTokenHolders.mockResolvedValue({ result: [] });
      mockPrisma.socialMetrics.findMany.mockResolvedValue([]);
      mockPrisma.riskAssessment.create.mockResolvedValue({
        id: 1,
        coinId: 1,
        overallScore: 25,
        liquidityScore: 20,
        holderDistributionScore: 20,
        contractSecurityScore: 15,
        socialScore: 50,
        factors: {},
        timestamp: new Date(),
      });

      const result = await service.assessRisk(mockInput);

      expect(result.factors.contractSecurity.score).toBeLessThan(40);
      expect(result.factors.contractSecurity.isVerified).toBe(false);
      expect(result.warnings).toContain('Contract not verified');
      expect(result.warnings).toContain('Very new contract');
    });
  });

  describe('social metrics risk calculation', () => {
    it('should calculate high score for positive social metrics', async () => {
      const mockInput = {
        coinId: 1,
        contractAddress: '0x1234567890123456789012345678901234567890',
        network: 'ethereum',
      };

      mockCacheService.get.mockResolvedValue(null);

      mockPrisma.socialMetrics.findMany.mockResolvedValue([
        {
          id: 1,
          coinId: 1,
          platform: 'twitter',
          followers: 50000,
          mentions24h: 200,
          sentimentScore: 0.8 as any,
          trendingScore: 85 as any,
          influencerMentions: 15,
          timestamp: new Date(),
        },
      ]);

      // Mock other required calls
      mockMoralisClient.getTokenTransfers.mockResolvedValue({ result: [] });
      mockMoralisClient.getTokenPrice.mockResolvedValue({
        tokenName: 'Test',
        tokenSymbol: 'TEST',
        tokenLogo: '',
        tokenDecimals: '18',
        nativePrice: { value: '0', decimals: 18, name: 'ETH', symbol: 'ETH' },
        usdPrice: 0,
        usdPriceFormatted: '0',
      });
      mockMoralisClient.getTokenHolders.mockResolvedValue({ result: [] });
      mockMoralisClient.getTokenMetadata.mockResolvedValue([]);
      mockPrisma.riskAssessment.create.mockResolvedValue({
        id: 1,
        coinId: 1,
        overallScore: 75,
        liquidityScore: 20,
        holderDistributionScore: 20,
        contractSecurityScore: 20,
        socialScore: 90,
        factors: {},
        timestamp: new Date(),
      });

      const result = await service.assessRisk(mockInput);

      expect(result.factors.socialMetrics.score).toBeGreaterThan(80);
      expect(result.factors.socialMetrics.sentimentScore).toBe(0.8);
      expect(result.factors.socialMetrics.communitySize).toBe(50000);
    });

    it('should calculate low score for negative social metrics', async () => {
      const mockInput = {
        coinId: 1,
        contractAddress: '0x1234567890123456789012345678901234567890',
        network: 'ethereum',
      };

      mockCacheService.get.mockResolvedValue(null);

      mockPrisma.socialMetrics.findMany.mockResolvedValue([
        {
          id: 1,
          coinId: 1,
          platform: 'twitter',
          followers: 500, // Small community
          mentions24h: 5,
          sentimentScore: 0.2 as any, // Negative sentiment
          trendingScore: 20 as any,
          influencerMentions: 0,
          timestamp: new Date(),
        },
      ]);

      // Mock other required calls
      mockMoralisClient.getTokenTransfers.mockResolvedValue({ result: [] });
      mockMoralisClient.getTokenPrice.mockResolvedValue({
        tokenName: 'Test',
        tokenSymbol: 'TEST',
        tokenLogo: '',
        tokenDecimals: '18',
        nativePrice: { value: '0', decimals: 18, name: 'ETH', symbol: 'ETH' },
        usdPrice: 0,
        usdPriceFormatted: '0',
      });
      mockMoralisClient.getTokenHolders.mockResolvedValue({ result: [] });
      mockMoralisClient.getTokenMetadata.mockResolvedValue([]);
      mockPrisma.riskAssessment.create.mockResolvedValue({
        id: 1,
        coinId: 1,
        overallScore: 30,
        liquidityScore: 20,
        holderDistributionScore: 20,
        contractSecurityScore: 20,
        socialScore: 35,
        factors: {},
        timestamp: new Date(),
      });

      const result = await service.assessRisk(mockInput);

      expect(result.factors.socialMetrics.score).toBeLessThan(50);
      expect(result.warnings).toContain('Negative social sentiment');
      expect(result.warnings).toContain('Small community size');
    });
  });

  describe('getRiskHistory', () => {
    it('should return historical risk assessments', async () => {
      const mockHistory = [
        {
          id: 1,
          coinId: 1,
          overallScore: 75,
          liquidityScore: 80,
          holderDistributionScore: 70,
          contractSecurityScore: 85,
          socialScore: 60,
          factors: {},
          timestamp: new Date('2024-01-01'),
        },
        {
          id: 2,
          coinId: 1,
          overallScore: 72,
          liquidityScore: 78,
          holderDistributionScore: 68,
          contractSecurityScore: 85,
          socialScore: 58,
          factors: {},
          timestamp: new Date('2024-01-02'),
        },
      ];

      mockPrisma.riskAssessment.findMany.mockResolvedValue(mockHistory);

      const result = await service.getRiskHistory(1, 10);

      expect(result).toEqual(mockHistory);
      expect(mockPrisma.riskAssessment.findMany).toHaveBeenCalledWith({
        where: { coinId: 1 },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig = {
        weights: {
          liquidity: 0.4,
          holderDistribution: 0.3,
        },
      };

      service.updateConfig(newConfig);

      const config = service.getConfig();
      expect(config.weights.liquidity).toBe(0.4);
      expect(config.weights.holderDistribution).toBe(0.3);
      expect(config.weights.contractSecurity).toBe(0.25); // Should remain unchanged
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = service.getConfig();

      expect(config).toEqual(defaultConfig);
      expect(config.weights.liquidity).toBe(0.35);
      expect(config.thresholds.liquidity.excellent).toBe(10000000);
    });
  });
});
