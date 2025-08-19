import { HttpClient, HttpClientOptions, RateLimitError } from './http-client.js';
import { FastifyBaseLogger } from 'fastify';

export interface MoralisConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  logger?: FastifyBaseLogger;
}

export interface MoralisTokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: string;
  logo?: string;
  logo_hash?: string;
  thumbnail?: string;
  block_number?: string;
  validated?: number;
  created_at: string;
}

export interface MoralisTokenPrice {
  tokenName: string;
  tokenSymbol: string;
  tokenLogo: string;
  tokenDecimals: string;
  nativePrice: {
    value: string;
    decimals: number;
    name: string;
    symbol: string;
  };
  usdPrice: number;
  usdPriceFormatted: string;
  exchangeAddress?: string;
  exchangeName?: string;
  '24hrPercentChange'?: string;
  verified_contract?: boolean;
}

export interface MoralisTokenBalance {
  token_address: string;
  name: string;
  symbol: string;
  logo?: string;
  thumbnail?: string;
  decimals: number;
  balance: string;
  possible_spam: boolean;
  verified_contract: boolean;
  total_supply?: string;
  total_supply_formatted?: string;
  percentage_relative_to_total_supply?: number;
}

export interface MoralisTransaction {
  hash: string;
  nonce: string;
  transaction_index: string;
  from_address: string;
  to_address: string;
  value: string;
  gas: string;
  gas_price: string;
  gas_used: string;
  cumulative_gas_used: string;
  input: string;
  receipt_contract_address?: string;
  receipt_root?: string;
  receipt_status: string;
  block_timestamp: string;
  block_number: string;
  block_hash: string;
  transfer_index?: number[];
  logs?: MoralisTransactionLog[];
}

export interface MoralisTransactionLog {
  log_index: string;
  transaction_hash: string;
  transaction_index: string;
  address: string;
  data: string;
  topic0?: string;
  topic1?: string;
  topic2?: string;
  topic3?: string;
  block_timestamp: string;
  block_number: string;
  block_hash: string;
  decoded?: {
    signature: string;
    label: string;
    type: string;
    params: Array<{
      name: string;
      value: string;
      type: string;
    }>;
  };
}

export interface MoralisTokenTransfer {
  transaction_hash: string;
  address: string;
  block_timestamp: string;
  block_number: string;
  block_hash: string;
  to_address: string;
  from_address: string;
  value: string;
  transaction_index: string;
  log_index: string;
  possible_spam: boolean;
  verified_contract: boolean;
}

export interface MoralisWalletTokenBalances {
  cursor?: string;
  page?: number;
  page_size?: number;
  result: MoralisTokenBalance[];
}

export interface MoralisWalletTransactions {
  cursor?: string;
  page?: number;
  page_size?: number;
  result: MoralisTransaction[];
}

export interface MoralisTokenHolders {
  cursor?: string;
  page?: number;
  page_size?: number;
  result: Array<{
    token_hash: string;
    address: string;
    balance: string;
    balance_formatted: string;
    is_contract: boolean;
    owner_of: string;
    block_number: string;
    block_number_minted: string;
    contract_type: string;
    name: string;
    symbol: string;
    token_id: string;
    token_uri: string;
    metadata?: string;
    last_token_uri_sync: string;
    last_metadata_sync: string;
    minter_address: string;
    possible_spam: boolean;
    verified_collection: boolean;
  }>;
}

export type MoralisChain = 
  | 'eth' 
  | 'bsc' 
  | 'polygon' 
  | 'avalanche' 
  | 'fantom' 
  | 'cronos' 
  | 'arbitrum' 
  | 'optimism'
  | 'base'
  | 'linea';

export class MoralisClient {
  private httpClient: HttpClient;
  private logger?: FastifyBaseLogger;

  constructor(config: MoralisConfig) {
    this.logger = config.logger;
    
    const httpOptions: HttpClientOptions = {
      baseUrl: config.baseUrl || 'https://deep-index.moralis.io/api/v2.2',
      timeout: config.timeout || 30000,
      headers: {
        'X-API-Key': config.apiKey,
      },
      logger: config.logger,
    };

    // Moralis rate limits vary by plan
    this.httpClient = new HttpClient(
      httpOptions,
      {
        threshold: 3,
        timeout: 120000, // 2 minutes
        monitoringPeriod: 60000, // 1 minute
      },
      {
        maxRetries: 2,
        baseDelay: 2000,
        maxDelay: 30000,
        backoffFactor: 2,
      }
    );
  }

