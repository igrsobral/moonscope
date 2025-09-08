import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Alert Integration Tests', () => {
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
        email: 'alert-test@example.com',
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
        symbol: 'ALERT',
        name: 'Alert Test Coin',
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

  describe('Alert CRUD Operations', () => {
    it('should create, read, update, and delete alerts', async () => {
      // Create alert
      const createResponse = await app.inject({
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
          name: 'Integration Test Alert',
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const createData = JSON.parse(createResponse.payload);
      expect(createData.success).toBe(true);
      const alertId = createData.data.id;

      // Read alert
      const readResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/alerts/${alertId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(readResponse.statusCode).toBe(200);
      const readData = JSON.parse(readResponse.payload);
      expect(readData.success).toBe(true);
      expect(readData.data.name).toBe('Integration Test Alert');

      // Update alert
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/api/v1/alerts/${alertId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          condition: {
            targetPrice: 2.0,
          },
          name: 'Updated Integration Test Alert',
        },
      });

      expect(updateResponse.statusCode).toBe(200);
      const updateData = JSON.parse(updateResponse.payload);
      expect(updateData.success).toBe(true);
      expect(updateData.data.condition.targetPrice).toBe(2.0);
      expect(updateData.data.name).toBe('Updated Integration Test Alert');

      // Delete alert
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/v1/alerts/${alertId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(deleteResponse.statusCode).toBe(200);
      const deleteData = JSON.parse(deleteResponse.payload);
      expect(deleteData.success).toBe(true);

      // Verify deletion
      const verifyResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/alerts/${alertId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(verifyResponse.statusCode).toBe(200);
      const verifyData = JSON.parse(verifyResponse.payload);
      expect(verifyData.success).toBe(false);
      expect(verifyData.error.code).toBe('NOT_FOUND');
    });

    it('should handle alert actions (pause, resume, test)', async () => {
      // Create alert
      const createResponse = await app.inject({
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
          name: 'Action Test Alert',
        },
      });

      const alertId = JSON.parse(createResponse.payload).data.id;

      // Pause alert
      const pauseResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${alertId}/actions`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          action: 'pause',
        },
      });

      expect(pauseResponse.statusCode).toBe(200);
      const pauseData = JSON.parse(pauseResponse.payload);
      expect(pauseData.success).toBe(true);
      expect(pauseData.data.isActive).toBe(false);

      // Resume alert
      const resumeResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${alertId}/actions`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          action: 'resume',
        },
      });

      expect(resumeResponse.statusCode).toBe(200);
      const resumeData = JSON.parse(resumeResponse.payload);
      expect(resumeData.success).toBe(true);
      expect(resumeData.data.isActive).toBe(true);

      // Test alert
      const testResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${alertId}/actions`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          action: 'test',
        },
      });

      expect(testResponse.statusCode).toBe(200);
      const testData = JSON.parse(testResponse.payload);
      expect(testData.success).toBe(true);
    });
  });

  describe('Alert Filtering and Pagination', () => {
    beforeEach(async () => {
      // Create multiple test alerts
      const alerts = [
        {
          type: 'price_above',
          condition: { targetPrice: 1.0 },
          name: 'Price Above Alert',
          isActive: true,
        },
        {
          type: 'price_below',
          condition: { targetPrice: 0.5 },
          name: 'Price Below Alert',
          isActive: false,
        },
        {
          type: 'volume_spike',
          condition: { volumeThreshold: 1000000 },
          name: 'Volume Spike Alert',
          isActive: true,
        },
      ];

      for (const alert of alerts) {
        await app.inject({
          method: 'POST',
          url: '/api/v1/alerts',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            coinId,
            ...alert,
            notificationMethods: ['email'],
          },
        });
      }
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
      expect(data.data).toHaveLength(2);
      expect(data.data.every((alert: any) => alert.isActive)).toBe(true);
    });

    it('should paginate alerts correctly', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/alerts?page=1&limit=2',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.meta.pagination.total).toBe(3);
      expect(data.meta.pagination.totalPages).toBe(2);
      expect(data.meta.pagination.hasNext).toBe(true);
    });
  });

  describe('Alert Validation', () => {
    it('should validate alert conditions based on type', async () => {
      // Test price alert without condition
      const priceResponse = await app.inject({
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

      expect(priceResponse.statusCode).toBe(400);

      // Test volume alert with valid condition
      const volumeResponse = await app.inject({
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
          notificationMethods: ['email'],
        },
      });

      expect(volumeResponse.statusCode).toBe(201);
      const volumeData = JSON.parse(volumeResponse.payload);
      expect(volumeData.success).toBe(true);
    });

    it('should require valid notification methods', async () => {
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
          notificationMethods: [], // Empty array
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate coin existence', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/alerts',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          coinId: 99999, // Non-existent coin
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

  describe('Authentication', () => {
    it('should require authentication for all alert endpoints', async () => {
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

    it('should prevent access to other users alerts', async () => {
      // Create another user
      const otherUserResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'other-user@example.com',
          password: 'password123',
        },
      });

      const otherUserData = JSON.parse(otherUserResponse.payload);
      const otherAuthToken = otherUserData.data.token;

      // Create alert with first user
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/alerts',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          coinId,
          type: 'price_above',
          condition: { targetPrice: 1.0 },
          notificationMethods: ['email'],
        },
      });

      const alertId = JSON.parse(createResponse.payload).data.id;

      // Try to access with second user
      const accessResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/alerts/${alertId}`,
        headers: {
          authorization: `Bearer ${otherAuthToken}`,
        },
      });

      expect(accessResponse.statusCode).toBe(200);
      const accessData = JSON.parse(accessResponse.payload);
      expect(accessData.success).toBe(false);
      expect(accessData.error.code).toBe('NOT_FOUND');
    });
  });
});
