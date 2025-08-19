import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExternalApiService } from './external-api-service.js';

// Mock the API clients
vi.mock('./coingecko-client.js', () => ({
  CoinGeckoClient: vi.fn().mockImplementation(() => ({
    getTrendingCoins: vi.fn(),
    getCoinsMarkets: vi.fn(),
    getCoinById: vi.fn(),
    searchCoins: vi.fn(),
    getStatus: vi.fn().mockReturnValue({
      circuitBreaker: { state: 'CLOSED', failures: 0, lastFailureTime: 0 },
    }),
  })),
}));

vi.mock('./moralis-client.js', () => ({
  MoralisClient: vi.fn().mockImplementation(() => ({
    getTokenPrice: vi.fn(),
    getTokenTransfers: vi.fn(),
    getStatus: vi.fn().mockReturnValue({
      circuitBreaker: { state: 'CLOSED', failures: 0, lastFailureTime: 0 },
    }),
  })),
}));

import { CoinGeckoClient } from './coingecko-client.js';
import { MoralisClient } from './moralis-client.js';

describe('ExternalApiService', () => {
  let service: ExternalApiService;
  let mockCoinGeckoClient: any;
  let mockMoralisClient: any;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    service = new ExternalApiService({
      coinGecko: {
        apiKey: 'test-coingecko-key',
      },
      moralis: {
        apiKey: 'test-moralis-key',
      },
      logger: mockLogger,
    });

    // Get the mocked client instances
    mockCoinGeckoClient = (CoinGeckoClient as any).mock.results[0].value;
    mockMoralisClient = (MoralisClient as any).mock.results[0].value;
    
    vi.clearAllMocks();
  });

  describe('getTrendingMemeCoins', () => {
    it('should fetch and enhance trending meme coins data', async () => {
      const mockTrendingData = {
        coins: [
          {
            item: {
              id: 'dogecoin',
              symbol: 'DOGE',
              name: 'Dogecoin',
              large: 'https://example.com/doge-large.png',
            },
          },
          {
            item: {
              id: 'shiba-inu',
              symbol: 'SHIB',
              name: 'Shiba Inu',
              large: 'https://example.com/shib-large.png',
            },
          },
        ],
      };

      const mockMarketData = [
        {
          id: 'dogecoin',
          current_price: 0.08,
          market_cap: 11500000000,
          total_volume: 500000000,
          price_change_percentage_24h: 5.2,
        },
      ];

      mockCoinGeckoClient.getTrendingCoins.mockResolvedValue(mockTrendingData);
      mockCoinGeckoClient.getCoinsMarkets.mockResolvedValue(mockMarketData);

      const result = await service.getTrendingMemeCoins();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'dogecoin',
        symbol: 'DOGE',
        name: 'Dogecoin',
        image: 'https://example.com/doge-large.png',
        currentPrice: 0.08,
        marketCap: 11500000000,
        volume24h: 500000000,
        priceChange24h: 5.2,
      });

      expect(mockCoinGeckoClient.getTrendingCoins).toHaveBeenCalledOnce();
      expect(mockCoinGeckoClient.getCoinsMarkets).toHaveBeenCalledWith({
        ids: ['dogecoin'],
        perPage: 1,
      });
    });

    it('should handle market data fetch failures gracefully', async () => {
      const mockTrendingData = {
        coins: [
          {
            item: {
              id: 'test-coin',
              symbol: 'TEST',
              name: 'Test Coin',
              large: 'https://example.com/test-large.png',
            },
          },
        ],
      };

      mockCoinGeckoClient.getTrendingCoins.mockResolvedValue(mockTrendingData);
      mockCoinGeckoClient.getCoinsMarkets.mockRejectedValue(new Error('Market data unavailable'));

      const result = await service.getTrendingMemeCoins();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'test-coin',
        symbol: 'TEST',
        name: 'Test Coin',
        image: 'https://example.com/test-large.png',
        currentPrice: 0,
        marketCap: 0,
        volume24h: 0,
        priceChange24h: 0,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          coinId: 'test-coin',
          error: 'Market data unavailable',
        }),
        'Failed to fetch market data for trending coin'
      );
    });
  });

  describe('getMemeTokensByCategory', () => {
    it('should fetch meme tokens by category with default options', async () => {
      const mockMarketData = [
        {
          id: 'dogecoin',
          symbol: 'doge',
          name: 'Dogecoin',
          image: 'https://example.com/doge.png',
          current_price: 0.08,
          market_cap: 11500000000,
          total_volume: 500000000,
          price_change_percentage_24h: 5.2,
        },
      ];

      mockCoinGeckoClient.getCoinsMarkets.mockResolvedValue(mockMarketData);

      const result = await service.getMemeTokensByCategory();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'dogecoin',
        symbol: 'doge',
        name: 'Dogecoin',
        image: 'https://example.com/doge.png',
        currentPrice: 0.08,
        marketCap: 11500000000,
        volume24h: 500000000,
        priceChange24h: 5.2,
      });

      expect(mockCoinGeckoClient.getCoinsMarkets).toHaveBeenCalledWith({
        category: 'meme-token',
        page: 1,
        perPage: 50,
        order: 'market_cap_desc',
        priceChangePercentage: '24h',
      });
    });

    it('should fetch meme tokens with custom options', async () => {
      const mockMarketData = [];
      mockCoinGeckoClient.getCoinsMarkets.mockResolvedValue(mockMarketData);

      await service.getMemeTokensByCategory({
        page: 2,
        perPage: 25,
        sortBy: 'volume_desc',
      });

      expect(mockCoinGeckoClient.getCoinsMarkets).toHaveBeenCalledWith({
        category: 'meme-token',
        page: 2,
        perPage: 25,
        order: 'volume_desc',
        priceChangePercentage: '24h',
      });
    });
  });

  describe('getEnhancedTokenData', () => {
    it('should combine CoinGecko and Moralis data', async () => {
      const mockCoinDetail = {
        id: 'shiba-inu',
        symbol: 'shib',
        name: 'Shiba Inu',
        image: { large: 'https://example.com/shib-large.png' },
      };

      const mockMarketData = [
        {
          current_price: 0.000008,
          market_cap: 4700000000,
          total_volume: 200000000,
          price_change_percentage_24h: -2.5,
        },
      ];

      const mockTokenPrice = {
        tokenName: 'SHIBA INU',
        tokenSymbol: 'SHIB',
        tokenLogo: 'https://example.com/shib-logo.png',
        tokenDecimals: '18',
        nativePrice: {
          value: '1000000000000000',
          decimals: 18,
          name: 'Ether',
          symbol: 'ETH',
        },
        usdPrice: 0.000008,
        usdPriceFormatted: '0.000008',
      };

      const mockTransfers = {
        result: [
          {
            transaction_hash: '0x123',
            address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
            block_timestamp: '2024-01-15T10:30:00.000Z',
            block_number: '19000000',
            block_hash: '0xabc',
            to_address: '0x111',
            from_address: '0x222',
            value: '1000000000000000000000',
            transaction_index: '45',
            log_index: '120',
            possible_spam: false,
            verified_contract: true,
          },
        ],
      };

      mockCoinGeckoClient.getCoinById.mockResolvedValue(mockCoinDetail);
      mockCoinGeckoClient.getCoinsMarkets.mockResolvedValue(mockMarketData);
      mockMoralisClient.getTokenPrice.mockResolvedValue(mockTokenPrice);
      mockMoralisClient.getTokenTransfers.mockResolvedValue(mockTransfers);

      const result = await service.getEnhancedTokenData(
        'shiba-inu',
        '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
        'eth'
      );

      expect(result).toEqual({
        id: 'shiba-inu',
        symbol: 'shib',
        name: 'Shiba Inu',
        image: 'https://example.com/shib-large.png',
        currentPrice: 0.000008,
        marketCap: 4700000000,
        volume24h: 200000000,
        priceChange24h: -2.5,
        contractAddress: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
        chain: 'eth',
        tokenPrice: mockTokenPrice,
        recentTransfers: mockTransfers.result,
      });
    });

    it('should work without contract address', async () => {
      const mockCoinDetail = {
        id: 'dogecoin',
        symbol: 'doge',
        name: 'Dogecoin',
        image: { large: 'https://example.com/doge-large.png' },
      };

      const mockMarketData = [
        {
          current_price: 0.08,
          market_cap: 11500000000,
          total_volume: 500000000,
          price_change_percentage_24h: 5.2,
        },
      ];

      mockCoinGeckoClient.getCoinById.mockResolvedValue(mockCoinDetail);
      mockCoinGeckoClient.getCoinsMarkets.mockResolvedValue(mockMarketData);

      const result = await service.getEnhancedTokenData('dogecoin');

      expect(result).toEqual({
        id: 'dogecoin',
        symbol: 'doge',
        name: 'Dogecoin',
        image: 'https://example.com/doge-large.png',
        currentPrice: 0.08,
        marketCap: 11500000000,
        volume24h: 500000000,
        priceChange24h: 5.2,
        contractAddress: undefined,
        chain: 'eth',
      });

      expect(mockMoralisClient.getTokenPrice).not.toHaveBeenCalled();
      expect(mockMoralisClient.getTokenTransfers).not.toHaveBeenCalled();
    });
  });

  describe('getWhaleTransactions', () => {
    it('should detect whale transactions above USD threshold', async () => {
      const mockTransfers = {
        result: [
          {
            transaction_hash: '0x123',
            address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
            block_timestamp: '2024-01-15T10:30:00.000Z',
            block_number: '19000000',
            block_hash: '0xabc',
            to_address: '0x111',
            from_address: '0x222',
            value: '10000000000000000000000000', // 10M tokens
            transaction_index: '45',
            log_index: '120',
            possible_spam: false,
            verified_contract: true,
          },
          {
            transaction_hash: '0x456',
            address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
            block_timestamp: '2024-01-15T09:30:00.000Z',
            block_number: '18999999',
            block_hash: '0xdef',
            to_address: '0x333',
            from_address: '0x444',
            value: '1000000000000000000000', // 1K tokens (small transaction)
            transaction_index: '12',
            log_index: '50',
            possible_spam: false,
            verified_contract: true,
          },
        ],
      };

      const mockTokenPrice = {
        tokenName: 'SHIBA INU',
        tokenSymbol: 'SHIB',
        tokenLogo: 'https://example.com/shib-logo.png',
        tokenDecimals: '18',
        nativePrice: {
          value: '1000000000000000',
          decimals: 18,
          name: 'Ether',
          symbol: 'ETH',
        },
        usdPrice: 0.000008, // $0.000008 per token
        usdPriceFormatted: '0.000008',
      };

      mockMoralisClient.getTokenTransfers.mockResolvedValue(mockTransfers);
      mockMoralisClient.getTokenPrice.mockResolvedValue(mockTokenPrice);

      const result = await service.getWhaleTransactions(
        '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
        'eth',
        { minUsdValue: 50 } // Low threshold for testing
      );

      expect(result).toHaveLength(1); // Only the large transaction should qualify
      expect(result[0]).toEqual({
        hash: '0x123',
        tokenAddress: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
        tokenSymbol: 'SHIB',
        fromAddress: '0x222',
        toAddress: '0x111',
        value: '10000000000000000000000000',
        usdValue: 80, // 10M tokens * $0.000008
        timestamp: '2024-01-15T10:30:00.000Z',
        blockNumber: '19000000',
      });
    });

    it('should handle missing token price gracefully', async () => {
      const mockTransfers = {
        result: [
          {
            transaction_hash: '0x123',
            address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
            block_timestamp: '2024-01-15T10:30:00.000Z',
            block_number: '19000000',
            block_hash: '0xabc',
            to_address: '0x111',
            from_address: '0x222',
            value: '10000000000000000000000000',
            transaction_index: '45',
            log_index: '120',
            possible_spam: false,
            verified_contract: true,
          },
        ],
      };

      mockMoralisClient.getTokenTransfers.mockResolvedValue(mockTransfers);
      mockMoralisClient.getTokenPrice.mockRejectedValue(new Error('Price not available'));

      const result = await service.getWhaleTransactions(
        '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce'
      );

      expect(result).toHaveLength(0); // No transactions qualify without price data
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          contractAddress: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
          error: 'Price not available',
        }),
        'Failed to fetch token price for whale transaction calculation'
      );
    });
  });

  describe('searchMemeCoins', () => {
    it('should search and filter meme coins', async () => {
      const mockSearchResults = {
        coins: [
          {
            id: 'dogecoin',
            name: 'Dogecoin',
            symbol: 'DOGE',
            market_cap_rank: 8,
            thumb: 'https://example.com/doge-thumb.png',
            large: 'https://example.com/doge-large.png',
          },
          {
            id: 'bitcoin',
            name: 'Bitcoin',
            symbol: 'BTC',
            market_cap_rank: 1,
            thumb: 'https://example.com/btc-thumb.png',
            large: 'https://example.com/btc-large.png',
          },
          {
            id: 'shiba-inu',
            name: 'Shiba Inu',
            symbol: 'SHIB',
            market_cap_rank: 15,
            thumb: 'https://example.com/shib-thumb.png',
            large: 'https://example.com/shib-large.png',
          },
        ],
      };

      const mockMarketData = [
        {
          id: 'dogecoin',
          current_price: 0.08,
          market_cap: 11500000000,
          total_volume: 500000000,
          price_change_percentage_24h: 5.2,
        },
      ];

      mockCoinGeckoClient.searchCoins.mockResolvedValue(mockSearchResults);
      mockCoinGeckoClient.getCoinsMarkets
        .mockResolvedValueOnce(mockMarketData) // For dogecoin
        .mockResolvedValueOnce([]); // For shiba-inu (no market data)

      const result = await service.searchMemeCoins('doge');

      expect(result).toHaveLength(1); // Only coins with market data should be returned
      expect(result[0]).toEqual({
        id: 'dogecoin',
        symbol: 'DOGE',
        name: 'Dogecoin',
        image: 'https://example.com/doge-large.png',
        currentPrice: 0.08,
        marketCap: 11500000000,
        volume24h: 500000000,
        priceChange24h: 5.2,
      });

      expect(mockCoinGeckoClient.searchCoins).toHaveBeenCalledWith('doge');
    });
  });

  describe('getServiceStatus', () => {
    it('should return status of both services', () => {
      const status = service.getServiceStatus();

      expect(status).toEqual({
        coinGecko: {
          circuitBreaker: { state: 'CLOSED', failures: 0, lastFailureTime: 0 },
        },
        moralis: {
          circuitBreaker: { state: 'CLOSED', failures: 0, lastFailureTime: 0 },
        },
        timestamp: expect.any(String),
      });
    });
  });
});