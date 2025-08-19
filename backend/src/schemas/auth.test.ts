import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  updatePreferencesSchema,
  linkWalletSchema,
  changePasswordSchema,
} from './auth.js';

describe('Auth Schemas', () => {
  describe('registerSchema', () => {
    it('should validate valid registration data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        walletAddress: '0x1234567890123456789012345678901234567890',
        preferences: {
          theme: 'dark' as const,
          riskTolerance: 'high' as const,
        },
      };

      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should validate registration data without optional fields', () => {
      const validData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'TestPassword123!',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid email format');
      }
    });

    it('should reject weak password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'weak',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Password must be at least 8 characters long');
      }
    });

    it('should reject password without special characters', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'TestPassword123',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Password must contain');
      }
    });

    it('should reject invalid wallet address', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        walletAddress: 'invalid-address',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid Ethereum wallet address');
      }
    });

    it('should reject wallet address with wrong length', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        walletAddress: '0x123456789012345678901234567890123456789', // 39 chars instead of 40
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'TestPassword123!',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid email format');
      }
    });

    it('should reject empty password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password is required');
      }
    });
  });

  describe('updatePreferencesSchema', () => {
    it('should validate valid preferences data', () => {
      const validData = {
        theme: 'dark' as const,
        riskTolerance: 'high' as const,
        defaultCurrency: 'EUR',
        notifications: {
          email: false,
          push: true,
          priceAlerts: true,
        },
      };

      const result = updatePreferencesSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should validate empty preferences object', () => {
      const validData = {};

      const result = updatePreferencesSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid theme value', () => {
      const invalidData = {
        theme: 'invalid-theme',
      };

      const result = updatePreferencesSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid risk tolerance value', () => {
      const invalidData = {
        riskTolerance: 'invalid-risk',
      };

      const result = updatePreferencesSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('linkWalletSchema', () => {
    it('should validate valid wallet address', () => {
      const validData = {
        walletAddress: '0x1234567890123456789012345678901234567890',
      };

      const result = linkWalletSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should reject invalid wallet address format', () => {
      const invalidData = {
        walletAddress: 'invalid-address',
      };

      const result = linkWalletSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid Ethereum wallet address');
      }
    });

    it('should reject wallet address without 0x prefix', () => {
      const invalidData = {
        walletAddress: '1234567890123456789012345678901234567890',
      };

      const result = linkWalletSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('should validate valid password change data', () => {
      const validData = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      };

      const result = changePasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should reject empty current password', () => {
      const invalidData = {
        currentPassword: '',
        newPassword: 'NewPassword123!',
      };

      const result = changePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Current password is required');
      }
    });

    it('should reject weak new password', () => {
      const invalidData = {
        currentPassword: 'OldPassword123!',
        newPassword: 'weak',
      };

      const result = changePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Password must be at least 8 characters long');
      }
    });

    it('should reject new password without special characters', () => {
      const invalidData = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123',
      };

      const result = changePasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Password must contain');
      }
    });
  });
});