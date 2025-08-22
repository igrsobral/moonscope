import { FastifyBaseLogger } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { QueueManager } from '../plugins/queue.js';

export interface JobMetrics {
  queueName: string;
  jobName: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  activeJobs: number;
  waitingJobs: number;
  delayedJobs: number;
  averageProcessingTime: number;
  successRate: number;
  lastProcessed: Date | null;
  lastFailure: Date | null;
}

export interface JobFailure {
  queueName: string;
  jobName: string;
  jobId: string;
  error: string;
  timestamp: Date;
  attemptsMade: number;
  data: any;
}

export class JobMonitor {
  // private prisma: PrismaClient; // Unused for now
  private redis: Redis;
  private queueManager: QueueManager;
  private logger: FastifyBaseLogger;
  private metricsCache: Map<string, JobMetrics> = new Map();
  // private readonly METRICS_TTL = 300; // 5 minutes - unused for now

  constructor(
    _prisma: PrismaClient,
    redis: Redis,
    queueManager: QueueManager,
    logger: FastifyBaseLogger
  ) {
    // this.prisma = prisma; // Unused for now
    this.redis = redis;
    this.queueManager = queueManager;
    this.logger = logger;
  }

  /**
   * Initialize job monitoring
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing job monitor...');

    // Set up queue event listeners for metrics collection
    await this.setupQueueEventListeners();

    // Schedule periodic metrics collection
    setInterval(() => {
      this.collectMetrics().catch(error => {
        this.logger.error({ error: error.message }, 'Failed to collect job metrics');
      });
    }, 60000); // Every minute

    // Schedule periodic cleanup of old metrics
    setInterval(() => {
      this.cleanupOldMetrics().catch(error => {
        this.logger.error({ error: error.message }, 'Failed to cleanup old metrics');
      });
    }, 3600000); // Every hour

    this.logger.info('Job monitor initialized');
  }

  /**
   * Set up queue event listeners
   */
  private async setupQueueEventListeners(): Promise<void> {
    const queues = ['price-updates', 'social-scraping', 'alert-processing', 'risk-assessment', 'maintenance'];

    for (const queueName of queues) {
      try {
        const queueEvents = this.queueManager.getQueueEvents(queueName);

        // Track job completions
        queueEvents.on('completed', async ({ jobId, returnvalue }) => {
          await this.recordJobCompletion(queueName, jobId, returnvalue);
        });

        // Track job failures
        queueEvents.on('failed', async ({ jobId, failedReason }) => {
          await this.recordJobFailure(queueName, jobId, failedReason);
        });

        // Track job progress
        queueEvents.on('progress', async ({ jobId, data }) => {
          await this.recordJobProgress(queueName, jobId, data);
        });

        // Track stalled jobs
        queueEvents.on('stalled', async ({ jobId }) => {
          await this.recordJobStall(queueName, jobId);
        });

        this.logger.debug({ queueName }, 'Queue event listeners set up');
      } catch (error) {
        this.logger.error({ queueName, error: error instanceof Error ? error.message : String(error) }, 'Failed to set up queue event listeners');
      }
    }
  }

  /**
   * Record job completion
   */
  private async recordJobCompletion(queueName: string, jobId: string, returnValue: any): Promise<void> {
    try {
      const key = `job:metrics:${queueName}:completed`;
      const timestamp = Date.now();
      
      // Store completion record
      await this.redis.zadd(key, timestamp, JSON.stringify({
        jobId,
        timestamp,
        returnValue,
      }));

      // Set expiry for cleanup
      await this.redis.expire(key, 86400); // 24 hours

      // Update metrics cache
      await this.updateMetricsCache(queueName);

      this.logger.debug({ queueName, jobId }, 'Job completion recorded');
    } catch (error) {
      this.logger.error({ queueName, jobId, error: error instanceof Error ? error.message : String(error) }, 'Failed to record job completion');
    }
  }

  /**
   * Record job failure
   */
  private async recordJobFailure(queueName: string, jobId: string, failedReason: string): Promise<void> {
    try {
      const key = `job:metrics:${queueName}:failed`;
      const timestamp = Date.now();
      
      // Get job details
      const job = await this.queueManager.getJob(queueName, jobId);
      
      const failureRecord: JobFailure = {
        queueName,
        jobName: job?.name || 'unknown',
        jobId,
        error: failedReason,
        timestamp: new Date(),
        attemptsMade: job?.attemptsMade || 0,
        data: job?.data || {},
      };

      // Store failure record
      await this.redis.zadd(key, timestamp, JSON.stringify(failureRecord));

      // Set expiry for cleanup
      await this.redis.expire(key, 86400); // 24 hours

      // Store in database for persistent tracking
      await this.storeJobFailure(failureRecord);

      // Update metrics cache
      await this.updateMetricsCache(queueName);

      this.logger.warn({ queueName, jobId, error: failedReason }, 'Job failure recorded');
    } catch (error) {
      this.logger.error({ queueName, jobId, error: error instanceof Error ? error.message : String(error) }, 'Failed to record job failure');
    }
  }

