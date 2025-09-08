import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { FastifyBaseLogger } from 'fastify';
import {
  NotificationService,
  EmailNotificationChannel,
  PushNotificationChannel,
  SMSNotificationChannel,
} from './notification.js';

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

describe('NotificationService', () => {
  let prisma: PrismaClient;
  let notificationService: NotificationService;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test',
        },
      },
    });

    notificationService = new NotificationService(prisma, mockLogger, {
      email: {
        smtpHost: 'localhost',
        smtpPort: 587,
        smtpUser: 'test',
        smtpPassword: 'test',
        fromEmail: 'test@example.com',
        fromName: 'Test',
      },
      push: {
        fcmServerKey: 'test-key',
      },
      sms: {
        twilioAccountSid: 'test-sid',
        twilioAuthToken: 'test-token',
        fromPhoneNumber: '+1234567890',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.notificationHistory.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.user.deleteMany();
    await prisma.coin.deleteMany();
  });

  describe('sendNotification', () => {
    let alertId: number;

    beforeEach(async () => {
      // Create test data
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'password',
          preferences: {},
        },
      });

      const coin = await prisma.coin.create({
        data: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'TEST',
          name: 'Test Coin',
          network: 'ethereum',
        },
      });

      const alert = await prisma.alert.create({
        data: {
          userId: user.id,
          coinId: coin.id,
          type: 'price_above',
          condition: { targetPrice: 1.0 },
          notificationMethods: ['email'],
        },
      });

      alertId = alert.id;
    });

    it('should send email notification successfully', async () => {
      const delivery = {
        alertId,
        method: 'email' as const,
        recipient: 'test@example.com',
        subject: 'Test Alert',
        content: 'This is a test notification',
      };

      const result = await notificationService.sendNotification(delivery);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.method).toBe('email');
      expect(result.data?.status).toBe('sent');
    });

    it('should handle invalid email recipient', async () => {
      const delivery = {
        alertId,
        method: 'email' as const,
        recipient: 'invalid-email',
        subject: 'Test Alert',
        content: 'This is a test notification',
      };

      const result = await notificationService.sendNotification(delivery);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_RECIPIENT');
    });

    it('should handle unavailable notification channel', async () => {
      const serviceWithoutChannels = new NotificationService(prisma, mockLogger, {});

      const delivery = {
        alertId,
        method: 'email' as const,
        recipient: 'test@example.com',
        subject: 'Test Alert',
        content: 'This is a test notification',
      };

      const result = await serviceWithoutChannels.sendNotification(delivery);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CHANNEL_NOT_AVAILABLE');
    });
  });

  describe('getNotificationHistory', () => {
    let alertId: number;

    beforeEach(async () => {
      // Create test data
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'password',
          preferences: {},
        },
      });

      const coin = await prisma.coin.create({
        data: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'TEST',
          name: 'Test Coin',
          network: 'ethereum',
        },
      });

      const alert = await prisma.alert.create({
        data: {
          userId: user.id,
          coinId: coin.id,
          type: 'price_above',
          condition: { targetPrice: 1.0 },
          notificationMethods: ['email'],
        },
      });

      alertId = alert.id;

      // Create notification history
      await prisma.notificationHistory.createMany({
        data: [
          {
            alertId,
            method: 'email',
            recipient: 'test@example.com',
            subject: 'Test 1',
            content: 'Content 1',
            status: 'sent',
            retryCount: 0,
          },
          {
            alertId,
            method: 'email',
            recipient: 'test@example.com',
            subject: 'Test 2',
            content: 'Content 2',
            status: 'failed',
            retryCount: 1,
          },
        ],
      });
    });

    it('should get notification history with pagination', async () => {
      const result = await notificationService.getNotificationHistory(alertId, {
        page: 1,
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.meta?.pagination?.total).toBe(2);
    });

    it('should handle non-existent alert', async () => {
      const result = await notificationService.getNotificationHistory(99999);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
      expect(result.meta?.pagination?.total).toBe(0);
    });
  });
});

describe('EmailNotificationChannel', () => {
  let channel: EmailNotificationChannel;

  beforeAll(() => {
    channel = new EmailNotificationChannel(
      {
        smtpHost: 'localhost',
        smtpPort: 587,
        smtpUser: 'test',
        smtpPassword: 'test',
        fromEmail: 'test@example.com',
        fromName: 'Test',
      },
      mockLogger
    );
  });

  describe('validateRecipient', () => {
    it('should validate correct email addresses', () => {
      expect(channel.validateRecipient('test@example.com')).toBe(true);
      expect(channel.validateRecipient('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(channel.validateRecipient('invalid-email')).toBe(false);
      expect(channel.validateRecipient('test@')).toBe(false);
      expect(channel.validateRecipient('@example.com')).toBe(false);
    });
  });

  describe('send', () => {
    it('should simulate successful email sending', async () => {
      const delivery = {
        alertId: 1,
        method: 'email' as const,
        recipient: 'test@example.com',
        subject: 'Test Alert',
        content: 'This is a test notification',
      };

      const result = await channel.send(delivery);

      // Since we're simulating, it should usually succeed
      // (with 5% simulated failure rate, most tests will pass)
      if (result.success) {
        expect(result.messageId).toBeDefined();
        expect(result.messageId).toMatch(/^email_/);
      } else {
        expect(result.error).toBeDefined();
        expect(result.retryable).toBe(true);
      }
    });
  });
});

describe('PushNotificationChannel', () => {
  let channel: PushNotificationChannel;

  beforeAll(() => {
    channel = new PushNotificationChannel(
      {
        fcmServerKey: 'test-key',
      },
      mockLogger
    );
  });

  describe('validateRecipient', () => {
    it('should validate device tokens', () => {
      expect(channel.validateRecipient('valid_device_token_123')).toBe(true);
      expect(channel.validateRecipient('abcdef123456')).toBe(true);
    });

    it('should reject invalid device tokens', () => {
      expect(channel.validateRecipient('short')).toBe(false);
      expect(channel.validateRecipient('invalid@token')).toBe(false);
      expect(channel.validateRecipient('')).toBe(false);
    });
  });
});

describe('SMSNotificationChannel', () => {
  let channel: SMSNotificationChannel;

  beforeAll(() => {
    channel = new SMSNotificationChannel(
      {
        twilioAccountSid: 'test-sid',
        twilioAuthToken: 'test-token',
        fromPhoneNumber: '+1234567890',
      },
      mockLogger
    );
  });

  describe('validateRecipient', () => {
    it('should validate phone numbers', () => {
      expect(channel.validateRecipient('+1234567890')).toBe(true);
      expect(channel.validateRecipient('1234567890')).toBe(true);
      expect(channel.validateRecipient('+44 20 7946 0958')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(channel.validateRecipient('123')).toBe(false);
      expect(channel.validateRecipient('invalid')).toBe(false);
      expect(channel.validateRecipient('')).toBe(false);
    });
  });
});
