#!/usr/bin/env tsx

/**
 * Mock Job System Demo - Demonstrates job system concepts without Redis
 * 
 * Usage:
 *   npm run demo:jobs-mock
 * 
 * Or directly:
 *   tsx scripts/demo-job-system-mock.ts
 */

import { EventEmitter } from 'events';

// Mock job interface
interface MockJob {
  id: string;
  name: string;
  data: any;
  progress: number;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processedAt?: Date;
  result?: any;
  error?: string;
}

// Mock queue class
class MockQueue extends EventEmitter {
  private jobs: Map<string, MockJob> = new Map();
  private jobCounter = 0;
  private isProcessing = false;
  private isPaused = false;

  constructor(public name: string) {
    super();
  }

  async add(jobName: string, data: any): Promise<MockJob> {
    const job: MockJob = {
      id: `job_${++this.jobCounter}`,
      name: jobName,
      data,
      progress: 0,
      status: 'waiting',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
    };

    this.jobs.set(job.id, job);
    this.emit('job-added', job);
    
    // Start processing if not already running
    if (!this.isProcessing && !this.isPaused) {
      this.processJobs();
    }

    return job;
  }

  async pause(): Promise<void> {
    this.isPaused = true;
    this.emit('paused');
  }

  async resume(): Promise<void> {
    this.isPaused = false;
    this.emit('resumed');
    
    if (!this.isProcessing) {
      this.processJobs();
    }
  }

  getStats() {
    const jobs = Array.from(this.jobs.values());
    return {
      waiting: jobs.filter(j => j.status === 'waiting').length,
      active: jobs.filter(j => j.status === 'active').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      total: jobs.length,
    };
  }

  private async processJobs(): Promise<void> {
    if (this.isProcessing || this.isPaused) return;
    
    this.isProcessing = true;

    while (!this.isPaused) {
      const waitingJobs = Array.from(this.jobs.values())
        .filter(job => job.status === 'waiting')
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      if (waitingJobs.length === 0) {
        break;
      }

      const job = waitingJobs[0];
      await this.processJob(job);
    }

    this.isProcessing = false;
  }

  private async processJob(job: MockJob): Promise<void> {
    job.status = 'active';
    job.attempts++;
    this.emit('job-started', job);

    try {
      // Simulate job processing
      await this.simulateJobWork(job);
      
      job.status = 'completed';
      job.processedAt = new Date();
      job.result = {
        success: true,
        processedAt: job.processedAt.toISOString(),
        data: job.data,
      };
      
      this.emit('job-completed', job);
    } catch (error) {
      job.error = error instanceof Error ? error.message : String(error);
      
      if (job.attempts < job.maxAttempts) {
        job.status = 'waiting';
        this.emit('job-retry', job);
        
        // Exponential backoff
        const delay = Math.pow(2, job.attempts) * 1000;
        setTimeout(() => {
          if (!this.isPaused && !this.isProcessing) {
            this.processJobs();
          }
        }, delay);
      } else {
        job.status = 'failed';
        this.emit('job-failed', job);
      }
    }
  }

  private async simulateJobWork(job: MockJob): Promise<void> {
    const steps = 4;
    const stepDelay = 500;

    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDelay));
      
      job.progress = (i / steps) * 100;
      this.emit('job-progress', job);

      // Simulate occasional failures
      if (job.name === 'failing-job' && job.attempts === 1) {
        throw new Error('Intentional failure for testing');
      }
    }
  }
}