  /**
   * Record job progress
   */
  private async recordJobProgress(queueName: string, jobId: string, progress: any): Promise<void> {
    try {
      const key = `job:progress:${queueName}:${jobId}`;
      
      await this.redis.setex(key, 3600, JSON.stringify({
        progress,
        timestamp: Date.now(),
      }));

      this.logger.debug({ queueName, jobId, progress }, 'Job progress recorded');
    } catch (error) {
      this.logger.error({ queueName, jobId, error: error instanceof Error ? error.message : String(error) }, 'Failed to record job progress');
    }
  }

  /**
   * Record job stall
   */
  private async recordJobStall(queueName: string, jobId: string): Promise<void> {
    try {
      const key = `job:metrics:${queueName}:stalled`;
      const timestamp = Date.now();
      
      await this.redis.zadd(key, timestamp, JSON.stringify({
        jobId,
        timestamp,
      }));

      await this.redis.expire(key, 86400); // 24 hours

      this.logger.warn({ queueName, jobId }, 'Job stall recorded');
    } catch (error) {
      this.logger.error({ queueName, jobId, error: error instanceof Error ? error.message : String(error) }, 'Failed to record job stall');
    }
  }

  /**
   * Store job failure in database
   */
  private async storeJobFailure(failure: JobFailure): Promise<void> {
    try {
      // This would store in a job_failures table if it existed
      // For now, we'll just log it
      this.logger.error({
        queueName: failure.queueName,
        jobName: failure.jobName,
        jobId: failure.jobId,
        error: failure.error,
        attemptsMade: failure.attemptsMade,
      }, 'Job failure stored');
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to store job failure in database');
    }
  }

  /**
   * Update metrics cache
   */
  private async updateMetricsCache(queueName: string): Promise<void> {
    try {
      const metrics = await this.calculateQueueMetrics(queueName);
      this.metricsCache.set(queueName, metrics);
    } catch (error) {
      this.logger.error({ queueName, error: error instanceof Error ? error.message : String(error) }, 'Failed to update metrics cache');
    }
  }

