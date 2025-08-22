#!/usr/bin/env tsx

/**
 * Simple Job System Demo - Tests job system components without full app setup
 * 
 * Usage:
 *   npm run demo:jobs-simple
 * 
 * Or directly:
 *   tsx scripts/demo-job-system-simple.ts
 */

import { Redis } from 'ioredis';
import { Queue, Worker, Job } from 'bullmq';

async function simpleJobDemo() {
  console.log('🚀 Starting Simple Job System Demo...\n');

  let redis: Redis;
  let queue: Queue;
  let worker: Worker;

  try {
    // Connect to Redis
    console.log('🔌 Connecting to Redis...');
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    await redis.ping();
    console.log('✅ Redis connected successfully\n');

    // Create a demo queue
    console.log('📋 Creating demo queue...');
    queue = new Queue('demo-queue', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 5,
      },
    });

    console.log('✅ Demo queue created\n');

    // Create a worker to process jobs
    console.log('👷 Creating demo worker...');
    worker = new Worker('demo-queue', async (job: Job) => {
      console.log(`   🔄 Processing job ${job.id}: ${job.name}`);
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update progress
      await job.updateProgress(50);
      console.log(`   📊 Job ${job.id} progress: 50%`);
      
      // More work
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Complete
      await job.updateProgress(100);
      console.log(`   ✅ Job ${job.id} completed`);
      
      return {
        success: true,
        processedAt: new Date().toISOString(),
        data: job.data,
      };
    }, {
      connection: redis,
      concurrency: 2,
    });

    // Set up event listeners
    worker.on('completed', (job, result) => {
      console.log(`🎉 Job ${job.id} completed with result:`, result);
    });

    worker.on('failed', (job, err) => {
      console.log(`❌ Job ${job?.id} failed:`, err.message);
    });

    console.log('✅ Demo worker created and listening\n');

    // Add some demo jobs
    console.log('📝 Adding demo jobs...');
    
    const jobs = [
      { name: 'price-update', data: { coinId: 1, symbol: 'DOGE' } },
      { name: 'social-scraping', data: { coinId: 2, symbol: 'SHIB' } },
      { name: 'risk-assessment', data: { coinId: 3, symbol: 'PEPE' } },
    ];

    for (const jobConfig of jobs) {
      const job = await queue.add(jobConfig.name, jobConfig.data);
      console.log(`   ➕ Added job ${job.id}: ${jobConfig.name}`);
    }

    console.log('✅ Demo jobs added\n');

    // Wait for jobs to process
    console.log('⏳ Waiting for jobs to process (10 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get queue statistics
    console.log('📊 Queue Statistics:');
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
    ]);

    console.log(`   - Waiting: ${waiting.length}`);
    console.log(`   - Active: ${active.length}`);
    console.log(`   - Completed: ${completed.length}`);
    console.log(`   - Failed: ${failed.length}`);
    console.log();

    // Test queue management
    console.log('🎛️  Testing queue management...');
    
    // Pause queue
    await queue.pause();
    console.log('   ⏸️  Queue paused');
    
    // Add a job while paused
    const pausedJob = await queue.add('paused-job', { test: true });
    console.log(`   ➕ Added job ${pausedJob.id} while paused`);
    
    // Resume queue
    await queue.resume();
    console.log('   ▶️  Queue resumed');
    
    // Wait for paused job to process
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log();

    // Test job with failure
    console.log('🧪 Testing job failure handling...');
    
    // Create a failing worker temporarily
    const failingWorker = new Worker('demo-queue', async (job: Job) => {
      if (job.name === 'failing-job') {
        throw new Error('Intentional failure for testing');
      }
      return { success: true };
    }, { connection: redis });

    failingWorker.on('failed', (job, err) => {
      console.log(`   ❌ Expected failure: Job ${job?.id} failed with: ${err.message}`);
    });

    // Add failing job
    const failingJob = await queue.add('failing-job', { shouldFail: true });
    console.log(`   ➕ Added failing job ${failingJob.id}`);
    
    // Wait for failure
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Close failing worker
    await failingWorker.close();
    console.log();

    console.log('🎉 Simple Job System Demo completed successfully!');
    console.log('\nFeatures demonstrated:');
    console.log('  ✅ Queue creation and configuration');
    console.log('  ✅ Worker creation and job processing');
    console.log('  ✅ Job progress tracking');
    console.log('  ✅ Event handling (completed/failed)');
    console.log('  ✅ Queue management (pause/resume)');
    console.log('  ✅ Error handling and retries');
    console.log('  ✅ Queue statistics');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    
    if (worker) {
      await worker.close();
      console.log('   ✅ Worker closed');
    }
    
    if (queue) {
      await queue.close();
      console.log('   ✅ Queue closed');
    }
    
    if (redis) {
      await redis.quit();
      console.log('   ✅ Redis connection closed');
    }
    
    console.log('\n👋 Demo completed');
  }
}

// Run the demo if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  simpleJobDemo().catch(console.error);
}

export { simpleJobDemo };