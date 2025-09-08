import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Queue, QueueEvents, Job } from 'bullmq';
import { Redis } from 'ioredis';

export interface JobData {
  [key: string]: any;
}

export interface JobOptions {
  delay?: number;
  repeat?: {
    pattern?: string;
    every?: number;
  };
  attempts?: number;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  removeOnComplete?: number;
  removeOnFail?: number;
}

export interface QueueManager {
  addJob: (queueName: string, jobName: string, data: JobData, options?: JobOptions) => Promise<Job>;
  getJob: (queueName: string, jobId: string) => Promise<Job | undefined>;
  getQueue: (queueName: string) => Queue;
  getQueueEvents: (queueName: string) => QueueEvents;
  removeJob: (queueName: string, jobId: string) => Promise<void>;
  pauseQueue: (queueName: string) => Promise<void>;
  resumeQueue: (queueName: string) => Promise<void>;
  getQueueStatus: (queueName: string) => Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }>;
}

declare module 'fastify' {
  interface FastifyInstance {
    queue: QueueManager;
  }
}

const queuePlugin: FastifyPluginAsync = async fastify => {
  const redis = fastify.redis as Redis;

  // Store queues and queue events
  const queues = new Map<string, Queue>();
  const queueEvents = new Map<string, QueueEvents>();

  // Default job options
  const defaultJobOptions = {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  };

  /**
   * Get or create a queue
   */
  function getQueue(queueName: string): Queue {
    if (!queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: redis,
        defaultJobOptions: {
          attempts: defaultJobOptions.attempts,
          backoff: defaultJobOptions.backoff,
          removeOnComplete: defaultJobOptions.removeOnComplete,
          removeOnFail: defaultJobOptions.removeOnFail,
        },
      });

      queues.set(queueName, queue);

      // Set up queue events
      const events = new QueueEvents(queueName, { connection: redis });
      queueEvents.set(queueName, events);

      // Log queue events
      events.on('waiting', ({ jobId }) => {
        fastify.log.debug({ queueName, jobId }, 'Job waiting');
      });

      events.on('active', ({ jobId, prev }) => {
        fastify.log.info({ queueName, jobId, prev }, 'Job started');
      });

      events.on('completed', ({ jobId, returnvalue }) => {
        fastify.log.info({ queueName, jobId, returnvalue }, 'Job completed');
      });

      events.on('failed', ({ jobId, failedReason }) => {
        fastify.log.error({ queueName, jobId, failedReason }, 'Job failed');
      });

      events.on('progress', ({ jobId, data }) => {
        fastify.log.debug({ queueName, jobId, progress: data }, 'Job progress');
      });

      events.on('stalled', ({ jobId }) => {
        fastify.log.warn({ queueName, jobId }, 'Job stalled');
      });

      fastify.log.info({ queueName }, 'Queue created');
    }

    return queues.get(queueName)!;
  }

  /**
   * Get queue events
   */
  function getQueueEvents(queueName: string): QueueEvents {
    // Ensure queue exists first
    getQueue(queueName);
    return queueEvents.get(queueName)!;
  }

  /**
   * Add a job to a queue
   */
  async function addJob(
    queueName: string,
    jobName: string,
    data: JobData,
    options: JobOptions = {}
  ): Promise<Job> {
    const queue = getQueue(queueName);

    const jobOptions = {
      ...defaultJobOptions,
      ...options,
    };

    const job = await queue.add(jobName, data, jobOptions);

    fastify.log.info(
      {
        queueName,
        jobName,
        jobId: job.id,
        data: Object.keys(data),
        options: jobOptions,
      },
      'Job added to queue'
    );

    return job;
  }

  /**
   * Get a specific job
   */
  async function getJob(queueName: string, jobId: string): Promise<Job | undefined> {
    const queue = getQueue(queueName);
    return await queue.getJob(jobId);
  }

  /**
   * Remove a job from queue
   */
  async function removeJob(queueName: string, jobId: string): Promise<void> {
    const job = await getJob(queueName, jobId);
    if (job) {
      await job.remove();
      fastify.log.info({ queueName, jobId }, 'Job removed from queue');
    }
  }

  /**
   * Pause a queue
   */
  async function pauseQueue(queueName: string): Promise<void> {
    const queue = getQueue(queueName);
    await queue.pause();
    fastify.log.info({ queueName }, 'Queue paused');
  }

  /**
   * Resume a queue
   */
  async function resumeQueue(queueName: string): Promise<void> {
    const queue = getQueue(queueName);
    await queue.resume();
    fastify.log.info({ queueName }, 'Queue resumed');
  }

  /**
   * Get queue status
   */
  async function getQueueStatus(queueName: string) {
    const queue = getQueue(queueName);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  // Register queue manager
  fastify.decorate('queue', {
    addJob,
    getJob,
    getQueue,
    getQueueEvents,
    removeJob,
    pauseQueue,
    resumeQueue,
    getQueueStatus,
  });

  // Graceful shutdown
  fastify.addHook('onClose', async instance => {
    instance.log.info('Closing job queues...');

    for (const [queueName, queue] of queues) {
      await queue.close();
      instance.log.info({ queueName }, 'Queue closed');
    }

    for (const [queueName, events] of queueEvents) {
      await events.close();
      instance.log.info({ queueName }, 'Queue events closed');
    }

    instance.log.info('All queues closed');
  });

  fastify.log.info('Queue plugin registered');
};

export default fp(queuePlugin, {
  name: 'queue',
  dependencies: ['redis'],
});
