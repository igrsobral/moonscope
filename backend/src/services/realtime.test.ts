import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import type { PriceData, Alert, WhaleTransaction } from '../types/index.js';

describe('Realtime Service', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should register realtime service', () => {
    expect(app.realtime).toBeDefined();
    expect(app.realtime.broadcastPriceUpdate).toBeTypeOf('function');
    expect(app.realtime.broadcastAlertTriggered).toBeTypeOf('function');
    expect(app.realtime.broadcastWhaleMovement).toBeTypeOf('function');
    expect(app.realtime.broadcastSocialSpike).toBeTypeOf('function');
  });

  it('should broadcast price updates', () => {
    const mockBroadcastToCoin = vi.spyOn(app.websocketManager, 'broadcastToCoin');

    const priceData: PriceData = {
      id: 1,
      coinId: 1,
      price: 50000,
      marketCap: 1000000000,
      volume24h: 50000000,
      liquidity: 10000000,
      priceChange24h: 5.2,
      volumeChange24h: -2.1,
      timestamp: new Date(),
    };

    app.realtime.broadcastPriceUpdate('bitcoin', priceData);

    expect(mockBroadcastToCoin).toHaveBeenCalledWith(
      'bitcoin',
      expect.objectContaining({
        type: 'price_update',
        data: expect.objectContaining({
          coinId: 'bitcoin',
          price: 50000,
          marketCap: 1000000000,
          volume24h: 50000000,
          priceChange24h: 5.2,
        }),
        coinId: 'bitcoin',
      })
    );
  });

  it('should broadcast alert triggered', () => {
    const mockBroadcastToUser = vi.spyOn(app.websocketManager, 'broadcastToUser');

    const alert: Alert = {
      id: 1,
      userId: 1,
      coinId: 1,
      type: 'price_above',
      condition: { targetPrice: 50000 },
      notificationMethods: ['email'],
      isActive: true,
      createdAt: new Date(),
    };

    const coinData = { symbol: 'BTC', name: 'Bitcoin' };

    app.realtime.broadcastAlertTriggered(1, alert, coinData);

    expect(mockBroadcastToUser).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        type: 'alert_triggered',
        data: expect.objectContaining({
          alertId: 1,
          alertType: 'price_above',
          coinId: 1,
          condition: { targetPrice: 50000 },
          coinData,
        }),
        userId: '1',
        coinId: '1',
      })
    );
  });

  it('should broadcast whale movements', () => {
    const mockBroadcastToCoin = vi.spyOn(app.websocketManager, 'broadcastToCoin');

    const whaleTransaction: WhaleTransaction = {
      id: 1,
      coinId: 1,
      txHash: '0x123456789abcdef',
      fromAddress: '0xfrom123',
      toAddress: '0xto456',
      amount: 1000,
      usdValue: 50000000,
      timestamp: new Date(),
    };

    app.realtime.broadcastWhaleMovement('bitcoin', whaleTransaction);

    expect(mockBroadcastToCoin).toHaveBeenCalledWith(
      'bitcoin',
      expect.objectContaining({
        type: 'whale_movement',
        data: expect.objectContaining({
          coinId: 'bitcoin',
          txHash: '0x123456789abcdef',
          fromAddress: '0xfrom123',
          toAddress: '0xto456',
          amount: 1000,
          usdValue: 50000000,
        }),
        coinId: 'bitcoin',
      })
    );
  });

  it('should broadcast social spikes', () => {
    const mockBroadcastToCoin = vi.spyOn(app.websocketManager, 'broadcastToCoin');

    const socialData = {
      platform: 'twitter',
      mentions24h: 5000,
      sentimentScore: 0.8,
      trendingScore: 95,
      change: 150,
      timestamp: new Date(),
    };

    app.realtime.broadcastSocialSpike('bitcoin', socialData);

    expect(mockBroadcastToCoin).toHaveBeenCalledWith(
      'bitcoin',
      expect.objectContaining({
        type: 'social_spike',
        data: expect.objectContaining({
          coinId: 'bitcoin',
          platform: 'twitter',
          mentions24h: 5000,
          sentimentScore: 0.8,
          trendingScore: 95,
          change: 150,
        }),
        coinId: 'bitcoin',
      })
    );
  });

  it('should broadcast to user', () => {
    const mockBroadcastToUser = vi.spyOn(app.websocketManager, 'broadcastToUser');

    const event = {
      type: 'price_update' as const,
      data: { test: 'data' },
      timestamp: new Date().toISOString(),
    };

    app.realtime.broadcastToUser(1, event);

    expect(mockBroadcastToUser).toHaveBeenCalledWith(1, event);
  });

  it('should broadcast to coin', () => {
    const mockBroadcastToCoin = vi.spyOn(app.websocketManager, 'broadcastToCoin');

    const event = {
      type: 'price_update' as const,
      data: { test: 'data' },
      timestamp: new Date().toISOString(),
    };

    app.realtime.broadcastToCoin('bitcoin', event);

    expect(mockBroadcastToCoin).toHaveBeenCalledWith('bitcoin', event);
  });

  it('should broadcast globally', () => {
    const mockBroadcast = vi.spyOn(app.websocketManager, 'broadcast');

    const event = {
      type: 'price_update' as const,
      data: { test: 'data' },
      timestamp: new Date().toISOString(),
    };

    app.realtime.broadcastGlobal(event);

    expect(mockBroadcast).toHaveBeenCalledWith(event);
  });
});
