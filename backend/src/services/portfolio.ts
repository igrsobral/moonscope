import { PrismaClient, Portfolio, Coin, PriceData, Prisma } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
import { CacheService } from './cache.js';
import { ExternalApiService } from './external-api-service.js';
import {
    PortfolioQuery,
    CreatePortfolio,
    UpdatePortfolio,
    WalletIntegration,
    PortfolioAnalyticsQuery,
    PortfolioPerformanceQuery
} from '../schemas/portfolio.js';
import { ApiResponse, PaginationMeta } from '../types/index.js';

export interface PortfolioWithCoin extends Portfolio {
    coin: Coin & {
        latestPrice?: PriceData;
    };
}

export interface PortfolioAnalytics {
    totalValue: number;
    totalInvested: number;
    totalProfitLoss: number;
    totalProfitLossPercentage: number;
    topPerformers: PortfolioWithCoin[];
    worstPerformers: PortfolioWithCoin[];
    allocation: {
        coinId: number;
        symbol: string;
        name: string;
        percentage: number;
        value: number;
    }[];
}

export interface PortfolioPerformance {
    timestamps: string[];
    values: number[];
    profitLoss: number[];
    profitLossPercentage: number[];
}

export interface WalletHolding {
    tokenAddress: string;
    symbol: string;
    name: string;
    balance: string;
    decimals: number;
    price?: number;
    value?: number;
}

export class PortfolioService {
    constructor(
        private prisma: PrismaClient,
        private logger: FastifyBaseLogger,
        private cacheService: CacheService,
        private externalApiService: ExternalApiService
    ) { }

    /**
     * Get user's portfolio with filtering and pagination
     */
    async getPortfolio(userId: number, query: PortfolioQuery): Promise<ApiResponse<PortfolioWithCoin[]>> {
        try {
            const { page, limit, sortBy, sortOrder, coinId } = query;
            const skip = (page - 1) * limit;

            // Build where clause
            const where: any = { userId };
            if (coinId) {
                where.coinId = coinId;
            }

            // Get total count for pagination
            const total = await this.prisma.portfolio.count({ where });

            // Build orderBy clause
            let orderBy: any = {};
            switch (sortBy) {
                case 'amount':
                    orderBy = { amount: sortOrder };
                    break;
                case 'currentValue':
                    orderBy = { currentValue: sortOrder };
                    break;
                case 'profitLoss':
                    orderBy = { profitLoss: sortOrder };
                    break;
                case 'profitLossPercentage':
                    orderBy = { profitLossPercentage: sortOrder };
                    break;
                default:
                    orderBy = { createdAt: sortOrder };
            }

            // Get portfolio holdings with coin data
            const portfolioHoldings = await this.prisma.portfolio.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: {
                    coin: {
                        include: {
                            priceData: {
                                orderBy: { timestamp: 'desc' },
                                take: 1,
                            },
                        },
                    },
                },
            });

