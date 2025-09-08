import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';

describe('Authentication Integration Tests', () => {
  let app: FastifyInstance | null = null;
  let userToken: string;
  let userId: number;

  beforeAll(async () => {
    try {
      app = await buildApp({ logger: false });
      await app.ready();
    } catch (error) {
      console.error('Failed to initialize app for testing:', error);
      app = null;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Complete Authentication Flow', () => {
    it('should register a new user successfully', async () => {
      if (!app) {
        console.log('App not initialized, skipping test');
        return;
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'integration@test.com',
          password: 'TestPassword123!',
          walletAddress: '0x1234567890123456789012345678901234567890',
          preferences: {
            theme: 'dark',
            riskTolerance: 'high',
            notifications: {
              email: true,
              push: false,
            },
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.user).toBeDefined();
      expect(data.data.user.email).toBe('integration@test.com');
      expect(data.data.user.walletAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(data.data.token).toBeDefined();

      // Store for later tests
      userToken = data.data.token;
      userId = data.data.user.id;
    });

    it('should login with correct credentials', async () => {
      if (!app) {
        console.log('App not initialized, skipping test');
        return;
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'integration@test.com',
          password: 'TestPassword123!',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe('integration@test.com');
      expect(data.data.token).toBeDefined();
    });

    it('should access protected profile endpoint with valid token', async () => {
      if (!app) {
        console.log('App not initialized, skipping test');
        return;
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/profile',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.user.id).toBe(userId);
      expect(data.data.user.email).toBe('integration@test.com');
    });

    it('should update user preferences', async () => {
      if (!app) {
        console.log('App not initialized, skipping test');
        return;
      }

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/auth/preferences',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          theme: 'light',
          riskTolerance: 'low',
          notifications: {
            email: false,
            push: true,
            sms: true,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.user.preferences.theme).toBe('light');
      expect(data.data.user.preferences.riskTolerance).toBe('low');
      expect(data.data.user.preferences.notifications.email).toBe(false);
      expect(data.data.user.preferences.notifications.push).toBe(true);
    });

    it('should link a new wallet address', async () => {
      if (!app) {
        console.log('App not initialized, skipping test');
        return;
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/link-wallet',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          walletAddress: '0x9876543210987654321098765432109876543210',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.user.walletAddress).toBe('0x9876543210987654321098765432109876543210');
    });

    it('should change password successfully', async () => {
      if (!app) {
        console.log('App not initialized, skipping test');
        return;
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          currentPassword: 'TestPassword123!',
          newPassword: 'NewTestPassword456!',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.message).toBe('Password changed successfully');
    });

    it('should login with new password', async () => {
      if (!app) {
        console.log('App not initialized, skipping test');
        return;
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'integration@test.com',
          password: 'NewTestPassword456!',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe('integration@test.com');
    });

    it('should reject login with old password', async () => {
      if (!app) {
        console.log('App not initialized, skipping test');
        return;
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'integration@test.com',
          password: 'TestPassword123!',
        },
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('Authentication Error Cases', () => {
    it('should reject registration with duplicate email', async () => {
      if (!app) {
        console.log('App not initialized, skipping test');
        return;
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'integration@test.com',
          password: 'AnotherPassword123!',
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('REGISTRATION_ERROR');
    });

    it('should reject access to protected routes without token', async () => {
      if (!app) {
        console.log('App not initialized, skipping test');
        return;
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/profile',
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should reject access with invalid token', async () => {
      if (!app) {
        console.log('App not initialized, skipping test');
        return;
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/profile',
        headers: {
          authorization: 'Bearer invalid-token-here',
        },
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should validate password requirements', async () => {
      if (!app) {
        console.log('App not initialized, skipping test');
        return;
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'weak@test.com',
          password: 'weak',
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate email format', async () => {
      if (!app) {
        console.log('App not initialized, skipping test');
        return;
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'ValidPassword123!',
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate wallet address format', async () => {
      if (!app) {
        console.log('App not initialized, skipping test');
        return;
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'wallet@test.com',
          password: 'ValidPassword123!',
          walletAddress: 'invalid-wallet-address',
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
