import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LiquidityService } from '../services/liquidity.js';
import {
  CoinIdParamsSchema,
  LiquidityPoolQuerySchema,
  LiquidityTrendsQuerySchema,
  CreateLiquidityAlertSchema,
  UpdateLiquidityAlertSchema,
  SyncPoolsSchema,
  AlertIdParamsSchema,
  PoolIdParamsSchema,
  PoolComparisonSchema,
} from '../schemas/liquidity.js';

export default async function liquidityRoutes(fastify: FastifyInstance) {
  const liquidityService = new LiquidityService(
    fastify.prisma,
    fastify.log,
    fastify.cache,
    fastify.realtime
  );

  // Get liquidity pools for a coin
  fastify.get(
    '/coins/:coinId/pools',
    {
      preHandler: fastify.authenticate,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
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
  fastify.get(
    '/coins/:coinId/analysis',
    {
      preHandler: fastify.authenticate,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validatedParams = CoinIdParamsSchema.parse(request.params);
        const result = await liquidityService.analyzeLiquidity(validatedParams.coinId);

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
  fastify.get(
    '/coins/:coinId/trends',
    {
      preHandler: fastify.authenticate,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validatedParams = CoinIdParamsSchema.parse(request.params);
        const validatedQuery = LiquidityTrendsQuerySchema.parse(request.query);

        const result = await liquidityService.getLiquidityTrends(
          validatedParams.coinId,
          validatedQuery.timeframe
        );

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

  // Sync liquidity pools
  fastify.post(
    '/sync',
    {
      preHandler: fastify.authenticate,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validatedBody = SyncPoolsSchema.parse(request.body);
        const result = await liquidityService.syncLiquidityPools(
          validatedBody.coinId,
          validatedBody.tokenAddress
        );

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
  fastify.post(
    '/alerts',
    {
      preHandler: fastify.authenticate,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user.id;
        const validatedBody = CreateLiquidityAlertSchema.parse(request.body);

        const result = await liquidityService.createLiquidityAlert(
          userId,
          validatedBody.coinId,
          validatedBody.type,
          validatedBody.condition,
          validatedBody.notificationMethods,
          {
            poolId: validatedBody.poolId,
            name: validatedBody.name,
            description: validatedBody.description,
          }
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
  fastify.put(
    '/alerts/:alertId',
    {
      preHandler: fastify.authenticate,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validatedParams = AlertIdParamsSchema.parse(request.params);
        const validatedBody = UpdateLiquidityAlertSchema.parse(request.body);

        const result = await liquidityService.updateLiquidityAlert(
          validatedParams.alertId,
          validatedBody
        );

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
  fastify.delete(
    '/alerts/:alertId',
    {
      preHandler: fastify.authenticate,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validatedParams = AlertIdParamsSchema.parse(request.params);
        const result = await liquidityService.deleteLiquidityAlert(validatedParams.alertId);

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
  fastify.get(
    '/pools/:poolId',
    {
      preHandler: fastify.authenticate,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validatedParams = PoolIdParamsSchema.parse(request.params);

        const pool = await fastify.prisma.liquidityPool.findUnique({
          where: { id: validatedParams.poolId },
          include: {
            coin: true,
            liquidityData: {
              orderBy: { timestamp: 'desc' },
              take: 100,
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
  fastify.post(
    '/pools/compare',
    {
      preHandler: fastify.authenticate,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validatedBody = PoolComparisonSchema.parse(request.body);

        const pools = await fastify.prisma.liquidityPool.findMany({
          where: {
            id: { in: validatedBody.poolIds },
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
          if (validatedBody.metrics.includes('liquidity')) {
            result.liquidity = Number(pool.totalLiquidity);
          }
          if (validatedBody.metrics.includes('volume')) {
            result.volume24h = Number(pool.volume24h);
          }
          if (validatedBody.metrics.includes('fees')) {
            result.fees24h = Number(pool.fees24h);
          }
          if (validatedBody.metrics.includes('apr') && pool.apr) {
            result.apr = Number(pool.apr);
          }
          if (validatedBody.metrics.includes('priceImpact') && latestData) {
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
            metrics: validatedBody.metrics,
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
