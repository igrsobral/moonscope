import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { UserService } from '../services/user.js';
import {
  registerSchema,
  loginSchema,
  updatePreferencesSchema,
  linkWalletSchema,
  changePasswordSchema,
  type RegisterRequest,
  type LoginRequest,
  type UpdatePreferencesRequest,
  type LinkWalletRequest,
  type ChangePasswordRequest,
} from '../schemas/auth.js';
import type { ApiResponse } from '../types/index.js';

/**
 * Authentication routes
 */
export async function authRoutes(fastify: FastifyInstance) {
  const userService = new UserService(fastify.prisma);

  fastify.post<{
    Body: RegisterRequest;
  }>('/register', async (request: FastifyRequest<{ Body: RegisterRequest }>, reply: FastifyReply) => {
    try {
      // Validate request body
      const validatedData = registerSchema.parse(request.body);
      const user = await userService.createUser(validatedData);
      
      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        walletAddress: user.walletAddress || undefined,
      });

      const response: ApiResponse<{ user: typeof user; token: string }> = {
        success: true,
        data: {
          user,
          token,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      };

      return reply.code(201).send(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        };
        return reply.code(400).send(response);
      }

      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'REGISTRATION_ERROR',
          message: errorMessage,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      };

      return reply.code(400).send(response);
    }
  });

  // Login endpoint
  fastify.post<{
    Body: LoginRequest;
  }>('/login', async (request: FastifyRequest<{ Body: LoginRequest }>, reply: FastifyReply) => {
    try {
      // Validate request body
      const validatedData = loginSchema.parse(request.body);
      const user = await userService.authenticateUser(validatedData);
      
      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        walletAddress: user.walletAddress || undefined,
      });

      const response: ApiResponse<{ user: typeof user; token: string }> = {
        success: true,
        data: {
          user,
          token,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      };

      return reply.send(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        };
        return reply.code(400).send(response);
      }

      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: errorMessage,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      };

      return reply.code(401).send(response);
    }
  });

  // Get current user profile (protected)
  fastify.get('/profile', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = await userService.getUserById(request.user!.id);
      
      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        };
        return reply.code(404).send(response);
      }

      const response: ApiResponse<{ user: typeof user }> = {
        success: true,
        data: { user },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      };

      return reply.send(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get user profile';
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'PROFILE_ERROR',
          message: errorMessage,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      };

      return reply.code(500).send(response);
    }
  });

  // Update user preferences (protected)
  fastify.put<{
    Body: UpdatePreferencesRequest;
  }>('/preferences', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: UpdatePreferencesRequest }>, reply: FastifyReply) => {
    try {
      // Validate request body
      const validatedData = updatePreferencesSchema.parse(request.body);
      const user = await userService.updateUserPreferences(request.user!.id, validatedData);

      const response: ApiResponse<{ user: typeof user }> = {
        success: true,
        data: { user },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      };

      return reply.send(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        };
        return reply.code(400).send(response);
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to update preferences';
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'UPDATE_PREFERENCES_ERROR',
          message: errorMessage,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      };

      return reply.code(400).send(response);
    }
  });

  // Link wallet address (protected)
  fastify.post<{
    Body: LinkWalletRequest;
  }>('/link-wallet', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: LinkWalletRequest }>, reply: FastifyReply) => {
    try {
      // Validate request body
      const validatedData = linkWalletSchema.parse(request.body);
      const user = await userService.linkWalletAddress(request.user!.id, validatedData.walletAddress);

      const response: ApiResponse<{ user: typeof user }> = {
        success: true,
        data: { user },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      };

      return reply.send(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        };
        return reply.code(400).send(response);
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to link wallet address';
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'LINK_WALLET_ERROR',
          message: errorMessage,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      };

      return reply.code(400).send(response);
    }
  });

  // Change password (protected)
  fastify.post<{
    Body: ChangePasswordRequest;
  }>('/change-password', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: ChangePasswordRequest }>, reply: FastifyReply) => {
    try {
      // Validate request body
      const validatedData = changePasswordSchema.parse(request.body);
      await userService.changePassword(
        request.user!.id,
        validatedData.currentPassword,
        validatedData.newPassword
      );

      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: {
          message: 'Password changed successfully',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      };

      return reply.send(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        };
        return reply.code(400).send(response);
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to change password';
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'CHANGE_PASSWORD_ERROR',
          message: errorMessage,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      };

      return reply.code(400).send(response);
    }
  });
}