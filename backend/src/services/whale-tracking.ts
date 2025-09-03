import { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import type { WhaleTransaction } from '../types/index.js';
import { ExternalApiService, WhaleTransaction as ExternalWhaleTransaction } from './external-api-service.js';
import { CacheService } from './cache.js';
import { RealtimeService } from './realtime.js';

export interface WhaleWallet {
  address: string;
  label?: string;
  category: 'exchange' | 'whale' | 'dev' | 'unknown';
  totalTransactions: number;
  totalVolume: number;
  firstSeen: Date;
  lastSeen: Date;
  isActive: boolean;
}

export interface WhaleMovementAnalysis {
  coinId: number;
  timeframe: '1h' | '24h' | '7d';
  totalTransactions: number;
  totalVolume: number;
  netFlow: number; // positive = accumulation, negative = distribution
  priceImpact: number;
  averageTransactionSize: number;
  uniqueWallets: number;
}

export interface WhaleAlert {
  coinId: number;
  transactionHash: string;
  alertType: 'large_buy' | 'large_sell' | 'accumulation' | 'distribution';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata: Record<string, unknown>;
}

export class WhaleTrackingService {
  private prisma: PrismaClient;
  private externalApiService: ExternalApiService;
  private cacheService: CacheService;
  private realtimeService: RealtimeService;
  private logger?: FastifyBaseLogger;

  // Whale detection thresholds
  private readonly WHALE_THRESHOLDS = {
    minUsdValue: 10000, // $10k minimum for whale transaction
    largeTransactionUsd: 50000, // $50k for large transaction alert
    massiveTransactionUsd: 250000, // $250k for critical alert
    accumulationThreshold: 100000, // $100k net accumulation
  };

  constructor(
    prisma: PrismaClient,
    externalApiService: ExternalApiService,
    cacheService: CacheService,
    realtimeService: RealtimeService,
    logger?: FastifyBaseLogger
  ) {
    this.prisma = prisma;
    this.externalApiService = externalApiService;
    this.cacheService = cacheService;
    this.realtimeService = realtimeService;
    this.logger = logger;
  }

  /**
   * Process and store whale transactions for a specific coin
   */
  async processWhaleTransactions(coinId: number, contractAddress: string, network: string): Promise<WhaleTransaction[]> {
    try {
      this.logger?.info({ coinId, contractAddress, network }, 'Processing whale transactions');

      // Get recent whale transactions from external API
      const externalTransactions = await this.externalApiService.getWhaleTransactions(
        contractAddress,
        this.getChainFromNetwork(network),
        {
          minUsdValue: this.WHALE_THRESHOLDS.minUsdValue,
          limit: 100,
          fromDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
        }
      );

      const processedTransactions: WhaleTransaction[] = [];

      for (const extTx of externalTransactions) {
        // Check if transaction already exists
        const existingTx = await this.prisma.whaleTransaction.findUnique({
          where: { txHash: extTx.hash }
        });

        if (existingTx) {
          continue; // Skip if already processed
        }

        // Create whale transaction record
        const whaleTransaction = await this.prisma.whaleTransaction.create({
          data: {
            coinId,
            txHash: extTx.hash,
            fromAddress: extTx.fromAddress.toLowerCase(),
            toAddress: extTx.toAddress.toLowerCase(),
            amount: extTx.value,
            usdValue: extTx.usdValue,
            timestamp: new Date(extTx.timestamp),
          }
        });

        // Convert Prisma Decimal to number for the interface
        const convertedTransaction = {
          ...whaleTransaction,
          amount: Number(whaleTransaction.amount),
          usdValue: Number(whaleTransaction.usdValue),
        };

        processedTransactions.push(convertedTransaction);

        // Update whale wallet tracking
        await this.updateWhaleWalletTracking(extTx.fromAddress, extTx.usdValue, new Date(extTx.timestamp));
        await this.updateWhaleWalletTracking(extTx.toAddress, extTx.usdValue, new Date(extTx.timestamp));

        // Generate alerts if needed
        const alert = await this.generateWhaleAlert(coinId, extTx);
        if (alert) {
          // Broadcast whale movement via WebSocket
          this.realtimeService.broadcastWhaleMovement(coinId.toString(), convertedTransaction);
        }
      }

      // Cache the results
      await this.cacheService.set(
        `whale_transactions:${coinId}`,
        processedTransactions,
        { ttl: 900 } // 15 minutes
      );

      this.logger?.info({
        coinId,
        processedCount: processedTransactions.length,
        totalFetched: externalTransactions.length
      }, 'Successfully processed whale transactions');

      return processedTransactions;
    } catch (error) {
      this.logger?.error({
        coinId,
        contractAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to process whale transactions');
      throw error;
    }
  }  /*
*
   * Update whale wallet tracking information
   */
  private async updateWhaleWalletTracking(address: string, transactionValue: number, timestamp: Date): Promise<void> {
    const cacheKey = `whale_wallet:${address.toLowerCase()}`;
    
    try {
      // Get existing whale wallet data from cache or database
      let whaleWallet = await this.cacheService.get<WhaleWallet>(cacheKey);
      
      if (!whaleWallet) {
        // Check if wallet exists in our tracking
        const existingTransactions = await this.prisma.whaleTransaction.findMany({
          where: {
            OR: [
              { fromAddress: address.toLowerCase() },
              { toAddress: address.toLowerCase() }
            ]
          },
          orderBy: { timestamp: 'asc' }
        });

        if (existingTransactions.length > 0) {
          const totalVolume = existingTransactions.reduce((sum, tx) => sum + Number(tx.usdValue), 0);
          const firstSeen = existingTransactions[0].timestamp;
          const lastSeen = existingTransactions[existingTransactions.length - 1].timestamp;

          whaleWallet = {
            address: address.toLowerCase(),
            category: this.categorizeWallet(address, totalVolume, existingTransactions.length),
            totalTransactions: existingTransactions.length,
            totalVolume,
            firstSeen,
            lastSeen,
            isActive: this.isWalletActive(lastSeen),
          };
        } else {
          // New whale wallet
          whaleWallet = {
            address: address.toLowerCase(),
            category: 'unknown',
            totalTransactions: 1,
            totalVolume: transactionValue,
            firstSeen: timestamp,
            lastSeen: timestamp,
            isActive: true,
          };
        }
      } else {
        // Update existing whale wallet
        whaleWallet.totalTransactions += 1;
        whaleWallet.totalVolume += transactionValue;
        whaleWallet.lastSeen = timestamp;
        whaleWallet.isActive = this.isWalletActive(timestamp);
        whaleWallet.category = this.categorizeWallet(address, whaleWallet.totalVolume, whaleWallet.totalTransactions);
      }

      // Cache updated whale wallet data
      await this.cacheService.set(cacheKey, whaleWallet, { ttl: 900 }); // 15 minutes
    } catch (error) {
      this.logger?.error({
        address,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to update whale wallet tracking');
    }
  }

  /**
   * Categorize wallet based on behavior patterns
   */
  private categorizeWallet(address: string, totalVolume: number, transactionCount: number): WhaleWallet['category'] {
    // Known exchange addresses (simplified - in production, maintain a comprehensive list)
    const knownExchanges = [
      '0x28c6c06298d514db089934071355e5743bf21d60', // Binance
      '0x21a31ee1afc51d94c2efccaa2092ad1028285549', // Binance 2
      '0x564286362092d8e7936f0549571a803b203aaced', // Binance 3
      '0x0681d8db095565fe8a346fa0277bffde9c0edbbf', // Kraken
      '0xe93381fb4c4f14bda253907b18fad305d799241a', // Huobi
    ];

    if (knownExchanges.includes(address.toLowerCase())) {
      return 'exchange';
    }

    // High volume, frequent transactions = likely whale
    if (totalVolume > 1000000 && transactionCount > 10) {
      return 'whale';
    }

    // Medium volume with few transactions = possible dev/team wallet
    if (totalVolume > 500000 && transactionCount < 5) {
      return 'dev';
    }

    return 'unknown';
  }

  /**
   * Check if wallet is considered active (transacted within last 7 days)
   */
  private isWalletActive(lastSeen: Date): boolean {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return lastSeen > sevenDaysAgo;
  }

  /**
   * Generate whale alert based on transaction characteristics
   */
  private async generateWhaleAlert(coinId: number, transaction: ExternalWhaleTransaction): Promise<WhaleAlert | null> {
    try {
      let alertType: WhaleAlert['alertType'];
      let severity: WhaleAlert['severity'];
      let message: string;

      // Determine alert type and severity based on transaction value
      if (transaction.usdValue >= this.WHALE_THRESHOLDS.massiveTransactionUsd) {
        severity = 'critical';
        message = `Massive ${transaction.tokenSymbol} transaction: $${transaction.usdValue.toLocaleString()}`;
      } else if (transaction.usdValue >= this.WHALE_THRESHOLDS.largeTransactionUsd) {
        severity = 'high';
        message = `Large ${transaction.tokenSymbol} transaction: $${transaction.usdValue.toLocaleString()}`;
      } else {
        severity = 'medium';
        message = `Whale ${transaction.tokenSymbol} transaction: $${transaction.usdValue.toLocaleString()}`;
      }

      // Determine if it's a buy or sell (simplified logic)
      const isExchange = this.categorizeWallet(transaction.toAddress, 0, 0) === 'exchange';
      alertType = isExchange ? 'large_sell' : 'large_buy';

      const alert: WhaleAlert = {
        coinId,
        transactionHash: transaction.hash,
        alertType,
        severity,
        message,
        metadata: {
          fromAddress: transaction.fromAddress,
          toAddress: transaction.toAddress,
          usdValue: transaction.usdValue,
          tokenAmount: transaction.value,
          timestamp: transaction.timestamp,
        }
      };

      this.logger?.info({
        coinId,
        alertType,
        severity,
        usdValue: transaction.usdValue
      }, 'Generated whale alert');

      return alert;
    } catch (error) {
      this.logger?.error({
        coinId,
        transactionHash: transaction.hash,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to generate whale alert');
      return null;
    }
  }

  /**
   * Analyze whale movement patterns for a coin
   */
  async analyzeWhaleMovements(coinId: number, timeframe: '1h' | '24h' | '7d' = '24h'): Promise<WhaleMovementAnalysis> {
    try {
      const timeframeMs = this.getTimeframeMs(timeframe);
      const fromDate = new Date(Date.now() - timeframeMs);

      const transactions = await this.prisma.whaleTransaction.findMany({
        where: {
          coinId,
          timestamp: {
            gte: fromDate
          }
        },
        orderBy: { timestamp: 'desc' }
      });

      const totalTransactions = transactions.length;
      const totalVolume = transactions.reduce((sum, tx) => sum + Number(tx.usdValue), 0);
      const averageTransactionSize = totalTransactions > 0 ? totalVolume / totalTransactions : 0;

      // Calculate net flow (positive = accumulation, negative = distribution)
      let netFlow = 0;
      const uniqueWallets = new Set<string>();

      for (const tx of transactions) {
        uniqueWallets.add(tx.fromAddress);
        uniqueWallets.add(tx.toAddress);

        // Simplified net flow calculation
        const fromCategory = this.categorizeWallet(tx.fromAddress, 0, 0);
        const toCategory = this.categorizeWallet(tx.toAddress, 0, 0);

        if (fromCategory === 'exchange' && toCategory !== 'exchange') {
          netFlow += Number(tx.usdValue); // Buying from exchange = accumulation
        } else if (fromCategory !== 'exchange' && toCategory === 'exchange') {
          netFlow -= Number(tx.usdValue); // Selling to exchange = distribution
        }
      }

      // Calculate price impact (simplified - would need price data correlation)
      const priceImpact = this.calculatePriceImpact(totalVolume, timeframe);

      const analysis: WhaleMovementAnalysis = {
        coinId,
        timeframe,
        totalTransactions,
        totalVolume,
        netFlow,
        priceImpact,
        averageTransactionSize,
        uniqueWallets: uniqueWallets.size,
      };

      // Cache the analysis
      await this.cacheService.set(
        `whale_analysis:${coinId}:${timeframe}`,
        analysis,
        { ttl: 900 } // 15 minutes
      );

      this.logger?.info({
        coinId,
        timeframe,
        totalTransactions,
        totalVolume,
        netFlow
      }, 'Completed whale movement analysis');

      return analysis;
    } catch (error) {
      this.logger?.error({
        coinId,
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to analyze whale movements');
      throw error;
    }
  }

  /**
   * Get whale transactions for a specific coin
   */
  async getWhaleTransactions(
    coinId: number,
    options: {
      limit?: number;
      offset?: number;
      fromDate?: Date;
      toDate?: Date;
      minUsdValue?: number;
    } = {}
  ): Promise<{ transactions: WhaleTransaction[]; total: number }> {
    try {
      const { limit = 50, offset = 0, fromDate, toDate, minUsdValue } = options;

      const where: any = { coinId };

      if (fromDate || toDate) {
        where.timestamp = {};
        if (fromDate) where.timestamp.gte = fromDate;
        if (toDate) where.timestamp.lte = toDate;
      }

      if (minUsdValue) {
        where.usdValue = { gte: minUsdValue };
      }

      const [rawTransactions, total] = await Promise.all([
        this.prisma.whaleTransaction.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.whaleTransaction.count({ where })
      ]);

      // Convert Prisma Decimal to number for the interface
      const transactions = rawTransactions.map(tx => ({
        ...tx,
        amount: Number(tx.amount),
        usdValue: Number(tx.usdValue),
      }));

      return { transactions, total };
    } catch (error) {
      this.logger?.error({
        coinId,
        options,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get whale transactions');
      throw error;
    }
  }

  /**
   * Get whale wallet information
   */
  async getWhaleWallet(address: string): Promise<WhaleWallet | null> {
    try {
      const cacheKey = `whale_wallet:${address.toLowerCase()}`;
      let whaleWallet = await this.cacheService.get<WhaleWallet>(cacheKey);

      if (!whaleWallet) {
        // Rebuild from database
        const transactions = await this.prisma.whaleTransaction.findMany({
          where: {
            OR: [
              { fromAddress: address.toLowerCase() },
              { toAddress: address.toLowerCase() }
            ]
          },
          orderBy: { timestamp: 'asc' }
        });

        if (transactions.length === 0) {
          return null;
        }

        const totalVolume = transactions.reduce((sum, tx) => sum + Number(tx.usdValue), 0);
        const firstSeen = transactions[0].timestamp;
        const lastSeen = transactions[transactions.length - 1].timestamp;

        whaleWallet = {
          address: address.toLowerCase(),
          category: this.categorizeWallet(address, totalVolume, transactions.length),
          totalTransactions: transactions.length,
          totalVolume,
          firstSeen,
          lastSeen,
          isActive: this.isWalletActive(lastSeen),
        };

        await this.cacheService.set(cacheKey, whaleWallet, { ttl: 900 }); // 15 minutes
      }

      return whaleWallet;
    } catch (error) {
      this.logger?.error({
        address,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get whale wallet');
      throw error;
    }
  }

  /**
   * Get top whale wallets for a coin
   */
  async getTopWhaleWallets(coinId: number, limit: number = 20): Promise<WhaleWallet[]> {
    try {
      // Get all unique addresses for this coin
      const transactions = await this.prisma.whaleTransaction.findMany({
        where: { coinId },
        select: {
          fromAddress: true,
          toAddress: true,
          usdValue: true,
          timestamp: true,
        }
      });

      // Aggregate by address
      const addressMap = new Map<string, { totalVolume: number; transactionCount: number; firstSeen: Date; lastSeen: Date }>();

      for (const tx of transactions) {
        for (const address of [tx.fromAddress, tx.toAddress]) {
          const existing = addressMap.get(address) || {
            totalVolume: 0,
            transactionCount: 0,
            firstSeen: tx.timestamp,
            lastSeen: tx.timestamp,
          };

          existing.totalVolume += Number(tx.usdValue);
          existing.transactionCount += 1;
          existing.firstSeen = tx.timestamp < existing.firstSeen ? tx.timestamp : existing.firstSeen;
          existing.lastSeen = tx.timestamp > existing.lastSeen ? tx.timestamp : existing.lastSeen;

          addressMap.set(address, existing);
        }
      }

      // Convert to WhaleWallet objects and sort by volume
      const whaleWallets: WhaleWallet[] = Array.from(addressMap.entries())
        .map(([address, data]) => ({
          address,
          category: this.categorizeWallet(address, data.totalVolume, data.transactionCount),
          totalTransactions: data.transactionCount,
          totalVolume: data.totalVolume,
          firstSeen: data.firstSeen,
          lastSeen: data.lastSeen,
          isActive: this.isWalletActive(data.lastSeen),
        }))
        .sort((a, b) => b.totalVolume - a.totalVolume)
        .slice(0, limit);

      return whaleWallets;
    } catch (error) {
      this.logger?.error({
        coinId,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get top whale wallets');
      throw error;
    }
  }

  /**
   * Helper methods
   */
  private getChainFromNetwork(network: string): 'eth' | 'bsc' | 'polygon' {
    switch (network.toLowerCase()) {
      case 'ethereum': return 'eth';
      case 'bsc': return 'bsc';
      case 'polygon': return 'polygon';
      default: return 'eth';
    }
  }

  private getTimeframeMs(timeframe: '1h' | '24h' | '7d'): number {
    switch (timeframe) {
      case '1h': return 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
    }
  }

  private calculatePriceImpact(totalVolume: number, timeframe: string): number {
    // Simplified price impact calculation
    // In production, this would correlate with actual price movements
    const baseImpact = totalVolume / 1000000; // $1M = 1% impact
    const timeframeFactor = timeframe === '1h' ? 2 : timeframe === '24h' ? 1 : 0.5;
    return Math.min(baseImpact * timeframeFactor, 50); // Cap at 50%
  }
}