  /**
   * Get token metadata by contract address
   */
  async getTokenMetadata(
    address: string,
    chain: MoralisChain = 'eth'
  ): Promise<MoralisTokenMetadata[]> {
    try {
      return await this.httpClient.get<MoralisTokenMetadata[]>(
        `/erc20/metadata?chain=${chain}&addresses%5B0%5D=${address}`
      );
    } catch (error) {
      this.handleApiError(error, 'getTokenMetadata');
      throw error;
    }
  }

  /**
   * Get token price by contract address
   */
  async getTokenPrice(
    address: string,
    chain: MoralisChain = 'eth',
    exchange?: string
  ): Promise<MoralisTokenPrice> {
    const params = new URLSearchParams({
      chain,
    });

    if (exchange) {
      params.append('exchange', exchange);
    }

    try {
      return await this.httpClient.get<MoralisTokenPrice>(
        `/erc20/${address}/price?${params.toString()}`
      );
    } catch (error) {
      this.handleApiError(error, 'getTokenPrice');
      throw error;
    }
  }

  /**
   * Get wallet token balances
   */
  async getWalletTokenBalances(
    address: string,
    chain: MoralisChain = 'eth',
    options: {
      cursor?: string;
      limit?: number;
      tokenAddresses?: string[];
      excludeSpam?: boolean;
      excludeUnverifiedContracts?: boolean;
    } = {}
  ): Promise<MoralisWalletTokenBalances> {
    const params = new URLSearchParams({
      chain,
    });

    if (options.cursor) {
      params.append('cursor', options.cursor);
    }
    if (options.limit) {
      params.append('limit', String(options.limit));
    }
    if (options.tokenAddresses && options.tokenAddresses.length > 0) {
      options.tokenAddresses.forEach((addr, index) => {
        params.append(`token_addresses[${index}]`, addr);
      });
    }
    if (options.excludeSpam) {
      params.append('exclude_spam', 'true');
    }
    if (options.excludeUnverifiedContracts) {
      params.append('exclude_unverified_contracts', 'true');
    }

    try {
      return await this.httpClient.get<MoralisWalletTokenBalances>(
        `/${address}/erc20?${params.toString()}`
      );
    } catch (error) {
      this.handleApiError(error, 'getWalletTokenBalances');
      throw error;
    }
  }

  /**
   * Get wallet transactions
   */
  async getWalletTransactions(
    address: string,
    chain: MoralisChain = 'eth',
    options: {
      cursor?: string;
      limit?: number;
      fromBlock?: number;
      toBlock?: number;
      fromDate?: string;
      toDate?: string;
      includeInternalTransactions?: boolean;
    } = {}
  ): Promise<MoralisWalletTransactions> {
    const params = new URLSearchParams({
      chain,
    });

    if (options.cursor) {
      params.append('cursor', options.cursor);
    }
    if (options.limit) {
      params.append('limit', String(options.limit));
    }
    if (options.fromBlock) {
      params.append('from_block', String(options.fromBlock));
    }
    if (options.toBlock) {
      params.append('to_block', String(options.toBlock));
    }
    if (options.fromDate) {
      params.append('from_date', options.fromDate);
    }
    if (options.toDate) {
      params.append('to_date', options.toDate);
    }
    if (options.includeInternalTransactions) {
      params.append('include_internal_transactions', 'true');
    }

    try {
      return await this.httpClient.get<MoralisWalletTransactions>(
        `/${address}?${params.toString()}`
      );
    } catch (error) {
      this.handleApiError(error, 'getWalletTransactions');
      throw error;
    }
  }

