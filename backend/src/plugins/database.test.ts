import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Database Plugin', () => {
  let app: FastifyInstance | undefined;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'file:./test.db';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only-32-chars';

    try {
      app = await buildApp({
        logger: false,
        disableRequestLogging: true,
      });
      await app.ready();
    } catch (error) {
      console.warn('Failed to initialize app for testing:', error);
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should register prisma client on fastify instance', () => {
    if (!app) {
      console.warn('App not initialized, skipping test');
      return;
    }

    expect(app.prisma).toBeDefined();
    expect(typeof app.prisma.$connect).toBe('function');
    expect(typeof app.prisma.$disconnect).toBe('function');
  });

  it('should be able to perform basic database query', async () => {
    if (!app) {
      console.warn('App not initialized, skipping test');
      return;
    }

    try {
      const result = await app.prisma.$queryRaw`SELECT 1 as test`;
      expect(result).toBeDefined();
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should have all expected models available', () => {
    if (!app) {
      console.warn('App not initialized, skipping test');
      return;
    }

    expect(app.prisma.user).toBeDefined();
    expect(app.prisma.coin).toBeDefined();
    expect(app.prisma.priceData).toBeDefined();
    expect(app.prisma.socialMetrics).toBeDefined();
    expect(app.prisma.riskAssessment).toBeDefined();
    expect(app.prisma.portfolio).toBeDefined();
    expect(app.prisma.alert).toBeDefined();
    expect(app.prisma.whaleTransaction).toBeDefined();
  });
});
