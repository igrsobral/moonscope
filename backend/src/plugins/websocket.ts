import fastifyPlugin from 'fastify-plugin';
import websocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import type { WebSocketEvent } from '../types/index.js';

export interface WebSocketConnection {
  id: string;
  userId?: number;
  socket: any; // WebSocket connection from @fastify/websocket
  subscriptions: Set<string>;
  lastPing: Date;
  isAuthenticated: boolean;
}

export interface WebSocketManager {
  connections: Map<string, WebSocketConnection>;
  addConnection: (connection: WebSocketConnection) => void;
  removeConnection: (connectionId: string) => void;
  getConnection: (connectionId: string) => WebSocketConnection | undefined;
  getUserConnections: (userId: number) => WebSocketConnection[];
  broadcast: (event: WebSocketEvent, filter?: (conn: WebSocketConnection) => boolean) => void;
  broadcastToUser: (userId: number, event: WebSocketEvent) => void;
  broadcastToCoin: (coinId: string, event: WebSocketEvent) => void;
}

declare module 'fastify' {
  interface FastifyInstance {
    websocketManager: WebSocketManager;
  }
}

/**
 * WebSocket plugin for real-time communication
 */
async function websocketPlugin(fastify: FastifyInstance): Promise<void> {
  // Register the websocket plugin
  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB
      verifyClient: () => {
        // Basic verification - can be extended
        return true;
      },
    },
  });

  // Create WebSocket manager
  const connections = new Map<string, WebSocketConnection>();

  const websocketManager: WebSocketManager = {
    connections,

    addConnection(connection: WebSocketConnection) {
      connections.set(connection.id, connection);
      fastify.log.info({ connectionId: connection.id, userId: connection.userId }, 'WebSocket connection added');
    },

    removeConnection(connectionId: string) {
      const connection = connections.get(connectionId);
      if (connection) {
        connections.delete(connectionId);
        fastify.log.info({ connectionId, userId: connection.userId }, 'WebSocket connection removed');
      }
    },

    getConnection(connectionId: string) {
      return connections.get(connectionId);
    },

    getUserConnections(userId: number) {
      return Array.from(connections.values()).filter(conn => conn.userId === userId);
    },

    broadcast(event: WebSocketEvent, filter?: (conn: WebSocketConnection) => boolean) {
      const message = JSON.stringify(event);
      let sentCount = 0;

      for (const connection of connections.values()) {
        if (filter && !filter(connection)) {
          continue;
        }

        try {
          if (connection.socket.readyState === connection.socket.OPEN) {
            connection.socket.send(message);
            sentCount++;
          } else {
            // Remove dead connections
            this.removeConnection(connection.id);
          }
        } catch (error) {
          fastify.log.error({ error, connectionId: connection.id }, 'Failed to send WebSocket message');
          this.removeConnection(connection.id);
        }
      }

      fastify.log.debug({ eventType: event.type, sentCount }, 'Broadcasted WebSocket event');
    },

    broadcastToUser(userId: number, event: WebSocketEvent) {
      this.broadcast(event, (conn) => conn.userId === userId);
    },

    broadcastToCoin(coinId: string, event: WebSocketEvent) {
      this.broadcast(event, (conn) => conn.subscriptions.has(`coin:${coinId}`));
    },
  };

  // Add manager to fastify instance
  fastify.decorate('websocketManager', websocketManager);

  // Cleanup interval for dead connections
  const cleanupInterval = setInterval(() => {
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [connectionId, connection] of connections.entries()) {
      if (now.getTime() - connection.lastPing.getTime() > staleThreshold) {
        fastify.log.info({ connectionId }, 'Removing stale WebSocket connection');
        websocketManager.removeConnection(connectionId);
      }
    }
  }, 60000); // Run every minute

  // Cleanup on close
  fastify.addHook('onClose', async () => {
    clearInterval(cleanupInterval);
    
    // Close all connections
    for (const connection of connections.values()) {
      try {
        connection.socket.close();
      } catch (error) {
        fastify.log.error({ error }, 'Error closing WebSocket connection');
      }
    }
    
    connections.clear();
  });
}

export default fastifyPlugin(websocketPlugin, {
  name: 'websocket-plugin',
  dependencies: ['env', 'jwt-plugin'],
});