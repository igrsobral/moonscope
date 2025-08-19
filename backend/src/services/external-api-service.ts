import { CoinGeckoClient } from './coingecko-client.js';
import { MoralisClient, MoralisChain } from './moralis-client.js';
import { FastifyBaseLogger } from 'fastify';

export interface ExternalApiConfig {
  coinGecko: {
    apiKey?: string;
    baseUrl?: string;
  };
  moralis: {
    apiKey: string;
    baseUrl?: string;
  };
  logger?: FastifyBaseLogger;
}

export interface CoinData {
  id: string;
  address?: string;
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  chain?: MoralisChain;
}

export interface TokenAnalysis {
  metadata: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    verified: boolean;
  };
  price: {
    usd: number;
    native: number;
    change24h?: number;
  };
  holders: {
    count: number;
    topHoldersPercentage: number;
    distribution: Array<{
      address: string;
      balance: string;
      percentage: number;
    }>;
  };
  liquidity: {
    totalValueLocked: number;
    exchanges: string[];
  };
}

/**
 * Service that orchestrates external API calls to provide comprehensive coin data
 */
export class ExternalApiService {
  private coinGeckoClient: CoinGeckoClient;
  private moralisClient: MoralisClient;
  private logger?: FastifyBaseLogger;

  constructor(config: ExternalApiConfig) {
    this.logger = config.logger;
    
    this.coinGeckoClient = new CoinGeckoClient({
      apiKey: config.coinGecko.apiKey,
      baseUrl: config.coinGecko.baseUrl,
      logger: config.logger,
    });

    this.moralisClient = new MoralisClient({
      apiKey: config.moralis.apiKey,
      baseUrl: config.moralis.baseUrl,
      logger: config.logger,
    });
  }

  /**
   * Get trending meme coins from CoinGecko
   */
  async getTrendingCoins(): Promise<CoinData[]> {
    try {
      const trending = await this.coinGeckoClient.getTrendingCoins();
      
      return trending.coins.map(coin => ({
        id: coin.item.id,
        symbol: coin.item.symbol,
        name: coin.item.name,
        price: coin.item.price_btc,
        marketCap: 0, // Not available in trending endpoint
        volume24h: 0, // Not available in trending endpoint
        priceChange24h: 0, // Not available in trending endpoint
      }));
    } catch (error) {
      this.logger?.error({ error: (error as Error).message }, 'Failed to fetch trending coins');
      throw new Error('Failed to fetch trending coins');
    }
  }

  /**
   * Get detailed market data for specific coins
   */
  async getCoinsMarketData(
    coinIds: string[],
    options: {
      vsCurrency?: string;
      includeSparkline?: boolean;
      priceChangePercentage?: string;
    } = {}
  ): Promise<CoinData[]> {
    try {
      const marketData = await this.coinGeckoClient.getCoinsMarkets({
        ids: coinIds,
        vsCurrency: options.vsCurrency || 'usd',
        sparkline: options.includeSparkline || false,
        priceChangePercentage: options.priceChangePercentage || '24h',
      });

      return marketData.map(coin => ({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        price: coin.current_price,
        marketCap: coin.market_cap,
        volume24h: coin.total_volume,
        priceChange24h: coin.price_change_percentage_24h,
      }));
    } catch (error) {
      this.logger?.error({ error: (error as Error).message, coinIds }, 'Failed to fetch market data');
      throw new Error('Failed to fetch market data');
    }
  }

  /**
   * Search for coins by query
   */
  async searchCoins(query: string): Promise<Array<{ id: string; name: string; symbol: string; marketCapRank: number }>> {
    try {
      const searchResult = await this.coinGeckoClient.searchCoins(query);
      
      return searchResult.coins.map(coin => ({
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        marketCapRank: coin.market_cap_rank,
      }));
    } catch (error) {
      this.logger?.error({ error: (error as Error).message, query }, 'Failed to search coins');
      throw new Error('Failed to search coins');
    }
  }

