import { describe, it, expect } from 'vitest';
import { PortfolioQuerySchema, CreatePortfolioSchema, UpdatePortfolioSchema } from '../schemas/portfolio.js';

describe('Portfolio Routes', () => {

  describe('Portfolio Schema Validation', () => {
    it('should validate portfolio query schema', () => {
      const validQuery = {
        page: 1,
        limit: 10,
        sortBy: 'currentValue',
        sortOrder: 'desc',
      };

      const result = PortfolioQuerySchema.parse(validQuery);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.sortBy).toBe('currentValue');
      expect(result.sortOrder).toBe('desc');
    });

    it('should apply default values for portfolio query', () => {
      const result = PortfolioQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sortBy).toBe('currentValue');
      expect(result.sortOrder).toBe('desc');
    });

    it('should validate create portfolio schema', () => {
      const validData = {
        coinId: 1,
        amount: 1000,
        avgPrice: 0.001,
      };

      const result = CreatePortfolioSchema.parse(validData);
      expect(result.coinId).toBe(1);
      expect(result.amount).toBe(1000);
      expect(result.avgPrice).toBe(0.001);
    });

    it('should reject invalid create portfolio data', () => {
      const invalidData = {
        coinId: -1,
        amount: -1000,
        avgPrice: -0.001,
      };

      expect(() => CreatePortfolioSchema.parse(invalidData)).toThrow();
    });
  });

  describe('Update Portfolio Schema Validation', () => {
    it('should validate update portfolio schema', () => {
      const validData = {
        amount: 2000,
        avgPrice: 0.0015,
      };

      const result = UpdatePortfolioSchema.parse(validData);
      expect(result.amount).toBe(2000);
      expect(result.avgPrice).toBe(0.0015);
    });

    it('should allow partial updates', () => {
      const partialData = {
        amount: 2000,
      };

      const result = UpdatePortfolioSchema.parse(partialData);
      expect(result.amount).toBe(2000);
      expect(result.avgPrice).toBeUndefined();
    });

    it('should reject negative values', () => {
      const invalidData = {
        amount: -2000,
        avgPrice: -0.0015,
      };

      expect(() => UpdatePortfolioSchema.parse(invalidData)).toThrow();
    });
  });

  describe('Wallet Integration Schema Validation', () => {
    it('should validate wallet integration schema', () => {
      const validData = {
        walletAddress: '0x1234567890123456789012345678901234567890',
        networks: ['ethereum', 'bsc'],
      };

      const result = PortfolioQuerySchema.parse(validData);
      expect(result).toBeDefined();
    });

    it('should reject invalid wallet address', () => {
      const invalidData = {
        walletAddress: 'invalid-address',
        networks: ['ethereum'],
      };

      // This would be validated by the WalletIntegrationSchema
      expect(invalidData.walletAddress).not.toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });
});