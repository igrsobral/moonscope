import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoinGeckoClient } from './coingecko-client.js';
import { MoralisClient } from './moralis-client.js';

// Mock the HttpClient to simulate API responses
vi.mock('./http-client.js', () => {
  const mockHttpClient = {
    get: vi.fn(),
    getCircuitBreakerState: vi.fn().mockReturnValue({
      state: 'CLOSED',
      failures: 0,
      lastFailureTime: 0,
    }),
  };

  return {
    HttpClient: vi.fn().mockImplementation(() => mockHttpClient),
    HttpError: class HttpError extends Error {
      constructor(message: string, public statusCode: number, public responseBody?: string) {
        super(message);
        this.name = 'HttpError';
      }
    },
    RateLimitError: class RateLimitError extends Error {
      constructor(message: string, public retryAfter?: number) {
        super(message);
        this.name = 'RateLimitError';
      }
    },
    CircuitBreaker: vi.fn(),
  };
});

import { HttpClient } from './http-client.js';

describe('External API Integration', () => {
  let coinGeckoClient: CoinGeckoClient;
  let moralisClient: MoralisClient;
  let mockHttpClient: any;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    coinGeckoClient = new CoinGeckoClient({
      apiKey: 'test-coingecko-key',
      logger: mockLogger,
    });

    moralisClient = new MoralisClient({
      apiKey: 'test-moralis-key',
      logger: mockLogger,
    });

    // Get the mocked HttpClient instance
    mockHttpClient = (HttpClient as any).mock.results[0].value;
    vi.clearAllMocks();
  });

  describe('CoinGecko Integration', () => {
    it('should fetch trending meme coins successfully', async () => {
      const mockTrendingData = {
        coins: [
          {
            item: {
              id: 'dogecoin',
              coin_id: 74,
              name: 'Dogecoin',
              symbol: 'DOGE',
              market_cap_rank: 8,
              thumb: 'https://assets.coingecko.com/coins/images/5/thumb/dogecoin.png',
              small: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
              large: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
              slug: 'dogecoin',
              price_btc: 0.00000123,
              score: 0,
            },
          },
          {
            item: {
              id: 'shiba-inu',
              coin_id: 11939,
              name: 'Shiba Inu',
              symbol: 'SHIB',
              market_cap_rank: 15,
              thumb: 'https://assets.coingecko.com/coins/images/11939/thumb/shiba.png',
              small: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png',
              large: 'https://assets.coingecko.com/coins/images/11939/large/shiba.png',
              slug: 'shiba-inu',
              price_btc: 0.00000000045,
              score: 1,
            },
          },
        ],
      };

      mockHttpClient.get.mockResolvedValue(mockTrendingData);

      const result = await coinGeckoClient.getTrendingCoins();

      expect(result).toEqual(mockTrendingData);
      expect(result.coins).toHaveLength(2);
      expect(result.coins[0].item.symbol).toBe('DOGE');
      expect(result.coins[1].item.symbol).toBe('SHIB');
    });

    it('should fetch meme coin market data with pagination', async () => {
      const mockMarketData = [
        {
          id: 'dogecoin',
          symbol: 'doge',
          name: 'Dogecoin',
          image: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
          current_price: 0.08,
          market_cap: 11500000000,
          market_cap_rank: 8,
          fully_diluted_valuation: 11500000000,
          total_volume: 500000000,
          high_24h: 0.085,
          low_24h: 0.075,
          price_change_24h: 0.005,
          price_change_percentage_24h: 6.67,
          market_cap_change_24h: 700000000,
          market_cap_change_percentage_24h: 6.48,
          circulating_supply: 143750000000,
          total_supply: 143750000000,
          max_supply: null,
          ath: 0.731578,
          ath_change_percentage: -89.06,
          ath_date: '2021-05-08T05:08:23.458Z',
          atl: 0.00008547,
          atl_change_percentage: 93500.0,
          atl_date: '2015-05-06T09:04:01.000Z',
          last_updated: '2024-01-15T10:30:00.000Z',
        },
      ];

      mockHttpClient.get.mockResolvedValue(mockMarketData);

      const result = await coinGeckoClient.getCoinsMarkets({
        category: 'meme-token',
        perPage: 50,
        page: 1,
        order: 'market_cap_desc',
      });

      expect(result).toEqual(mockMarketData);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('category=meme-token')
      );
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('per_page=50')
      );
    });

    it('should handle rate limiting gracefully', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).statusCode = 429;
      mockHttpClient.get.mockRejectedValue(rateLimitError);

      await expect(coinGeckoClient.getCoinsMarkets()).rejects.toThrow('CoinGecko API rate limit exceeded');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 429,
        }),
        'CoinGecko API rate limit exceeded'
      );
    });
  });

  describe('Moralis Integration', () => {
    it('should fetch token metadata for meme coins', async () => {
      const mockTokenMetadata = [
        {
          address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
          name: 'SHIBA INU',
          symbol: 'SHIB',
          decimals: '18',
          logo: 'https://logo.moralis.io/0x1_0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce_a578c5277503e5b0a8c5d9cb5e4e4e8e',
          logo_hash: 'a578c5277503e5b0a8c5d9cb5e4e4e8e',
          thumbnail: 'https://logo.moralis.io/0x1_0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce_a578c5277503e5b0a8c5d9cb5e4e4e8e',
          block_number: '10329791',
          validated: 1,
          created_at: '2022-01-20T10:41:03.000Z',
        },
      ];

      mockHttpClient.get.mockResolvedValue(mockTokenMetadata);

      const result = await moralisClient.getTokenMetadata('0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce');

      expect(result).toEqual(mockTokenMetadata);
      expect(result[0].symbol).toBe('SHIB');
      expect(result[0].name).toBe('SHIBA INU');
    });

    it('should fetch whale transactions for meme coins', async () => {
      const mockTokenTransfers = {
        cursor: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        result: [
          {
            transaction_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
            block_timestamp: '2024-01-15T10:30:00.000Z',
            block_number: '19000000',
            block_hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            to_address: '0x1111111111111111111111111111111111111111',
            from_address: '0x2222222222222222222222222222222222222222',
            value: '1000000000000000000000000', // 1M tokens
            transaction_index: '45',
            log_index: '120',
            possible_spam: false,
            verified_contract: true,
          },
        ],
      };

      mockHttpClient.get.mockResolvedValue(mockTokenTransfers);

      const result = await moralisClient.getTokenTransfers(
        '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
        'eth',
        {
          limit: 100,
          order: 'DESC',
        }
      );

      expect(result).toEqual(mockTokenTransfers);
      expect(result.result[0].value).toBe('1000000000000000000000000');
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('limit=100')
      );
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('order=DESC')
      );
    });

    it('should fetch token holder distribution', async () => {
      const mockTokenHolders = {
        cursor: 'next-page-cursor',
        result: [
          {
            address: '0x1111111111111111111111111111111111111111',
            balance: '50000000000000000000000000', // 50M tokens
            balance_formatted: '50000000.0',
            percentage_relative_to_total_supply: 5.0,
          },
          {
            address: '0x2222222222222222222222222222222222222222',
            balance: '30000000000000000000000000', // 30M tokens
            balance_formatted: '30000000.0',
            percentage_relative_to_total_supply: 3.0,
          },
        ],
      };

      mockHttpClient.get.mockResolvedValue(mockTokenHolders);

      const result = await moralisClient.getTokenHolders(
        '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
        'eth',
        {
          limit: 100,
          order: 'DESC',
        }
      );

      expect(result).toEqual(mockTokenHolders);
      expect(result.result).toHaveLength(2);
      expect(result.result[0].percentage_relative_to_total_supply).toBe(5.0);
    });

    it('should handle API errors with proper logging', async () => {
      const apiError = new Error('API Error');
      (apiError as any).statusCode = 500;
      (apiError as any).responseBody = '{"error": "Internal server error"}';
      mockHttpClient.get.mockRejectedValue(apiError);

      await expect(
        moralisClient.getTokenMetadata('0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce')
      ).rejects.toThrow('API Error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'getTokenMetadata',
          error: 'API Error',
          statusCode: 500,
          responseBody: '{"error": "Internal server error"}',
        }),
        'Moralis API error'
      );
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should report circuit breaker status for both clients', () => {
      const coinGeckoStatus = coinGeckoClient.getStatus();
      const moralisStatus = moralisClient.getStatus();

      expect(coinGeckoStatus).toEqual({
        circuitBreaker: {
          state: 'CLOSED',
          failures: 0,
          lastFailureTime: 0,
        },
      });

      expect(moralisStatus).toEqual({
        circuitBreaker: {
          state: 'CLOSED',
          failures: 0,
          lastFailureTime: 0,
        },
      });
    });
  });

  describe('Multi-chain Support', () => {
    it('should support multiple blockchain networks', async () => {
      const mockEthereumPrice = {
        tokenName: 'SHIBA INU',
        tokenSymbol: 'SHIB',
        tokenLogo: 'https://logo.moralis.io/0x1_0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
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

      const mockBscPrice = {
        ...mockEthereumPrice,
        nativePrice: {
          value: '1000000000000000',
          decimals: 18,
          name: 'BNB',
          symbol: 'BNB',
        },
      };

      mockHttpClient.get
        .mockResolvedValueOnce(mockEthereumPrice)
        .mockResolvedValueOnce(mockBscPrice);

      const ethPrice = await moralisClient.getTokenPrice(
        '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
        'eth'
      );
      const bscPrice = await moralisClient.getTokenPrice(
        '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
        'bsc'
      );

      expect(ethPrice.nativePrice.symbol).toBe('ETH');
      expect(bscPrice.nativePrice.symbol).toBe('BNB');
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });
  });
});