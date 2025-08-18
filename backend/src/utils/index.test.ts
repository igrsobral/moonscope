import { describe, it, expect } from 'vitest';
import {
  sleep,
  generateId,
  formatCurrency,
  formatPercentage,
  isValidEthereumAddress,
  truncateAddress,
  calculatePercentageChange,
  clamp,
} from './index';

describe('Utility Functions', () => {
  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      const start = Date.now();
      await sleep(10);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(10);
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0.123456)).toBe('$0.12');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage correctly', () => {
      expect(formatPercentage(25)).toBe('25.00%');
      expect(formatPercentage(-10)).toBe('-10.00%');
    });
  });

  describe('isValidEthereumAddress', () => {
    it('should validate Ethereum addresses correctly', () => {
      expect(isValidEthereumAddress('0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6')).toBe(true);
      expect(isValidEthereumAddress('0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b')).toBe(false);
      expect(isValidEthereumAddress('742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6')).toBe(false);
    });
  });

  describe('truncateAddress', () => {
    it('should truncate Ethereum addresses correctly', () => {
      const address = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
      expect(truncateAddress(address)).toBe('0x742d...d8b6');
      expect(truncateAddress(address, 6)).toBe('0x742d35...b4d8b6');
    });
  });

  describe('calculatePercentageChange', () => {
    it('should calculate percentage change correctly', () => {
      expect(calculatePercentageChange(110, 100)).toBe(10);
      expect(calculatePercentageChange(90, 100)).toBe(-10);
      expect(calculatePercentageChange(100, 0)).toBe(0);
    });
  });

  describe('clamp', () => {
    it('should clamp values correctly', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });
});
