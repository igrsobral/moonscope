import { CoinGeckoClient } from './coingecko-client.js';
import {
  MoralisClient,
  MoralisTokenPrice,
  MoralisTokenTransfer,
  MoralisChain,
} from './moralis-client.js';
import { FastifyBaseLogger } from 'fastify';

export interface ExternalApiConfig {
  coinGecko: {
    apiKey?: string;
    baseUrl?: string;
    timeout?: number;
  };
  moralis: {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
  };
  logger?: FastifyBaseLogger;
}

export interface MemeTokenData {
  // CoinGecko data
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;

  // Moralis blockchain data
  contractAddress?: string;
  chain?: MoralisChain;
  tokenPrice?: MoralisTokenPrice;
  recentTransfers?: MoralisTokenTransfer[];

  // Combined metrics
  riskScore?: number;
  liquidityScore?: number;
  socialScore?: number;
}

export interface WhaleTransaction {
  hash: string;
  tokenAddress: string;
  tokenSymbol: string;
  fromAddress: string;
  toAddress: string;
  value: string;
  usdValue: number;
  timestamp: string;
  blockNumber: string;
}

export class ExternalApiService {
  private coinGeckoClient: CoinGeckoClient;
  private moralisClient: MoralisClient;
  private logger?: FastifyBaseLogger;

  constructor(config: ExternalApiConfig) {
    this.logger = config.logger;

    this.coinGeckoClient = new CoinGeckoClient({
      apiKey: config.coinGecko.apiKey,
      baseUrl: config.coinGecko.baseUrl,
      timeout: config.coinGecko.timeout,
      logger: config.logger,
    });

    this.moralisClient = new MoralisClient({
      apiKey: config.moralis.apiKey,
      baseUrl: config.moralis.baseUrl,
      timeout: config.moralis.timeout,
      logger: config.logger,
    });
  }

  /**
   * Get trending meme coins with enhanced data
   */
  async getTrendingMemeCoins(): Promise<MemeTokenData[]> {
    try {
      this.logger?.info('Fetching trending meme coins from CoinGecko');

      const trendingData = await this.coinGeckoClient.getTrendingCoins();
      const memeTokens: MemeTokenData[] = [];

      for (const coin of trendingData.coins) {
        const tokenData: MemeTokenData = {
          id: coin.item.id,
          symbol: coin.item.symbol,
          name: coin.item.name,
          image: coin.item.large,
          currentPrice: 0, // Will be fetched separately
          marketCap: 0,
          volume24h: 0,
          priceChange24h: 0,
        };

        // Fetch detailed market data
        try {
          const marketData = await this.coinGeckoClient.getCoinsMarkets({
            ids: [coin.item.id],
            perPage: 1,
          });

          if (marketData.length > 0) {
            const market = marketData[0];
            tokenData.currentPrice = market.current_price;
            tokenData.marketCap = market.market_cap;
            tokenData.volume24h = market.total_volume;
            tokenData.priceChange24h = market.price_change_percentage_24h;
          }
        } catch (error) {
          this.logger?.warn(
            {
              coinId: coin.item.id,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to fetch market data for trending coin'
          );
        }

        memeTokens.push(tokenData);
      }

      this.logger?.info({ count: memeTokens.length }, 'Successfully fetched trending meme coins');
      return memeTokens;
    } catch (error) {
      this.logger?.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to fetch trending meme coins'
      );
      throw error;
    }
  }

