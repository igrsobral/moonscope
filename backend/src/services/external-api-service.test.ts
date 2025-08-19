import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExternalApiService } from './external-api-service.js';

// Mock the API clients
vi.mock('./coingecko-client.js', () => ({
  CoinGeckoClient: vi.fn().mockImplementation(() => ({
    getTrendingCoins: vi.fn(),
    getCoinsMarkets: vi.fn(),
    searchCoins: vi.fn(),
    ping: vi.fn(),
    getStatus: vi.fn().mockReturnValue({
      circuitBreaker: { state: 'CLOSED', failures: 0 }
    }),
  })),
}));

vi.mock('./moralis-client.js', () => ({
  MoralisClient: vi.fn().mockImplementation(() => ({
    getTokenMetadata: vi.fn(),
    getTokenPrice: vi.fn(),
    getTokenHolders: vi.fn(),
    getWalletTokenBalances: vi.fn(),
    getTokenTransfers: vi.fn(),
    getStatus: vi.fn().mockReturnValue({
      circuitBreaker: { state: 'CLOSED', failures: 0 }
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
      debug: vi.fn(),
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

  describe('getTrendingCoins', () => {
    it('should fetch and transform trending coins data', async () => {
      const mockTrendingData = {
        coins: [
          {
            item: {
              id: 'bitcoin',
              symbol: 'BTC',
              name: 'Bitcoin',
              price_btc: 1,
            },
          },
          {
            item: {
              id: 'ethereum',
              symbol: 'ETH',
              name: 'Ethereum',
              price_btc: 0.065,
            },
          },
        ],
      };

      mockCoinGeckoClient.getTrendingCoins.mockResolvedValue(mockTrendingData);

      const result = await service.getTrendingCoins();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        price: 1,
        marketCap: 0,
        volume24h: 0,
        priceChange24h: 0,
      });
      expect(mockCoinGeckoClient.getTrendingCoins).toHaveBeenCalledOnce();
    });

    it('should handle errors gracefully', async () => {
      mockCoinGeckoClient.getTrendingCoins.mockRejectedValue(new Error('API Error'));

      await expect(service.getTrendingCoins()).rejects.toThrow('Failed to fetch trending coins');
      expect(mockLogger.error).toHaveBeenCalledWith(
        { error: 'API Error' },
        'Failed to fetch trending coins'
      );
    });
  });

  describe('getCoinsMarketData', () => {
    it('should fetch and transform market data', async () => {
      const mockMarketData = [
        {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          current_price: 50000,
          market_cap: 1000000000000,
          total_volume: 50000000000,
          price_change_percentage_24h: 2.5,
        },
      ];

      mockCoinGeckoClient.getCoinsMarkets.mockResolvedValue(mockMarketData);

      const result = await service.getCoinsMarketData(['bitcoin']);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        price: 50000,
        marketCap: 1000000000000,
        volume24h: 50000000000,
        priceChange24h: 2.5,
      });
      expect(mockCoinGeckoClient.getCoinsMarkets).toHaveBeenCalledWith({
        ids: ['bitcoin'],
        vsCurrency: 'usd',
        sparkline: false,
        priceChangePercentage: '24h',
      });
    });

    it('should handle custom options', async () => {
      mockCoinGeckoClient.getCoinsMarkets.mockResolvedValue([]);

      await service.getCoinsMarketData(['bitcoin'], {
        vsCurrency: 'eur',
        includeSparkline: true,
        priceChangePercentage: '7d',
      });

      expect(mockCoinGeckoClient.getCoinsMarkets).toHaveBeenCalledWith({
        ids: ['bitcoin'],
        vsCurrency: 'eur',
        sparkline: true,
        priceChangePercentage: '7d',
      });
    });
  });

  describe('searchCoins', () => {
    it('should search and transform coin results', async () => {
      const mockSearchResult = {
        coins: [
          {
            id: 'bitcoin',
            name: 'Bitcoin',
            symbol: 'BTC',
            market_cap_rank: 1,
          },
        ],
      };

      mockCoinGeckoClient.searchCoins.mockResolvedValue(mockSearchResult);

      const result = await service.searchCoins('bitcoin');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'bitcoin',
        name: 'Bitcoin',
        symbol: 'BTC',
        marketCapRank: 1,
      });
      expect(mockCoinGeckoClient.searchCoins).toHaveBeenCalledWith('bitcoin');
    });
  });

  describe('getTokenAnalysis', () => {
    it('should combine data from multiple sources', async () => {
      const mockMetadata = [
        {
          address: '0x1234567890123456789012345678901234567890',
          name: 'Test Token',
          symbol: 'TEST',
          decimals: '18',
          validated: 1,
        },
      ];

      const mockPriceData = {
        usdPrice: 100.5,
        nativePrice: {
          value: '1000000000000000000',
          decimals: 18,
        },
        '24hrPercentChange': '5.2',
        exchangeName: 'Uniswap v3',
      };

      const mockHoldersData = {
        result: [
          {
            address: '0xholder1',
            balance_formatted: '1000.0',
            percentage_relative_to_total_supply: 10.5,
          },
          {
            address: '0xholder2',
            balance_formatted: '500.0',
            percentage_relative_to_total_supply: 5.2,
          },
        ],
      };

      mockMoralisClient.getTokenMetadata.mockResolvedValue(mockMetadata);
      mockMoralisClient.getTokenPrice.mockResolvedValue(mockPriceData);
      mockMoralisClient.getTokenHolders.mockResolvedValue(mockHoldersData);

      const result = await service.getTokenAnalysis('0x1234567890123456789012345678901234567890');

      expect(result).toEqual({
        metadata: {
          address: '0x1234567890123456789012345678901234567890',
          name: 'Test Token',
          symbol: 'TEST',
          decimals: 18,
          verified: true,
        },
        price: {
          usd: 100.5,
          native: 1,
          change24h: 5.2,
        },
        holders: {
          count: 2,
          topHoldersPercentage: 15.7,
          distribution: [
            {
              address: '0xholder1',
              balance: '1000.0',
              percentage: 10.5,
            },
            {
              address: '0xholder2',
              balance: '500.0',
              percentage: 5.2,
            },
          ],
        },
        liquidity: {
          totalValueLocked: 0,
          exchanges: ['Uniswap v3'],
        },
      });

      expect(mockMoralisClient.getTokenMetadata).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        'eth'
      );
      expect(mockMoralisClient.getTokenPrice).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        'eth'
      );
      expect(mockMoralisClient.getTokenHolders).toHaveBeenCalledWith(
        '0x1234567890123456789012345678901234567890',
        'eth',
        { limit: 100, order: 'DESC' }
      );
    });
  });

  describe('getWalletTokens', () => {
    it('should fetch and transform wallet token balances', async () => {
      const mockBalances = {
        result: [
          {
            token_address: '0x1234567890123456789012345678901234567890',
            name: 'Test Token',
            symbol: 'TEST',
            balance: '1000000000000000000',
            decimals: 18,
            verified_contract: true,
            possible_spam: false,
          },
        ],
      };

      mockMoralisClient.getWalletTokenBalances.mockResolvedValue(mockBalances);

      const result = await service.getWalletTokens('0xwallet123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        address: '0x1234567890123456789012345678901234567890',
        name: 'Test Token',
        symbol: 'TEST',
        balance: '1000000000000000000',
        decimals: 18,
        verified: true,
        possibleSpam: false,
      });
      expect(mockMoralisClient.getWalletTokenBalances).toHaveBeenCalledWith(
        '0xwallet123',
        'eth',
        {
          excludeSpam: true,
          excludeUnverifiedContracts: true,
          limit: 100,
        }
      );
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status for both services', async () => {
      mockCoinGeckoClient.ping.mockResolvedValue({ gecko_says: 'OK' });
      mockMoralisClient.getTokenMetadata.mockResolvedValue([{ name: 'Test' }]);

      const result = await service.getHealthStatus();

      expect(result).toEqual({
        coinGecko: {
          status: 'healthy',
          circuitBreaker: { state: 'CLOSED', failures: 0 },
          lastError: null,
        },
        moralis: {
          status: 'healthy',
          circuitBreaker: { state: 'CLOSED', failures: 0 },
          lastError: null,
        },
      });
    });

    it('should handle service failures', async () => {
      mockCoinGeckoClient.ping.mockRejectedValue(new Error('CoinGecko Error'));
      mockMoralisClient.getTokenMetadata.mockRejectedValue(new Error('Moralis Error'));

      const result = await service.getHealthStatus();

      expect(result.coinGecko.status).toBe('unhealthy');
      expect(result.coinGecko.lastError).toBe('CoinGecko Error');
      expect(result.moralis.status).toBe('unhealthy');
      expect(result.moralis.lastError).toBe('Moralis Error');
    });
  });
});