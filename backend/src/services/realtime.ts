import type { FastifyInstance } from 'fastify';
import type { WebSocketEvent, PriceData, Alert, WhaleTransaction } from '../types/index.js';

export interface RealtimeService {
  broadcastPriceUpdate: (coinId: string, priceData: PriceData) => void;
  broadcastAlertTriggered: (userId: number, alert: Alert, coinData?: any) => void;
  broadcastWhaleMovement: (coinId: string, transaction: WhaleTransaction) => void;
  broadcastSocialSpike: (coinId: string, socialData: any) => void;
  broadcastToUser: (userId: number, event: WebSocketEvent) => void;
  broadcastToCoin: (coinId: string, event: WebSocketEvent) => void;
  broadcastGlobal: (event: WebSocketEvent) => void;
}

/**
 * Service for managing real-time events and broadcasting
 */
export function createRealtimeService(fastify: FastifyInstance): RealtimeService {
  return {
    /**
     * Broadcast price updates to subscribers
     */
    broadcastPriceUpdate(coinId: string, priceData: PriceData) {
      const event: WebSocketEvent = {
        type: 'price_update',
        data: {
          coinId,
          price: priceData.price,
          marketCap: priceData.marketCap,
          volume24h: priceData.volume24h,
          priceChange24h: priceData.priceChange24h,
          volumeChange24h: priceData.volumeChange24h,
          timestamp: priceData.timestamp,
        },
        timestamp: new Date().toISOString(),
        coinId,
      };

      fastify.websocketManager.broadcastToCoin(coinId, event);

      fastify.log.debug({ 
        coinId, 
        price: priceData.price, 
        change: priceData.priceChange24h 
      }, 'Broadcasted price update');
    },

    /**
     * Broadcast alert triggered to specific user
     */
    broadcastAlertTriggered(userId: number, alert: Alert, coinData?: any) {
      const event: WebSocketEvent = {
        type: 'alert_triggered',
        data: {
          alertId: alert.id,
          alertType: alert.type,
          coinId: alert.coinId,
          condition: alert.condition,
          coinData,
          triggeredAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
        userId: userId.toString(),
        coinId: alert.coinId.toString(),
      };

      fastify.websocketManager.broadcastToUser(userId, event);

      fastify.log.info({ 
        userId, 
        alertId: alert.id, 
        alertType: alert.type, 
        coinId: alert.coinId 
      }, 'Broadcasted alert triggered');
    },

    /**
     * Broadcast whale movement to coin subscribers
     */
    broadcastWhaleMovement(coinId: string, transaction: WhaleTransaction) {
      const event: WebSocketEvent = {
        type: 'whale_movement',
        data: {
          coinId,
          txHash: transaction.txHash,
          fromAddress: transaction.fromAddress,
          toAddress: transaction.toAddress,
          amount: transaction.amount,
          usdValue: transaction.usdValue,
          timestamp: transaction.timestamp,
        },
        timestamp: new Date().toISOString(),
        coinId,
      };

      fastify.websocketManager.broadcastToCoin(coinId, event);

      fastify.log.info({ 
        coinId, 
        txHash: transaction.txHash, 
        usdValue: transaction.usdValue 
      }, 'Broadcasted whale movement');
    },

    /**
     * Broadcast social spike to coin subscribers
     */
    broadcastSocialSpike(coinId: string, socialData: any) {
      const event: WebSocketEvent = {
        type: 'social_spike',
        data: {
          coinId,
          platform: socialData.platform,
          mentions24h: socialData.mentions24h,
          sentimentScore: socialData.sentimentScore,
          trendingScore: socialData.trendingScore,
          change: socialData.change,
          timestamp: socialData.timestamp,
        },
        timestamp: new Date().toISOString(),
        coinId,
      };

      fastify.websocketManager.broadcastToCoin(coinId, event);

      fastify.log.info({ 
        coinId, 
        platform: socialData.platform, 
        mentions: socialData.mentions24h 
      }, 'Broadcasted social spike');
    },

    /**
     * Broadcast event to specific user
     */
    broadcastToUser(userId: number, event: WebSocketEvent) {
      fastify.websocketManager.broadcastToUser(userId, event);
    },

    /**
     * Broadcast event to coin subscribers
     */
    broadcastToCoin(coinId: string, event: WebSocketEvent) {
      fastify.websocketManager.broadcastToCoin(coinId, event);
    },

    /**
     * Broadcast event to all connected clients
     */
    broadcastGlobal(event: WebSocketEvent) {
      fastify.websocketManager.broadcast(event);
    },
  };
}

/**
 * Plugin to register realtime service
 */
export async function realtimePlugin(fastify: FastifyInstance): Promise<void> {
  const realtimeService = createRealtimeService(fastify);
  fastify.decorate('realtime', realtimeService);
}

declare module 'fastify' {
  interface FastifyInstance {
    realtime: RealtimeService;
  }
}