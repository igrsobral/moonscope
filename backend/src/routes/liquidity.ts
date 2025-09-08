import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LiquidityService } from '../services/liquidity.js';
import {
  LiquidityPoolQuerySchema,
  LiquidityAnalysisQuerySchema,
  LiquidityTrendsQuerySchema,
  CreateLiquidityAlertSchema,
  UpdateLiquidityAlertSchema,
  SyncPoolsSchema,
  DexPoolSearchSchema,
  LiquidityRiskAssessmentSchema,
  PoolComparisonSchema,
  CoinIdParamsSchema,
  PoolIdParamsSchema,
  AlertIdParamsSchema,
  TokenAddressParamsSchema,
  LiquidityPoolQuery,
  LiquidityAnalysisQuery,
  LiquidityTrendsQuery,
  CreateLiquidityAlert,
  UpdateLiquidityAlert,
  SyncPools,
  DexPoolSearch,
  LiquidityRiskAssessment,
  PoolComparison,
  CoinIdParams,
  PoolIdParams,
  AlertIdParams,
  TokenAddressParams,
} from '../schemas/liquidity.js';

export default async function liquidityRoutes(fastify: FastifyInstance) {
  const liquidityService = new LiquidityService(
    fastify.prisma,
    fastify.log,
    fastify.cache,
    fastify.realtime
  );

  // Get liquidity pools for a coin
  fastify.get<{
    Params: CoinIdParams;
    Querystring: LiquidityPoolQuery;
  }>(
    '/coins/:coinId/pools',
    {
      preHandler: fastify.authenticate,
    },
    async (
      request: FastifyRequest<{
        Params: CoinIdParams;
        Querystring: LiquidityPoolQuery;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const validatedParams = CoinIdParamsSchema.parse(request.params);
        const validatedQuery = LiquidityPoolQuerySchema.parse(request.query);

        const result = await liquidityService.getLiquidityPools(validatedParams.coinId);

        if (result.meta) {
          result.meta.requestId = request.id;
        }

        return reply.send(result);
      } catch (error) {
        request.log.error({ error }, 'Failed to get liquidity pools');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to get liquidity pools',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
    }
  );

  // Analyze liquidity for a coin
  fastify.get<{
    Params: CoinIdParams;
    Querystring: LiquidityAnalysisQuery;
  }>(
    '/coins/:coinId/analysis',
    {
      schema: {
        params: CoinIdParamsSchema,
        querystring: LiquidityAnalysisQuerySchema,
        tags: ['Liquidity'],
        summary: 'Analyze liquidity for a coin',
        description: 'Get comprehensive liquidity analysis including risk scores and distribution',
      },
      preHandler: fastify.authenticate,
    },
    async (
      request: FastifyRequest<{
        Params: CoinIdParams;
        Querystring: LiquidityAnalysisQuery;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { coinId } = request.params;
        const result = await liquidityService.analyzeLiquidity(coinId);

        if (result.meta) {
          result.meta.requestId = request.id;
        }

        return reply.send(result);
      } catch (error) {
        request.log.error({ error }, 'Failed to analyze liquidity');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to analyze liquidity',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
    }
  );

  // Get liquidity trends
  fastify.get<{
    Params: CoinIdParams;
    Querystring: LiquidityTrendsQuery;
  }>(
    '/coins/:coinId/trends',
    {
      schema: {
        params: CoinIdParamsSchema,
        querystring: LiquidityTrendsQuerySchema,
        tags: ['Liquidity'],
        summary: 'Get liquidity trends over time',
        description: 'Retrieve historical liquidity trends for analysis and charting',
      },
      preHandler: fastify.authenticate,
    },
    async (
      request: FastifyRequest<{
        Params: CoinIdParams;
        Querystring: LiquidityTrendsQuery;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { coinId } = request.params;
        const { timeframe } = request.query;
        const result = await liquidityService.getLiquidityTrends(coinId, timeframe);

        if (result.meta) {
          result.meta.requestId = request.id;
        }

        return reply.send(result);
      } catch (error) {
        request.log.error({ error }, 'Failed to get liquidity trends');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to get liquidity trends',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
    }
  );

  // Sync liquidity pools for a coin
  fastify.post<{
    Body: SyncPools;
  }>(
    '/sync',
    {
      schema: {
        body: SyncPoolsSchema,
        tags: ['Liquidity'],
        summary: 'Sync liquidity pools',
        description: 'Sync liquidity pools for a coin from all supported DEXs',
      },
      preHandler: fastify.authenticate,
    },
    async (
      request: FastifyRequest<{
        Body: SyncPools;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { coinId, tokenAddress } = request.body;
        const result = await liquidityService.syncLiquidityPools(coinId, tokenAddress);

        if (result.meta) {
          result.meta.requestId = request.id;
        }

        return reply.send(result);
      } catch (error) {
        request.log.error({ error }, 'Failed to sync liquidity pools');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to sync liquidity pools',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
    }
  );

  // Create liquidity alert
  fastify.post<{
    Body: CreateLiquidityAlert;
  }>(
    '/alerts',
    {
      schema: {
        body: CreateLiquidityAlertSchema,
        tags: ['Liquidity'],
        summary: 'Create liquidity alert',
        description: 'Create a new liquidity monitoring alert with custom conditions',
      },
      preHandler: fastify.authenticate,
    },
    async (
      request: FastifyRequest<{
        Body: CreateLiquidityAlert;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = request.user.id;
        const { coinId, poolId, type, condition, notificationMethods, name, description } =
          request.body;

        const result = await liquidityService.createLiquidityAlert(
          userId,
          coinId,
          type,
          condition,
          notificationMethods,
          { poolId, name, description }
        );

        if (result.meta) {
          result.meta.requestId = request.id;
        }

        return reply.status(201).send(result);
      } catch (error) {
        request.log.error({ error }, 'Failed to create liquidity alert');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create liquidity alert',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
    }
  );

  // Get user's liquidity alerts
  fastify.get(
    '/alerts',
    {
      schema: {
        tags: ['Liquidity'],
        summary: 'Get user liquidity alerts',
        description: 'Retrieve all liquidity alerts for the authenticated user',
      },
      preHandler: fastify.authenticate,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user.id;
        const result = await liquidityService.getUserLiquidityAlerts(userId);

        if (result.meta) {
          result.meta.requestId = request.id;
        }

        return reply.send(result);
      } catch (error) {
        request.log.error({ error }, 'Failed to get user liquidity alerts');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to get liquidity alerts',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
    }
  );

  // Update liquidity alert
  fastify.put<{
    Params: AlertIdParams;
    Body: UpdateLiquidityAlert;
  }>(
    '/alerts/:alertId',
    {
      schema: {
        params: AlertIdParamsSchema,
        body: UpdateLiquidityAlertSchema,
        tags: ['Liquidity'],
        summary: 'Update liquidity alert',
        description: 'Update an existing liquidity alert configuration',
      },
      preHandler: fastify.authenticate,
    },
    async (
      request: FastifyRequest<{
        Params: AlertIdParams;
        Body: UpdateLiquidityAlert;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { alertId } = request.params;
        const updates = request.body;

        const result = await liquidityService.updateLiquidityAlert(alertId, updates);

        if (result.meta) {
          result.meta.requestId = request.id;
        }

        return reply.send(result);
      } catch (error) {
        request.log.error({ error }, 'Failed to update liquidity alert');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update liquidity alert',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
    }
  );

  // Delete liquidity alert
  fastify.delete<{
    Params: AlertIdParams;
  }>(
    '/alerts/:alertId',
    {
      schema: {
        params: AlertIdParamsSchema,
        tags: ['Liquidity'],
        summary: 'Delete liquidity alert',
        description: 'Delete a liquidity alert',
      },
      preHandler: fastify.authenticate,
    },
    async (
      request: FastifyRequest<{
        Params: AlertIdParams;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { alertId } = request.params;
        const result = await liquidityService.deleteLiquidityAlert(alertId);

        if (result.meta) {
          result.meta.requestId = request.id;
        }

        return reply.send(result);
      } catch (error) {
        request.log.error({ error }, 'Failed to delete liquidity alert');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete liquidity alert',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
    }
  );

  // Get pool details
  fastify.get<{
    Params: PoolIdParams;
  }>(
    '/pools/:poolId',
    {
      schema: {
        params: PoolIdParamsSchema,
        tags: ['Liquidity'],
        summary: 'Get pool details',
        description: 'Get detailed information about a specific liquidity pool',
      },
      preHandler: fastify.authenticate,
    },
    async (
      request: FastifyRequest<{
        Params: PoolIdParams;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { poolId } = request.params;

        const pool = await fastify.prisma.liquidityPool.findUnique({
          where: { id: poolId },
          include: {
            coin: true,
            liquidityData: {
              orderBy: { timestamp: 'desc' },
              take: 100, // Last 100 data points
            },
          },
        });

        if (!pool) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'POOL_NOT_FOUND',
              message: 'Liquidity pool not found',
            },
            meta: {
              timestamp: new Date().toISOString(),
              requestId: request.id,
            },
          });
        }

        return reply.send({
          success: true,
          data: pool,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to get pool details');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to get pool details',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
    }
  );

  // Compare pools
  fastify.post<{
    Body: PoolComparison;
  }>(
    '/pools/compare',
    {
      schema: {
        body: PoolComparisonSchema,
        tags: ['Liquidity'],
        summary: 'Compare liquidity pools',
        description: 'Compare multiple liquidity pools across different metrics',
      },
      preHandler: fastify.authenticate,
    },
    async (
      request: FastifyRequest<{
        Body: PoolComparison;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { poolIds, metrics } = request.body;

        const pools = await fastify.prisma.liquidityPool.findMany({
          where: {
            id: { in: poolIds },
            isActive: true,
          },
          include: {
            coin: true,
            liquidityData: {
              orderBy: { timestamp: 'desc' },
              take: 1,
            },
          },
        });

        if (pools.length === 0) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'POOLS_NOT_FOUND',
              message: 'No active pools found for comparison',
            },
            meta: {
              timestamp: new Date().toISOString(),
              requestId: request.id,
            },
          });
        }

        const comparison = pools.map(pool => {
          const latestData = pool.liquidityData[0];
          const result: any = {
            poolId: pool.id,
            exchange: pool.exchange,
            pairAddress: pool.pairAddress,
            baseSymbol: pool.baseSymbol,
            quoteSymbol: pool.quoteSymbol,
            coin: {
              id: pool.coin.id,
              symbol: pool.coin.symbol,
              name: pool.coin.name,
            },
          };

          // Add requested metrics
          if (metrics.includes('liquidity')) {
            result.liquidity = Number(pool.totalLiquidity);
          }
          if (metrics.includes('volume')) {
            result.volume24h = Number(pool.volume24h);
          }
          if (metrics.includes('fees')) {
            result.fees24h = Number(pool.fees24h);
          }
          if (metrics.includes('apr') && pool.apr) {
            result.apr = Number(pool.apr);
          }
          if (metrics.includes('priceImpact') && latestData) {
            result.priceImpact = {
              impact1k: Number(latestData.priceImpact1k),
              impact10k: Number(latestData.priceImpact10k),
              impact100k: Number(latestData.priceImpact100k),
            };
          }

          return result;
        });

        return reply.send({
          success: true,
          data: {
            pools: comparison,
            metrics,
            comparedAt: new Date().toISOString(),
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to compare pools');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to compare pools',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
    }
  );
}
