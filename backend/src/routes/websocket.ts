import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocketConnection } from '../plugins/websocket.js';
import type { WebSocketEvent } from '../types/index.js';
import { request } from 'http';

interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'authenticate';
  data?: {
    coinId?: string;
    channel?: string;
    token?: string;
  };
}

// WebSocket connection type from @fastify/websocket
type WebSocketConnection = any;

/**
 * WebSocket routes for real-time communication
 */
export async function websocketRoutes(fastify: FastifyInstance): Promise<void> {
  // WebSocket endpoint
  fastify.get(
    '/ws',
    { websocket: true },
    async (connection: WebSocketConnection, request: FastifyRequest) => {
      const connectionId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      const wsConnection: WebSocketConnection = {
        id: connectionId,
        socket: connection,
        subscriptions: new Set(),
        lastPing: new Date(),
        isAuthenticated: false,
      };

      // Add connection to manager
      fastify.websocketManager.addConnection(wsConnection);

      // Send welcome message
      const welcomeEvent: WebSocketEvent = {
        type: 'price_update',
        data: {
          message: 'Connected to Meme Coin Analyzer WebSocket',
          connectionId,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      connection.send(JSON.stringify(welcomeEvent));

      // Handle incoming messages
      connection.on('message', async (rawMessage: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(rawMessage.toString());
          await handleWebSocketMessage(fastify, wsConnection, message, request);
        } catch (error) {
          fastify.log.error({ error, connectionId }, 'Error parsing WebSocket message');

          const errorEvent: WebSocketEvent = {
            type: 'price_update',
            data: {
              error: 'Invalid message format',
              message: 'Message must be valid JSON',
            },
            timestamp: new Date().toISOString(),
          };

          connection.send(JSON.stringify(errorEvent));
        }
      });

      // Handle connection close
      connection.on('close', () => {
        fastify.log.info(
          { connectionId, userId: wsConnection.userId },
          'WebSocket connection closed'
        );
        fastify.websocketManager.removeConnection(connectionId);
      });

      // Handle connection error
      connection.on('error', (error: Error) => {
        fastify.log.error({ error, connectionId }, 'WebSocket connection error');
        fastify.websocketManager.removeConnection(connectionId);
      });

      // Send periodic ping to keep connection alive
      const pingInterval = setInterval(() => {
        if (connection.readyState === connection.OPEN) {
          const pingEvent: WebSocketEvent = {
            type: 'price_update',
            data: { type: 'ping' },
            timestamp: new Date().toISOString(),
          };

          connection.send(JSON.stringify(pingEvent));
        } else {
          clearInterval(pingInterval);
        }
      }, 30000); // Ping every 30 seconds

      // Cleanup interval on connection close
      connection.on('close', () => {
        clearInterval(pingInterval);
      });
    }
  );
}

/**
 * Handle incoming WebSocket messages
 */
async function handleWebSocketMessage(
  fastify: FastifyInstance,
  connection: import('../plugins/websocket.js').WebSocketConnection,
  message: WebSocketMessage,
  _request: FastifyRequest
): Promise<void> {
  const { type, data } = message;

  switch (type) {
    case 'authenticate':
      await handleAuthentication(fastify, connection, data?.token, request);
      break;

    case 'subscribe':
      await handleSubscription(fastify, connection, data);
      break;

    case 'unsubscribe':
      await handleUnsubscription(fastify, connection, data);
      break;

    case 'ping':
      await handlePing(fastify, connection);
      break;

    default:
      fastify.log.warn(
        { messageType: type, connectionId: connection.id },
        'Unknown WebSocket message type'
      );

      const errorEvent: WebSocketEvent = {
        type: 'price_update',
        data: {
          error: 'Unknown message type',
          supportedTypes: ['authenticate', 'subscribe', 'unsubscribe', 'ping'],
        },
        timestamp: new Date().toISOString(),
      };

      connection.socket.send(JSON.stringify(errorEvent));
  }
}

/**
 * Handle WebSocket authentication
 */
async function handleAuthentication(
  fastify: FastifyInstance,
  connection: import('../plugins/websocket.js').WebSocketConnection,
  token: string | undefined,
  _request: FastifyRequest
): Promise<void> {
  if (!token) {
    const errorEvent: WebSocketEvent = {
      type: 'price_update',
      data: {
        error: 'Authentication failed',
        message: 'Token is required',
      },
      timestamp: new Date().toISOString(),
    };

    connection.socket.send(JSON.stringify(errorEvent));
    return;
  }

  try {
    // Verify JWT token
    const decoded = fastify.jwt.verify(token) as any;

    connection.userId = decoded.id;
    connection.isAuthenticated = true;

    // Update connection in manager
    fastify.websocketManager.addConnection(connection);

    const successEvent: WebSocketEvent = {
      type: 'price_update',
      data: {
        message: 'Authentication successful',
        userId: decoded.id,
      },
      timestamp: new Date().toISOString(),
    };

    connection.socket.send(JSON.stringify(successEvent));

    fastify.log.info(
      {
        connectionId: connection.id,
        userId: decoded.id,
      },
      'WebSocket authentication successful'
    );
  } catch (error) {
    fastify.log.error({ error, connectionId: connection.id }, 'WebSocket authentication failed');

    const errorEvent: WebSocketEvent = {
      type: 'price_update',
      data: {
        error: 'Authentication failed',
        message: 'Invalid or expired token',
      },
      timestamp: new Date().toISOString(),
    };

    connection.socket.send(JSON.stringify(errorEvent));
  }
}

/**
 * Handle subscription to channels
 */
async function handleSubscription(
  fastify: FastifyInstance,
  connection: import('../plugins/websocket.js').WebSocketConnection,
  data: any
): Promise<void> {
  const { coinId, channel } = data || {};

  if (coinId) {
    const subscription = `coin:${coinId}`;
    connection.subscriptions.add(subscription);

    const successEvent: WebSocketEvent = {
      type: 'price_update',
      data: {
        message: 'Subscribed to coin updates',
        coinId,
        subscription,
      },
      timestamp: new Date().toISOString(),
    };

    connection.socket.send(JSON.stringify(successEvent));

    fastify.log.info(
      {
        connectionId: connection.id,
        coinId,
        subscription,
      },
      'WebSocket subscription added'
    );
  }

  if (channel) {
    connection.subscriptions.add(channel);

    const successEvent: WebSocketEvent = {
      type: 'price_update',
      data: {
        message: 'Subscribed to channel',
        channel,
      },
      timestamp: new Date().toISOString(),
    };

    connection.socket.send(JSON.stringify(successEvent));

    fastify.log.info(
      {
        connectionId: connection.id,
        channel,
      },
      'WebSocket channel subscription added'
    );
  }

  if (!coinId && !channel) {
    const errorEvent: WebSocketEvent = {
      type: 'price_update',
      data: {
        error: 'Invalid subscription',
        message: 'Either coinId or channel is required',
      },
      timestamp: new Date().toISOString(),
    };

    connection.socket.send(JSON.stringify(errorEvent));
  }
}

/**
 * Handle unsubscription from channels
 */
async function handleUnsubscription(
  fastify: FastifyInstance,
  connection: import('../plugins/websocket.js').WebSocketConnection,
  data: any
): Promise<void> {
  const { coinId, channel } = data || {};

  if (coinId) {
    const subscription = `coin:${coinId}`;
    connection.subscriptions.delete(subscription);

    const successEvent: WebSocketEvent = {
      type: 'price_update',
      data: {
        message: 'Unsubscribed from coin updates',
        coinId,
        subscription,
      },
      timestamp: new Date().toISOString(),
    };

    connection.socket.send(JSON.stringify(successEvent));

    fastify.log.info(
      {
        connectionId: connection.id,
        coinId,
        subscription,
      },
      'WebSocket subscription removed'
    );
  }

  if (channel) {
    connection.subscriptions.delete(channel);

    const successEvent: WebSocketEvent = {
      type: 'price_update',
      data: {
        message: 'Unsubscribed from channel',
        channel,
      },
      timestamp: new Date().toISOString(),
    };

    connection.socket.send(JSON.stringify(successEvent));

    fastify.log.info(
      {
        connectionId: connection.id,
        channel,
      },
      'WebSocket channel subscription removed'
    );
  }
}

/**
 * Handle ping messages
 */
async function handlePing(
  _fastify: FastifyInstance,
  connection: import('../plugins/websocket.js').WebSocketConnection
): Promise<void> {
  connection.lastPing = new Date();

  const pongEvent: WebSocketEvent = {
    type: 'price_update',
    data: { type: 'pong' },
    timestamp: new Date().toISOString(),
  };

  connection.socket.send(JSON.stringify(pongEvent));
}
