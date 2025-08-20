import { PrismaClient, Coin, PriceData } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
// import { CoinGeckoClient } from './coingecko-client.js';
import { ExternalApiService } from './external-api-service.js';
import { CacheService } from './cache.js';
import { 
  CoinQuery, 
  CreateCoin, 
  UpdateCoin, 
  CreatePriceData, 
  NetworkType,
  PriceHistoryQuery 
} from '../schemas/coins.js';
import { ApiResponse, PaginationMeta } from '../types/index.js';

export interface CoinWithPriceData extends Coin {
  latestPrice?: PriceData;
  riskScore?: number;
}

export interface CoinDetailResponse extends CoinWithPriceData {
  priceHistory: PriceData[];
  socialMetrics?: any;
  riskAssessment?: any;
}

export class CoinService {
  constructor(
    private prisma: PrismaClient,
    private logger: FastifyBaseLogger,
    private cacheService: CacheService,
    private externalApiService: ExternalApiService
  ) {}

  /**
   * Get paginated list of coins with filtering and sorting
   */
  async getCoins(query: CoinQuery): Promise<ApiResponse<CoinWithPriceData[]>> {
    try {
      const { page, limit, sortBy, sortOrder, network, minMarketCap, maxRiskScore, search } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      
      if (network) {
        where.network = network;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { symbol: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Build orderBy clause
      let orderBy: any = {};
      switch (sortBy) {
        case 'name':
          orderBy = { name: sortOrder };
          break;
        case 'symbol':
          orderBy = { symbol: sortOrder };
          break;
        case 'price':
        case 'marketCap':
        case 'volume':
          // For price-related sorting, we'll need to join with price data
          orderBy = { 
            priceData: {
              _count: sortOrder === 'desc' ? 'desc' : 'asc'
            }
          };
          break;
        default:
          orderBy = { createdAt: sortOrder };
      }

      // Get total count for pagination
      const total = await this.prisma.coin.count({ where });

      // Get coins with latest price data
      const coins = await this.prisma.coin.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          priceData: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
          riskAssessments: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      // Transform data and apply additional filters
      const coinsWithPriceData: CoinWithPriceData[] = coins
        .map(coin => {
          const { priceData, riskAssessments, ...coinData } = coin;
          return {
            ...coinData,
            latestPrice: priceData[0] || undefined,
            riskScore: riskAssessments[0]?.overallScore || undefined,
          };
        })
        .filter(coin => {
          // Apply market cap filter
          if (minMarketCap && (!coin.latestPrice || Number(coin.latestPrice.marketCap) < minMarketCap)) {
            return false;
          }
          
          // Apply risk score filter
          if (maxRiskScore && (!coin.riskScore || coin.riskScore > maxRiskScore)) {
            return false;
          }
          
          return true;
        });

      // Sort by price-related fields if needed
      if (['price', 'marketCap', 'volume'].includes(sortBy)) {
        coinsWithPriceData.sort((a, b) => {
          let aValue = 0;
          let bValue = 0;

          switch (sortBy) {
            case 'price':
              aValue = Number(a.latestPrice?.price || 0);
              bValue = Number(b.latestPrice?.price || 0);
              break;
            case 'marketCap':
              aValue = Number(a.latestPrice?.marketCap || 0);
              bValue = Number(b.latestPrice?.marketCap || 0);
              break;
            case 'volume':
              aValue = Number(a.latestPrice?.volume24h || 0);
              bValue = Number(b.latestPrice?.volume24h || 0);
              break;
          }

          return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
        });
      }

      const totalPages = Math.ceil(total / limit);
      const pagination: PaginationMeta = {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };

      this.logger.info({ 
        query, 
        resultCount: coinsWithPriceData.length, 
        total 
      }, 'Successfully retrieved coins list');

      return {
        success: true,
        data: coinsWithPriceData,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '', // Will be set by the route handler
          pagination,
        },
      };
    } catch (error) {
      this.logger.error({ error, query }, 'Failed to get coins list');
      throw error;
    }
  }

  /**
   * Get coin by ID with comprehensive data
   */
  async getCoinById(id: number): Promise<ApiResponse<CoinDetailResponse>> {
    try {
      // Try to get from cache first
      const cacheKey = `coin:${id}:detail`;
      const cached = await this.cacheService.get<CoinDetailResponse>(cacheKey);
      
      if (cached) {
        this.logger.info({ coinId: id }, 'Retrieved coin detail from cache');
        return {
          success: true,
          data: cached,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: '',
          },
        };
      }

      const coin = await this.prisma.coin.findUnique({
        where: { id },
        include: {
          priceData: {
            orderBy: { timestamp: 'desc' },
            take: 100, // Last 100 price points for history
          },
          socialMetrics: {
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
          riskAssessments: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      if (!coin) {
        return {
          success: false,
          error: {
            code: 'COIN_NOT_FOUND',
            message: 'Coin not found',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: '',
          },
        };
      }

      const { priceData, riskAssessments, ...coinData } = coin;
      const coinDetail: CoinDetailResponse = {
        ...coinData,
        latestPrice: priceData[0] || undefined,
        priceHistory: priceData,
        riskScore: riskAssessments[0]?.overallScore || undefined,
        socialMetrics: coin.socialMetrics,
        riskAssessment: riskAssessments[0] || undefined,
      };

      // Cache the result for 5 minutes
      await this.cacheService.set(cacheKey, coinDetail, { ttl: 300 });

      this.logger.info({ coinId: id }, 'Successfully retrieved coin detail');

      return {
        success: true,
        data: coinDetail,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    } catch (error) {
      this.logger.error({ error, coinId: id }, 'Failed to get coin by ID');
      throw error;
    }
  }

  /**
   * Get coin by contract address
   */
  async getCoinByAddress(address: string): Promise<ApiResponse<CoinDetailResponse>> {
    try {
      const coin = await this.prisma.coin.findUnique({
        where: { address },
      });

      if (!coin) {
        return {
          success: false,
          error: {
            code: 'COIN_NOT_FOUND',
            message: 'Coin not found',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: '',
          },
        };
      }

      return this.getCoinById(coin.id);
    } catch (error) {
      this.logger.error({ error, address }, 'Failed to get coin by address');
      throw error;
    }
  }

  /**
   * Create a new coin
   */
  async createCoin(data: CreateCoin): Promise<ApiResponse<Coin>> {
    try {
      // Check if coin already exists
      const existingCoin = await this.prisma.coin.findUnique({
        where: { address: data.address },
      });

      if (existingCoin) {
        return {
          success: false,
          error: {
            code: 'COIN_ALREADY_EXISTS',
            message: 'Coin with this address already exists',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: '',
          },
        };
      }

      const coin = await this.prisma.coin.create({
        data: {
          address: data.address,
          symbol: data.symbol,
          name: data.name,
          network: data.network,
          contractVerified: data.contractVerified,
          logoUrl: data.logoUrl || null,
          description: data.description || null,
          website: data.website || null,
          socialLinks: data.socialLinks || {},
        },
      });

      // Invalidate coins list cache
      await this.cacheService.delete('coins:*');

      this.logger.info({ coinId: coin.id, address: coin.address }, 'Successfully created coin');

      return {
        success: true,
        data: coin,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to create coin');
      throw error;
    }
  }

  /**
   * Update coin information
   */
  async updateCoin(id: number, data: UpdateCoin): Promise<ApiResponse<Coin>> {
    try {
      const updateData: any = { updatedAt: new Date() };
      
      if (data.symbol !== undefined) updateData.symbol = data.symbol;
      if (data.name !== undefined) updateData.name = data.name;
      if (data.network !== undefined) updateData.network = data.network;
      if (data.contractVerified !== undefined) updateData.contractVerified = data.contractVerified;
      if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.website !== undefined) updateData.website = data.website;
      if (data.socialLinks !== undefined) updateData.socialLinks = data.socialLinks;

      const coin = await this.prisma.coin.update({
        where: { id },
        data: updateData,
      });

      // Invalidate cache
      await this.cacheService.delete(`coin:${id}:*`);
      await this.cacheService.delete('coins:*');

      this.logger.info({ coinId: id }, 'Successfully updated coin');

      return {
        success: true,
        data: coin,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    } catch (error) {
      this.logger.error({ error, coinId: id, data }, 'Failed to update coin');
      throw error;
    }
  }

  /**
   * Delete a coin
   */
  async deleteCoin(id: number): Promise<ApiResponse<void>> {
    try {
      await this.prisma.coin.delete({
        where: { id },
      });

      // Invalidate cache
      await this.cacheService.delete(`coin:${id}:*`);
      await this.cacheService.delete('coins:*');

      this.logger.info({ coinId: id }, 'Successfully deleted coin');

      return {
        success: true,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    } catch (error) {
      this.logger.error({ error, coinId: id }, 'Failed to delete coin');
      throw error;
    }
  }

  /**
   * Store price data for a coin
   */
  async storePriceData(data: CreatePriceData): Promise<ApiResponse<PriceData>> {
    try {
      const priceData = await this.prisma.priceData.create({
        data: {
          coinId: data.coinId,
          price: data.price,
          marketCap: BigInt(data.marketCap),
          volume24h: BigInt(data.volume24h),
          liquidity: BigInt(data.liquidity),
          priceChange24h: data.priceChange24h,
          volumeChange24h: data.volumeChange24h,
          timestamp: new Date(),
        },
      });

      // Invalidate coin detail cache
      await this.cacheService.delete(`coin:${data.coinId}:*`);

      this.logger.info({ coinId: data.coinId, price: data.price }, 'Successfully stored price data');

      return {
        success: true,
        data: priceData,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to store price data');
      throw error;
    }
  }

  /**
   * Get price history for a coin
   */
  async getPriceHistory(
    coinId: number, 
    query: PriceHistoryQuery
  ): Promise<ApiResponse<PriceData[]>> {
    try {
      const { timeframe } = query;
      
      // Calculate date range based on timeframe
      const now = new Date();
      let fromDate: Date;
      
      switch (timeframe) {
        case '1h':
          fromDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const priceHistory = await this.prisma.priceData.findMany({
        where: {
          coinId,
          timestamp: {
            gte: fromDate,
          },
        },
        orderBy: { timestamp: 'asc' },
      });

      this.logger.info({ 
        coinId, 
        timeframe, 
        dataPoints: priceHistory.length 
      }, 'Successfully retrieved price history');

      return {
        success: true,
        data: priceHistory,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    } catch (error) {
      this.logger.error({ error, coinId, query }, 'Failed to get price history');
      throw error;
    }
  }

  /**
   * Discover and import new coins from external APIs
   */
  async discoverCoins(network: NetworkType = 'ethereum'): Promise<ApiResponse<Coin[]>> {
    try {
      this.logger.info({ network }, 'Starting coin discovery');

      // Get trending meme coins from external API
      const trendingCoins = await this.externalApiService.getTrendingMemeCoins();
      const importedCoins: Coin[] = [];

      for (const tokenData of trendingCoins.slice(0, 10)) { // Limit to 10 coins
        try {
          // Check if coin already exists
          const existingCoin = await this.prisma.coin.findFirst({
            where: {
              OR: [
                { name: tokenData.name },
                { symbol: tokenData.symbol },
              ],
            },
          });

          if (existingCoin) {
            this.logger.info({ 
              coinName: tokenData.name, 
              symbol: tokenData.symbol 
            }, 'Coin already exists, skipping');
            continue;
          }

          // Create new coin
          const newCoin = await this.prisma.coin.create({
            data: {
              address: tokenData.contractAddress || `0x${Math.random().toString(16).substr(2, 40)}`, // Fallback address
              symbol: tokenData.symbol.toUpperCase(),
              name: tokenData.name,
              network,
              contractVerified: false,
              logoUrl: tokenData.image,
              socialLinks: {},
            },
          });

          // Store initial price data if available
          if (tokenData.currentPrice > 0) {
            await this.prisma.priceData.create({
              data: {
                coinId: newCoin.id,
                price: tokenData.currentPrice,
                marketCap: tokenData.marketCap || 0,
                volume24h: tokenData.volume24h || 0,
                liquidity: 0,
                priceChange24h: tokenData.priceChange24h || 0,
                volumeChange24h: 0,
                timestamp: new Date(),
              },
            });
          }

          importedCoins.push(newCoin);
          
          this.logger.info({ 
            coinId: newCoin.id, 
            name: newCoin.name, 
            symbol: newCoin.symbol 
          }, 'Successfully imported coin');
        } catch (error) {
          this.logger.warn({ 
            error, 
            tokenName: tokenData.name 
          }, 'Failed to import coin');
        }
      }

      // Invalidate coins cache
      await this.cacheService.delete('coins:*');

      this.logger.info({ 
        network, 
        importedCount: importedCoins.length 
      }, 'Completed coin discovery');

      return {
        success: true,
        data: importedCoins,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      };
    } catch (error) {
      this.logger.error({ error, network }, 'Failed to discover coins');
      throw error;
    }
  }

  /**
   * Search coins by name, symbol, or address
   */
  async searchCoins(query: string): Promise<ApiResponse<CoinWithPriceData[]>> {
    try {
      const searchQuery: CoinQuery = {
        page: 1,
        limit: 20,
        sortBy: 'marketCap',
        sortOrder: 'desc',
        search: query,
      };

      const result = await this.getCoins(searchQuery);
      
      this.logger.info({ query, resultCount: result.data?.length || 0 }, 'Successfully searched coins');
      
      return result;
    } catch (error) {
      this.logger.error({ error, query }, 'Failed to search coins');
      throw error;
    }
  }
}