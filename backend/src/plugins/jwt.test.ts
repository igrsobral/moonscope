import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import jwtPlugin from './jwt.js';
import type { FastifyInstance } from 'fastify';

describe('JWT Plugin', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    
    // Mock the config
    app.decorate('config', {
      JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes-only-32-chars',
    });
    
    await app.register(jwtPlugin);
  });

  afterEach(async () => {
    await app.close();
  });

  it('should register JWT plugin successfully', async () => {
    expect(app.jwt).toBeDefined();
    expect(app.authenticate).toBeDefined();
  });

  it('should sign and verify JWT tokens', async () => {
    const payload = {
      id: 1,
      email: 'test@example.com',
      walletAddress: '0x1234567890123456789012345678901234567890',
    };

    const token = app.jwt.sign(payload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = app.jwt.verify(token);
    expect(decoded).toMatchObject(payload);
  });

  it('should reject invalid tokens', async () => {
    const invalidToken = 'invalid.token.here';

    expect(() => {
      app.jwt.verify(invalidToken);
    }).toThrow();
  });

  it('should reject expired tokens', async () => {
    const payload = {
      id: 1,
      email: 'test@example.com',
      walletAddress: '0x1234567890123456789012345678901234567890',
    };

    // Create token that expires in 1 millisecond
    const token = app.jwt.sign(payload, { expiresIn: '1ms' });

    // Wait for token to expire
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(() => {
      app.jwt.verify(token);
    }).toThrow();
  });

  it('should authenticate valid requests', async () => {
    const payload = {
      id: 1,
      email: 'test@example.com',
      walletAddress: '0x1234567890123456789012345678901234567890',
    };

    const token = app.jwt.sign(payload);

    // Add a test route that requires authentication
    app.get('/test-auth', {
      preHandler: [app.authenticate],
    }, async (request) => {
      return { user: request.user };
    });

    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/test-auth',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.user).toMatchObject(payload);
  });

  it('should reject requests without authorization header', async () => {
    // Add a test route that requires authentication
    app.get('/test-auth-required', {
      preHandler: [app.authenticate],
    }, async () => {
      return { message: 'authenticated' };
    });

    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/test-auth-required',
    });

    expect(response.statusCode).toBe(401);
    const data = JSON.parse(response.payload);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('AUTHENTICATION_ERROR');
    expect(data.error.message).toBe('Authentication required');
  });

  it('should reject requests with invalid authorization format', async () => {
    // Add a test route that requires authentication
    app.get('/test-auth-format', {
      preHandler: [app.authenticate],
    }, async () => {
      return { message: 'authenticated' };
    });

    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/test-auth-format',
      headers: {
        authorization: 'InvalidFormat token',
      },
    });

    expect(response.statusCode).toBe(401);
    const data = JSON.parse(response.payload);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('AUTHENTICATION_ERROR');
    expect(data.error.message).toBe('Authentication required');
  });

  it('should reject requests with invalid tokens', async () => {
    // Add a test route that requires authentication
    app.get('/test-auth-invalid', {
      preHandler: [app.authenticate],
    }, async () => {
      return { message: 'authenticated' };
    });

    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/test-auth-invalid',
      headers: {
        authorization: 'Bearer invalid.token.here',
      },
    });

    expect(response.statusCode).toBe(401);
    const data = JSON.parse(response.payload);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('AUTHENTICATION_ERROR');
    expect(data.error.message).toBe('Authentication required');
  });
});