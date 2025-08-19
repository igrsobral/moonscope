import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ApiResponse } from '../types/index.js';

/**
 * Authentication middleware for protecting routes
 */
export async function authenticateMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication required',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    };

    return reply.code(401).send(response);
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (error) {
    // Silently continue without authentication
    request.user = undefined;
  }
}

/**
 * Role-based authorization middleware (for future use)
 */
export function requireRole(role: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      };

      return reply.code(401).send(response);
    }

    // For now, we don't have roles in the user model
    // This is a placeholder for future role-based authorization
    // const userRoles = request.user.roles || [];
    // if (!userRoles.includes(role)) {
    //   const response: ApiResponse = {
    //     success: false,
    //     error: {
    //       code: 'AUTHORIZATION_ERROR',
    //       message: 'Insufficient permissions',
    //     },
    //     meta: {
    //       timestamp: new Date().toISOString(),
    //       requestId: request.id,
    //     },
    //   };

    //   return reply.code(403).send(response);
    // }
  };
}