  /**
   * Get comprehensive token analysis combining CoinGecko and Moralis data
   */
  async getTokenAnalysis(
    tokenAddress: string,
    chain: MoralisChain = 'eth'
  ): Promise<TokenAnalysis> {
    try {
      // Get token metadata from Moralis
      const [metadata] = await this.moralisClient.getTokenMetadata(tokenAddress, chain);
      
      // Get token price from Moralis
      const priceData = await this.moralisClient.getTokenPrice(tokenAddress, chain);
      
      // Get token holders (first page)
      const holdersData = await this.moralisClient.getTokenHolders(tokenAddress, chain, {
        limit: 100,
        order: 'DESC',
      });

      // Calculate holder distribution
      const totalSupply = parseFloat(metadata.decimals);
      const topHolders = holdersData.result.slice(0, 10);
      const topHoldersPercentage = topHolders.reduce(
        (sum, holder) => sum + (holder.percentage_relative_to_total_supply || 0),
        0
      );

      return {
        metadata: {
          address: metadata.address,
          name: metadata.name,
          symbol: metadata.symbol,
          decimals: parseInt(metadata.decimals),
          verified: metadata.validated === 1,
        },
        price: {
          usd: priceData.usdPrice,
          native: parseFloat(priceData.nativePrice.value) / Math.pow(10, priceData.nativePrice.decimals),
          change24h: priceData['24hrPercentChange'] ? parseFloat(priceData['24hrPercentChange']) : undefined,
        },
        holders: {
          count: holdersData.result.length,
          topHoldersPercentage,
          distribution: topHolders.map(holder => ({
            address: holder.address,
            balance: holder.balance_formatted,
            percentage: holder.percentage_relative_to_total_supply || 0,
          })),
        },
        liquidity: {
          totalValueLocked: 0, // Would need DEX data
          exchanges: priceData.exchangeName ? [priceData.exchangeName] : [],
        },
      };
    } catch (error) {
      this.logger?.error({ 
        error: (error as Error).message, 
        tokenAddress, 
        chain 
      }, 'Failed to get token analysis');
      throw new Error('Failed to get token analysis');
    }
  }

  /**
   * Get wallet token balances
   */
  async getWalletTokens(
    walletAddress: string,
    chain: MoralisChain = 'eth',
    options: {
      excludeSpam?: boolean;
      excludeUnverified?: boolean;
      limit?: number;
    } = {}
  ) {
    try {
      const balances = await this.moralisClient.getWalletTokenBalances(
        walletAddress,
        chain,
        {
          excludeSpam: options.excludeSpam !== false,
          excludeUnverifiedContracts: options.excludeUnverified !== false,
          limit: options.limit || 100,
        }
      );

      return balances.result.map(token => ({
        address: token.token_address,
        name: token.name,
        symbol: token.symbol,
        balance: token.balance,
        decimals: token.decimals,
        verified: token.verified_contract,
        possibleSpam: token.possible_spam,
      }));
    } catch (error) {
      this.logger?.error({ 
        error: (error as Error).message, 
        walletAddress, 
        chain 
      }, 'Failed to get wallet tokens');
      throw new Error('Failed to get wallet tokens');
    }
  }

  /**
   * Get large token transfers (whale movements)
   */
  async getWhaleMovements(
    tokenAddress: string,
    chain: MoralisChain = 'eth',
    options: {
      fromBlock?: number;
      toBlock?: number;
      limit?: number;
      minValue?: number; // Minimum USD value to consider as whale movement
    } = {}
  ) {
    try {
      const transfers = await this.moralisClient.getTokenTransfers(
        tokenAddress,
        chain,
        {
          fromBlock: options.fromBlock,
          toBlock: options.toBlock,
          limit: options.limit || 100,
          order: 'DESC',
        }
      );

      // Get token price to calculate USD values
      const priceData = await this.moralisClient.getTokenPrice(tokenAddress, chain);
      const tokenPrice = priceData.usdPrice;

      // Filter for large transfers
      const minValue = options.minValue || 10000; // $10k minimum
      
      return transfers.result
        .map(transfer => {
          const value = parseFloat(transfer.value);
          const usdValue = (value / Math.pow(10, 18)) * tokenPrice; // Assuming 18 decimals
          
          return {
            hash: transfer.transaction_hash,
            from: transfer.from_address,
            to: transfer.to_address,
            value: transfer.value,
            usdValue,
            timestamp: transfer.block_timestamp,
            blockNumber: transfer.block_number,
          };
        })
        .filter(transfer => transfer.usdValue >= minValue)
        .sort((a, b) => b.usdValue - a.usdValue);
    } catch (error) {
      this.logger?.error({ 
        error: (error as Error).message, 
        tokenAddress, 
        chain 
      }, 'Failed to get whale movements');
      throw new Error('Failed to get whale movements');
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus() {
    try {
      const [coinGeckoStatus, moralisStatus] = await Promise.allSettled([
        this.coinGeckoClient.ping(),
        // Moralis doesn't have a ping endpoint, so we'll check with a simple call
        this.moralisClient.getTokenMetadata('0xa0b86a33e6441e8c8c7014c8c7014c8c7014c8c7'),
      ]);

      return {
        coinGecko: {
          status: coinGeckoStatus.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          circuitBreaker: this.coinGeckoClient.getStatus().circuitBreaker,
          lastError: coinGeckoStatus.status === 'rejected' ? coinGeckoStatus.reason.message : null,
        },
        moralis: {
          status: moralisStatus.status === 'fulfilled' ? 'healthy' : 'unhealthy',
          circuitBreaker: this.moralisClient.getStatus().circuitBreaker,
          lastError: moralisStatus.status === 'rejected' ? moralisStatus.reason.message : null,
        },
      };
    } catch (error) {
      this.logger?.error({ error: (error as Error).message }, 'Failed to get health status');
      throw new Error('Failed to get health status');
    }
  }
}