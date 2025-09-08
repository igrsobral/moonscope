import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MoralisClient } from './moralis-client.js';
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
      constructor(
        message: string,
        public statusCode: number,
        public responseBody?: string
      ) {
        super(message);
        this.name = 'HttpError';
      }
    },
    RateLimitError: class RateLimitError extends Error {
      constructor(
        message: string,
        public retryAfter?: number
      ) {
        super(message);
        this.name = 'RateLimitError';
      }
    },
    CircuitBreaker: vi.fn(),
  };
});

import { HttpClient } from './http-client.js';

describe('MoralisClient', () => {
  let client: MoralisClient;
  let mockHttpClient: any;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    client = new MoralisClient({
      apiKey: 'test-api-key',
      logger: mockLogger,
    });

    // Get the mocked HttpClient instance
    mockHttpClient = (HttpClient as any).mock.results[0].value;
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with default configuration', () => {
      new MoralisClient({
        apiKey: 'test-default-key',
        logger: mockLogger,
      });

      expect(HttpClient).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://deep-index.moralis.io/api/v2.2',
          timeout: 30000,
          headers: {
            'X-API-Key': 'test-default-key',
          },
        }),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should create client with custom configuration', () => {
      new MoralisClient({
        apiKey: 'custom-key',
        baseUrl: 'https://custom-api.example.com',
        timeout: 60000,
        logger: mockLogger,
      });

      expect(HttpClient).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://custom-api.example.com',
          timeout: 60000,
          headers: {
            'X-API-Key': 'custom-key',
          },
        }),
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('getTokenMetadata', () => {
    const mockTokenMetadata = [
      {
        address: '0x1234567890123456789012345678901234567890',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: '18',
        logo: 'https://example.com/logo.png',
        created_at: '2023-01-01T00:00:00.000Z',
      },
    ];

    it('should fetch token metadata with default chain', async () => {
      mockHttpClient.get.mockResolvedValue(mockTokenMetadata);

      const result = await client.getTokenMetadata('0x1234567890123456789012345678901234567890');

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/erc20/metadata?chain=eth&addresses%5B0%5D=0x1234567890123456789012345678901234567890'
      );
      expect(result).toEqual(mockTokenMetadata);
    });

    it('should fetch token metadata with custom chain', async () => {
      mockHttpClient.get.mockResolvedValue(mockTokenMetadata);

      const result = await client.getTokenMetadata(
        '0x1234567890123456789012345678901234567890',
        'bsc'
      );

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/erc20/metadata?chain=bsc&addresses%5B0%5D=0x1234567890123456789012345678901234567890'
      );
      expect(result).toEqual(mockTokenMetadata);
    });
  });

  describe('getTokenPrice', () => {
    const mockTokenPrice = {
      tokenName: 'Test Token',
      tokenSymbol: 'TEST',
      tokenLogo: 'https://example.com/logo.png',
      tokenDecimals: '18',
      nativePrice: {
        value: '1000000000000000000',
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
      },
      usdPrice: 100.5,
      usdPriceFormatted: '100.50',
    };

    it('should fetch token price with default parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockTokenPrice);

      const result = await client.getTokenPrice('0x1234567890123456789012345678901234567890');

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/erc20/0x1234567890123456789012345678901234567890/price?chain=eth'
      );
      expect(result).toEqual(mockTokenPrice);
    });

    it('should fetch token price with custom parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockTokenPrice);

      const result = await client.getTokenPrice(
        '0x1234567890123456789012345678901234567890',
        'polygon',
        'uniswap-v3'
      );

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/erc20/0x1234567890123456789012345678901234567890/price?chain=polygon&exchange=uniswap-v3'
      );
      expect(result).toEqual(mockTokenPrice);
    });
  });

  describe('getWalletTokenBalances', () => {
    const mockTokenBalances = {
      cursor: 'next-page-cursor',
      page: 1,
      page_size: 100,
      result: [
        {
          token_address: '0x1234567890123456789012345678901234567890',
          name: 'Test Token',
          symbol: 'TEST',
          decimals: 18,
          balance: '1000000000000000000',
          possible_spam: false,
          verified_contract: true,
        },
      ],
    };

    it('should fetch wallet token balances with default parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockTokenBalances);

      const result = await client.getWalletTokenBalances(
        '0xabcdef1234567890123456789012345678901234'
      );

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/0xabcdef1234567890123456789012345678901234/erc20?chain=eth'
      );
      expect(result).toEqual(mockTokenBalances);
    });

    it('should fetch wallet token balances with custom parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockTokenBalances);

      const result = await client.getWalletTokenBalances(
        '0xabcdef1234567890123456789012345678901234',
        'bsc',
        {
          cursor: 'page-cursor',
          limit: 50,
          tokenAddresses: ['0x1111111111111111111111111111111111111111'],
          excludeSpam: true,
          excludeUnverifiedContracts: true,
        }
      );

      expect(mockHttpClient.get).toHaveBeenCalledWith(expect.stringContaining('chain=bsc'));
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('cursor=page-cursor')
      );
      expect(mockHttpClient.get).toHaveBeenCalledWith(expect.stringContaining('limit=50'));
      expect(mockHttpClient.get).toHaveBeenCalledWith(expect.stringContaining('exclude_spam=true'));
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('exclude_unverified_contracts=true')
      );
    });
  });

  describe('getWalletTransactions', () => {
    const mockTransactions = {
      cursor: 'next-page-cursor',
      page: 1,
      page_size: 100,
      result: [
        {
          hash: '0xabcdef1234567890123456789012345678901234567890123456789012345678',
          nonce: '1',
          transaction_index: '0',
          from_address: '0x1111111111111111111111111111111111111111',
          to_address: '0x2222222222222222222222222222222222222222',
          value: '1000000000000000000',
          gas: '21000',
          gas_price: '20000000000',
          gas_used: '21000',
          cumulative_gas_used: '21000',
          input: '0x',
          receipt_status: '1',
          block_timestamp: '2023-01-01T00:00:00.000Z',
          block_number: '12345678',
          block_hash: '0xabcdef1234567890123456789012345678901234567890123456789012345678',
        },
      ],
    };

    it('should fetch wallet transactions with default parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockTransactions);

      const result = await client.getWalletTransactions(
        '0xabcdef1234567890123456789012345678901234'
      );

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/0xabcdef1234567890123456789012345678901234?chain=eth'
      );
      expect(result).toEqual(mockTransactions);
    });

    it('should fetch wallet transactions with custom parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockTransactions);

      const result = await client.getWalletTransactions(
        '0xabcdef1234567890123456789012345678901234',
        'polygon',
        {
          cursor: 'page-cursor',
          limit: 50,
          fromBlock: 12000000,
          toBlock: 13000000,
          fromDate: '2023-01-01',
          toDate: '2023-12-31',
          includeInternalTransactions: true,
        }
      );

      expect(mockHttpClient.get).toHaveBeenCalledWith(expect.stringContaining('chain=polygon'));
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('from_block=12000000')
      );
      expect(mockHttpClient.get).toHaveBeenCalledWith(expect.stringContaining('to_block=13000000'));
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('include_internal_transactions=true')
      );
    });
  });

  describe('getTokenTransfers', () => {
    const mockTokenTransfers = {
      cursor: 'next-page-cursor',
      result: [
        {
          transaction_hash: '0xabcdef1234567890123456789012345678901234567890123456789012345678',
          address: '0x1234567890123456789012345678901234567890',
          block_timestamp: '2023-01-01T00:00:00.000Z',
          block_number: '12345678',
          block_hash: '0xabcdef1234567890123456789012345678901234567890123456789012345678',
          to_address: '0x2222222222222222222222222222222222222222',
          from_address: '0x1111111111111111111111111111111111111111',
          value: '1000000000000000000',
          transaction_index: '0',
          log_index: '0',
          possible_spam: false,
          verified_contract: true,
        },
      ],
    };

    it('should fetch token transfers with default parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockTokenTransfers);

      const result = await client.getTokenTransfers('0x1234567890123456789012345678901234567890');

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/erc20/0x1234567890123456789012345678901234567890/transfers?chain=eth'
      );
      expect(result).toEqual(mockTokenTransfers);
    });

    it('should fetch token transfers with custom parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockTokenTransfers);

      const result = await client.getTokenTransfers(
        '0x1234567890123456789012345678901234567890',
        'bsc',
        {
          cursor: 'page-cursor',
          limit: 50,
          fromBlock: 12000000,
          toBlock: 13000000,
          order: 'DESC',
        }
      );

      expect(mockHttpClient.get).toHaveBeenCalledWith(expect.stringContaining('chain=bsc'));
      expect(mockHttpClient.get).toHaveBeenCalledWith(expect.stringContaining('order=DESC'));
    });
  });

  describe('getTokenHolders', () => {
    const mockTokenHolders = {
      cursor: 'next-page-cursor',
      result: [
        {
          address: '0x1111111111111111111111111111111111111111',
          balance: '1000000000000000000',
          balance_formatted: '1.0',
          percentage_relative_to_total_supply: 10.5,
        },
      ],
    };

    it('should fetch token holders with default parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockTokenHolders);

      const result = await client.getTokenHolders('0x1234567890123456789012345678901234567890');

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/erc20/0x1234567890123456789012345678901234567890/owners?chain=eth'
      );
      expect(result).toEqual(mockTokenHolders);
    });

    it('should fetch token holders with custom parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockTokenHolders);

      const result = await client.getTokenHolders(
        '0x1234567890123456789012345678901234567890',
        'polygon',
        {
          cursor: 'page-cursor',
          limit: 100,
          order: 'ASC',
        }
      );

      expect(mockHttpClient.get).toHaveBeenCalledWith(expect.stringContaining('chain=polygon'));
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('cursor=page-cursor')
      );
      expect(mockHttpClient.get).toHaveBeenCalledWith(expect.stringContaining('order=ASC'));
    });
  });

  describe('getTransaction', () => {
    const mockTransaction = {
      hash: '0xabcdef1234567890123456789012345678901234567890123456789012345678',
      nonce: '1',
      transaction_index: '0',
      from_address: '0x1111111111111111111111111111111111111111',
      to_address: '0x2222222222222222222222222222222222222222',
      value: '1000000000000000000',
      gas: '21000',
      gas_price: '20000000000',
      gas_used: '21000',
      cumulative_gas_used: '21000',
      input: '0x',
      receipt_status: '1',
      block_timestamp: '2023-01-01T00:00:00.000Z',
      block_number: '12345678',
      block_hash: '0xabcdef1234567890123456789012345678901234567890123456789012345678',
    };

    it('should fetch transaction with default parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockTransaction);

      const result = await client.getTransaction(
        '0xabcdef1234567890123456789012345678901234567890123456789012345678'
      );

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/transaction/0xabcdef1234567890123456789012345678901234567890123456789012345678?chain=eth'
      );
      expect(result).toEqual(mockTransaction);
    });

    it('should fetch transaction with custom parameters', async () => {
      mockHttpClient.get.mockResolvedValue(mockTransaction);

      const result = await client.getTransaction(
        '0xabcdef1234567890123456789012345678901234567890123456789012345678',
        'bsc',
        true
      );

      expect(mockHttpClient.get).toHaveBeenCalledWith(expect.stringContaining('chain=bsc'));
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('include_internal_transactions=true')
      );
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      const error = new Error('API Error');
      (error as any).statusCode = 500;
      mockHttpClient.get.mockRejectedValue(error);

      await expect(
        client.getTokenMetadata('0x1234567890123456789012345678901234567890')
      ).rejects.toThrow('API Error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'getTokenMetadata',
          error: 'API Error',
          statusCode: 500,
        }),
        'Moralis API error'
      );
    });

    it('should handle rate limit errors', async () => {
      const error = new Error('Rate limit exceeded');
      (error as any).statusCode = 429;
      mockHttpClient.get.mockRejectedValue(error);

      await expect(
        client.getTokenMetadata('0x1234567890123456789012345678901234567890')
      ).rejects.toThrow(RateLimitError);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'getTokenMetadata',
          statusCode: 429,
        }),
        'Moralis API rate limit exceeded'
      );
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
