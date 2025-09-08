import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BulkRiskAssessmentSchema, RiskComparisonSchema } from '../schemas/risk-assessment.js';
import { CoinParamsSchema } from '../schemas/coins.js';
import { RiskAssessmentService } from '../services/risk-assessment.js';
import { ApiResponse } from '../types/index.js';

export default async function riskAssessmentRoutes(fastify: FastifyInstance) {
  const riskService = fastify.riskAssessmentService as RiskAssessmentService;

  fastify.get<{
    Params: { id: number };
    Querystring: { forceRefresh?: boolean };
  }>(
    '/coins/:id/risk',
    {
      schema: {
        params: CoinParamsSchema,
        querystring: {
          type: 'object',
          properties: {
            forceRefresh: { type: 'boolean', default: false },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  coinId: { type: 'number' },
                  overallScore: { type: 'number', minimum: 1, maximum: 100 },
                  factors: {
                    type: 'object',
                    properties: {
                      liquidity: {
                        type: 'object',
                        properties: {
                          score: { type: 'number' },
                          value: { type: 'number' },
                          threshold: { type: 'number' },
                        },
                      },
                      holderDistribution: {
                        type: 'object',
                        properties: {
                          score: { type: 'number' },
                          topHoldersPercentage: { type: 'number' },
                          holderCount: { type: 'number' },
                        },
                      },
                      contractSecurity: {
                        type: 'object',
                        properties: {
                          score: { type: 'number' },
                          isVerified: { type: 'boolean' },
                          hasProxyContract: { type: 'boolean' },
                          hasOwnershipRenounced: { type: 'boolean' },
                        },
                      },
                      socialMetrics: {
                        type: 'object',
                        properties: {
                          score: { type: 'number' },
                          sentimentScore: { type: 'number' },
                          communitySize: { type: 'number' },
                        },
                      },
                    },
                  },
                  timestamp: { type: 'string', format: 'date-time' },
                  confidence: { type: 'number', minimum: 0, maximum: 100 },
                  warnings: { type: 'array', items: { type: 'string' } },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string' },
                  requestId: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: number };
        Querystring: { forceRefresh?: boolean };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { forceRefresh = false } = request.query;

        // Get coin information first
        const coin = await fastify.prisma.coin.findUnique({
          where: { id },
        });

        if (!coin) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'COIN_NOT_FOUND',
              message: 'Coin not found',
            },
            meta: {
              timestamp: new Date().toISOString(),
              requestId: request.id,
            },
          });
        }

        const result = await riskService.assessRisk({
          coinId: id,
          contractAddress: coin.address,
          network: coin.network,
          forceRefresh,
        });

        const response: ApiResponse<typeof result> = {
          success: true,
          data: result,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        };

        return reply.send(response);
      } catch (error) {
        request.log.error({ error, coinId: request.params.id }, 'Failed to get risk assessment');

        return reply.status(500).send({
          success: false,
          error: {
            code: 'RISK_ASSESSMENT_ERROR',
            message: 'Failed to assess risk',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
    }
  );

  // Get risk assessment history for a coin
  fastify.get<{
    Params: { id: number };
    Querystring: { limit?: number; fromDate?: string; toDate?: string };
  }>(
    '/coins/:id/risk/history',
    {
      schema: {
        params: CoinParamsSchema,
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100, default: 30 },
            fromDate: { type: 'string', format: 'date-time' },
            toDate: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: number };
        Querystring: { limit?: number; fromDate?: string; toDate?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { limit = 30 } = request.query;

        const history = await riskService.getRiskHistory(id, limit);

        const response: ApiResponse<typeof history> = {
          success: true,
          data: history,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        };

        return reply.send(response);
      } catch (error) {
        request.log.error({ error, coinId: request.params.id }, 'Failed to get risk history');

        return reply.status(500).send({
          success: false,
          error: {
            code: 'RISK_HISTORY_ERROR',
            message: 'Failed to get risk history',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
    }
  );

  // Bulk risk assessment for multiple coins
  fastify.post<{
    Body: {
      coins: Array<{
        coinId: number;
        contractAddress: string;
        network: string;
      }>;
      forceRefresh?: boolean;
    };
  }>(
    '/risk/bulk',
    {
      schema: {
        body: BulkRiskAssessmentSchema,
      },
    },
    async (
      request: FastifyRequest<{
        Body: {
          coins: Array<{
            coinId: number;
            contractAddress: string;
            network: string;
          }>;
          forceRefresh?: boolean;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { coins, forceRefresh = false } = request.body;

        const results = await Promise.allSettled(
          coins.map(coin =>
            riskService.assessRisk({
              ...coin,
              forceRefresh,
            })
          )
        );

        const successful = results
          .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
          .map(result => result.value);

        const failed = results
          .map((result, index) =>
            result.status === 'rejected'
              ? { coinId: coins[index]?.coinId, error: result.reason }
              : null
          )
          .filter(Boolean);

        const response: ApiResponse<{
          successful: typeof successful;
          failed: typeof failed;
        }> = {
          success: true,
          data: {
            successful,
            failed,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        };

        return reply.send(response);
      } catch (error) {
        request.log.error({ error }, 'Failed to perform bulk risk assessment');

        return reply.status(500).send({
          success: false,
          error: {
            code: 'BULK_RISK_ASSESSMENT_ERROR',
            message: 'Failed to perform bulk risk assessment',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
    }
  );

  // Compare risk assessments between coins
  fastify.post<{
    Body: {
      coinIds: number[];
      metrics?: string[];
    };
  }>(
    '/risk/compare',
    {
      schema: {
        body: RiskComparisonSchema,
      },
    },
    async (
      request: FastifyRequest<{
        Body: {
          coinIds: number[];
          metrics?: string[];
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { coinIds, metrics = ['overall'] } = request.body;

        // Get latest risk assessments for all coins
        const riskAssessments = await Promise.all(
          coinIds.map(async coinId => {
            const latest = await fastify.prisma.riskAssessment.findFirst({
              where: { coinId },
              orderBy: { timestamp: 'desc' },
              include: {
                coin: {
                  select: {
                    id: true,
                    name: true,
                    symbol: true,
                  },
                },
              },
            });
            return latest;
          })
        );

        const validAssessments = riskAssessments.filter(Boolean);

        if (validAssessments.length === 0) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'NO_RISK_DATA',
              message: 'No risk assessment data found for the specified coins',
            },
            meta: {
              timestamp: new Date().toISOString(),
              requestId: request.id,
            },
          });
        }

        // Build comparison data
        const comparison = validAssessments.map(assessment => {
          const data: any = {
            coinId: assessment!.coinId,
            coin: assessment!.coin,
            timestamp: assessment!.timestamp,
          };

          if (metrics.includes('overall')) {
            data.overallScore = assessment!.overallScore;
          }
          if (metrics.includes('liquidity')) {
            data.liquidityScore = assessment!.liquidityScore;
          }
          if (metrics.includes('holderDistribution')) {
            data.holderDistributionScore = assessment!.holderDistributionScore;
          }
          if (metrics.includes('contractSecurity')) {
            data.contractSecurityScore = assessment!.contractSecurityScore;
          }
          if (metrics.includes('socialMetrics')) {
            data.socialScore = assessment!.socialScore;
          }

          return data;
        });

        const response: ApiResponse<typeof comparison> = {
          success: true,
          data: comparison,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        };

        return reply.send(response);
      } catch (error) {
        request.log.error({ error }, 'Failed to compare risk assessments');

        return reply.status(500).send({
          success: false,
          error: {
            code: 'RISK_COMPARISON_ERROR',
            message: 'Failed to compare risk assessments',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
    }
  );

  // Get risk assessment configuration
  fastify.get(
    '/risk/config',
    {
      schema: {},
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const config = riskService.getConfig();

        const response: ApiResponse<typeof config> = {
          success: true,
          data: config,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        };

        return reply.send(response);
      } catch (error) {
        request.log.error({ error }, 'Failed to get risk assessment configuration');

        return reply.status(500).send({
          success: false,
          error: {
            code: 'CONFIG_ERROR',
            message: 'Failed to get configuration',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
    }
  );

  // Update risk assessment configuration
  fastify.put<{
    Body: Partial<{
      weights: {
        liquidity: number;
        holderDistribution: number;
        contractSecurity: number;
        socialMetrics: number;
      };
      thresholds: any;
    }>;
  }>(
    '/risk/config',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            weights: {
              type: 'object',
              properties: {
                liquidity: { type: 'number', minimum: 0, maximum: 1 },
                holderDistribution: { type: 'number', minimum: 0, maximum: 1 },
                contractSecurity: { type: 'number', minimum: 0, maximum: 1 },
                socialMetrics: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
            thresholds: { type: 'object' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: Partial<{
          weights: {
            liquidity: number;
            holderDistribution: number;
            contractSecurity: number;
            socialMetrics: number;
          };
          thresholds: any;
        }>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const newConfig = request.body;

        // Validate weights sum to 1 if provided
        if (newConfig.weights) {
          const sum = Object.values(newConfig.weights).reduce((a, b) => a + b, 0);
          if (Math.abs(sum - 1) > 0.001) {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'INVALID_WEIGHTS',
                message: 'Weights must sum to 1.0',
              },
              meta: {
                timestamp: new Date().toISOString(),
                requestId: request.id,
              },
            });
          }
        }

        riskService.updateConfig(newConfig);
        const updatedConfig = riskService.getConfig();

        const response: ApiResponse<typeof updatedConfig> = {
          success: true,
          data: updatedConfig,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        };

        return reply.send(response);
      } catch (error) {
        request.log.error({ error }, 'Failed to update risk assessment configuration');

        return reply.status(500).send({
          success: false,
          error: {
            code: 'CONFIG_UPDATE_ERROR',
            message: 'Failed to update configuration',
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
