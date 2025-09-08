import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';

describe('WebSocket Routes', () => {
  let app: FastifyInstance;
  let wsUrl: string;

  beforeEach(async () => {
    app = await buildApp({ logger: false });
    await app.listen({ port: 0, host: '127.0.0.1' });

    const address = app.server.address();
    const port = typeof address === 'object' && address ? address.port : 3000;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should establish WebSocket connection', done => {
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    ws.on('close', () => {
      done();
    });

    ws.on('error', error => {
      done(error);
    });
  });

  it('should receive welcome message on connection', done => {
    const ws = new WebSocket(wsUrl);

    ws.on('message', data => {
      const message = JSON.parse(data.toString());

      expect(message).toMatchObject({
        type: 'price_update',
        data: expect.objectContaining({
          message: 'Connected to Meme Coin Analyzer WebSocket',
          connectionId: expect.any(String),
        }),
        timestamp: expect.any(String),
      });

      ws.close();
      done();
    });

    ws.on('error', error => {
      done(error);
    });
  });

  it('should handle ping messages', done => {
    const ws = new WebSocket(wsUrl);
    let messageCount = 0;

    ws.on('message', data => {
      messageCount++;

      if (messageCount === 1) {
        // Skip welcome message
        const pingMessage = {
          type: 'ping',
        };
        ws.send(JSON.stringify(pingMessage));
        return;
      }

      const message = JSON.parse(data.toString());

      expect(message).toMatchObject({
        type: 'price_update',
        data: { type: 'pong' },
        timestamp: expect.any(String),
      });

      ws.close();
      done();
    });

    ws.on('error', error => {
      done(error);
    });
  });

  it('should handle subscription messages', done => {
    const ws = new WebSocket(wsUrl);
    let messageCount = 0;

    ws.on('message', data => {
      messageCount++;

      if (messageCount === 1) {
        // Skip welcome message
        const subscribeMessage = {
          type: 'subscribe',
          data: {
            coinId: 'bitcoin',
          },
        };
        ws.send(JSON.stringify(subscribeMessage));
        return;
      }

      const message = JSON.parse(data.toString());

      expect(message).toMatchObject({
        type: 'price_update',
        data: expect.objectContaining({
          message: 'Subscribed to coin updates',
          coinId: 'bitcoin',
          subscription: 'coin:bitcoin',
        }),
        timestamp: expect.any(String),
      });

      ws.close();
      done();
    });

    ws.on('error', error => {
      done(error);
    });
  });

  it('should handle unsubscription messages', done => {
    const ws = new WebSocket(wsUrl);
    let messageCount = 0;

    ws.on('message', data => {
      messageCount++;

      if (messageCount === 1) {
        // Skip welcome message, send subscribe first
        const subscribeMessage = {
          type: 'subscribe',
          data: { coinId: 'bitcoin' },
        };
        ws.send(JSON.stringify(subscribeMessage));
        return;
      }

      if (messageCount === 2) {
        // Skip subscribe confirmation, send unsubscribe
        const unsubscribeMessage = {
          type: 'unsubscribe',
          data: { coinId: 'bitcoin' },
        };
        ws.send(JSON.stringify(unsubscribeMessage));
        return;
      }

      const message = JSON.parse(data.toString());

      expect(message).toMatchObject({
        type: 'price_update',
        data: expect.objectContaining({
          message: 'Unsubscribed from coin updates',
          coinId: 'bitcoin',
          subscription: 'coin:bitcoin',
        }),
        timestamp: expect.any(String),
      });

      ws.close();
      done();
    });

    ws.on('error', error => {
      done(error);
    });
  });

  it('should handle authentication failure', done => {
    const ws = new WebSocket(wsUrl);
    let messageCount = 0;

    ws.on('message', data => {
      messageCount++;

      if (messageCount === 1) {
        // Skip welcome message
        const authMessage = {
          type: 'authenticate',
          data: {
            token: 'invalid-token',
          },
        };
        ws.send(JSON.stringify(authMessage));
        return;
      }

      const message = JSON.parse(data.toString());

      expect(message).toMatchObject({
        type: 'price_update',
        data: expect.objectContaining({
          error: 'Authentication failed',
          message: 'Invalid or expired token',
        }),
        timestamp: expect.any(String),
      });

      ws.close();
      done();
    });

    ws.on('error', error => {
      done(error);
    });
  });

  it('should handle invalid JSON messages', done => {
    const ws = new WebSocket(wsUrl);
    let messageCount = 0;

    ws.on('message', data => {
      messageCount++;

      if (messageCount === 1) {
        // Skip welcome message
        ws.send('invalid json');
        return;
      }

      const message = JSON.parse(data.toString());

      expect(message).toMatchObject({
        type: 'price_update',
        data: expect.objectContaining({
          error: 'Invalid message format',
          message: 'Message must be valid JSON',
        }),
        timestamp: expect.any(String),
      });

      ws.close();
      done();
    });

    ws.on('error', error => {
      done(error);
    });
  });

  it('should handle unknown message types', done => {
    const ws = new WebSocket(wsUrl);
    let messageCount = 0;

    ws.on('message', data => {
      messageCount++;

      if (messageCount === 1) {
        // Skip welcome message
        const unknownMessage = {
          type: 'unknown_type',
          data: {},
        };
        ws.send(JSON.stringify(unknownMessage));
        return;
      }

      const message = JSON.parse(data.toString());

      expect(message).toMatchObject({
        type: 'price_update',
        data: expect.objectContaining({
          error: 'Unknown message type',
          supportedTypes: ['authenticate', 'subscribe', 'unsubscribe', 'ping'],
        }),
        timestamp: expect.any(String),
      });

      ws.close();
      done();
    });

    ws.on('error', error => {
      done(error);
    });
  });

  it('should track connections in websocket manager', done => {
    const initialConnectionCount = app.websocketManager.connections.size;

    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      // Give it a moment for the connection to be registered
      setTimeout(() => {
        expect(app.websocketManager.connections.size).toBe(initialConnectionCount + 1);
        ws.close();
      }, 100);
    });

    ws.on('close', () => {
      // Give it a moment for the connection to be removed
      setTimeout(() => {
        expect(app.websocketManager.connections.size).toBe(initialConnectionCount);
        done();
      }, 100);
    });

    ws.on('error', error => {
      done(error);
    });
  });
});