            // Transform data to include latest price
            const portfolioWithCoin: PortfolioWithCoin[] = portfolioHoldings.map(holding => {
                const { coin, ...portfolioData } = holding;
                const { priceData, ...coinData } = coin;

                return {
                    ...portfolioData,
                    coin: {
                        ...coinData,
                        latestPrice: priceData[0] || undefined,
                    },
                };
            });

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
                userId,
                query,
                resultCount: portfolioWithCoin.length,
                total
            }, 'Successfully retrieved portfolio');

            return {
                success: true,
                data: portfolioWithCoin,
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: '',
                    pagination,
                },
            };
        } catch (error) {
            this.logger.error({ error, userId, query }, 'Failed to get portfolio');
            throw error;
        }
    }

    /**
     * Add or update a portfolio holding
     */
    async addOrUpdateHolding(userId: number, data: CreatePortfolio): Promise<ApiResponse<PortfolioWithCoin>> {
        try {
            // Check if holding already exists
            const existingHolding = await this.prisma.portfolio.findUnique({
                where: {
                    userId_coinId: {
                        userId,
                        coinId: data.coinId,
                    },
                },
            });

            let portfolio: Portfolio;

            if (existingHolding) {
                // Update existing holding - calculate new average price
                const totalAmount = Number(existingHolding.amount) + data.amount;
                const totalValue = (Number(existingHolding.amount) * Number(existingHolding.avgPrice)) +
                    (data.amount * data.avgPrice);
                const newAvgPrice = totalValue / totalAmount;

                portfolio = await this.prisma.portfolio.update({
                    where: { id: existingHolding.id },
                    data: {
                        amount: totalAmount,
                        avgPrice: newAvgPrice,
                        updatedAt: new Date(),
                    },
                });

                this.logger.info({
                    userId,
                    coinId: data.coinId,
                    oldAmount: existingHolding.amount,
                    newAmount: totalAmount,
                    newAvgPrice
                }, 'Updated existing portfolio holding');
            } else {
                // Create new holding
                portfolio = await this.prisma.portfolio.create({
                    data: {
                        userId,
                        coinId: data.coinId,
                        amount: data.amount,
                        avgPrice: data.avgPrice,
                    },
                });

                this.logger.info({
                    userId,
                    coinId: data.coinId,
                    amount: data.amount,
                    avgPrice: data.avgPrice
                }, 'Created new portfolio holding');
            }

            // Update portfolio values
            await this.updatePortfolioValues(userId, data.coinId);

            // Get updated holding with coin data
            const updatedHolding = await this.prisma.portfolio.findUnique({
                where: { id: portfolio.id },
                include: {
                    coin: {
                        include: {
                            priceData: {
                                orderBy: { timestamp: 'desc' },
                                take: 1,
                            },
                        },
                    },
                },
            });

            if (!updatedHolding) {
                throw new Error('Failed to retrieve updated holding');
            }

            const { coin, ...portfolioData } = updatedHolding;
            const { priceData, ...coinData } = coin;

            const result: PortfolioWithCoin = {
                ...portfolioData,
                coin: {
                    ...coinData,
                    latestPrice: priceData[0] || undefined,
                },
            };

            // Invalidate cache
            await this.cacheService.delete(`portfolio:${userId}:*`);

            return {
                success: true,
                data: result,
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: '',
                },
            };
        } catch (error) {
            this.logger.error({ error, userId, data }, 'Failed to add/update portfolio holding');
            throw error;
        }
    }

    /**
     * Update a portfolio holding
     */
    async updateHolding(userId: number, holdingId: number, data: UpdatePortfolio): Promise<ApiResponse<PortfolioWithCoin>> {
        try {
            // Verify ownership
            const existingHolding = await this.prisma.portfolio.findFirst({
                where: {
                    id: holdingId,
                    userId,
                },
            });

            if (!existingHolding) {
                return {
                    success: false,
                    error: {
                        code: 'HOLDING_NOT_FOUND',
                        message: 'Portfolio holding not found',
                    },
                    meta: {
                        timestamp: new Date().toISOString(),
                        requestId: '',
                    },
                };
            }

            // Update holding
            const updateData: any = { updatedAt: new Date() };
            if (data.amount !== undefined) updateData.amount = data.amount;
            if (data.avgPrice !== undefined) updateData.avgPrice = data.avgPrice;

            const portfolio = await this.prisma.portfolio.update({
                where: { id: holdingId },
                data: updateData,
            });

            // Update portfolio values
            await this.updatePortfolioValues(userId, existingHolding.coinId);

            // Get updated holding with coin data
            const updatedHolding = await this.prisma.portfolio.findUnique({
                where: { id: portfolio.id },
                include: {
                    coin: {
                        include: {
                            priceData: {
                                orderBy: { timestamp: 'desc' },
                                take: 1,
                            },
                        },
                    },
                },
            });

            if (!updatedHolding) {
                throw new Error('Failed to retrieve updated holding');
            }

            const { coin, ...portfolioData } = updatedHolding;
            const { priceData, ...coinData } = coin;

            const result: PortfolioWithCoin = {
                ...portfolioData,
                coin: {
                    ...coinData,
                    latestPrice: priceData[0] || undefined,
                },
            };

            // Invalidate cache
            await this.cacheService.delete(`portfolio:${userId}:*`);

            this.logger.info({ userId, holdingId }, 'Successfully updated portfolio holding');

            return {
                success: true,
                data: result,
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: '',
                },
            };
        } catch (error) {
            this.logger.error({ error, userId, holdingId, data }, 'Failed to update portfolio holding');
            throw error;
        }
    }

    /**
     * Delete a portfolio holding
     */
    async deleteHolding(userId: number, holdingId: number): Promise<ApiResponse<void>> {
        try {
            // Verify ownership
            const existingHolding = await this.prisma.portfolio.findFirst({
                where: {
                    id: holdingId,
                    userId,
                },
            });

            if (!existingHolding) {
                return {
                    success: false,
                    error: {
                        code: 'HOLDING_NOT_FOUND',
                        message: 'Portfolio holding not found',
                    },
                    meta: {
                        timestamp: new Date().toISOString(),
                        requestId: '',
                    },
                };
            }

            await this.prisma.portfolio.delete({
                where: { id: holdingId },
            });

            // Invalidate cache
            await this.cacheService.delete(`portfolio:${userId}:*`);

            this.logger.info({ userId, holdingId }, 'Successfully deleted portfolio holding');

            return {
                success: true,
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: '',
                },
            };
        } catch (error) {
            this.logger.error({ error, userId, holdingId }, 'Failed to delete portfolio holding');
            throw error;
        }
    }

    /**
     * Get portfolio analytics
     */
    async getPortfolioAnalytics(userId: number, query: PortfolioAnalyticsQuery): Promise<ApiResponse<PortfolioAnalytics>> {
        try {
            const cacheKey = `portfolio:${userId}:analytics:${query.timeframe}`;
            const cached = await this.cacheService.get<PortfolioAnalytics>(cacheKey);

            if (cached) {
                this.logger.info({ userId }, 'Retrieved portfolio analytics from cache');
                return {
                    success: true,
                    data: cached,
                    meta: {
                        timestamp: new Date().toISOString(),
                        requestId: '',
                    },
                };
            }

            // Get all portfolio holdings with current prices
            const holdings = await this.prisma.portfolio.findMany({
                where: { userId },
                include: {
                    coin: {
                        include: {
                            priceData: {
                                orderBy: { timestamp: 'desc' },
                                take: 1,
                            },
                        },
                    },
                },
            });

            if (holdings.length === 0) {
                const emptyAnalytics: PortfolioAnalytics = {
                    totalValue: 0,
                    totalInvested: 0,
                    totalProfitLoss: 0,
                    totalProfitLossPercentage: 0,
                    topPerformers: [],
                    worstPerformers: [],
                    allocation: [],
                };

                return {
                    success: true,
                    data: emptyAnalytics,
                    meta: {
                        timestamp: new Date().toISOString(),
                        requestId: '',
                    },
                };
            }

            // Calculate analytics
            let totalValue = 0;
            let totalInvested = 0;
            const holdingsWithPerformance: PortfolioWithCoin[] = [];

            for (const holding of holdings) {
                const { coin, ...portfolioData } = holding;
                const { priceData, ...coinData } = coin;
                const latestPrice = priceData[0];

                const currentPrice = latestPrice ? Number(latestPrice.price) : 0;
                const amount = Number(holding.amount);
                const avgPrice = Number(holding.avgPrice);

                const currentValue = amount * currentPrice;
                const invested = amount * avgPrice;
                const profitLoss = currentValue - invested;
                const profitLossPercentage = invested > 0 ? (profitLoss / invested) * 100 : 0;

                // Update portfolio record with calculated values
                await this.prisma.portfolio.update({
                    where: { id: holding.id },
                    data: {
                        currentValue: new Prisma.Decimal(currentValue),
                        profitLoss: new Prisma.Decimal(profitLoss),
                        profitLossPercentage: new Prisma.Decimal(profitLossPercentage),
                    },
                });

                totalValue += currentValue;
                totalInvested += invested;

                holdingsWithPerformance.push({
                    ...portfolioData,
                    currentValue: new Prisma.Decimal(currentValue),
                    profitLoss: new Prisma.Decimal(profitLoss),
                    profitLossPercentage: new Prisma.Decimal(profitLossPercentage),
                    coin: {
                        ...coinData,
                        latestPrice,
                    },
                });
            }

            const totalProfitLoss = totalValue - totalInvested;
            const totalProfitLossPercentage = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

            // Sort for top/worst performers
            const sortedByPerformance = [...holdingsWithPerformance].sort((a, b) =>
                Number(b.profitLossPercentage) - Number(a.profitLossPercentage)
            );

            // Calculate allocation
            const allocation = holdingsWithPerformance.map(holding => ({
                coinId: holding.coinId,
                symbol: holding.coin.symbol,
                name: holding.coin.name,
                percentage: totalValue > 0 ? (Number(holding.currentValue) / totalValue) * 100 : 0,
                value: Number(holding.currentValue),
            }));

            const analytics: PortfolioAnalytics = {
                totalValue,
                totalInvested,
                totalProfitLoss,
                totalProfitLossPercentage,
                topPerformers: sortedByPerformance.slice(0, 5),
                worstPerformers: sortedByPerformance.slice(-5).reverse(),
                allocation,
            };

            // Cache for 5 minutes
            await this.cacheService.set(cacheKey, analytics, { ttl: 300 });

            this.logger.info({
                userId,
                totalValue,
                totalProfitLoss,
                holdingsCount: holdings.length
            }, 'Successfully calculated portfolio analytics');

            return {
                success: true,
                data: analytics,
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: '',
                },
            };
        } catch (error) {
            this.logger.error({ error, userId, query }, 'Failed to get portfolio analytics');
            throw error;
        }
    }

    /**
     * Get portfolio performance over time
     */
    async getPortfolioPerformance(userId: number, query: PortfolioPerformanceQuery): Promise<ApiResponse<PortfolioPerformance>> {
        try {
            const { timeframe, interval } = query;

            // Calculate date range
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

            // Get user's portfolio holdings
            const holdings = await this.prisma.portfolio.findMany({
                where: { userId },
                include: {
                    coin: {
                        include: {
                            priceData: {
                                where: {
                                    timestamp: {
                                        gte: fromDate,
                                    },
                                },
                                orderBy: { timestamp: 'asc' },
                            },
                        },
                    },
                },
            });

            if (holdings.length === 0) {
                const emptyPerformance: PortfolioPerformance = {
                    timestamps: [],
                    values: [],
                    profitLoss: [],
                    profitLossPercentage: [],
                };

                return {
                    success: true,
                    data: emptyPerformance,
                    meta: {
                        timestamp: new Date().toISOString(),
                        requestId: '',
                    },
                };
            }

            // Create time series data
            const timeSeriesMap = new Map<string, { value: number; invested: number }>();

            // Initialize with current holdings
            for (const holding of holdings) {
                const amount = Number(holding.amount);
                const avgPrice = Number(holding.avgPrice);
                const invested = amount * avgPrice;

                // Process price history
                for (const priceData of holding.coin.priceData) {
                    const timestamp = priceData.timestamp.toISOString();
                    const price = Number(priceData.price);
                    const value = amount * price;

                    if (!timeSeriesMap.has(timestamp)) {
                        timeSeriesMap.set(timestamp, { value: 0, invested: 0 });
                    }

                    const existing = timeSeriesMap.get(timestamp)!;
                    existing.value += value;
                    existing.invested += invested;
                }
            }

            // Convert to arrays and sort by timestamp
            const sortedEntries = Array.from(timeSeriesMap.entries())
                .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());

            const timestamps = sortedEntries.map(([timestamp]) => timestamp);
            const values = sortedEntries.map(([, data]) => data.value);
            const profitLoss = sortedEntries.map(([, data]) => data.value - data.invested);
            const profitLossPercentage = sortedEntries.map(([, data]) =>
                data.invested > 0 ? ((data.value - data.invested) / data.invested) * 100 : 0
            );

            const performance: PortfolioPerformance = {
                timestamps,
                values,
                profitLoss,
                profitLossPercentage,
            };

            this.logger.info({
                userId,
                timeframe,
                dataPoints: timestamps.length
            }, 'Successfully retrieved portfolio performance');

            return {
                success: true,
                data: performance,
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: '',
                },
            };
        } catch (error) {
            this.logger.error({ error, userId, query }, 'Failed to get portfolio performance');
            throw error;
        }
    }

    /**
     * Integrate wallet for automatic portfolio detection
     */
    async integrateWallet(userId: number, data: WalletIntegration): Promise<ApiResponse<PortfolioWithCoin[]>> {
        try {
            const { walletAddress, networks } = data;
            const importedHoldings: PortfolioWithCoin[] = [];

            this.logger.info({ userId, walletAddress, networks }, 'Starting wallet integration');

            for (const network of networks) {
                try {
                    // Get wallet holdings from external API
                    const walletHoldings = await this.getWalletHoldings(walletAddress, network);

                    for (const holding of walletHoldings) {
                        try {
                            // Find or create coin
                            let coin = await this.prisma.coin.findFirst({
                                where: {
                                    OR: [
                                        { address: holding.tokenAddress },
                                        { symbol: holding.symbol },
                                    ],
                                    network,
                                },
                            });

                            if (!coin) {
                                // Create new coin if not exists
                                coin = await this.prisma.coin.create({
                                    data: {
                                        address: holding.tokenAddress,
                                        symbol: holding.symbol,
                                        name: holding.name,
                                        network,
                                        contractVerified: false,
                                    },
                                });

                                this.logger.info({
                                    coinId: coin.id,
                                    symbol: holding.symbol,
                                    network
                                }, 'Created new coin from wallet integration');
                            }

                            // Check if portfolio holding already exists
                            const existingHolding = await this.prisma.portfolio.findUnique({
                                where: {
                                    userId_coinId: {
                                        userId,
                                        coinId: coin.id,
                                    },
                                },
                            });

                            if (!existingHolding && holding.value && holding.value > 0) {
                                // Create portfolio holding
                                const amount = parseFloat(holding.balance) / Math.pow(10, holding.decimals);
                                const avgPrice = holding.price || 0;

                                if (amount > 0 && avgPrice > 0) {
                                    const portfolio = await this.prisma.portfolio.create({
                                        data: {
                                            userId,
                                            coinId: coin.id,
                                            amount,
                                            avgPrice,
                                            currentValue: holding.value,
                                        },
                                    });

                                    // Get the created holding with coin data
                                    const createdHolding = await this.prisma.portfolio.findUnique({
                                        where: { id: portfolio.id },
                                        include: {
                                            coin: {
                                                include: {
                                                    priceData: {
                                                        orderBy: { timestamp: 'desc' },
                                                        take: 1,
                                                    },
                                                },
                                            },
                                        },
                                    });

                                    if (createdHolding) {
                                        const { coin: coinData, ...portfolioData } = createdHolding;
                                        const { priceData, ...coinInfo } = coinData;

                                        importedHoldings.push({
                                            ...portfolioData,
                                            coin: {
                                                ...coinInfo,
                                                latestPrice: priceData[0] || undefined,
                                            },
                                        });
                                    }

                                    this.logger.info({
                                        userId,
                                        coinId: coin.id,
                                        amount,
                                        value: holding.value
                                    }, 'Imported wallet holding to portfolio');
                                }
                            }
                        } catch (error) {
                            this.logger.warn({
                                error,
                                holding: holding.symbol,
                                walletAddress
                            }, 'Failed to import wallet holding');
                        }
                    }
                } catch (error) {
                    this.logger.warn({
                        error,
                        network,
                        walletAddress
                    }, 'Failed to get wallet holdings for network');
                }
            }

            // Update user's wallet address
            await this.prisma.user.update({
                where: { id: userId },
                data: { walletAddress },
            });

            // Invalidate cache
            await this.cacheService.delete(`portfolio:${userId}:*`);

            this.logger.info({
                userId,
                walletAddress,
                importedCount: importedHoldings.length
            }, 'Successfully completed wallet integration');

            return {
                success: true,
                data: importedHoldings,
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: '',
                },
            };
        } catch (error) {
            this.logger.error({ error, userId, data }, 'Failed to integrate wallet');
            throw error;
        }
    }

    /**
     * Update portfolio values for all holdings or specific coin
     */
    async updatePortfolioValues(userId: number, coinId?: number): Promise<void> {
        try {
            const where: any = { userId };
            if (coinId) {
                where.coinId = coinId;
            }

            const holdings = await this.prisma.portfolio.findMany({
                where,
                include: {
                    coin: {
                        include: {
                            priceData: {
                                orderBy: { timestamp: 'desc' },
                                take: 1,
                            },
                        },
                    },
                },
            });

            for (const holding of holdings) {
                const latestPrice = holding.coin.priceData[0];
                if (!latestPrice) continue;

                const currentPrice = Number(latestPrice.price);
                const amount = Number(holding.amount);
                const avgPrice = Number(holding.avgPrice);

                const currentValue = amount * currentPrice;
                const invested = amount * avgPrice;
                const profitLoss = currentValue - invested;
                const profitLossPercentage = invested > 0 ? (profitLoss / invested) * 100 : 0;

                await this.prisma.portfolio.update({
                    where: { id: holding.id },
                    data: {
                        currentValue: new Prisma.Decimal(currentValue),
                        profitLoss: new Prisma.Decimal(profitLoss),
                        profitLossPercentage: new Prisma.Decimal(profitLossPercentage),
                    },
                });
            }

            this.logger.debug({
                userId,
                coinId,
                updatedCount: holdings.length
            }, 'Updated portfolio values');
        } catch (error) {
            this.logger.error({ error, userId, coinId }, 'Failed to update portfolio values');
            throw error;
        }
    }

    /**
     * Get wallet holdings from external API (mock implementation)
     */
    private async getWalletHoldings(walletAddress: string, network: string): Promise<WalletHolding[]> {
        try {
            // This would integrate with actual blockchain APIs like Moralis, Alchemy, etc.
            // For now, return mock data
            const mockHoldings: WalletHolding[] = [
                {
                    tokenAddress: '0x1234567890123456789012345678901234567890',
                    symbol: 'MOCK',
                    name: 'Mock Token',
                    balance: '1000000000000000000', // 1 token with 18 decimals
                    decimals: 18,
                    price: 0.001,
                    value: 0.001,
                },
            ];

            this.logger.info({
                walletAddress,
                network,
                holdingsCount: mockHoldings.length
            }, 'Retrieved wallet holdings (mock)');

            return mockHoldings;
        } catch (error) {
            this.logger.error({ error, walletAddress, network }, 'Failed to get wallet holdings');
            return [];
        }
    }
}