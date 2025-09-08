import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

describe('Fastify App', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.JWT_SECRET = 'test-jwt-secret-that-is-long-enough-for-validation';

    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Health Check Endpoints', () => {
    it('should return ok status for basic health check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.status).toBe('ok');
      expect(payload.timestamp).toBeDefined();
    });

    it('should return detailed health information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/detailed',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);

      expect(payload.status).toMatch(/^(ok|degraded|unhealthy)$/);
      expect(payload.timestamp).toBeDefined();
      expect(payload.uptime).toBeTypeOf('number');
      expect(payload.version).toBeDefined();
      expect(payload.environment).toBe('test');
      expect(payload.services).toBeDefined();
      expect(payload.memory).toBeDefined();
      expect(payload.system).toBeDefined();
    });

    it('should return readiness status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.ready).toBe(true);
      expect(payload.timestamp).toBeDefined();
    });

    it('should return liveness status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/live',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.alive).toBe(true);
      expect(payload.timestamp).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/non-existent-route',
      });

      expect(response.statusCode).toBe(404);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Not Found');
      expect(payload.statusCode).toBe(404);
      expect(payload.requestId).toBeDefined();
    });
  });

  describe('Environment Configuration', () => {
    it('should have loaded environment configuration', () => {
      expect(app.config).toBeDefined();
      expect(app.config.NODE_ENV).toBe('test');
      expect(app.config.DATABASE_URL).toBeDefined();
      expect(app.config.REDIS_URL).toBeDefined();
      expect(app.config.JWT_SECRET).toBeDefined();
    });

    it('should have default values for optional config', () => {
      expect(app.config.PORT).toBe(3001);
      expect(app.config.HOST).toBe('0.0.0.0');
      expect(app.config.LOG_LEVEL).toBe('info');
      expect(app.config.RATE_LIMIT_MAX).toBe(100);
      expect(app.config.RATE_LIMIT_WINDOW).toBe(60000);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });
});
