import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('WebSocket Plugin', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    try {
      app = await buildApp({ logger: false });
      await app.ready();
    } catch (error) {
      console.error('Failed to build app:', error);
      throw error;
    }
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should register websocket manager', () => {
    expect(app.websocketManager).toBeDefined();
    expect(app.websocketManager.connections).toBeDefined();
    expect(app.websocketManager.addConnection).toBeTypeOf('function');
    expect(app.websocketManager.removeConnection).toBeTypeOf('function');
    expect(app.websocketManager.broadcast).toBeTypeOf('function');
  });

  it('should add and remove connections', () => {
    const mockConnection = {
      id: 'test-connection',
      socket: {} as any,
      subscriptions: new Set(),
      lastPing: new Date(),
      isAuthenticated: false,
    };

    app.websocketManager.addConnection(mockConnection);
    expect(app.websocketManager.getConnection('test-connection')).toBe(mockConnection);

    app.websocketManager.removeConnection('test-connection');
    expect(app.websocketManager.getConnection('test-connection')).toBeUndefined();
  });

  it('should filter user connections', () => {
    const mockConnection1 = {
      id: 'test-connection-1',
      userId: 1,
      socket: {} as any,
      subscriptions: new Set(),
      lastPing: new Date(),
      isAuthenticated: true,
    };

    const mockConnection2 = {
      id: 'test-connection-2',
      userId: 2,
      socket: {} as any,
      subscriptions: new Set(),
      lastPing: new Date(),
      isAuthenticated: true,
    };

    const mockConnection3 = {
      id: 'test-connection-3',
      userId: 1,
      socket: {} as any,
      subscriptions: new Set(),
      lastPing: new Date(),
      isAuthenticated: true,
    };

    app.websocketManager.addConnection(mockConnection1);
    app.websocketManager.addConnection(mockConnection2);
    app.websocketManager.addConnection(mockConnection3);

    const user1Connections = app.websocketManager.getUserConnections(1);
    expect(user1Connections).toHaveLength(2);
    expect(user1Connections).toContain(mockConnection1);
    expect(user1Connections).toContain(mockConnection3);

    const user2Connections = app.websocketManager.getUserConnections(2);
    expect(user2Connections).toHaveLength(1);
    expect(user2Connections).toContain(mockConnection2);
  });

  it('should broadcast messages with filters', () => {
    const mockSend = vi.fn();
    const mockConnection1 = {
      id: 'test-connection-1',
      userId: 1,
      socket: {
        send: mockSend,
        readyState: 1, // OPEN
        OPEN: 1,
      } as any,
      subscriptions: new Set(['coin:bitcoin']),
      lastPing: new Date(),
      isAuthenticated: true,
    };

    const mockConnection2 = {
      id: 'test-connection-2',
      userId: 2,
      socket: {
        send: mockSend,
        readyState: 1, // OPEN
        OPEN: 1,
      } as any,
      subscriptions: new Set(['coin:ethereum']),
      lastPing: new Date(),
      isAuthenticated: true,
    };

    app.websocketManager.addConnection(mockConnection1);
    app.websocketManager.addConnection(mockConnection2);

    const testEvent = {
      type: 'price_update' as const,
      data: { test: 'data' },
      timestamp: new Date().toISOString(),
    };

    // Broadcast to all
    app.websocketManager.broadcast(testEvent);
    expect(mockSend).toHaveBeenCalledTimes(2);

    mockSend.mockClear();

    // Broadcast with filter
    app.websocketManager.broadcast(testEvent, conn => conn.userId === 1);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should broadcast to specific user', () => {
    const mockSend1 = vi.fn();
    const mockSend2 = vi.fn();

    const mockConnection1 = {
      id: 'test-connection-1',
      userId: 1,
      socket: {
        send: mockSend1,
        readyState: 1, // OPEN
        OPEN: 1,
      } as any,
      subscriptions: new Set(),
      lastPing: new Date(),
      isAuthenticated: true,
    };

    const mockConnection2 = {
      id: 'test-connection-2',
      userId: 2,
      socket: {
        send: mockSend2,
        readyState: 1, // OPEN
        OPEN: 1,
      } as any,
      subscriptions: new Set(),
      lastPing: new Date(),
      isAuthenticated: true,
    };

    app.websocketManager.addConnection(mockConnection1);
    app.websocketManager.addConnection(mockConnection2);

    const testEvent = {
      type: 'alert_triggered' as const,
      data: { alertId: 1 },
      timestamp: new Date().toISOString(),
    };

    app.websocketManager.broadcastToUser(1, testEvent);

    expect(mockSend1).toHaveBeenCalledTimes(1);
    expect(mockSend2).not.toHaveBeenCalled();
  });

  it('should broadcast to coin subscribers', () => {
    const mockSend1 = vi.fn();
    const mockSend2 = vi.fn();

    const mockConnection1 = {
      id: 'test-connection-1',
      userId: 1,
      socket: {
        send: mockSend1,
        readyState: 1, // OPEN
        OPEN: 1,
      } as any,
      subscriptions: new Set(['coin:bitcoin']),
      lastPing: new Date(),
      isAuthenticated: true,
    };

    const mockConnection2 = {
      id: 'test-connection-2',
      userId: 2,
      socket: {
        send: mockSend2,
        readyState: 1, // OPEN
        OPEN: 1,
      } as any,
      subscriptions: new Set(['coin:ethereum']),
      lastPing: new Date(),
      isAuthenticated: true,
    };

    app.websocketManager.addConnection(mockConnection1);
    app.websocketManager.addConnection(mockConnection2);

    const testEvent = {
      type: 'price_update' as const,
      data: { coinId: 'bitcoin', price: 50000 },
      timestamp: new Date().toISOString(),
    };

    app.websocketManager.broadcastToCoin('bitcoin', testEvent);

    expect(mockSend1).toHaveBeenCalledTimes(1);
    expect(mockSend2).not.toHaveBeenCalled();
  });
});
