import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { UserService } from './user.js';
import type { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrisma = {
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
} as unknown as PrismaClient;

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService(mockPrisma);
    vi.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        walletAddress: '0x1234567890123456789012345678901234567890',
      };

      const hashedPassword = 'hashedPassword123';
      const createdUser = {
        id: 1,
        email: userData.email,
        password: hashedPassword,
        walletAddress: userData.walletAddress,
        preferences: {
          notifications: {
            email: true,
            push: true,
            sms: false,
            priceAlerts: true,
            whaleMovements: true,
            socialSpikes: false,
          },
          defaultCurrency: 'USD',
          theme: 'light',
          riskTolerance: 'medium',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.user.findFirst as any).mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue(hashedPassword);
      (mockPrisma.user.create as any).mockResolvedValue(createdUser);

      const result = await userService.createUser(userData);

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ email: userData.email }, { walletAddress: userData.walletAddress }],
        },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 12);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: userData.email,
          password: hashedPassword,
          walletAddress: userData.walletAddress,
          preferences: expect.any(Object),
        },
      });
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe(userData.email);
    });

    it('should throw error if user with email already exists', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      const existingUser = {
        id: 1,
        email: userData.email,
        walletAddress: null,
      };

      (mockPrisma.user.findFirst as any).mockResolvedValue(existingUser);

      await expect(userService.createUser(userData)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should throw error if user with wallet address already exists', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        walletAddress: '0x1234567890123456789012345678901234567890',
      };

      const existingUser = {
        id: 1,
        email: 'other@example.com',
        walletAddress: userData.walletAddress,
      };

      (mockPrisma.user.findFirst as any).mockResolvedValue(existingUser);

      await expect(userService.createUser(userData)).rejects.toThrow(
        'User with this wallet address already exists'
      );
    });
  });

  describe('authenticateUser', () => {
    it('should authenticate user with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      const user = {
        id: 1,
        email: credentials.email,
        password: 'hashedPassword123',
        walletAddress: '0x1234567890123456789012345678901234567890',
        preferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.user.findUnique as any).mockResolvedValue(user);
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await userService.authenticateUser(credentials);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: credentials.email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(credentials.password, user.password);
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe(credentials.email);
    });

    it('should throw error if user not found', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'TestPassword123!',
      };

      (mockPrisma.user.findUnique as any).mockResolvedValue(null);

      await expect(userService.authenticateUser(credentials)).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should throw error if password is invalid', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      const user = {
        id: 1,
        email: credentials.email,
        password: 'hashedPassword123',
      };

      (mockPrisma.user.findUnique as any).mockResolvedValue(user);
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(userService.authenticateUser(credentials)).rejects.toThrow(
        'Invalid email or password'
      );
    });
  });

  describe('getUserById', () => {
    it('should return user without password', async () => {
      const userId = 1;
      const user = {
        id: userId,
        email: 'test@example.com',
        walletAddress: '0x1234567890123456789012345678901234567890',
        preferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.user.findUnique as any).mockResolvedValue(user);

      const result = await userService.getUserById(userId);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          id: true,
          walletAddress: true,
          email: true,
          preferences: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(user);
    });

    it('should return null if user not found', async () => {
      const userId = 999;

      (mockPrisma.user.findUnique as any).mockResolvedValue(null);

      const result = await userService.getUserById(userId);

      expect(result).toBeNull();
    });
  });

  describe('linkWalletAddress', () => {
    it('should link wallet address to user', async () => {
      const userId = 1;
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const updatedUser = {
        id: userId,
        email: 'test@example.com',
        walletAddress,
        preferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.user.findUnique as any).mockResolvedValue(null);
      (mockPrisma.user.update as any).mockResolvedValue(updatedUser);

      const result = await userService.linkWalletAddress(userId, walletAddress);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { walletAddress },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { walletAddress },
        select: {
          id: true,
          walletAddress: true,
          email: true,
          preferences: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(updatedUser);
    });

    it('should throw error if wallet address is already linked to another user', async () => {
      const userId = 1;
      const walletAddress = '0x1234567890123456789012345678901234567890';
      const existingUser = {
        id: 2,
        walletAddress,
      };

      (mockPrisma.user.findUnique as any).mockResolvedValue(existingUser);

      await expect(userService.linkWalletAddress(userId, walletAddress)).rejects.toThrow(
        'Wallet address is already linked to another account'
      );
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const userId = 1;
      const currentPassword = 'OldPassword123!';
      const newPassword = 'NewPassword123!';
      const user = {
        id: userId,
        password: 'oldHashedPassword',
      };
      const newHashedPassword = 'newHashedPassword';

      (mockPrisma.user.findUnique as any).mockResolvedValue(user);
      (bcrypt.compare as any).mockResolvedValue(true);
      (bcrypt.hash as any).mockResolvedValue(newHashedPassword);
      (mockPrisma.user.update as any).mockResolvedValue({});

      await userService.changePassword(userId, currentPassword, newPassword);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(currentPassword, user.password);
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: newHashedPassword },
      });
    });

    it('should throw error if user not found', async () => {
      const userId = 999;
      const currentPassword = 'OldPassword123!';
      const newPassword = 'NewPassword123!';

      (mockPrisma.user.findUnique as any).mockResolvedValue(null);

      await expect(
        userService.changePassword(userId, currentPassword, newPassword)
      ).rejects.toThrow('User not found');
    });

    it('should throw error if current password is incorrect', async () => {
      const userId = 1;
      const currentPassword = 'WrongPassword123!';
      const newPassword = 'NewPassword123!';
      const user = {
        id: userId,
        password: 'oldHashedPassword',
      };

      (mockPrisma.user.findUnique as any).mockResolvedValue(user);
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(
        userService.changePassword(userId, currentPassword, newPassword)
      ).rejects.toThrow('Current password is incorrect');
    });
  });
});
