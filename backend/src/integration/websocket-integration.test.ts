import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import type { FastifyInstance } from 'fastify';

describe('WebSocket Integration', () => {
  let app: FastifyInstance;
  let wsUrl: string;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    
    // Register websocket plugin
    await app.register(websocket);

    // Create a simple websocket manager
    const connections = new Map();
    
    const websocketManager = {
      connections,
      addConnection: (conn: any) => connections.set(conn.id, conn),
      removeConnection: (id: string) => connections.delete(id),
      broadcast: (event: any) => {
        const message = JSON.stringify(event);
        for (const conn of connections.values()) {
          if (conn.socket.readyState === conn.socket.OPEN) {
            conn.socket.send(message);
          }
        }
      },
      broadcastToCoin: (coinId: string, event: any) => {
        const message = JSON.stringify(event);
        for (const conn of connections.values()) {
          if (conn.subscriptions.has(`coin:${coinId}`) && conn.socket.readyState === conn.socket.OPEN) {
            conn.socket.send(message);
          }
        }
      },
    };

    app.decorate('websocketManager', websocketManager);

    // WebSocket route
    app.get('/ws', { websocket: true }, (connection, request) => {
      const connectionId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      const wsConnection = {
        id: connectionId,
        socket: connection,
        subscriptions: new Set(),
        lastPing: new Date(),
        isAuthenticated: false,
      };

      websocketManager.addConnection(wsConnection);

      // Send welcome message
      connection.send(JSON.stringify({
        type: 'welcome',
        data: {
          message: 'Connected to WebSocket',
          connectionId,
        },
        timestamp: new Date().toISOString(),
      }));

      connection.on('message', (rawMessage) => {
        try {
          const message = JSON.parse(rawMessage.toString());
          
          switch (message.type) {
            case 'ping':
              connection.send(JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString(),
              }));
              break;
              
            case 'subscribe':
              if (message.data?.coinId) {
                wsConnection.subscriptions.add(`coin:${message.data.coinId}`);
                connection.send(JSON.stringify({
                  type: 'subscribed',
                  data: {
                    coinId: message.data.coinId,
                    subscription: `coin:${message.data.coinId}`,
                  },
                  timestamp: new Date().toISOString(),
                }));
              }
              break;
          }
        } catch (error) {
          connection.send(JSON.stringify({
            type: 'error',
            data: { message: 'Invalid JSON' },
            timestamp: new Date().toISOString(),
          }));
        }
      });

      connection.on('close', () => {
        websocketManager.removeConnection(connectionId);
      });
    });

    await app.listen({ port: 0, host: '127.0.0.1' });
    
    const address = app.server.address();
    const port = typeof address === 'object' && address ? address.port : 3000;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should establish WebSocket connection and receive welcome message', (done) => {
    const ws = new WebSocket(wsUrl);

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      expect(message).toMatchObject({
        type: 'welcome',
        data: expect.objectContaining({
          message: 'Connected to WebSocket',
          connectionId: expect.any(String),
        }),
        timestamp: expect.any(String),
      });

      ws.close();
      done();
    });

    ws.on('error', (error) => {
      done(error);
    });
  });

  it('should handle ping/pong messages', (done) => {
    const ws = new WebSocket(wsUrl);
    let messageCount = 0;

    ws.on('message', (data) => {
      messageCount++;
      
      if (messageCount === 1) {
        // Skip welcome message, send ping
        ws.send(JSON.stringify({ type: 'ping' }));
        return;
      }

      const message = JSON.parse(data.toString());
      
      expect(message).toMatchObject({
        type: 'pong',
        timestamp: expect.any(String),
      });

      ws.close();
      done();
    });

    ws.on('error', (error) => {
      done(error);
    });
  });

  it('should handle subscription messages', (done) => {
    const ws = new WebSocket(wsUrl);
    let messageCount = 0;

    ws.on('message', (data) => {
      messageCount++;
      
      if (messageCount === 1) {
        // Skip welcome message, send subscription
        ws.send(JSON.stringify({
          type: 'subscribe',
          data: { coinId: 'bitcoin' }
        }));
        return;
      }

      const message = JSON.parse(data.toString());
      
      expect(message).toMatchObject({
        type: 'subscribed',
        data: expect.objectContaining({
          coinId: 'bitcoin',
          subscription: 'coin:bitcoin',
        }),
        timestamp: expect.any(String),
      });

      ws.close();
      done();
    });

    ws.on('error', (error) => {
      done(error);
    });
  });

  it('should broadcast messages to coin subscribers', (done) => {
    const ws1 = new WebSocket(wsUrl);
    const ws2 = new WebSocket(wsUrl);
    
    let ws1Ready = false;
    let ws2Ready = false;
    let ws1MessageCount = 0;
    let ws2MessageCount = 0;

    const checkReady = () => {
      if (ws1Ready && ws2Ready) {
        // Both connections are subscribed, now broadcast
        setTimeout(() => {
          (app as any).websocketManager.broadcastToCoin('bitcoin', {
            type: 'price_update',
            data: { price: 50000 },
            timestamp: new Date().toISOString(),
          });
        }, 100);
      }
    };

    ws1.on('message', (data) => {
      ws1MessageCount++;
      
      if (ws1MessageCount === 1) {
        // Welcome message, send subscription
        ws1.send(JSON.stringify({
          type: 'subscribe',
          data: { coinId: 'bitcoin' }
        }));
        return;
      }
      
      if (ws1MessageCount === 2) {
        // Subscription confirmation
        ws1Ready = true;
        checkReady();
        return;
      }

      // Should be the broadcast message
      const message = JSON.parse(data.toString());
      expect(message).toMatchObject({
        type: 'price_update',
        data: { price: 50000 },
      });

      ws1.close();
      ws2.close();
      done();
    });

    ws2.on('message', (data) => {
      ws2MessageCount++;
      
      if (ws2MessageCount === 1) {
        // Welcome message, send subscription for different coin
        ws2.send(JSON.stringify({
          type: 'subscribe',
          data: { coinId: 'ethereum' }
        }));
        return;
      }
      
      if (ws2MessageCount === 2) {
        // Subscription confirmation
        ws2Ready = true;
        checkReady();
        return;
      }

      // Should not receive bitcoin updates
      done(new Error('ws2 should not receive bitcoin updates'));
    });

    ws1.on('error', done);
    ws2.on('error', done);
  });

  it('should handle invalid JSON messages', (done) => {
    const ws = new WebSocket(wsUrl);
    let messageCount = 0;

    ws.on('message', (data) => {
      messageCount++;
      
      if (messageCount === 1) {
        // Skip welcome message, send invalid JSON
        ws.send('invalid json');
        return;
      }

      const message = JSON.parse(data.toString());
      
      expect(message).toMatchObject({
        type: 'error',
        data: expect.objectContaining({
          message: 'Invalid JSON',
        }),
        timestamp: expect.any(String),
      });

      ws.close();
      done();
    });

    ws.on('error', (error) => {
      done(error);
    });
  });
});