import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Redis from 'ioredis';
import SessionService from './session.js';

// Mock Redis
vi.mock('ioredis');

describe('SessionService', () => {
  let mockRedis: any;
  let mockLogger: any;
  let sessionService: SessionService;

  beforeEach(() => {
    mockRedis = {
      setex: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
      sadd: vi.fn(),
      srem: vi.fn(),
      smembers: vi.fn(),
      expire: vi.fn(),
      exists: vi.fn(),
      keys: vi.fn(),
      pipeline: vi.fn(() => ({
        setex: vi.fn().mockReturnThis(),
        sadd: vi.fn().mockReturnThis(),
        srem: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        del: vi.fn().mockReturnThis(),
        exec: vi.fn(),
      })),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };

    sessionService = new SessionService(mockRedis as any, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const mockPipeline = {
        setex: vi.fn().mockReturnThis(),
        sadd: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 'OK'],
          [null, 1],
          [null, 1],
        ]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const sessionId = await sessionService.createSession(
        1,
        '0x1234567890abcdef',
        {
          email: 'test@example.com',
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        }
      );

      expect(sessionId).toBeTruthy();
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toHaveLength(64); // 32 bytes * 2 (hex)
      expect(mockPipeline.setex).toHaveBeenCalled();
      expect(mockPipeline.sadd).toHaveBeenCalled();
      expect(mockPipeline.expire).toHaveBeenCalled();
    });

    it('should handle Redis errors during session creation', async () => {
      const mockPipeline = {
        setex: vi.fn().mockReturnThis(),
        sadd: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [new Error('Redis error'), null],
          [null, 1],
          [null, 1],
        ]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const sessionId = await sessionService.createSession(1, '0x1234567890abcdef');

      expect(sessionId).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getSession', () => {
    it('should get session data successfully', async () => {
      const now = Date.now();
      const sessionData = {
        userId: 1,
        walletAddress: '0x1234567890abcdef',
        email: 'test@example.com',
        createdAt: now,
        lastAccessedAt: now - 1000, // 1 second ago
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

      const mockPipeline = {
        setex: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 'OK'],
          [null, 1],
        ]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const result = await sessionService.getSession('test-session-id');

      expect(result).toBeTruthy();
      expect(result?.userId).toBe(1);
      expect(result?.walletAddress).toBe('0x1234567890abcdef');
      expect(result?.email).toBe('test@example.com');
      expect(result?.lastAccessedAt).toBeGreaterThan(sessionData.lastAccessedAt);
    });

    it('should return null for non-existent session', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await sessionService.getSession('non-existent-session');

      expect(result).toBeNull();
    });

    it('should not update lastAccessedAt when rolling is disabled', async () => {
      const sessionData = {
        userId: 1,
        walletAddress: '0x1234567890abcdef',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

      const result = await sessionService.getSession('test-session-id', { rolling: false });

      expect(result?.lastAccessedAt).toBe(sessionData.lastAccessedAt);
      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });

    it('should handle Redis errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await sessionService.getSession('test-session-id');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('updateSession', () => {
    it('should update session data successfully', async () => {
      const existingSessionData = {
        userId: 1,
        walletAddress: '0x1234567890abcdef',
        email: 'test@example.com',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(existingSessionData));
      mockRedis.setex.mockResolvedValue('OK');

      const updates = {
        email: 'updated@example.com',
        preferences: { theme: 'dark' },
      };

      const result = await sessionService.updateSession('test-session-id', updates);

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled();
      
      const setexCall = mockRedis.setex.mock.calls[0];
      const updatedData = JSON.parse(setexCall[2]);
      expect(updatedData.email).toBe('updated@example.com');
      expect(updatedData.preferences).toEqual({ theme: 'dark' });
    });

    it('should return false for non-existent session', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await sessionService.updateSession('non-existent-session', {
        email: 'test@example.com',
      });

      expect(result).toBe(false);
    });
  });

  describe('deleteSession', () => {
    it('should delete session successfully', async () => {
      const sessionData = {
        userId: 1,
        walletAddress: '0x1234567890abcdef',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(sessionData));

      const mockPipeline = {
        del: vi.fn().mockReturnThis(),
        srem: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 1],
          [null, 1],
        ]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const result = await sessionService.deleteSession('test-session-id');

      expect(result).toBe(true);
      expect(mockPipeline.del).toHaveBeenCalled();
      expect(mockPipeline.srem).toHaveBeenCalled();
    });

    it('should return true for non-existent session', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await sessionService.deleteSession('non-existent-session');

      expect(result).toBe(true);
    });
  });

  describe('deleteUserSessions', () => {
    it('should delete all user sessions successfully', async () => {
      const sessionIds = ['session1', 'session2', 'session3'];
      mockRedis.smembers.mockResolvedValue(sessionIds);

      const mockPipeline = {
        del: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 1],
          [null, 1],
          [null, 1],
          [null, 1], // Last one is for user sessions set
        ]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const result = await sessionService.deleteUserSessions(1);

      expect(result).toBe(3);
      expect(mockPipeline.del).toHaveBeenCalledTimes(4); // 3 sessions + 1 user sessions set
    });

    it('should return 0 when user has no sessions', async () => {
      mockRedis.smembers.mockResolvedValue([]);

      const result = await sessionService.deleteUserSessions(1);

      expect(result).toBe(0);
    });
  });

  describe('getUserSessions', () => {
    it('should get all user sessions successfully', async () => {
      const sessionIds = ['session1', 'session2'];
      mockRedis.smembers.mockResolvedValue(sessionIds);

      const sessionData1 = {
        userId: 1,
        walletAddress: '0x1234567890abcdef',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      };
      const sessionData2 = {
        userId: 1,
        walletAddress: '0x1234567890abcdef',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      };

      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(sessionData1))
        .mockResolvedValueOnce(JSON.stringify(sessionData2));

      const mockPipeline = {
        setex: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 'OK'],
          [null, 1],
        ]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const result = await sessionService.getUserSessions(1);

      expect(result).toHaveLength(2);
      expect(result[0].sessionId).toBe('session1');
      expect(result[1].sessionId).toBe('session2');
    });

    it('should return empty array when user has no sessions', async () => {
      mockRedis.smembers.mockResolvedValue([]);

      const result = await sessionService.getUserSessions(1);

      expect(result).toEqual([]);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions successfully', async () => {
      const userSessionKeys = [
        'mca:user_sessions:1',
        'mca:user_sessions:2',
      ];
      mockRedis.keys.mockResolvedValue(userSessionKeys);

      mockRedis.smembers
        .mockResolvedValueOnce(['session1', 'session2', 'session3'])
        .mockResolvedValueOnce(['session4', 'session5']);

      mockRedis.exists
        .mockResolvedValueOnce(1) // session1 exists
        .mockResolvedValueOnce(0) // session2 expired
        .mockResolvedValueOnce(0) // session3 expired
        .mockResolvedValueOnce(1) // session4 exists
        .mockResolvedValueOnce(0); // session5 expired

      mockRedis.srem
        .mockResolvedValueOnce(2) // Removed 2 sessions from user 1
        .mockResolvedValueOnce(1); // Removed 1 session from user 2

      const result = await sessionService.cleanupExpiredSessions();

      expect(result).toBe(3); // Total expired sessions cleaned
      expect(mockRedis.srem).toHaveBeenCalledWith(
        'mca:user_sessions:1',
        'session2',
        'session3'
      );
      expect(mockRedis.srem).toHaveBeenCalledWith(
        'mca:user_sessions:2',
        'session5'
      );
    });
  });

  describe('getSessionStats', () => {
    it('should return session statistics', async () => {
      const sessionKeys = ['session1', 'session2', 'session3'];
      const userSessionKeys = ['user1', 'user2'];

      mockRedis.keys
        .mockResolvedValueOnce(sessionKeys)
        .mockResolvedValueOnce(userSessionKeys);

      const result = await sessionService.getSessionStats();

      expect(result.totalSessions).toBe(3);
      expect(result.totalUsers).toBe(2);
      expect(result.averageSessionsPerUser).toBe(1.5);
    });

    it('should handle division by zero', async () => {
      mockRedis.keys
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await sessionService.getSessionStats();

      expect(result.totalSessions).toBe(0);
      expect(result.totalUsers).toBe(0);
      expect(result.averageSessionsPerUser).toBe(0);
    });
  });
});