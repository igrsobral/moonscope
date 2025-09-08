import { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { randomBytes, createHash } from 'crypto';

export interface SessionData {
  userId: number;
  walletAddress: string;
  email?: string;
  preferences?: Record<string, any>;
  createdAt: number;
  lastAccessedAt: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionOptions {
  ttl?: number;
  rolling?: boolean; // Extend TTL on each access
  secure?: boolean;
  httpOnly?: boolean;
}

export class SessionService {
  private redis: Redis;
  private logger: FastifyInstance['log'];
  private readonly SESSION_PREFIX = 'session';
  private readonly USER_SESSIONS_PREFIX = 'user_sessions';
  private readonly DEFAULT_TTL = 86400; // 24 hours

  constructor(redis: Redis, logger: FastifyInstance['log']) {
    this.redis = redis;
    this.logger = logger;
  }

  /**
   * Generate a secure session ID
   */
  private generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Generate session key for Redis
   */
  private getSessionKey(sessionId: string): string {
    return `mca:${this.SESSION_PREFIX}:${sessionId}`;
  }

  /**
   * Generate user sessions key for Redis
   */
  private getUserSessionsKey(userId: number): string {
    return `mca:${this.USER_SESSIONS_PREFIX}:${userId}`;
  }

  /**
   * Hash sensitive data for logging
   */
  private hashForLogging(data: string): string {
    return createHash('sha256').update(data).digest('hex').substring(0, 8);
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: number,
    walletAddress: string,
    options: SessionOptions & {
      email?: string;
      preferences?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<string | null> {
    try {
      const sessionId = this.generateSessionId();
      const sessionKey = this.getSessionKey(sessionId);
      const userSessionsKey = this.getUserSessionsKey(userId);
      const now = Date.now();

      const sessionData: SessionData = {
        userId,
        walletAddress,
        ...(options.email && { email: options.email }),
        ...(options.preferences && { preferences: options.preferences }),
        createdAt: now,
        lastAccessedAt: now,
        ...(options.ipAddress && { ipAddress: options.ipAddress }),
        ...(options.userAgent && { userAgent: options.userAgent }),
      };

      const ttl = options.ttl || this.DEFAULT_TTL;

      // Use pipeline for atomic operations
      const pipeline = this.redis.pipeline();

      // Store session data
      pipeline.setex(sessionKey, ttl, JSON.stringify(sessionData));

      // Add session to user's session set
      pipeline.sadd(userSessionsKey, sessionId);
      pipeline.expire(userSessionsKey, ttl);

      const results = await pipeline.exec();

      // Check if all operations succeeded
      const allSucceeded =
        results?.every(
          ([error, result]) => error === null && (result === 'OK' || typeof result === 'number')
        ) ?? false;

      if (!allSucceeded) {
        throw new Error('Failed to create session in Redis');
      }

      this.logger.info(
        {
          sessionId: this.hashForLogging(sessionId),
          userId,
          walletAddress: this.hashForLogging(walletAddress),
          ttl,
        },
        'Session created successfully'
      );

      return sessionId;
    } catch (error) {
      this.logger.error(
        {
          error,
          userId,
          walletAddress: this.hashForLogging(walletAddress),
        },
        'Failed to create session'
      );
      return null;
    }
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string, options: SessionOptions = {}): Promise<SessionData | null> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      const sessionDataStr = await this.redis.get(sessionKey);

      if (!sessionDataStr) {
        this.logger.debug(
          {
            sessionId: this.hashForLogging(sessionId),
          },
          'Session not found'
        );
        return null;
      }

      const sessionData: SessionData = JSON.parse(sessionDataStr);

      // Update last accessed time if rolling sessions are enabled
      if (options.rolling !== false) {
        sessionData.lastAccessedAt = Date.now();

        const ttl = options.ttl || this.DEFAULT_TTL;
        const pipeline = this.redis.pipeline();

        // Update session data with new lastAccessedAt
        pipeline.setex(sessionKey, ttl, JSON.stringify(sessionData));

        // Extend user sessions set TTL
        const userSessionsKey = this.getUserSessionsKey(sessionData.userId);
        pipeline.expire(userSessionsKey, ttl);

        await pipeline.exec();
      }

      this.logger.debug(
        {
          sessionId: this.hashForLogging(sessionId),
          userId: sessionData.userId,
        },
        'Session retrieved successfully'
      );

      return sessionData;
    } catch (error) {
      this.logger.error(
        {
          error,
          sessionId: this.hashForLogging(sessionId),
        },
        'Failed to get session'
      );
      return null;
    }
  }

  /**
   * Update session data
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Omit<SessionData, 'userId' | 'createdAt'>>,
    options: SessionOptions = {}
  ): Promise<boolean> {
    try {
      const sessionData = await this.getSession(sessionId, { rolling: false });

      if (!sessionData) {
        return false;
      }

      // Merge updates
      const updatedData: SessionData = {
        ...sessionData,
        ...updates,
        lastAccessedAt: Date.now(),
      };

      const sessionKey = this.getSessionKey(sessionId);
      const ttl = options.ttl || this.DEFAULT_TTL;

      const result = await this.redis.setex(sessionKey, ttl, JSON.stringify(updatedData));

      this.logger.debug(
        {
          sessionId: this.hashForLogging(sessionId),
          userId: sessionData.userId,
          updates: Object.keys(updates),
        },
        'Session updated successfully'
      );

      return result === 'OK';
    } catch (error) {
      this.logger.error(
        {
          error,
          sessionId: this.hashForLogging(sessionId),
        },
        'Failed to update session'
      );
      return false;
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      // Get session data first to clean up user sessions set
      const sessionData = await this.getSession(sessionId, { rolling: false });

      if (!sessionData) {
        return true; // Session doesn't exist, consider it deleted
      }

      const sessionKey = this.getSessionKey(sessionId);
      const userSessionsKey = this.getUserSessionsKey(sessionData.userId);

      const pipeline = this.redis.pipeline();

      // Delete session data
      pipeline.del(sessionKey);

      // Remove session from user's session set
      pipeline.srem(userSessionsKey, sessionId);

      const results = await pipeline.exec();

      this.logger.info(
        {
          sessionId: this.hashForLogging(sessionId),
          userId: sessionData.userId,
        },
        'Session deleted successfully'
      );

      return results?.[0]?.[1] === 1; // First operation (del) should return 1
    } catch (error) {
      this.logger.error(
        {
          error,
          sessionId: this.hashForLogging(sessionId),
        },
        'Failed to delete session'
      );
      return false;
    }
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: number): Promise<number> {
    try {
      const userSessionsKey = this.getUserSessionsKey(userId);
      const sessionIds = await this.redis.smembers(userSessionsKey);

      if (sessionIds.length === 0) {
        return 0;
      }

      const pipeline = this.redis.pipeline();

      // Delete all session data
      for (const sessionId of sessionIds) {
        const sessionKey = this.getSessionKey(sessionId);
        pipeline.del(sessionKey);
      }

      // Delete user sessions set
      pipeline.del(userSessionsKey);

      const results = await pipeline.exec();

      // Count successful deletions
      const deletedCount =
        results?.slice(0, -1).filter(([error, result]) => error === null && result === 1).length ??
        0;

      this.logger.info(
        {
          userId,
          deletedCount,
          totalSessions: sessionIds.length,
        },
        'User sessions deleted'
      );

      return deletedCount;
    } catch (error) {
      this.logger.error(
        {
          error,
          userId,
        },
        'Failed to delete user sessions'
      );
      return 0;
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: number): Promise<Array<{ sessionId: string; data: SessionData }>> {
    try {
      const userSessionsKey = this.getUserSessionsKey(userId);
      const sessionIds = await this.redis.smembers(userSessionsKey);

      if (sessionIds.length === 0) {
        return [];
      }

      const sessions: Array<{ sessionId: string; data: SessionData }> = [];

      for (const sessionId of sessionIds) {
        const sessionData = await this.getSession(sessionId, { rolling: false });
        if (sessionData) {
          sessions.push({ sessionId, data: sessionData });
        }
      }

      return sessions;
    } catch (error) {
      this.logger.error(
        {
          error,
          userId,
        },
        'Failed to get user sessions'
      );
      return [];
    }
  }

  /**
   * Clean up expired sessions (maintenance task)
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      // This is a maintenance operation that should be run periodically
      // It cleans up orphaned session references in user session sets

      const pattern = `mca:${this.USER_SESSIONS_PREFIX}:*`;
      const userSessionKeys = await this.redis.keys(pattern);

      let cleanedCount = 0;

      for (const userSessionKey of userSessionKeys) {
        const sessionIds = await this.redis.smembers(userSessionKey);
        const expiredSessionIds: string[] = [];

        for (const sessionId of sessionIds) {
          const sessionKey = this.getSessionKey(sessionId);
          const exists = await this.redis.exists(sessionKey);

          if (!exists) {
            expiredSessionIds.push(sessionId);
          }
        }

        if (expiredSessionIds.length > 0) {
          await this.redis.srem(userSessionKey, ...expiredSessionIds);
          cleanedCount += expiredSessionIds.length;
        }
      }

      this.logger.info(
        {
          cleanedCount,
          checkedUserKeys: userSessionKeys.length,
        },
        'Session cleanup completed'
      );

      return cleanedCount;
    } catch (error) {
      this.logger.error({ error }, 'Session cleanup failed');
      return 0;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalSessions: number;
    totalUsers: number;
    averageSessionsPerUser: number;
  }> {
    try {
      const sessionPattern = `mca:${this.SESSION_PREFIX}:*`;
      const userSessionPattern = `mca:${this.USER_SESSIONS_PREFIX}:*`;

      const [sessionKeys, userSessionKeys] = await Promise.all([
        this.redis.keys(sessionPattern),
        this.redis.keys(userSessionPattern),
      ]);

      const totalSessions = sessionKeys.length;
      const totalUsers = userSessionKeys.length;
      const averageSessionsPerUser = totalUsers > 0 ? totalSessions / totalUsers : 0;

      return {
        totalSessions,
        totalUsers,
        averageSessionsPerUser: Math.round(averageSessionsPerUser * 100) / 100,
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get session stats');
      return {
        totalSessions: 0,
        totalUsers: 0,
        averageSessionsPerUser: 0,
      };
    }
  }
}

export default SessionService;