async function mockJobDemo() {
  console.log('🚀 Starting Mock Job System Demo...\n');

  try {
    // Create mock queues
    console.log('📋 Creating mock job queues...');
    const priceQueue = new MockQueue('price-updates');
    const socialQueue = new MockQueue('social-scraping');
    const alertQueue = new MockQueue('alert-processing');
    const riskQueue = new MockQueue('risk-assessment');
    const maintenanceQueue = new MockQueue('maintenance');

    const queues = [priceQueue, socialQueue, alertQueue, riskQueue, maintenanceQueue];
    console.log(`✅ Created ${queues.length} mock queues\n`);

    // Set up event listeners
    console.log('👂 Setting up event listeners...');
    queues.forEach(queue => {
      queue.on('job-added', (job) => {
        console.log(`   ➕ [${queue.name}] Job ${job.id} added: ${job.name}`);
      });

      queue.on('job-started', (job) => {
        console.log(`   🔄 [${queue.name}] Job ${job.id} started: ${job.name}`);
      });

      queue.on('job-progress', (job) => {
        console.log(`   📊 [${queue.name}] Job ${job.id} progress: ${job.progress.toFixed(0)}%`);
      });

      queue.on('job-completed', (job) => {
        console.log(`   ✅ [${queue.name}] Job ${job.id} completed: ${job.name}`);
      });

      queue.on('job-failed', (job) => {
        console.log(`   ❌ [${queue.name}] Job ${job.id} failed: ${job.error}`);
      });

      queue.on('job-retry', (job) => {
        console.log(`   🔄 [${queue.name}] Job ${job.id} retry ${job.attempts}/${job.maxAttempts}`);
      });

      queue.on('paused', () => {
        console.log(`   ⏸️  [${queue.name}] Queue paused`);
      });

      queue.on('resumed', () => {
        console.log(`   ▶️  [${queue.name}] Queue resumed`);
      });
    });
    console.log('✅ Event listeners configured\n');

    // Demo 1: Add various job types
    console.log('📝 Adding demo jobs...');
    
    await priceQueue.add('update-coin-price', { coinId: 1, symbol: 'DOGE' });
    await priceQueue.add('update-coin-price', { coinId: 2, symbol: 'SHIB' });
    
    await socialQueue.add('scrape-social-data', { 
      coinId: 1, 
      keywords: ['DOGE', 'Dogecoin'],
      platforms: ['twitter', 'reddit'] 
    });
    
    await alertQueue.add('check-alerts', {});
    await alertQueue.add('check-specific-alert', { alertId: 123 });
    
    await riskQueue.add('assess-coin-risk', { coinId: 1, symbol: 'DOGE' });
    
    await maintenanceQueue.add('cleanup-old-price-data', { retentionDays: 90 });
    await maintenanceQueue.add('warm-cache', {});

    console.log('✅ Demo jobs added\n');

    // Wait for initial jobs to process
    console.log('⏳ Processing initial jobs (5 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Demo 2: Show queue statistics
    console.log('📊 Queue Statistics:');
    queues.forEach(queue => {
      const stats = queue.getStats();
      console.log(`   ${queue.name}:`);
      console.log(`     - Waiting: ${stats.waiting}`);
      console.log(`     - Active: ${stats.active}`);
      console.log(`     - Completed: ${stats.completed}`);
      console.log(`     - Failed: ${stats.failed}`);
      console.log(`     - Total: ${stats.total}`);
    });
    console.log();

    // Demo 3: Test queue management
    console.log('🎛️  Testing queue management...');
    
    // Pause a queue
    await priceQueue.pause();
    
    // Add jobs while paused
    await priceQueue.add('update-coin-price', { coinId: 3, symbol: 'PEPE' });
    await priceQueue.add('update-coin-price', { coinId: 4, symbol: 'FLOKI' });
    
    console.log('   📊 Stats while paused:', priceQueue.getStats());
    
    // Resume queue
    await priceQueue.resume();
    
    // Wait for paused jobs to process
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log();

    // Demo 4: Test failure handling
    console.log('🧪 Testing failure handling...');
    
    // Add a job that will fail
    await socialQueue.add('failing-job', { shouldFail: true });
    
    // Wait for retries
    await new Promise(resolve => setTimeout(resolve, 8000));
    console.log();

    // Demo 5: Final statistics
    console.log('📈 Final Queue Statistics:');
    queues.forEach(queue => {
      const stats = queue.getStats();
      const successRate = stats.total > 0 ? 
        ((stats.completed / (stats.completed + stats.failed)) * 100).toFixed(1) : 
        '0.0';
      
      console.log(`   ${queue.name}:`);
      console.log(`     - Total processed: ${stats.completed + stats.failed}`);
      console.log(`     - Success rate: ${successRate}%`);
      console.log(`     - Currently waiting: ${stats.waiting}`);
    });
    console.log();

    console.log('🎉 Mock Job System Demo completed successfully!');
    console.log('\nFeatures demonstrated:');
    console.log('  ✅ Multiple job queues with different types');
    console.log('  ✅ Job lifecycle (waiting → active → completed/failed)');
    console.log('  ✅ Progress tracking and event emission');
    console.log('  ✅ Queue management (pause/resume)');
    console.log('  ✅ Retry logic with exponential backoff');
    console.log('  ✅ Error handling and failure tracking');
    console.log('  ✅ Queue statistics and monitoring');
    console.log('  ✅ Concurrent job processing simulation');

    console.log('\n💡 This demo simulates the BullMQ job system behavior.');
    console.log('   In production, this would use Redis for persistence');
    console.log('   and distributed processing across multiple workers.');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  mockJobDemo().catch(console.error);
}

export { mockJobDemo };