import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import { authRoutes } from './auth.js';
import jwtPlugin from '../plugins/jwt.js';
import type { FastifyInstance } from 'fastify';

// Mock the UserService
const mockUserService = {
  createUser: vi.fn(),
  authenticateUser: vi.fn(),
  getUserById: vi.fn(),
  updateUserPreferences: vi.fn(),
  linkWalletAddress: vi.fn(),
  changePassword: vi.fn(),
};

vi.mock('../services/user.js', () => ({
  UserService: vi.fn(() => mockUserService),
}));

describe('Auth Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });

    // Mock the config and prisma
    app.decorate('config', {
      JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes-only-32-chars',
    });

    app.decorate('prisma', {});

    await app.register(jwtPlugin);
    await app.register(authRoutes, { prefix: '/api/v1/auth' });
    await app.ready();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        walletAddress: '0x1234567890123456789012345678901234567890',
      };

      const mockUser = {
        id: 1,
        email: userData.email,
        walletAddress: userData.walletAddress,
        preferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockUserService.createUser as any).mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: userData,
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.user).toMatchObject({
        ...mockUser,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(data.data.token).toBeDefined();
      expect(typeof data.data.token).toBe('string');
    });

    it('should return 400 for invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'TestPassword123!',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: userData,
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });

    it('should return 400 for weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'weak',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: userData,
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });

    it('should return 400 for invalid wallet address', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        walletAddress: 'invalid-address',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: userData,
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });

    it('should handle registration errors', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      (mockUserService.createUser as any).mockRejectedValue(new Error('User already exists'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: userData,
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('User already exists');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login user successfully', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      const mockUser = {
        id: 1,
        email: credentials.email,
        walletAddress: '0x1234567890123456789012345678901234567890',
        preferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockUserService.authenticateUser as any).mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: credentials,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.user).toMatchObject({
        ...mockUser,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(data.data.token).toBeDefined();
      expect(typeof data.data.token).toBe('string');
    });

    it('should return 401 for invalid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      (mockUserService.authenticateUser as any).mockRejectedValue(
        new Error('Invalid email or password')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: credentials,
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('Invalid email or password');
    });

    it('should return 400 for invalid email format', async () => {
      const credentials = {
        email: 'invalid-email',
        password: 'TestPassword123!',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: credentials,
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    it('should return user profile for authenticated user', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        walletAddress: '0x1234567890123456789012345678901234567890',
        preferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockUserService.getUserById as any).mockResolvedValue(mockUser);

      const token = app.jwt.sign({
        id: mockUser.id,
        email: mockUser.email,
        walletAddress: mockUser.walletAddress,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/profile',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.user).toMatchObject({
        ...mockUser,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/profile',
      });

      expect(response.statusCode).toBe(401);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTHENTICATION_ERROR');
      expect(data.error.message).toBe('Authentication required');
    });

    it('should return 404 if user not found', async () => {
      (mockUserService.getUserById as any).mockResolvedValue(null);

      const token = app.jwt.sign({
        id: 999,
        email: 'test@example.com',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/profile',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('PUT /api/v1/auth/preferences', () => {
    it('should update user preferences successfully', async () => {
      const preferences = {
        theme: 'dark' as const,
        riskTolerance: 'high' as const,
      };

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        preferences: { ...preferences },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockUserService.updateUserPreferences as any).mockResolvedValue(mockUser);

      const token = app.jwt.sign({
        id: mockUser.id,
        email: mockUser.email,
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/auth/preferences',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: preferences,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.user).toMatchObject({
        ...mockUser,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/auth/preferences',
        payload: { theme: 'dark' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/auth/link-wallet', () => {
    it('should link wallet address successfully', async () => {
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        walletAddress,
        preferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockUserService.linkWalletAddress as any).mockResolvedValue(mockUser);

      const token = app.jwt.sign({
        id: mockUser.id,
        email: mockUser.email,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/link-wallet',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: { walletAddress },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.user.walletAddress).toBe(walletAddress);
    });

    it('should return 400 for invalid wallet address', async () => {
      const token = app.jwt.sign({
        id: 1,
        email: 'test@example.com',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/link-wallet',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: { walletAddress: 'invalid-address' },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('should change password successfully', async () => {
      const passwordData = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      };

      (mockUserService.changePassword as any).mockResolvedValue(undefined);

      const token = app.jwt.sign({
        id: 1,
        email: 'test@example.com',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: passwordData,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.message).toBe('Password changed successfully');
    });

    it('should return 400 for weak new password', async () => {
      const passwordData = {
        currentPassword: 'OldPassword123!',
        newPassword: 'weak',
      };

      const token = app.jwt.sign({
        id: 1,
        email: 'test@example.com',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: passwordData,
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });

    it('should handle change password errors', async () => {
      const passwordData = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!',
      };

      (mockUserService.changePassword as any).mockRejectedValue(
        new Error('Current password is incorrect')
      );

      const token = app.jwt.sign({
        id: 1,
        email: 'test@example.com',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: passwordData,
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('Current password is incorrect');
    });
  });
});
