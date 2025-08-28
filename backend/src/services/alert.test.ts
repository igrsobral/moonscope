import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
import { AlertService } from './alert.js';
import { CacheService } from './cache.js';
import { NotificationService } from './notification.js';

// Mock logger
const mockLogger: FastifyBaseLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(() => mockLogger),
  level: 'info',
  silent: false,
} as any;

// Mock cache service
const mockCache: CacheService = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  keys: vi.fn(),
} as any;

// Mock notification service
const mockNotificationService: NotificationService = {
  sendNotification: vi.fn(),
  getNotificationHistory: vi.fn(),
  retryFailedNotification: vi.fn(),
} as any;

describe('AlertService', () => {
  let prisma: PrismaClient;
  let alertService: AlertService;
  let userId: number;
  let coinId: number;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test',
        },
      },
    });

    alertService = new AlertService(
      prisma,
      mockLogger,
      mockCache,
      mockNotificationService
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.alert.deleteMany();
    await prisma.user.deleteMany();
    await prisma.coin.deleteMany();

    // Create test user and coin
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: 'password',
        preferences: {},
      },
    });
    userId = user.id;

    const coin = await prisma.coin.create({
      data: {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'TEST',
        name: 'Test Coin',
        network: 'ethereum',
      },
    });
    coinId = coin.id;

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('createAlert', () => {
    it('should create a price above alert', async () => {
      const alertData = {
        coinId,
        type: 'price_above' as const,
        condition: {
          targetPrice: 1.0,
        },
        notificationMethods: ['email' as const],
        name: 'Test Alert',
        description: 'Test description',
      };

      const result = await alertService.createAlert(userId, alertData);

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('price_above');
      expect(result.data?.condition).toEqual({ targetPrice: 1.0 });
      expect(result.data?.notificationMethods).toEqual(['email']);
      expect(result.data?.name).toBe('Test Alert');
      expect(result.data?.coin).toBeDefined();
    });

    it('should create a volume spike alert', async () => {
      const alertData = {
        coinId,
        type: 'volume_spike' as const,
        condition: {
          volumeThreshold: 1000000,
        },
        notificationMethods: ['email' as const, 'push' as const],
      };

      const result = await alertService.createAlert(userId, alertData);

      expect(result.success).toBe(true);
      expect(result.data?.type).toBe('volume_spike');
      expect(result.data?.condition).toEqual({ volumeThreshold: 1000000 });
      expect(result.data?.notificationMethods).toEqual(['email', 'push']);
    });

    it('should fail with non-existent coin', async () => {
      const alertData = {
        coinId: 99999,
        type: 'price_above' as const,
        condition: {
          targetPrice: 1.0,
        },
        notificationMethods: ['email' as const],
      };

      const result = await alertService.createAlert(userId, alertData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('COIN_NOT_FOUND');
    });

    it('should validate alert conditions', async () => {
      const alertData = {
        coinId,
        type: 'price_above' as const,
        condition: {}, // Empty condition
        notificationMethods: ['email' as const],
      };

      const result = await alertService.createAlert(userId, alertData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_CONDITION');
    });
  });

  describe('getAlerts', () => {
    beforeEach(async () => {
      // Create test alerts
      await prisma.alert.createMany({
        data: [
          {
            userId,
            coinId,
            type: 'price_above',
            condition: { targetPrice: 1.0 },
            notificationMethods: ['email'],
            name: 'Alert 1',
          },
          {
            userId,
            coinId,
            type: 'price_below',
            condition: { targetPrice: 0.5 },
            notificationMethods: ['email'],
            name: 'Alert 2',
            isActive: false,
          },
          {
            userId,
            coinId,
            type: 'volume_spike',
            condition: { volumeThreshold: 1000000 },
            notificationMethods: ['push'],
            name: 'Alert 3',
          },
        ],
      });
    });

    it('should get all user alerts', async () => {
      const result = await alertService.getAlerts(userId, {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.meta?.pagination?.total).toBe(3);
      expect(result.data?.[0].coin).toBeDefined();
    });

    it('should filter alerts by type', async () => {
      const result = await alertService.getAlerts(userId, {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        type: 'price_above',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].type).toBe('price_above');
    });

    it('should filter alerts by active status', async () => {
      const result = await alertService.getAlerts(userId, {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        isActive: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.every(alert => alert.isActive)).toBe(true);
    });
  });

  describe('updateAlert', () => {
    let alertId: number;

    beforeEach(async () => {
      const alert = await prisma.alert.create({
        data: {
          userId,
          coinId,
          type: 'price_above',
          condition: { targetPrice: 1.0 },
          notificationMethods: ['email'],
          name: 'Test Alert',
        },
      });
      alertId = alert.id;
    });

    it('should update alert condition', async () => {
      const result = await alertService.updateAlert(userId, alertId, {
        condition: { targetPrice: 2.0 },
        name: 'Updated Alert',
      });

      expect(result.success).toBe(true);
      expect(result.data?.condition).toEqual({ targetPrice: 2.0 });
      expect(result.data?.name).toBe('Updated Alert');
    });

    it('should update alert status', async () => {
      const result = await alertService.updateAlert(userId, alertId, {
        isActive: false,
      });

      expect(result.success).toBe(true);
      expect(result.data?.isActive).toBe(false);
    });

    it('should fail for non-existent alert', async () => {
      const result = await alertService.updateAlert(userId, 99999, {
        name: 'Updated Alert',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('deleteAlert', () => {
    let alertId: number;

    beforeEach(async () => {
      const alert = await prisma.alert.create({
        data: {
          userId,
          coinId,
          type: 'price_above',
          condition: { targetPrice: 1.0 },
          notificationMethods: ['email'],
          name: 'Test Alert',
        },
      });
      alertId = alert.id;
    });

    it('should delete alert', async () => {
      const result = await alertService.deleteAlert(userId, alertId);

      expect(result.success).toBe(true);

      // Verify alert is deleted
      const alert = await prisma.alert.findUnique({
        where: { id: alertId },
      });
      expect(alert).toBeNull();
    });

    it('should fail for non-existent alert', async () => {
      const result = await alertService.deleteAlert(userId, 99999);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('performAlertAction', () => {
    let alertId: number;

    beforeEach(async () => {
      const alert = await prisma.alert.create({
        data: {
          userId,
          coinId,
          type: 'price_above',
          condition: { targetPrice: 1.0 },
          notificationMethods: ['email'],
          name: 'Test Alert',
        },
      });
      alertId = alert.id;
    });

    it('should pause alert', async () => {
      const result = await alertService.performAlertAction(userId, alertId, {
        action: 'pause',
      });

      expect(result.success).toBe(true);
      expect(result.data?.isActive).toBe(false);
    });

    it('should resume alert', async () => {
      // First pause the alert
      await prisma.alert.update({
        where: { id: alertId },
        data: { isActive: false },
      });

      const result = await alertService.performAlertAction(userId, alertId, {
        action: 'resume',
      });

      expect(result.success).toBe(true);
      expect(result.data?.isActive).toBe(true);
    });

    it('should test alert', async () => {
      const result = await alertService.performAlertAction(userId, alertId, {
        action: 'test',
      });

      expect(result.success).toBe(true);
      expect(mockNotificationService.sendNotification).toHaveBeenCalled();
    });
  });

  describe('checkAlerts', () => {
    beforeEach(async () => {
      // Create test alerts
      await prisma.alert.createMany({
        data: [
          {
            userId,
            coinId,
            type: 'price_above',
            condition: { targetPrice: 1.0 },
            notificationMethods: ['email'],
            name: 'Price Above Alert',
          },
          {
            userId,
            coinId,
            type: 'price_below',
            condition: { targetPrice: 0.5 },
            notificationMethods: ['email'],
            name: 'Price Below Alert',
          },
          {
            userId,
            coinId,
            type: 'volume_spike',
            condition: { volumeThreshold: 1000000 },
            notificationMethods: ['email'],
            name: 'Volume Spike Alert',
          },
        ],
      });
    });

    it('should trigger price above alert', async () => {
      const context = {
        coinId,
        currentPrice: 1.5,
        priceChange24h: 50,
      };

      await alertService.checkAlerts(context);

      // Should trigger the price above alert
      const alerts = await prisma.alert.findMany({
        where: { coinId, lastTriggered: { not: null } },
      });

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('price_above');
    });

    it('should trigger price below alert', async () => {
      const context = {
        coinId,
        currentPrice: 0.3,
        priceChange24h: -40,
      };

      await alertService.checkAlerts(context);

      // Should trigger the price below alert
      const alerts = await prisma.alert.findMany({
        where: { coinId, lastTriggered: { not: null } },
      });

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('price_below');
    });

    it('should trigger volume spike alert', async () => {
      const context = {
        coinId,
        volume24h: 2000000,
      };

      await alertService.checkAlerts(context);

      // Should trigger the volume spike alert
      const alerts = await prisma.alert.findMany({
        where: { coinId, lastTriggered: { not: null } },
      });

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('volume_spike');
    });

    it('should not trigger alerts when conditions are not met', async () => {
      const context = {
        coinId,
        currentPrice: 0.8, // Between 0.5 and 1.0
        volume24h: 500000, // Below threshold
      };

      await alertService.checkAlerts(context);

      // Should not trigger any alerts
      const alerts = await prisma.alert.findMany({
        where: { coinId, lastTriggered: { not: null } },
      });

      expect(alerts).toHaveLength(0);
    });
  });
});