  /**
   * Calculate queue metrics
   */
  private async calculateQueueMetrics(queueName: string): Promise<JobMetrics> {
    try {
      // Get queue status
      const queueStatus = await this.queueManager.getQueueStatus(queueName);

      // Get completion and failure counts from Redis
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);

      const [completedCount, failedCount] = await Promise.all([
        this.redis.zcount(`job:metrics:${queueName}:completed`, oneDayAgo, now),
        this.redis.zcount(`job:metrics:${queueName}:failed`, oneDayAgo, now),
      ]);

      // Calculate success rate
      const totalProcessed = completedCount + failedCount;
      const successRate = totalProcessed > 0 ? (completedCount / totalProcessed) * 100 : 0;

      // Get last processed and failure times
      const [lastCompletedData, lastFailedData] = await Promise.all([
        this.redis.zrevrange(`job:metrics:${queueName}:completed`, 0, 0, 'WITHSCORES'),
        this.redis.zrevrange(`job:metrics:${queueName}:failed`, 0, 0, 'WITHSCORES'),
      ]);

      const lastProcessed = lastCompletedData.length > 0 && lastCompletedData[1] ? 
        new Date(parseInt(lastCompletedData[1])) : null;
      const lastFailure = lastFailedData.length > 0 && lastFailedData[1] ? 
        new Date(parseInt(lastFailedData[1])) : null;

      // Calculate average processing time (placeholder - would need more detailed tracking)
      const averageProcessingTime = 0; // TODO: Implement proper timing

      return {
        queueName,
        jobName: 'all', // This could be broken down by job type
        totalJobs: queueStatus.waiting + queueStatus.active + queueStatus.completed + queueStatus.failed,
        completedJobs: completedCount,
        failedJobs: failedCount,
        activeJobs: queueStatus.active,
        waitingJobs: queueStatus.waiting,
        delayedJobs: queueStatus.delayed,
        averageProcessingTime,
        successRate,
        lastProcessed,
        lastFailure,
      };
    } catch (error) {
      this.logger.error({ queueName, error: error instanceof Error ? error.message : String(error) }, 'Failed to calculate queue metrics');
      
      // Return default metrics on error
      return {
        queueName,
        jobName: 'all',
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        activeJobs: 0,
        waitingJobs: 0,
        delayedJobs: 0,
        averageProcessingTime: 0,
        successRate: 0,
        lastProcessed: null,
        lastFailure: null,
      };
    }
  }

  /**
   * Collect metrics for all queues
   */
  async collectMetrics(): Promise<void> {
    const queues = ['price-updates', 'social-scraping', 'alert-processing', 'risk-assessment', 'maintenance'];

    for (const queueName of queues) {
      try {
        await this.updateMetricsCache(queueName);
      } catch (error) {
        this.logger.error({ queueName, error: error instanceof Error ? error.message : String(error) }, 'Failed to collect metrics for queue');
      }
    }

    this.logger.debug('Metrics collection completed');
  }

  /**
   * Get metrics for a specific queue
   */
  async getQueueMetrics(queueName: string): Promise<JobMetrics> {
    // Check cache first
    if (this.metricsCache.has(queueName)) {
      return this.metricsCache.get(queueName)!;
    }

    // Calculate and cache metrics
    const metrics = await this.calculateQueueMetrics(queueName);
    this.metricsCache.set(queueName, metrics);
    
    return metrics;
  }

  /**
   * Get metrics for all queues
   */
  async getAllQueueMetrics(): Promise<JobMetrics[]> {
    const queues = ['price-updates', 'social-scraping', 'alert-processing', 'risk-assessment', 'maintenance'];
    const metrics: JobMetrics[] = [];

    for (const queueName of queues) {
      try {
        const queueMetrics = await this.getQueueMetrics(queueName);
        metrics.push(queueMetrics);
      } catch (error) {
        this.logger.error({ queueName, error: error instanceof Error ? error.message : String(error) }, 'Failed to get queue metrics');
      }
    }

    return metrics;
  }

  /**
   * Get recent job failures
   */
  async getRecentFailures(queueName?: string, limit: number = 50): Promise<JobFailure[]> {
    try {
      const failures: JobFailure[] = [];
      const queues = queueName ? [queueName] : ['price-updates', 'social-scraping', 'alert-processing', 'risk-assessment', 'maintenance'];

      for (const queue of queues) {
        const key = `job:metrics:${queue}:failed`;
        const failureData = await this.redis.zrevrange(key, 0, limit - 1);

        for (const data of failureData) {
          try {
            const failure = JSON.parse(data) as JobFailure;
            failures.push(failure);
          } catch (parseError) {
            this.logger.warn({ queue, data }, 'Failed to parse failure data');
          }
        }
      }

      // Sort by timestamp and limit
      failures.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return failures.slice(0, limit);
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get recent failures');
      return [];
    }
  }

  /**
   * Get job health status
   */
  async getHealthStatus(): Promise<{
    overall: 'healthy' | 'warning' | 'critical';
    queues: Record<string, {
      status: 'healthy' | 'warning' | 'critical';
      issues: string[];
    }>;
  }> {
    const metrics = await this.getAllQueueMetrics();
    const queueStatuses: Record<string, { status: 'healthy' | 'warning' | 'critical'; issues: string[] }> = {};
    
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

    for (const metric of metrics) {
      const issues: string[] = [];
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      // Check success rate
      if (metric.successRate < 50) {
        status = 'critical';
        issues.push(`Low success rate: ${metric.successRate.toFixed(1)}%`);
      } else if (metric.successRate < 80) {
        status = 'warning';
        issues.push(`Moderate success rate: ${metric.successRate.toFixed(1)}%`);
      }

      // Check for recent failures
      if (metric.lastFailure && metric.lastProcessed) {
        const timeSinceLastFailure = Date.now() - metric.lastFailure.getTime();
        const timeSinceLastProcessed = Date.now() - metric.lastProcessed.getTime();
        
        if (timeSinceLastFailure < timeSinceLastProcessed) {
          if (status !== 'critical') status = 'warning';
          issues.push('Recent failures detected');
        }
      }

      // Check for stalled jobs
      if (metric.activeJobs > 10) {
        if (status !== 'critical') status = 'warning';
        issues.push(`High number of active jobs: ${metric.activeJobs}`);
      }

      queueStatuses[metric.queueName] = { status, issues };

      // Update overall status
      if (status === 'critical') {
        overallStatus = 'critical';
      } else if (status === 'warning' && overallStatus !== 'critical') {
        overallStatus = 'warning';
      }
    }

    return {
      overall: overallStatus,
      queues: queueStatuses,
    };
  }

  /**
   * Clean up old metrics
   */
  private async cleanupOldMetrics(): Promise<void> {
    try {
      const queues = ['price-updates', 'social-scraping', 'alert-processing', 'risk-assessment', 'maintenance'];
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

      for (const queueName of queues) {
        // Clean up old completion records
        await this.redis.zremrangebyscore(`job:metrics:${queueName}:completed`, 0, oneDayAgo);
        
        // Clean up old failure records
        await this.redis.zremrangebyscore(`job:metrics:${queueName}:failed`, 0, oneDayAgo);
        
        // Clean up old stall records
        await this.redis.zremrangebyscore(`job:metrics:${queueName}:stalled`, 0, oneDayAgo);
      }

      this.logger.debug('Old metrics cleaned up');
    } catch (error) {
      this.logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to cleanup old metrics');
    }
  }

  /**
   * Reset metrics for a queue
   */
  async resetQueueMetrics(queueName: string): Promise<void> {
    try {
      const keys = [
        `job:metrics:${queueName}:completed`,
        `job:metrics:${queueName}:failed`,
        `job:metrics:${queueName}:stalled`,
      ];

      for (const key of keys) {
        await this.redis.del(key);
      }

      // Clear cache
      this.metricsCache.delete(queueName);

      this.logger.info({ queueName }, 'Queue metrics reset');
    } catch (error) {
      this.logger.error({ queueName, error: error instanceof Error ? error.message : String(error) }, 'Failed to reset queue metrics');
      throw error;
    }
  }
}