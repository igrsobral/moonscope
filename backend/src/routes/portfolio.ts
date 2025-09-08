import { FastifyInstance, FastifyRequest, FastifyReply, RouteHandlerMethod } from 'fastify';
import {
  PortfolioQuerySchema,
  CreatePortfolioSchema,
  UpdatePortfolioSchema,
  WalletIntegrationSchema,
  PortfolioAnalyticsQuerySchema,
  PortfolioPerformanceQuerySchema,
  PortfolioQuery,
  CreatePortfolio,
  UpdatePortfolio,
  WalletIntegration,
  PortfolioAnalyticsQuery,
  PortfolioPerformanceQuery,
} from '../schemas/portfolio.js';
import { PortfolioService } from '../services/portfolio.js';

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: number;
    email: string;
  };
}

/**
 * Portfolio routes
 */
export async function portfolioRoutes(fastify: FastifyInstance): Promise<void> {
  const portfolioService = new PortfolioService(
    fastify.prisma,
    fastify.log,
    fastify.cache,
    fastify.externalApi
  );

  // Get user's portfolio
  fastify.get<{
    Querystring: PortfolioQuery;
  }>(
    '/portfolio',
    {
      preHandler: [fastify.authenticate],
      schema: {
        querystring: PortfolioQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    userId: { type: 'number' },
                    coinId: { type: 'number' },
                    amount: { type: 'number' },
                    avgPrice: { type: 'number' },
                    currentValue: { type: 'number' },
                    profitLoss: { type: 'number' },
                    profitLossPercentage: { type: 'number' },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                    coin: {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        symbol: { type: 'string' },
                        name: { type: 'string' },
                        address: { type: 'string' },
                        network: { type: 'string' },
                        logoUrl: { type: 'string', nullable: true },
                        latestPrice: {
                          type: 'object',
                          nullable: true,
                          properties: {
                            price: { type: 'number' },
                            marketCap: { type: 'number' },
                            volume24h: { type: 'number' },
                            priceChange24h: { type: 'number' },
                            timestamp: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string' },
                  requestId: { type: 'string' },
                  pagination: {
                    type: 'object',
                    properties: {
                      page: { type: 'number' },
                      limit: { type: 'number' },
                      total: { type: 'number' },
                      totalPages: { type: 'number' },
                      hasNext: { type: 'boolean' },
                      hasPrev: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const query = PortfolioQuerySchema.parse(request.query);
      const result = await portfolioService.getPortfolio(request.user.id, query);

      if (result.meta) {
        result.meta.requestId = request.id;
      }

      return reply.send(result);
    }
  );

  // Add or update portfolio holding
  fastify.post<{
    Body: CreatePortfolio;
  }>(
    '/portfolio/holdings',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: CreatePortfolioSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  userId: { type: 'number' },
                  coinId: { type: 'number' },
                  amount: { type: 'number' },
                  avgPrice: { type: 'number' },
                  currentValue: { type: 'number' },
                  profitLoss: { type: 'number' },
                  profitLossPercentage: { type: 'number' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                  coin: { type: 'object' },
                },
              },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const data = CreatePortfolioSchema.parse(request.body);
      const result = await portfolioService.addOrUpdateHolding(request.user.id, data);

      if (result.meta) {
        result.meta.requestId = request.id;
      }

      // Broadcast portfolio update via WebSocket
      if (result.success && result.data) {
        const event = {
          type: 'portfolio_update' as const,
          data: {
            userId: request.user.id,
            holding: result.data,
            action: 'add_or_update',
          },
          timestamp: new Date().toISOString(),
          userId: request.user.id.toString(),
        };

        fastify.realtime.broadcastToUser(request.user.id, event);
      }

      return reply.send(result);
    }
  );

  // Update portfolio holding
  fastify.put<{
    Params: { holdingId: number };
    Body: UpdatePortfolio;
  }>(
    '/portfolio/holdings/:holdingId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          properties: {
            holdingId: { type: 'number' },
          },
          required: ['holdingId'],
        },
        body: UpdatePortfolioSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const holdingId = Number((request.params as any).holdingId);
      const data = UpdatePortfolioSchema.parse(request.body);
      const result = await portfolioService.updateHolding(request.user.id, holdingId, data);

      if (result.meta) {
        result.meta.requestId = request.id;
      }

      // Broadcast portfolio update via WebSocket
      if (result.success && result.data) {
        const event = {
          type: 'portfolio_update' as const,
          data: {
            userId: request.user.id,
            holding: result.data,
            action: 'update',
          },
          timestamp: new Date().toISOString(),
          userId: request.user.id.toString(),
        };

        fastify.realtime.broadcastToUser(request.user.id, event);
      }

      return reply.send(result);
    }
  );

  // Delete portfolio holding
  fastify.delete<{
    Params: { holdingId: number };
  }>(
    '/portfolio/holdings/:holdingId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          properties: {
            holdingId: { type: 'number' },
          },
          required: ['holdingId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const holdingId = Number((request.params as any).holdingId);
      const result = await portfolioService.deleteHolding(request.user.id, holdingId);

      if (result.meta) {
        result.meta.requestId = request.id;
      }

      // Broadcast portfolio update via WebSocket
      if (result.success) {
        const event = {
          type: 'portfolio_update' as const,
          data: {
            userId: request.user.id,
            holdingId,
            action: 'delete',
          },
          timestamp: new Date().toISOString(),
          userId: request.user.id.toString(),
        };

        fastify.realtime.broadcastToUser(request.user.id, event);
      }

      return reply.send(result);
    }
  );

  // Get portfolio analytics
  fastify.get<{
    Querystring: PortfolioAnalyticsQuery;
  }>(
    '/portfolio/analytics',
    {
      preHandler: [fastify.authenticate],
      schema: {
        querystring: PortfolioAnalyticsQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  totalValue: { type: 'number' },
                  totalInvested: { type: 'number' },
                  totalProfitLoss: { type: 'number' },
                  totalProfitLossPercentage: { type: 'number' },
                  topPerformers: { type: 'array' },
                  worstPerformers: { type: 'array' },
                  allocation: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        coinId: { type: 'number' },
                        symbol: { type: 'string' },
                        name: { type: 'string' },
                        percentage: { type: 'number' },
                        value: { type: 'number' },
                      },
                    },
                  },
                },
              },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const query = PortfolioAnalyticsQuerySchema.parse(request.query);
      const result = await portfolioService.getPortfolioAnalytics(request.user.id, query);

      if (result.meta) {
        result.meta.requestId = request.id;
      }

      return reply.send(result);
    }
  );

  // Get portfolio performance over time
  fastify.get<{
    Querystring: PortfolioPerformanceQuery;
  }>(
    '/portfolio/performance',
    {
      preHandler: [fastify.authenticate],
      schema: {
        querystring: PortfolioPerformanceQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  timestamps: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  values: {
                    type: 'array',
                    items: { type: 'number' },
                  },
                  profitLoss: {
                    type: 'array',
                    items: { type: 'number' },
                  },
                  profitLossPercentage: {
                    type: 'array',
                    items: { type: 'number' },
                  },
                },
              },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const query = PortfolioPerformanceQuerySchema.parse(request.query);
      const result = await portfolioService.getPortfolioPerformance(request.user.id, query);

      if (result.meta) {
        result.meta.requestId = request.id;
      }

      return reply.send(result);
    }
  );

  // Integrate wallet for automatic portfolio detection
  fastify.post<{
    Body: WalletIntegration;
  }>(
    '/portfolio/wallet-integration',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: WalletIntegrationSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: { type: 'object' },
              },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const data = WalletIntegrationSchema.parse(request.body);
      const result = await portfolioService.integrateWallet(request.user.id, data);

      if (result.meta) {
        result.meta.requestId = request.id;
      }

      // Broadcast wallet integration completion via WebSocket
      if (result.success && result.data && result.data.length > 0) {
        const event = {
          type: 'wallet_integration_complete' as const,
          data: {
            userId: request.user.id,
            walletAddress: data.walletAddress,
            importedCount: result.data.length,
            holdings: result.data,
          },
          timestamp: new Date().toISOString(),
          userId: request.user.id.toString(),
        };

        fastify.realtime.broadcastToUser(request.user.id, event);
      }

      return reply.send(result);
    }
  );
}