  /**
   * Get token transfers for a specific token
   */
  async getTokenTransfers(
    address: string,
    chain: MoralisChain = 'eth',
    options: {
      cursor?: string;
      limit?: number;
      fromBlock?: number;
      toBlock?: number;
      fromDate?: string;
      toDate?: string;
      order?: 'ASC' | 'DESC';
    } = {}
  ): Promise<{ cursor?: string; result: MoralisTokenTransfer[] }> {
    const params = new URLSearchParams({
      chain,
    });

    if (options.cursor) {
      params.append('cursor', options.cursor);
    }
    if (options.limit) {
      params.append('limit', String(options.limit));
    }
    if (options.fromBlock) {
      params.append('from_block', String(options.fromBlock));
    }
    if (options.toBlock) {
      params.append('to_block', String(options.toBlock));
    }
    if (options.fromDate) {
      params.append('from_date', options.fromDate);
    }
    if (options.toDate) {
      params.append('to_date', options.toDate);
    }
    if (options.order) {
      params.append('order', options.order);
    }

    try {
      return await this.httpClient.get<{ cursor?: string; result: MoralisTokenTransfer[] }>(
        `/erc20/${address}/transfers?${params.toString()}`
      );
    } catch (error) {
      this.handleApiError(error, 'getTokenTransfers');
      throw error;
    }
  }

  /**
   * Get token holders for a specific token
   */
  async getTokenHolders(
    address: string,
    chain: MoralisChain = 'eth',
    options: {
      cursor?: string;
      limit?: number;
      order?: 'ASC' | 'DESC';
    } = {}
  ): Promise<{ cursor?: string; result: Array<{ address: string; balance: string; balance_formatted: string; percentage_relative_to_total_supply?: number }> }> {
    const params = new URLSearchParams({
      chain,
    });

    if (options.cursor) {
      params.append('cursor', options.cursor);
    }
    if (options.limit) {
      params.append('limit', String(options.limit));
    }
    if (options.order) {
      params.append('order', options.order);
    }

    try {
      return await this.httpClient.get<{ cursor?: string; result: Array<{ address: string; balance: string; balance_formatted: string; percentage_relative_to_total_supply?: number }> }>(
        `/erc20/${address}/owners?${params.toString()}`
      );
    } catch (error) {
      this.handleApiError(error, 'getTokenHolders');
      throw error;
    }
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(
    hash: string,
    chain: MoralisChain = 'eth',
    includeInternalTransactions: boolean = false
  ): Promise<MoralisTransaction> {
    const params = new URLSearchParams({
      chain,
    });

    if (includeInternalTransactions) {
      params.append('include_internal_transactions', 'true');
    }

    try {
      return await this.httpClient.get<MoralisTransaction>(
        `/transaction/${hash}?${params.toString()}`
      );
    } catch (error) {
      this.handleApiError(error, 'getTransaction');
      throw error;
    }
  }

  /**
   * Get block by hash or number
   */
  async getBlock(
    blockNumberOrHash: string | number,
    chain: MoralisChain = 'eth',
    includeTransactions: boolean = false
  ): Promise<{
    timestamp: string;
    number: string;
    hash: string;
    parent_hash: string;
    nonce: string;
    sha3_uncles: string;
    logs_bloom: string;
    transactions_root: string;
    state_root: string;
    receipts_root: string;
    miner: string;
    difficulty: string;
    total_difficulty: string;
    size: string;
    extra_data: string;
    gas_limit: string;
    gas_used: string;
    transaction_count: string;
    transactions?: MoralisTransaction[];
  }> {
    const params = new URLSearchParams({
      chain,
    });

    if (includeTransactions) {
      params.append('include', 'internal_transactions');
    }

    try {
      return await this.httpClient.get(
        `/block/${blockNumberOrHash}?${params.toString()}`
      );
    } catch (error) {
      this.handleApiError(error, 'getBlock');
      throw error;
    }
  }

  private handleApiError(error: any, method: string): void {
    if (error.statusCode === 429) {
      this.logger?.warn({
        method,
        error: error.message,
        statusCode: error.statusCode,
      }, 'Moralis API rate limit exceeded');
      
      throw new RateLimitError('Moralis API rate limit exceeded');
    }

    this.logger?.error({
      method,
      error: error.message,
      statusCode: error.statusCode,
      responseBody: error.responseBody,
    }, 'Moralis API error');
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      circuitBreaker: this.httpClient.getCircuitBreakerState(),
    };
  }
}