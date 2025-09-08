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
  }>(
    '/register',
    {
      schema: {
        description: 'Register a new user account',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              minLength: 8,
              description:
                'Password (min 8 chars, must contain uppercase, lowercase, number, and special character)',
              example: 'SecurePass123!',
            },
            walletAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Optional Ethereum wallet address',
              example: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b5',
            },
            preferences: {
              type: 'object',
              properties: {
                notifications: {
                  type: 'object',
                  properties: {
                    email: { type: 'boolean', default: true },
                    push: { type: 'boolean', default: true },
                    sms: { type: 'boolean', default: false },
                    priceAlerts: { type: 'boolean', default: true },
                    whaleMovements: { type: 'boolean', default: true },
                    socialSpikes: { type: 'boolean', default: true },
                  },
                },
                defaultCurrency: { type: 'string', default: 'USD' },
                theme: { type: 'string', enum: ['light', 'dark'], default: 'light' },
                riskTolerance: {
                  type: 'string',
                  enum: ['low', 'medium', 'high'],
                  default: 'medium',
                },
              },
            },
          },
        },
        response: {
          201: {
            description: 'User registered successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  user: { $ref: '#/components/schemas/User' },
                  token: {
                    type: 'string',
                    description: 'JWT authentication token',
                    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string', format: 'date-time' },
                  requestId: { type: 'string' },
                },
              },
            },
          },
          400: { $ref: '#/components/schemas/ValidationError' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: RegisterRequest }>, reply: FastifyReply) => {
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
    }
  );

  // Login endpoint
  fastify.post<{
    Body: LoginRequest;
  }>(
    '/login',
    {
      schema: {
        description: 'Authenticate user and get JWT token',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              description: 'User password',
              example: 'SecurePass123!',
            },
          },
        },
        response: {
          200: {
            description: 'Login successful',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  user: { $ref: '#/components/schemas/User' },
                  token: {
                    type: 'string',
                    description: 'JWT authentication token',
                    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string', format: 'date-time' },
                  requestId: { type: 'string' },
                },
              },
            },
          },
          400: { $ref: '#/components/schemas/ValidationError' },
          401: { $ref: '#/components/schemas/AuthenticationError' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: LoginRequest }>, reply: FastifyReply) => {
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
    }
  );

  // Get current user profile (protected)
  fastify.get(
    '/profile',
    {
      schema: {
        description: 'Get current user profile information',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: 'User profile retrieved successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  user: { $ref: '#/components/schemas/User' },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string', format: 'date-time' },
                  requestId: { type: 'string' },
                },
              },
            },
          },
          401: { $ref: '#/components/schemas/AuthenticationError' },
          404: { $ref: '#/components/schemas/NotFoundError' },
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
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
    }
  );

  // Update user preferences (protected)
  fastify.put<{
    Body: UpdatePreferencesRequest;
  }>(
    '/preferences',
    {
      schema: {
        description: 'Update user preferences',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            notifications: {
              type: 'object',
              properties: {
                email: { type: 'boolean' },
                push: { type: 'boolean' },
                sms: { type: 'boolean' },
                priceAlerts: { type: 'boolean' },
                whaleMovements: { type: 'boolean' },
                socialSpikes: { type: 'boolean' },
              },
            },
            defaultCurrency: { type: 'string', example: 'USD' },
            theme: { type: 'string', enum: ['light', 'dark'] },
            riskTolerance: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
        },
        response: {
          200: {
            description: 'Preferences updated successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  user: { $ref: '#/components/schemas/User' },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string', format: 'date-time' },
                  requestId: { type: 'string' },
                },
              },
            },
          },
          400: { $ref: '#/components/schemas/ValidationError' },
          401: { $ref: '#/components/schemas/AuthenticationError' },
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Body: UpdatePreferencesRequest }>, reply: FastifyReply) => {
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

        const errorMessage =
          error instanceof Error ? error.message : 'Failed to update preferences';

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
    }
  );

  // Link wallet address (protected)
  fastify.post<{
    Body: LinkWalletRequest;
  }>(
    '/link-wallet',
    {
      schema: {
        description: 'Link a wallet address to user account',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['walletAddress'],
          properties: {
            walletAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Ethereum wallet address to link',
              example: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b5',
            },
          },
        },
        response: {
          200: {
            description: 'Wallet linked successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  user: { $ref: '#/components/schemas/User' },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string', format: 'date-time' },
                  requestId: { type: 'string' },
                },
              },
            },
          },
          400: { $ref: '#/components/schemas/ValidationError' },
          401: { $ref: '#/components/schemas/AuthenticationError' },
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Body: LinkWalletRequest }>, reply: FastifyReply) => {
      try {
        // Validate request body
        const validatedData = linkWalletSchema.parse(request.body);
        const user = await userService.linkWalletAddress(
          request.user!.id,
          validatedData.walletAddress
        );

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

        const errorMessage =
          error instanceof Error ? error.message : 'Failed to link wallet address';

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
    }
  );

  // Change password (protected)
  fastify.post<{
    Body: ChangePasswordRequest;
  }>(
    '/change-password',
    {
      schema: {
        description: 'Change user password',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: {
              type: 'string',
              description: 'Current password',
              example: 'OldPass123!',
            },
            newPassword: {
              type: 'string',
              minLength: 8,
              description:
                'New password (min 8 chars, must contain uppercase, lowercase, number, and special character)',
              example: 'NewSecurePass123!',
            },
          },
        },
        response: {
          200: {
            description: 'Password changed successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Password changed successfully',
                  },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string', format: 'date-time' },
                  requestId: { type: 'string' },
                },
              },
            },
          },
          400: { $ref: '#/components/schemas/ValidationError' },
          401: { $ref: '#/components/schemas/AuthenticationError' },
        },
      },
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Body: ChangePasswordRequest }>, reply: FastifyReply) => {
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
    }
  );
}
