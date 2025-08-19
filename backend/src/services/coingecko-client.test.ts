import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CoinGeckoClient } from './coingecko-client.js';
import { RateLimitError } from './http-client.js';

// Mock the HttpClient
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

describe('CoinGeckoClient', () => {
  let client: CoinGeckoClient;
  let mockHttpClient: any;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    client = new CoinGeckoClient({
      apiKey: 'test-api-key',
      logger: mockLogger,
    });

    // Get the mocked HttpClient instance
    mockHttpClient = (HttpClient as any).mock.results[0].value;
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with default configuration', () => {
      const defaultClient = new CoinGeckoClient({});
      expect(HttpClient).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://api.coingecko.com/api/v3',
          timeout: 30000,
          headers: {},
        }),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should create client with API key', () => {
      new CoinGeckoClient({
        apiKey: 'test-api-key-2',
        logger: mockLogger,
      });
      
      expect(HttpClient).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'x-cg-demo-api-key': 'test-api-key-2',
          },
        }),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should create client with custom configuration', () => {
      new CoinGeckoClient({
        baseUrl: 'https://custom-api.example.com',
        timeout: 60000,
        logger: mockLogger,
      });

      expect(HttpClient).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://custom-api.example.com',
          timeout: 60000,
        }),
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('getCoinsMarkets', () => {
    const mockCoinsData = [
      {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        image: 'https://example.com/bitcoin.png',
        current_price: 50000,
        market_cap: 1000000000000,
        market_cap_rank: 1,
        total_volume: 50000000000,
        price_change_percentage_24h: 2.5,
      },
    ];

    it('should fetch coins markets with default parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockCoinsData);

      const result = await client.getCoinsMarkets();

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false'
      );
      expect(result).toEqual(mockCoinsData);
    });

    it('should fetch coins markets with custom parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockCoinsData);

      const result = await client.getCoinsMarkets({
        vsCurrency: 'eur',
        ids: ['bitcoin', 'ethereum'],
        category: 'meme-token',
        order: 'volume_desc',
        perPage: 50,
        page: 2,
        sparkline: true,
        priceChangePercentage: '1h,24h,7d',
      });

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('vs_currency=eur')
      );
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('ids=bitcoin%2Cethereum')
      );
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('category=meme-token')
      );
      expect(result).toEqual(mockCoinsData);
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      (error as any).statusCode = 500;
      mockHttpClient.get.mockRejectedValue(error);

      await expect(client.getCoinsMarkets()).rejects.toThrow('API Error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'getCoinsMarkets',
          error: 'API Error',
          statusCode: 500,
        }),
        'CoinGecko API error'
      );
    });

    it('should handle rate limit errors', async () => {
      const error = new Error('Rate limit exceeded');
      (error as any).statusCode = 429;
      mockHttpClient.get.mockRejectedValue(error);

      await expect(client.getCoinsMarkets()).rejects.toThrow(RateLimitError);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'getCoinsMarkets',
          statusCode: 429,
        }),
        'CoinGecko API rate limit exceeded'
      );
    });
  });

  describe('getCoinById', () => {
    const mockCoinDetail = {
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      description: { en: 'Bitcoin is a cryptocurrency' },
      market_data: {
        current_price: { usd: 50000 },
        market_cap: { usd: 1000000000000 },
      },
    };

    it('should fetch coin details with default parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockCoinDetail);

      const result = await client.getCoinById('bitcoin');

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=true&developer_data=true&sparkline=false'
      );
      expect(result).toEqual(mockCoinDetail);
    });

    it('should fetch coin details with custom parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockCoinDetail);

      const result = await client.getCoinById('bitcoin', {
        localization: true,
        tickers: true,
        marketData: false,
        communityData: false,
        developerData: false,
        sparkline: true,
      });

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/coins/bitcoin?localization=true&tickers=true&market_data=false&community_data=false&developer_data=false&sparkline=true'
      );
      expect(result).toEqual(mockCoinDetail);
    });
  });

  describe('getCoinMarketChart', () => {
    const mockMarketData = {
      prices: [[1640995200000, 50000]],
      market_caps: [[1640995200000, 1000000000000]],
      total_volumes: [[1640995200000, 50000000000]],
    };

    it('should fetch market chart with default parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockMarketData);

      const result = await client.getCoinMarketChart('bitcoin');

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/coins/bitcoin/market_chart?vs_currency=usd&days=7'
      );
      expect(result).toEqual(mockMarketData);
    });

    it('should fetch market chart with custom parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockMarketData);

      const result = await client.getCoinMarketChart('bitcoin', 'eur', 30, 'daily');

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/coins/bitcoin/market_chart?vs_currency=eur&days=30&interval=daily'
      );
      expect(result).toEqual(mockMarketData);
    });

    it('should handle max days parameter', async () => {
      mockHttpClient.get.mockResolvedValue(mockMarketData);

      await client.getCoinMarketChart('bitcoin', 'usd', 'max');

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/coins/bitcoin/market_chart?vs_currency=usd&days=max'
      );
    });
  });

  describe('searchCoins', () => {
    const mockSearchResult = {
      coins: [
        {
          id: 'bitcoin',
          name: 'Bitcoin',
          symbol: 'BTC',
          market_cap_rank: 1,
          thumb: 'https://example.com/bitcoin-thumb.png',
          large: 'https://example.com/bitcoin-large.png',
        },
      ],
    };

    it('should search for coins', async () => {
      mockHttpClient.get.mockResolvedValue(mockSearchResult);

      const result = await client.searchCoins('bitcoin');

      expect(mockHttpClient.get).toHaveBeenCalledWith('/search?query=bitcoin');
      expect(result).toEqual(mockSearchResult);
    });

    it('should handle special characters in search query', async () => {
      mockHttpClient.get.mockResolvedValue(mockSearchResult);

      await client.searchCoins('doge coin');

      expect(mockHttpClient.get).toHaveBeenCalledWith('/search?query=doge+coin');
    });
  });

  describe('getTrendingCoins', () => {
    const mockTrendingResult = {
      coins: [
        {
          item: {
            id: 'bitcoin',
            coin_id: 1,
            name: 'Bitcoin',
            symbol: 'BTC',
            market_cap_rank: 1,
            thumb: 'https://example.com/bitcoin-thumb.png',
            small: 'https://example.com/bitcoin-small.png',
            large: 'https://example.com/bitcoin-large.png',
            slug: 'bitcoin',
            price_btc: 1,
            score: 0,
          },
        },
      ],
    };

    it('should fetch trending coins', async () => {
      mockHttpClient.get.mockResolvedValue(mockTrendingResult);

      const result = await client.getTrendingCoins();

      expect(mockHttpClient.get).toHaveBeenCalledWith('/search/trending');
      expect(result).toEqual(mockTrendingResult);
    });
  });

  describe('getSimplePrice', () => {
    const mockPriceData = {
      bitcoin: { usd: 50000, usd_market_cap: 1000000000000 },
      ethereum: { usd: 3000, usd_market_cap: 400000000000 },
    };

    it('should fetch simple prices with default parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockPriceData);

      const result = await client.getSimplePrice(['bitcoin', 'ethereum']);

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/simple/price?ids=bitcoin%2Cethereum&vs_currencies=usd'
      );
      expect(result).toEqual(mockPriceData);
    });

    it('should fetch simple prices with additional data', async () => {
      mockHttpClient.get.mockResolvedValue(mockPriceData);

      const result = await client.getSimplePrice(
        ['bitcoin'],
        ['usd', 'eur'],
        {
          includeMarketCap: true,
          include24hrVol: true,
          include24hrChange: true,
          includeLastUpdatedAt: true,
        }
      );

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('include_market_cap=true')
      );
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('include_24hr_vol=true')
      );
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('include_24hr_change=true')
      );
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('include_last_updated_at=true')
      );
    });
  });

  describe('getSupportedVsCurrencies', () => {
    const mockCurrencies = ['usd', 'eur', 'jpy', 'btc', 'eth'];

    it('should fetch supported currencies', async () => {
      mockHttpClient.get.mockResolvedValue(mockCurrencies);

      const result = await client.getSupportedVsCurrencies();

      expect(mockHttpClient.get).toHaveBeenCalledWith('/simple/supported_vs_currencies');
      expect(result).toEqual(mockCurrencies);
    });
  });

  describe('ping', () => {
    const mockPingResponse = { gecko_says: '(V3) To the Moon!' };

    it('should ping the API', async () => {
      mockHttpClient.get.mockResolvedValue(mockPingResponse);

      const result = await client.ping();

      expect(mockHttpClient.get).toHaveBeenCalledWith('/ping');
      expect(result).toEqual(mockPingResponse);
    });
  });

  describe('getStatus', () => {
    it('should return circuit breaker status', () => {
      const status = client.getStatus();

      expect(status).toEqual({
        circuitBreaker: {
          state: 'CLOSED',
          failures: 0,
          lastFailureTime: 0,
        },
      });
    });
  });
});