#!/usr/bin/env tsx

/**
 * Demo script to showcase the job system functionality
 * 
 * Usage:
 *   npm run dev:demo-jobs
 * 
 * Or directly:
 *   tsx scripts/demo-job-system.ts
 */

import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

async function demoJobSystem() {
  console.log('🚀 Starting Job System Demo...\n');

  let app: FastifyInstance;

  try {
    // Set up required environment variables
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/meme_coin_analyzer';
    }
    if (!process.env.REDIS_URL) {
      process.env.REDIS_URL = 'redis://localhost:6379';
    }
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'demo-secret-key-change-in-production-this-is-32-chars-long';
    }
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = 'development';
    }
    if (!process.env.PORT) {
      process.env.PORT = '3001';
    }
    if (!process.env.HOST) {
      process.env.HOST = '0.0.0.0';
    }
    
    // Disable scheduled jobs for demo
    process.env.ENABLE_SCHEDULED_JOBS = 'false';

    console.log('📋 Environment configured for demo');
    console.log(`   - Database: ${process.env.DATABASE_URL.replace(/\/\/.*@/, '//***@')}`);
    console.log(`   - Redis: ${process.env.REDIS_URL}`);
    console.log(`   - Scheduled Jobs: ${process.env.ENABLE_SCHEDULED_JOBS}`);
    console.log();

    // Build the app
    app = await buildApp({ logger: false, disableRequestLogging: true });
    await app.ready();

    console.log('✅ Application initialized successfully\n');

    // Demo 1: Check job system health
    console.log('📊 Checking job system health...');
    const healthStatus = await app.jobMonitor.getHealthStatus();
    console.log('Overall health:', healthStatus.overall);
    console.log('Queue statuses:');
    Object.entries(healthStatus.queues).forEach(([queueName, status]) => {
      console.log(`  - ${queueName}: ${status.status} ${status.issues.length > 0 ? `(${status.issues.join(', ')})` : ''}`);
    });
    console.log();

    // Demo 2: Get queue statistics
    console.log('📈 Getting queue statistics...');
    const queueStats = await app.jobScheduler.getQueueStats();
    Object.entries(queueStats).forEach(([queueName, stats]) => {
      if ('error' in stats) {
        console.log(`  - ${queueName}: Error - ${stats.error}`);
      } else {
        console.log(`  - ${queueName}: ${stats.waiting} waiting, ${stats.active} active, ${stats.completed} completed, ${stats.failed} failed`);
      }
    });
    console.log();

    // Demo 3: Create a test coin for job demonstrations
    console.log('🪙 Creating test coin...');
    const testCoin = await app.prisma.coin.create({
      data: {
        address: '0xdemo123456789',
        symbol: 'DEMO',
        name: 'Demo Coin',
        network: 'ethereum',
        contractVerified: true,
      },
    });
    console.log(`Created test coin: ${testCoin.symbol} (ID: ${testCoin.id})`);
    console.log();

    // Demo 4: Schedule individual jobs
    console.log('⏰ Scheduling individual jobs...');
    
    // Schedule price update
    await app.jobScheduler.scheduleCoinPriceUpdate(testCoin.id);
    console.log('✅ Price update job scheduled');

    // Schedule social scraping
    await app.jobScheduler.scheduleCoinSocialScraping(testCoin.id);
    console.log('✅ Social scraping job scheduled');

    // Schedule risk assessment
    await app.jobScheduler.scheduleCoinRiskAssessment(testCoin.id);
    console.log('✅ Risk assessment job scheduled');

    // Schedule maintenance job
    await app.queue.addJob('maintenance', 'warm-cache', {}, { delay: 1000 });
    console.log('✅ Cache warming job scheduled');
    console.log();

    // Demo 5: Wait for jobs to process
    console.log('⏳ Waiting for jobs to process (10 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Demo 6: Check job results
    console.log('📋 Checking job results...');
    const updatedStats = await app.jobScheduler.getQueueStats();
    Object.entries(updatedStats).forEach(([queueName, stats]) => {
      if ('error' in stats) {
        console.log(`  - ${queueName}: Error - ${stats.error}`);
      } else {
        console.log(`  - ${queueName}: ${stats.waiting} waiting, ${stats.active} active, ${stats.completed} completed, ${stats.failed} failed`);
      }
    });
    console.log();

    // Demo 7: Check for failures
    console.log('❌ Checking recent failures...');
    const recentFailures = await app.jobMonitor.getRecentFailures(undefined, 5);
    if (recentFailures.length > 0) {
      console.log(`Found ${recentFailures.length} recent failures:`);
      recentFailures.forEach(failure => {
        console.log(`  - ${failure.queueName}/${failure.jobName}: ${failure.error}`);
      });
    } else {
      console.log('No recent failures found ✅');
    }
    console.log();

    // Demo 8: Demonstrate queue management
    console.log('🎛️  Demonstrating queue management...');
    
    // Pause a queue
    await app.queue.pauseQueue('price-updates');
    console.log('⏸️  Paused price-updates queue');

    // Resume the queue
    await app.queue.resumeQueue('price-updates');
    console.log('▶️  Resumed price-updates queue');
    console.log();

    // Demo 9: Show job monitoring metrics
    console.log('📊 Job monitoring metrics:');
    const allMetrics = await app.jobMonitor.getAllQueueMetrics();
    allMetrics.forEach(metric => {
      console.log(`  ${metric.queueName}:`);
      console.log(`    - Success rate: ${metric.successRate.toFixed(1)}%`);
      console.log(`    - Total jobs: ${metric.totalJobs}`);
      console.log(`    - Last processed: ${metric.lastProcessed ? metric.lastProcessed.toISOString() : 'Never'}`);
      console.log(`    - Last failure: ${metric.lastFailure ? metric.lastFailure.toISOString() : 'Never'}`);
    });
    console.log();

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await app.prisma.coin.delete({ where: { id: testCoin.id } });
    console.log('✅ Test coin deleted');

    console.log('\n🎉 Job System Demo completed successfully!');
    console.log('\nKey features demonstrated:');
    console.log('  ✅ Job scheduling and execution');
    console.log('  ✅ Queue management (pause/resume)');
    console.log('  ✅ Job monitoring and metrics');
    console.log('  ✅ Error handling and failure tracking');
    console.log('  ✅ Health status monitoring');
    console.log('  ✅ Rate limiting and concurrency control');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  } finally {
    if (app!) {
      await app.close();
      console.log('\n👋 Application closed');
    }
  }
}

// Run the demo if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demoJobSystem().catch(console.error);
}

export { demoJobSystem };