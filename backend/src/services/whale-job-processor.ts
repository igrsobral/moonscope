import { Job } from 'bullmq';
import type { FastifyBaseLogger } from 'fastify';
import { WhaleTrackingService } from './whale-tracking.js';
import { AlertTriggerService } from './alert-trigger.js';

export interface WhaleJobData {
  type: 'process_whale_transactions' | 'analyze_whale_impact';
  coinId: number;
  contractAddress: string;
  network: string;
  options?: {
    minUsdValue?: number;
    timeframe?: '1h' | '24h' | '7d';
  };
}

export class WhaleJobProcessor {
  private whaleTrackingService: WhaleTrackingService;
  private alertTriggerService: AlertTriggerService;
  private logger: FastifyBaseLogger;

  constructor(
    whaleTrackingService: WhaleTrackingService,
    alertTriggerService: AlertTriggerService,
    logger: FastifyBaseLogger
  ) {
    this.whaleTrackingService = whaleTrackingService;
    this.alertTriggerService = alertTriggerService;
    this.logger = logger;
  }

  /**
   * Process whale tracking jobs
   */
  async processJob(job: Job<WhaleJobData>): Promise<void> {
    const { type, coinId, contractAddress, network, options = {} } = job.data;

    this.logger.info({
      jobId: job.id,
      type,
      coinId,
      contractAddress,
      network
    }, 'Processing whale tracking job');

    try {
      switch (type) {
        case 'process_whale_transactions':
          await this.processWhaleTransactions(coinId, contractAddress, network, options);
          break;

        case 'analyze_whale_impact':
          await this.analyzeWhaleImpact(coinId, options.timeframe || '24h');
          break;

        default:
          throw new Error(`Unknown whale job type: ${type}`);
      }

      this.logger.info({
        jobId: job.id,
        type,
        coinId
      }, 'Successfully completed whale tracking job');

    } catch (error) {
      this.logger.error({
        jobId: job.id,
        type,
        coinId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to process whale tracking job');
      throw error;
    }
  }

  /**
   * Process whale transactions for a coin
   */
  private async processWhaleTransactions(
    coinId: number,
    contractAddress: string,
    network: string,
    options: { minUsdValue?: number }
  ): Promise<void> {
    try {
      // Process whale transactions
      const transactions = await this.whaleTrackingService.processWhaleTransactions(
        coinId,
        contractAddress,
        network
      );

      this.logger.info({
        coinId,
        processedCount: transactions.length
      }, 'Processed whale transactions');

      // Trigger alerts for significant whale movements
      for (const transaction of transactions) {
        if (Number(transaction.usdValue) >= (options.minUsdValue || 50000)) {
          await this.alertTriggerService.processWhaleMovement({
            coinId: transaction.coinId,
            txHash: transaction.txHash,
            amount: Number(transaction.amount),
            usdValue: Number(transaction.usdValue),
            fromAddress: transaction.fromAddress,
            toAddress: transaction.toAddress,
            timestamp: transaction.timestamp.toISOString(),
          });
        }
      }

    } catch (error) {
      this.logger.error({
        coinId,
        contractAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to process whale transactions');
      throw error;
    }
  }

  /**
   * Analyze whale impact on price movements
   */
  private async analyzeWhaleImpact(
    coinId: number,
    timeframe: '1h' | '24h' | '7d'
  ): Promise<void> {
    try {
      // Get whale movement analysis
      const analysis = await this.whaleTrackingService.analyzeWhaleMovements(coinId, timeframe);

      this.logger.info({
        coinId,
        timeframe,
        totalTransactions: analysis.totalTransactions,
        totalVolume: analysis.totalVolume,
        netFlow: analysis.netFlow,
        priceImpact: analysis.priceImpact
      }, 'Completed whale impact analysis');

      // Check for significant whale activity patterns
      if (analysis.totalVolume > 1000000) { // $1M+ in whale activity
        this.logger.info({
          coinId,
          timeframe,
          totalVolume: analysis.totalVolume,
          netFlow: analysis.netFlow
        }, 'Significant whale activity detected');

        // Could trigger additional alerts or notifications here
        // For example, notify users about unusual whale activity
      }

      // Check for accumulation/distribution patterns
      if (Math.abs(analysis.netFlow) > 500000) { // $500k+ net flow
        const pattern = analysis.netFlow > 0 ? 'accumulation' : 'distribution';
        
        this.logger.info({
          coinId,
          pattern,
          netFlow: analysis.netFlow,
          timeframe
        }, `Strong whale ${pattern} pattern detected`);

        // Could trigger pattern-based alerts
      }

    } catch (error) {
      this.logger.error({
        coinId,
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to analyze whale impact');
      throw error;
    }
  }

  /**
   * Schedule whale tracking jobs for all active coins
   */
  async scheduleWhaleTrackingJobs(coins: Array<{ id: number; address: string; network: string }>): Promise<void> {
    try {
      this.logger.info({
        coinCount: coins.length
      }, 'Scheduling whale tracking jobs for active coins');

      for (const coin of coins) {
        // Schedule whale transaction processing
        const jobData: WhaleJobData = {
          type: 'process_whale_transactions',
          coinId: coin.id,
          contractAddress: coin.address,
          network: coin.network,
          options: {
            minUsdValue: 10000, // $10k minimum
          }
        };

        // This would be called by the job scheduler
        // await this.jobQueue.add('whale-tracking', jobData, {
        //   delay: Math.random() * 60000, // Random delay up to 1 minute
        //   attempts: 3,
        //   backoff: {
        //     type: 'exponential',
        //     delay: 2000,
        //   },
        // });
      }

      this.logger.info({
        coinCount: coins.length
      }, 'Successfully scheduled whale tracking jobs');

    } catch (error) {
      this.logger.error({
        coinCount: coins.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to schedule whale tracking jobs');
      throw error;
    }
  }
}