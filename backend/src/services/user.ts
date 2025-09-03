import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import type { User, UserPreferences } from '../types/index.js';

export interface CreateUserData {
  walletAddress?: string | undefined;
  email: string;
  password: string;
  preferences?: Partial<UserPreferences> | undefined;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface UserWithoutPassword extends Omit<User, 'password'> {}

/**
 * User service for authentication and user management
 */
export class UserService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Hash a password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify a password against its hash
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Get default user preferences
   */
  private getDefaultPreferences(): UserPreferences {
    return {
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
    };
  }

  /**
   * Create a new user with email and password
   */
  async createUser(userData: CreateUserData): Promise<UserWithoutPassword> {
    const { email, password, walletAddress, preferences } = userData;

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(walletAddress ? [{ walletAddress }] : []),
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new Error('User with this email already exists');
      }
      if (existingUser.walletAddress === walletAddress) {
        throw new Error('User with this wallet address already exists');
      }
    }

    const hashedPassword = await this.hashPassword(password);
    const defaultPrefs = this.getDefaultPreferences();
    const userPreferences = {
      ...defaultPrefs,
      ...(preferences || {}),
      notifications: {
        ...defaultPrefs.notifications,
        ...(preferences?.notifications || {}),
      },
    };

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        walletAddress,
        preferences: userPreferences as any,
      },
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      preferences: userWithoutPassword.preferences as unknown as UserPreferences,
    } as UserWithoutPassword;
  }

  /**
   * Authenticate user with email and password
   */
  async authenticateUser(credentials: LoginCredentials): Promise<UserWithoutPassword> {
    const { email, password } = credentials;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isValidPassword = await this.verifyPassword(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      preferences: userWithoutPassword.preferences as unknown as UserPreferences,
    } as UserWithoutPassword;
  }

  /**
   * Get user by ID (without password)
   */
  async getUserById(id: number): Promise<UserWithoutPassword | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        walletAddress: true,
        email: true,
        preferences: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user ? {
      ...user,
      preferences: user.preferences as unknown as UserPreferences,
    } as UserWithoutPassword : null;
  }

  /**
   * Get user by wallet address (without password)
   */
  async getUserByWalletAddress(walletAddress: string): Promise<UserWithoutPassword | null> {
    const user = await this.prisma.user.findUnique({
      where: { walletAddress },
      select: {
        id: true,
        walletAddress: true,
        email: true,
        preferences: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user ? {
      ...user,
      preferences: user.preferences as unknown as UserPreferences,
    } as UserWithoutPassword : null;
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: number,
    preferences: Partial<UserPreferences>
  ): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        preferences: preferences as any,
      },
      select: {
        id: true,
        walletAddress: true,
        email: true,
        preferences: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...user,
      preferences: user.preferences as unknown as UserPreferences,
    } as UserWithoutPassword;
  }

  /**
   * Link wallet address to existing user
   */
  async linkWalletAddress(userId: number, walletAddress: string): Promise<UserWithoutPassword> {
    // Check if wallet address is already linked to another user
    const existingUser = await this.prisma.user.findUnique({
      where: { walletAddress },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new Error('Wallet address is already linked to another account');
    }

    const user = await this.prisma.user.update({
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

    return {
      ...user,
      preferences: user.preferences as unknown as UserPreferences,
    } as UserWithoutPassword;
  }

  /**
   * Change user password
   */
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isValidPassword = await this.verifyPassword(currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    const hashedNewPassword = await this.hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });
  }
}