  /**
   * Get meme coins by category with pagination
   */
  async getMemeTokensByCategory(
    options: {
      page?: number;
      perPage?: number;
      sortBy?: 'market_cap_desc' | 'volume_desc' | 'price_change_24h_desc';
    } = {}
  ): Promise<MemeTokenData[]> {
    try {
      this.logger?.info({ options }, 'Fetching meme tokens by category');

      const marketData = await this.coinGeckoClient.getCoinsMarkets({
        category: 'meme-token',
        page: options.page || 1,
        perPage: options.perPage || 50,
        order: options.sortBy || 'market_cap_desc',
        priceChangePercentage: '24h',
      });

      const memeTokens: MemeTokenData[] = marketData.map(coin => ({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        image: coin.image,
        currentPrice: coin.current_price,
        marketCap: coin.market_cap,
        volume24h: coin.total_volume,
        priceChange24h: coin.price_change_percentage_24h,
      }));

      this.logger?.info(
        { count: memeTokens.length },
        'Successfully fetched meme tokens by category'
      );
      return memeTokens;
    } catch (error) {
      this.logger?.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to fetch meme tokens by category'
      );
      throw error;
    }
  }

  /**
   * Get enhanced token data combining CoinGecko and Moralis data
   */
  async getEnhancedTokenData(
    coinGeckoId: string,
    contractAddress?: string,
    chain: MoralisChain = 'eth'
  ): Promise<MemeTokenData> {
    try {
      this.logger?.info({ coinGeckoId, contractAddress, chain }, 'Fetching enhanced token data');

      // Fetch CoinGecko data
      const [coinDetail, marketData] = await Promise.all([
        this.coinGeckoClient.getCoinById(coinGeckoId),
        this.coinGeckoClient.getCoinsMarkets({ ids: [coinGeckoId], perPage: 1 }),
      ]);

      const market = marketData[0];
      const tokenData: MemeTokenData = {
        id: coinDetail.id,
        symbol: coinDetail.symbol,
        name: coinDetail.name,
        image: coinDetail.image.large,
        currentPrice: market?.current_price || 0,
        marketCap: market?.market_cap || 0,
        volume24h: market?.total_volume || 0,
        priceChange24h: market?.price_change_percentage_24h || 0,
        contractAddress,
        chain,
      };

      // Fetch Moralis data if contract address is provided
      if (contractAddress) {
        try {
          const [tokenPrice, recentTransfers] = await Promise.all([
            this.moralisClient.getTokenPrice(contractAddress, chain).catch(() => null),
            this.moralisClient
              .getTokenTransfers(contractAddress, chain, {
                limit: 10,
                order: 'DESC',
              })
              .catch(() => null),
          ]);

          if (tokenPrice) {
            tokenData.tokenPrice = tokenPrice;
          }

          if (recentTransfers) {
            tokenData.recentTransfers = recentTransfers.result;
          }
        } catch (error) {
          this.logger?.warn(
            {
              contractAddress,
              chain,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to fetch Moralis data for token'
          );
        }
      }

      this.logger?.info({ tokenId: tokenData.id }, 'Successfully fetched enhanced token data');
      return tokenData;
    } catch (error) {
      this.logger?.error(
        {
          coinGeckoId,
          contractAddress,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to fetch enhanced token data'
      );
      throw error;
    }
  }

  /**
   * Detect whale transactions for a specific token
   */
  async getWhaleTransactions(
    contractAddress: string,
    chain: MoralisChain = 'eth',
    options: {
      minUsdValue?: number;
      limit?: number;
      fromDate?: string;
      toDate?: string;
    } = {}
  ): Promise<WhaleTransaction[]> {
    try {
      this.logger?.info({ contractAddress, chain, options }, 'Fetching whale transactions');

      const { minUsdValue = 10000, limit = 50 } = options;

      // Get token transfers
      const transfersResponse = await this.moralisClient.getTokenTransfers(contractAddress, chain, {
        limit,
        order: 'DESC',
        fromDate: options.fromDate,
        toDate: options.toDate,
      });

      // Get token price for USD value calculation
      let tokenPrice: MoralisTokenPrice | null = null;
      try {
        tokenPrice = await this.moralisClient.getTokenPrice(contractAddress, chain);
      } catch (error) {
        this.logger?.warn(
          {
            contractAddress,
            error: error instanceof Error ? error.message : String(error),
          },
          'Failed to fetch token price for whale transaction calculation'
        );
      }

      const whaleTransactions: WhaleTransaction[] = [];

      for (const transfer of transfersResponse.result) {
        let usdValue = 0;

        if (tokenPrice) {
          // Convert token amount to USD
          const tokenAmount = parseFloat(transfer.value) / Math.pow(10, 18); // Assuming 18 decimals
          usdValue = tokenAmount * tokenPrice.usdPrice;
        }

        // Filter for whale transactions
        if (usdValue >= minUsdValue) {
          whaleTransactions.push({
            hash: transfer.transaction_hash,
            tokenAddress: transfer.address,
            tokenSymbol: tokenPrice?.tokenSymbol || 'UNKNOWN',
            fromAddress: transfer.from_address,
            toAddress: transfer.to_address,
            value: transfer.value,
            usdValue,
            timestamp: transfer.block_timestamp,
            blockNumber: transfer.block_number,
          });
        }
      }

      this.logger?.info(
        {
          contractAddress,
          totalTransfers: transfersResponse.result.length,
          whaleTransactions: whaleTransactions.length,
        },
        'Successfully detected whale transactions'
      );

      return whaleTransactions;
    } catch (error) {
      this.logger?.error(
        {
          contractAddress,
          chain,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to fetch whale transactions'
      );
      throw error;
    }
  }

  /**
   * Get service health status including circuit breaker states
   */
  getServiceStatus() {
    return {
      coinGecko: this.coinGeckoClient.getStatus(),
      moralis: this.moralisClient.getStatus(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Search for meme coins across both platforms
   */
  async searchMemeCoins(query: string): Promise<MemeTokenData[]> {
    try {
      this.logger?.info({ query }, 'Searching for meme coins');

      const searchResults = await this.coinGeckoClient.searchCoins(query);
      const memeTokens: MemeTokenData[] = [];

      // Filter for potential meme coins and fetch market data
      const memeKeywords = ['meme', 'doge', 'shib', 'pepe', 'floki', 'inu', 'moon', 'safe'];
      const potentialMemeCoins = searchResults.coins.filter(coin =>
        memeKeywords.some(
          keyword =>
            coin.name.toLowerCase().includes(keyword) || coin.symbol.toLowerCase().includes(keyword)
        )
      );

      for (const coin of potentialMemeCoins.slice(0, 10)) {
        // Limit to 10 results
        try {
          const marketData = await this.coinGeckoClient.getCoinsMarkets({
            ids: [coin.id],
            perPage: 1,
          });

          if (marketData.length > 0) {
            const market = marketData[0];
            memeTokens.push({
              id: coin.id,
              symbol: coin.symbol,
              name: coin.name,
              image: coin.large,
              currentPrice: market.current_price,
              marketCap: market.market_cap,
              volume24h: market.total_volume,
              priceChange24h: market.price_change_percentage_24h,
            });
          }
        } catch (error) {
          this.logger?.warn(
            {
              coinId: coin.id,
              error: error instanceof Error ? error.message : String(error),
            },
            'Failed to fetch market data for search result'
          );
        }
      }

      this.logger?.info({ query, results: memeTokens.length }, 'Successfully searched meme coins');
      return memeTokens;
    } catch (error) {
      this.logger?.error(
        {
          query,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to search meme coins'
      );
      throw error;
    }
  }
}
