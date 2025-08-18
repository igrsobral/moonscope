import { describe, it, expect } from 'vitest';
import {
  cn,
  formatCurrency,
  formatNumber,
  formatPercentage,
  isValidEthereumAddress,
  truncateAddress,
  calculatePercentageChange,
  clamp,
  formatTimeAgo,
  getRiskColor,
  getRiskLabel,
  getChangeColor,
} from './utils';

describe('Utility Functions', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500');
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });
  });

  describe('formatCurrency', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0.123456)).toBe('$0.123456');
    });
  });

  describe('formatNumber', () => {
    it('should format large numbers correctly', () => {
      expect(formatNumber(1234567890)).toBe('1.23B');
      expect(formatNumber(1234567)).toBe('1.23M');
      expect(formatNumber(1234)).toBe('1.23K');
      expect(formatNumber(123)).toBe('123.00');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage correctly', () => {
      expect(formatPercentage(25)).toBe('+25.00%');
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

  describe('getRiskColor', () => {
    it('should return correct risk colors', () => {
      expect(getRiskColor(90)).toBe('text-green-600');
      expect(getRiskColor(70)).toBe('text-yellow-600');
      expect(getRiskColor(50)).toBe('text-orange-600');
      expect(getRiskColor(30)).toBe('text-red-600');
    });
  });

  describe('getRiskLabel', () => {
    it('should return correct risk labels', () => {
      expect(getRiskLabel(90)).toBe('Low Risk');
      expect(getRiskLabel(70)).toBe('Medium Risk');
      expect(getRiskLabel(50)).toBe('High Risk');
      expect(getRiskLabel(30)).toBe('Very High Risk');
    });
  });

  describe('getChangeColor', () => {
    it('should return correct change colors', () => {
      expect(getChangeColor(5)).toBe('text-green-600');
      expect(getChangeColor(-5)).toBe('text-red-600');
      expect(getChangeColor(0)).toBe('text-green-600');
    });
  });
});
