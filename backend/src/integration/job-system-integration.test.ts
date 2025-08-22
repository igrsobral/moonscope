import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Job System Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
    process.env.REDIS_URL = 'redis://localhost:6379/1';
    process.env.JWT_SECRET = 'test-secret';
    process.env.ENABLE_SCHEDULED_JOBS = 'false'; // Disable scheduled jobs in tests

    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Job Queue Management', () => {
    it('should get job statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/jobs/stats',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.meta.timestamp).toBeDefined();
      expect(data.meta.requestId).toBeDefined();
    });

    it('should get job health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/jobs/health',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.overall).toMatch(/^(healthy|warning|critical)$/);
      expect(typeof data.data.queues).toBe('object');
    });

    it('should get recent job failures', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/jobs/failures?limit=10',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should trigger a one-time job', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/trigger',
        payload: {
          queueName: 'price-updates',
          jobName: 'update-coin-price',
          data: {
            coinId: 1,
            coinAddress: '0x123',
            symbol: 'TEST',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.jobId).toBeDefined();
      expect(data.data.queueName).toBe('price-updates');
      expect(data.data.jobName).toBe('update-coin-price');
    });

    it('should pause and resume a queue', async () => {
      // Pause queue
      const pauseResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/queue-action',
        payload: {
          queueName: 'price-updates',
          action: 'pause',
        },
      });

      expect(pauseResponse.statusCode).toBe(200);
      const pauseData = JSON.parse(pauseResponse.payload);
      expect(pauseData.success).toBe(true);
      expect(pauseData.data.message).toContain('paused');

      // Resume queue
      const resumeResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/queue-action',
        payload: {
          queueName: 'price-updates',
          action: 'resume',
        },
      });

      expect(resumeResponse.statusCode).toBe(200);
      const resumeData = JSON.parse(resumeResponse.payload);
      expect(resumeData.success).toBe(true);
      expect(resumeData.data.message).toContain('resumed');
    });
  });

  describe('Job Scheduling', () => {
    it('should schedule price update for specific coin', async () => {
      // First, we need to create a test coin
      const coin = await app.prisma.coin.create({
        data: {
          address: '0x123456789',
          symbol: 'TEST',
          name: 'Test Coin',
          network: 'ethereum',
          contractVerified: true,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/jobs/price-update/${coin.id}`,
        payload: {
          delay: 1000,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.coinId).toBe(coin.id);
      expect(data.data.message).toContain('Price update job scheduled');

      // Cleanup
      await app.prisma.coin.delete({ where: { id: coin.id } });
    });

    it('should schedule social scraping for specific coin', async () => {
      // Create a test coin
      const coin = await app.prisma.coin.create({
        data: {
          address: '0x987654321',
          symbol: 'SOCIAL',
          name: 'Social Coin',
          network: 'ethereum',
          contractVerified: true,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/jobs/social-scraping/${coin.id}`,
        payload: {
          delay: 2000,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.coinId).toBe(coin.id);
      expect(data.data.message).toContain('Social scraping job scheduled');

      // Cleanup
      await app.prisma.coin.delete({ where: { id: coin.id } });
    });

    it('should schedule risk assessment for specific coin', async () => {
      // Create a test coin
      const coin = await app.prisma.coin.create({
        data: {
          address: '0x111222333',
          symbol: 'RISK',
          name: 'Risk Coin',
          network: 'ethereum',
          contractVerified: false,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/jobs/risk-assessment/${coin.id}`,
        payload: {
          delay: 3000,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.coinId).toBe(coin.id);
      expect(data.data.message).toContain('Risk assessment job scheduled');

      // Cleanup
      await app.prisma.coin.delete({ where: { id: coin.id } });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid queue name in trigger job', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/trigger',
        payload: {
          queueName: 'invalid-queue',
          jobName: 'test-job',
          data: {},
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });

    it('should handle non-existent coin in price update', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/price-update/99999',
        payload: {},
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });

    it('should handle invalid queue action', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/queue-action',
        payload: {
          queueName: 'price-updates',
          action: 'invalid-action',
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });
  });

  describe('Job Monitoring', () => {
    it('should track job metrics', async () => {
      // Trigger a job
      await app.inject({
        method: 'POST',
        url: '/api/v1/jobs/trigger',
        payload: {
          queueName: 'maintenance',
          jobName: 'warm-cache',
          data: {},
        },
      });

      // Wait a bit for job to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check metrics
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/jobs/stats',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      
      // Should have at least one queue with metrics
      const maintenanceQueue = data.data.find((q: any) => q.queueName === 'maintenance');
      expect(maintenanceQueue).toBeDefined();
    });

    it('should provide health status for all queues', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/jobs/health',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      
      // Should have health status for all expected queues
      const expectedQueues = ['price-updates', 'social-scraping', 'alert-processing', 'risk-assessment', 'maintenance'];
      for (const queueName of expectedQueues) {
        expect(data.data.queues[queueName]).toBeDefined();
        expect(data.data.queues[queueName].status).toMatch(/^(healthy|warning|critical)$/);
        expect(Array.isArray(data.data.queues[queueName].issues)).toBe(true);
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits for job triggering', async () => {
      const promises = [];
      
      // Trigger multiple jobs rapidly
      for (let i = 0; i < 5; i++) {
        promises.push(
          app.inject({
            method: 'POST',
            url: '/api/v1/jobs/trigger',
            payload: {
              queueName: 'maintenance',
              jobName: 'warm-cache',
              data: { iteration: i },
            },
          })
        );
      }

      const responses = await Promise.all(promises);
      
      // All should succeed (rate limiting is handled by BullMQ, not HTTP)
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });
    });
  });
});