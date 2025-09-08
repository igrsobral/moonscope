import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CoinGeckoClient } from '../services/coingecko-client.js';
import { MoralisClient } from '../services/moralis-client.js';

// Mock undici for integration testing
vi.mock('undici', () => ({
  request: vi.fn(),
}));

import { request } from 'undici';
const mockRequest = vi.mocked(request);

describe('External API Integration Tests', () => {
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('CoinGecko API Integration', () => {
    let coinGeckoClient: CoinGeckoClient;

    beforeEach(() => {
      coinGeckoClient = new CoinGeckoClient({
        apiKey: 'test-api-key',
        logger: mockLogger,
      });
    });

    it('should successfully fetch coins markets data', async () => {
      const mockCoinsData = [
        {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
          current_price: 50000,
          market_cap: 1000000000000,
          market_cap_rank: 1,
          fully_diluted_valuation: 1050000000000,
          total_volume: 50000000000,
          high_24h: 51000,
          low_24h: 49000,
          price_change_24h: 1000,
          price_change_percentage_24h: 2.04,
          market_cap_change_24h: 20000000000,
          market_cap_change_percentage_24h: 2.04,
          circulating_supply: 19500000,
          total_supply: 19500000,
          max_supply: 21000000,
          ath: 69000,
          ath_change_percentage: -27.54,
          ath_date: '2021-11-10T14:24:11.849Z',
          atl: 67.81,
          atl_change_percentage: 73641.63,
          atl_date: '2013-07-06T00:00:00.000Z',
          last_updated: '2023-01-01T12:00:00.000Z',
        },
      ];

      const mockResponse = {
        statusCode: 200,
        body: {
          text: vi.fn().mockResolvedValue(JSON.stringify(mockCoinsData)),
        },
      };
      mockRequest.mockResolvedValue(mockResponse as any);

      const result = await coinGeckoClient.getCoinsMarkets({
        vsCurrency: 'usd',
        perPage: 1,
        page: 1,
      });

      expect(result).toEqual(mockCoinsData);
      expect(mockRequest).toHaveBeenCalledWith(
        expect.stringContaining('https://api.coingecko.com/api/v3/coins/markets'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'x-cg-demo-api-key': 'test-api-key',
          }),
        })
      );
    });

    it('should handle CoinGecko rate limiting gracefully', async () => {
      const mockResponse = {
        statusCode: 429,
        body: {
          text: vi.fn().mockResolvedValue('{"error":"Rate limit exceeded"}'),
        },
      };
      mockRequest.mockResolvedValue(mockResponse as any);

      await expect(coinGeckoClient.getCoinsMarkets()).rejects.toThrow(
        'CoinGecko API rate limit exceeded'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'getCoinsMarkets',
          statusCode: 429,
        }),
        'CoinGecko API rate limit exceeded'
      );
    });

    it('should retry on server errors and eventually succeed', async () => {
      vi.useFakeTimers();

      const serverErrorResponse = {
        statusCode: 500,
        body: {
          text: vi.fn().mockResolvedValue('{"error":"Internal server error"}'),
        },
      };
      const successResponse = {
        statusCode: 200,
        body: {
          text: vi.fn().mockResolvedValue('{"gecko_says":"(V3) To the Moon!"}'),
        },
      };

      mockRequest
        .mockResolvedValueOnce(serverErrorResponse as any)
        .mockResolvedValueOnce(successResponse as any);

      const pingPromise = coinGeckoClient.ping();

      // Fast-forward through retry delay
      await vi.runAllTimersAsync();

      const result = await pingPromise;

      expect(result).toEqual({ gecko_says: '(V3) To the Moon!' });
      expect(mockRequest).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should open circuit breaker after repeated failures', async () => {
      const serverErrorResponse = {
        statusCode: 500,
        body: {
          text: vi.fn().mockResolvedValue('{"error":"Internal server error"}'),
        },
      };
      mockRequest.mockResolvedValue(serverErrorResponse as any);

      // Make enough requests to open the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await coinGeckoClient.ping();
        } catch {
          // Expected to fail
        }
      }

      // Next request should fail immediately due to open circuit
      await expect(coinGeckoClient.ping()).rejects.toThrow('Circuit breaker is OPEN');

      const status = coinGeckoClient.getStatus();
      expect(status.circuitBreaker.state).toBe('OPEN');
    });
  });

  describe('Moralis API Integration', () => {
    let moralisClient: MoralisClient;

    beforeEach(() => {
      moralisClient = new MoralisClient({
        apiKey: 'test-moralis-key',
        logger: mockLogger,
      });
    });

    it('should successfully fetch token metadata', async () => {
      const mockTokenMetadata = [
        {
          address: '0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7',
          name: 'Chainlink Token',
          symbol: 'LINK',
          decimals: '18',
          logo: 'https://logo.moralis.io/0x1_0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7_a578c5277503e5b0d7a3e7c3d3e5c5e5',
          logo_hash: 'a578c5277503e5b0d7a3e7c3d3e5c5e5',
          thumbnail:
            'https://logo.moralis.io/0x1_0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7_a578c5277503e5b0d7a3e7c3d3e5c5e5_thumb',
          block_number: '4281611',
          validated: 1,
          created_at: '2022-01-20T10:39:55.818Z',
        },
      ];

      const mockResponse = {
        statusCode: 200,
        body: {
          text: vi.fn().mockResolvedValue(JSON.stringify(mockTokenMetadata)),
        },
      };
      mockRequest.mockResolvedValue(mockResponse as any);

      const result = await moralisClient.getTokenMetadata(
        '0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7'
      );

      expect(result).toEqual(mockTokenMetadata);
      expect(mockRequest).toHaveBeenCalledWith(
        expect.stringContaining('https://deep-index.moralis.io/api/v2.2/erc20/metadata'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-API-Key': 'test-moralis-key',
          }),
        })
      );
    });

    it('should successfully fetch token price', async () => {
      const mockTokenPrice = {
        tokenName: 'Chainlink Token',
        tokenSymbol: 'LINK',
        tokenLogo:
          'https://logo.moralis.io/0x1_0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7_a578c5277503e5b0d7a3e7c3d3e5c5e5',
        tokenDecimals: '18',
        nativePrice: {
          value: '8850000000000000000',
          decimals: 18,
          name: 'Ether',
          symbol: 'ETH',
        },
        usdPrice: 14.59,
        usdPriceFormatted: '14.59',
        exchangeAddress: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
        exchangeName: 'Uniswap v3',
        '24hrPercentChange': '1.23',
        verified_contract: true,
      };

      const mockResponse = {
        statusCode: 200,
        body: {
          text: vi.fn().mockResolvedValue(JSON.stringify(mockTokenPrice)),
        },
      };
      mockRequest.mockResolvedValue(mockResponse as any);

      const result = await moralisClient.getTokenPrice(
        '0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7'
      );

      expect(result).toEqual(mockTokenPrice);
      expect(mockRequest).toHaveBeenCalledWith(
        expect.stringContaining('/erc20/0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7/price'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should handle Moralis rate limiting gracefully', async () => {
      const mockResponse = {
        statusCode: 429,
        body: {
          text: vi.fn().mockResolvedValue('{"message":"Rate limit exceeded"}'),
        },
      };
      mockRequest.mockResolvedValue(mockResponse as any);

      await expect(
        moralisClient.getTokenMetadata('0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7')
      ).rejects.toThrow('Moralis API rate limit exceeded');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'getTokenMetadata',
          statusCode: 429,
        }),
        'Moralis API rate limit exceeded'
      );
    });

    it('should successfully fetch wallet token balances with pagination', async () => {
      const mockTokenBalances = {
        cursor: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        page: 1,
        page_size: 100,
        result: [
          {
            token_address: '0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7',
            name: 'Chainlink Token',
            symbol: 'LINK',
            logo: 'https://logo.moralis.io/0x1_0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7_a578c5277503e5b0d7a3e7c3d3e5c5e5',
            thumbnail:
              'https://logo.moralis.io/0x1_0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7_a578c5277503e5b0d7a3e7c3d3e5c5e5_thumb',
            decimals: 18,
            balance: '158972296077000000000',
            possible_spam: false,
            verified_contract: true,
            total_supply: '1000000000000000000000000000',
            total_supply_formatted: '1000000000',
            percentage_relative_to_total_supply: 0.000015897,
          },
        ],
      };

      const mockResponse = {
        statusCode: 200,
        body: {
          text: vi.fn().mockResolvedValue(JSON.stringify(mockTokenBalances)),
        },
      };
      mockRequest.mockResolvedValue(mockResponse as any);

      const result = await moralisClient.getWalletTokenBalances(
        '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
        'eth',
        { limit: 100, excludeSpam: true }
      );

      expect(result).toEqual(mockTokenBalances);
      expect(mockRequest).toHaveBeenCalledWith(
        expect.stringContaining('/0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6/erc20'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should handle network errors and retry', async () => {
      vi.useFakeTimers();

      const networkError = new Error('Network connection failed');
      const successResponse = {
        statusCode: 200,
        body: {
          text: vi
            .fn()
            .mockResolvedValue(
              '[{"address":"0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7","name":"Chainlink Token","symbol":"LINK","decimals":"18"}]'
            ),
        },
      };

      mockRequest.mockRejectedValueOnce(networkError).mockResolvedValueOnce(successResponse as any);

      const metadataPromise = moralisClient.getTokenMetadata(
        '0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7'
      );

      // Fast-forward through retry delay
      await vi.runAllTimersAsync();

      const result = await metadataPromise;

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('LINK');
      expect(mockRequest).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('Cross-API Integration Scenarios', () => {
    let coinGeckoClient: CoinGeckoClient;
    let moralisClient: MoralisClient;

    beforeEach(() => {
      coinGeckoClient = new CoinGeckoClient({
        apiKey: 'test-coingecko-key',
        logger: mockLogger,
      });
      moralisClient = new MoralisClient({
        apiKey: 'test-moralis-key',
        logger: mockLogger,
      });
    });

    it('should handle concurrent API calls to different services', async () => {
      const mockCoinGeckoResponse = {
        statusCode: 200,
        body: {
          text: vi.fn().mockResolvedValue('{"gecko_says":"(V3) To the Moon!"}'),
        },
      };
      const mockMoralisResponse = {
        statusCode: 200,
        body: {
          text: vi
            .fn()
            .mockResolvedValue(
              '[{"address":"0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7","name":"Chainlink Token","symbol":"LINK","decimals":"18"}]'
            ),
        },
      };

      mockRequest
        .mockResolvedValueOnce(mockCoinGeckoResponse as any)
        .mockResolvedValueOnce(mockMoralisResponse as any);

      const [coinGeckoResult, moralisResult] = await Promise.all([
        coinGeckoClient.ping(),
        moralisClient.getTokenMetadata('0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7'),
      ]);

      expect(coinGeckoResult).toEqual({ gecko_says: '(V3) To the Moon!' });
      expect(moralisResult).toHaveLength(1);
      expect(moralisResult[0].symbol).toBe('LINK');
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success and failure scenarios', async () => {
      const mockCoinGeckoSuccess = {
        statusCode: 200,
        body: {
          text: vi.fn().mockResolvedValue('{"gecko_says":"(V3) To the Moon!"}'),
        },
      };
      const mockMoralisError = {
        statusCode: 500,
        body: {
          text: vi.fn().mockResolvedValue('{"message":"Internal server error"}'),
        },
      };

      mockRequest
        .mockResolvedValueOnce(mockCoinGeckoSuccess as any)
        .mockResolvedValueOnce(mockMoralisError as any);

      const results = await Promise.allSettled([
        coinGeckoClient.ping(),
        moralisClient.getTokenMetadata('0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7'),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');

      if (results[0].status === 'fulfilled') {
        expect(results[0].value).toEqual({ gecko_says: '(V3) To the Moon!' });
      }
    });

    it('should maintain independent circuit breaker states', async () => {
      const serverErrorResponse = {
        statusCode: 500,
        body: {
          text: vi.fn().mockResolvedValue('{"error":"Server error"}'),
        },
      };

      // Fail CoinGecko requests to open its circuit breaker
      mockRequest.mockResolvedValue(serverErrorResponse as any);

      for (let i = 0; i < 3; i++) {
        try {
          await coinGeckoClient.ping();
        } catch {
          // Expected to fail
        }
      }

      // CoinGecko circuit should be open
      const coinGeckoStatus = coinGeckoClient.getStatus();
      expect(coinGeckoStatus.circuitBreaker.state).toBe('OPEN');

      // Moralis circuit should still be closed
      const moralisStatus = moralisClient.getStatus();
      expect(moralisStatus.circuitBreaker.state).toBe('CLOSED');

      // CoinGecko should fail immediately
      await expect(coinGeckoClient.ping()).rejects.toThrow('Circuit breaker is OPEN');

      // Moralis should still attempt the request
      const mockMoralisSuccess = {
        statusCode: 200,
        body: {
          text: vi
            .fn()
            .mockResolvedValue(
              '[{"address":"0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7","name":"Test","symbol":"TEST","decimals":"18"}]'
            ),
        },
      };
      mockRequest.mockResolvedValueOnce(mockMoralisSuccess as any);

      const result = await moralisClient.getTokenMetadata(
        '0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7'
      );
      expect(result).toHaveLength(1);
    });
  });
});
