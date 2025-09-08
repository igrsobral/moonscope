import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Alert Routes', () => {
  let app: FastifyInstance;
  let authToken: string;
  let userId: number;
  let coinId: number;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    // Create test user and get auth token
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'password123',
      },
    });

    const registerData = JSON.parse(registerResponse.payload);
    authToken = registerData.data.token;
    userId = registerData.data.user.id;

    // Create test coin
    const coin = await app.prisma.coin.create({
      data: {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'TEST',
        name: 'Test Coin',
        network: 'ethereum',
        contractVerified: true,
      },
    });
    coinId = coin.id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up alerts before each test
    await app.prisma.alert.deleteMany({
      where: { userId },
    });
  });

  describe('POST /api/v1/alerts', () => {
    it('should create a price above alert', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/alerts',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          coinId,
          type: 'price_above',
          condition: {
            targetPrice: 1.0,
          },
          notificationMethods: ['email'],
          name: 'Test Price Alert',
          description: 'Test alert for price above $1',
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.type).toBe('price_above');
      expect(data.data.condition.targetPrice).toBe(1.0);
      expect(data.data.notificationMethods).toEqual(['email']);
      expect(data.data.name).toBe('Test Price Alert');
    });

    it('should create a volume spike alert', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/alerts',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          coinId,
          type: 'volume_spike',
          condition: {
            volumeThreshold: 1000000,
          },
          notificationMethods: ['email', 'push'],
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.type).toBe('volume_spike');
      expect(data.data.condition.volumeThreshold).toBe(1000000);
      expect(data.data.notificationMethods).toEqual(['email', 'push']);
    });

    it('should fail with invalid condition', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/alerts',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          coinId,
          type: 'price_above',
          condition: {}, // Empty condition
          notificationMethods: ['email'],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail with non-existent coin', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/alerts',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          coinId: 99999,
          type: 'price_above',
          condition: {
            targetPrice: 1.0,
          },
          notificationMethods: ['email'],
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('COIN_NOT_FOUND');
    });
  });

  describe('GET /api/v1/alerts', () => {
    beforeEach(async () => {
      // Create test alerts
      await app.prisma.alert.createMany({
        data: [
          {
            userId,
            coinId,
            type: 'price_above',
            condition: { targetPrice: 1.0 },
            notificationMethods: ['email'],
            name: 'Alert 1',
          },
          {
            userId,
            coinId,
            type: 'price_below',
            condition: { targetPrice: 0.5 },
            notificationMethods: ['email'],
            name: 'Alert 2',
            isActive: false,
          },
        ],
      });
    });

    it('should get user alerts with pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/alerts?page=1&limit=10',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.meta.pagination.total).toBe(2);
      expect(data.data[0].coin).toBeDefined();
    });

    it('should filter alerts by type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/alerts?type=price_above',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].type).toBe('price_above');
    });

    it('should filter alerts by active status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/alerts?isActive=true',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].isActive).toBe(true);
    });
  });

  describe('GET /api/v1/alerts/:alertId', () => {
    let alertId: number;

    beforeEach(async () => {
      const alert = await app.prisma.alert.create({
        data: {
          userId,
          coinId,
          type: 'price_above',
          condition: { targetPrice: 1.0 },
          notificationMethods: ['email'],
          name: 'Test Alert',
        },
      });
      alertId = alert.id;
    });

    it('should get specific alert', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/alerts/${alertId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(alertId);
      expect(data.data.coin).toBeDefined();
    });

    it('should fail for non-existent alert', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/alerts/99999',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/v1/alerts/:alertId', () => {
    let alertId: number;

    beforeEach(async () => {
      const alert = await app.prisma.alert.create({
        data: {
          userId,
          coinId,
          type: 'price_above',
          condition: { targetPrice: 1.0 },
          notificationMethods: ['email'],
          name: 'Test Alert',
        },
      });
      alertId = alert.id;
    });

    it('should update alert condition', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/alerts/${alertId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          condition: {
            targetPrice: 2.0,
          },
          name: 'Updated Alert',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.condition.targetPrice).toBe(2.0);
      expect(data.data.name).toBe('Updated Alert');
    });

    it('should update alert status', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/alerts/${alertId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          isActive: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.isActive).toBe(false);
    });
  });

  describe('DELETE /api/v1/alerts/:alertId', () => {
    let alertId: number;

    beforeEach(async () => {
      const alert = await app.prisma.alert.create({
        data: {
          userId,
          coinId,
          type: 'price_above',
          condition: { targetPrice: 1.0 },
          notificationMethods: ['email'],
          name: 'Test Alert',
        },
      });
      alertId = alert.id;
    });

    it('should delete alert', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/alerts/${alertId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);

      // Verify alert is deleted
      const alert = await app.prisma.alert.findUnique({
        where: { id: alertId },
      });
      expect(alert).toBeNull();
    });
  });

  describe('POST /api/v1/alerts/:alertId/actions', () => {
    let alertId: number;

    beforeEach(async () => {
      const alert = await app.prisma.alert.create({
        data: {
          userId,
          coinId,
          type: 'price_above',
          condition: { targetPrice: 1.0 },
          notificationMethods: ['email'],
          name: 'Test Alert',
        },
      });
      alertId = alert.id;
    });

    it('should pause alert', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${alertId}/actions`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          action: 'pause',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.isActive).toBe(false);
    });

    it('should resume alert', async () => {
      // First pause the alert
      await app.prisma.alert.update({
        where: { id: alertId },
        data: { isActive: false },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${alertId}/actions`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          action: 'resume',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.isActive).toBe(true);
    });

    it('should test alert', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${alertId}/actions`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          action: 'test',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        { method: 'GET', url: '/api/v1/alerts' },
        { method: 'POST', url: '/api/v1/alerts' },
        { method: 'GET', url: '/api/v1/alerts/1' },
        { method: 'PUT', url: '/api/v1/alerts/1' },
        { method: 'DELETE', url: '/api/v1/alerts/1' },
        { method: 'POST', url: '/api/v1/alerts/1/actions' },
      ];

      for (const endpoint of endpoints) {
        const response = await app.inject({
          method: endpoint.method as any,
          url: endpoint.url,
          payload: endpoint.method === 'POST' || endpoint.method === 'PUT' ? {} : undefined,
        });

        expect(response.statusCode).toBe(401);
      }
    });
  });
});
