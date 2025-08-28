import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ApiResponse } from '../types/index.js';
import { WhaleTrackingService } from '../services/whale-tracking.js';
import {
  WhaleTransactionQuerySchema,
  WhaleAnalysisQuerySchema,
  WhaleWalletQuerySchema,
  TopWhaleWalletsQuerySchema,
  type WhaleTransactionQuery,
  type WhaleAnalysisQuery,
  type WhaleWalletQuery,
  type TopWhaleWalletsQuery,
} from '../schemas/whale.js';

export default async function whaleRoutes(fastify: FastifyInstance) {
  const whaleTrackingService = new WhaleTrackingService(
    fastify.prisma,
    fastify.externalApi,
    fastify.cache,
    fastify.realtime,
    fastify.log
  );

  // Get whale transactions for a specific coin
  fastify.get<{
    Querystring: WhaleTransactionQuery;
  }>('/transactions', {
    schema: {
      querystring: WhaleTransactionQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                transactions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'number' },
                      coinId: { type: 'number' },
                      txHash: { type: 'string' },
                      fromAddress: { type: 'string' },
                      toAddress: { type: 'string' },
                      amount: { type: 'string' },
                      usdValue: { type: 'number' },
                      timestamp: { type: 'string', format: 'date-time' },
                    }
                  }
                },
                total: { type: 'number' },
              }
            },
            meta: {
              type: 'object',
              properties: {
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number' },
                    limit: { type: 'number' },
                    total: { type: 'number' },
                    totalPages: { type: 'number' },
                    hasNext: { type: 'boolean' },
                    hasPrev: { type: 'boolean' },
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: WhaleTransactionQuery }>, reply: FastifyReply) => {
    try {
      const { coinId, limit, offset, fromDate, toDate, minUsdValue } = request.query;

      const options = {
        limit,
        offset,
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
        minUsdValue,
      };

      const result = await whaleTrackingService.getWhaleTransactions(coinId, options);

      const page = Math.floor(offset / limit) + 1;
      const totalPages = Math.ceil(result.total / limit);

      const response: ApiResponse = {
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          }
        }
      };

      return reply.send(response);
    } catch (error) {
      request.log.error(error, 'Failed to get whale transactions');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'WHALE_TRANSACTIONS_ERROR',
          message: 'Failed to retrieve whale transactions',
        }
      });
    }
  });

  // Get whale movement analysis for a coin
  fastify.get<{
    Querystring: WhaleAnalysisQuery;
  }>('/analysis', {
    schema: {
      querystring: WhaleAnalysisQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                coinId: { type: 'number' },
                timeframe: { type: 'string', enum: ['1h', '24h', '7d'] },
                totalTransactions: { type: 'number' },
                totalVolume: { type: 'number' },
                netFlow: { type: 'number' },
                priceImpact: { type: 'number' },
                averageTransactionSize: { type: 'number' },
                uniqueWallets: { type: 'number' },
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: WhaleAnalysisQuery }>, reply: FastifyReply) => {
    try {
      const { coinId, timeframe } = request.query;

      const analysis = await whaleTrackingService.analyzeWhaleMovements(coinId, timeframe);

      const response: ApiResponse = {
        success: true,
        data: analysis,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        }
      };

      return reply.send(response);
    } catch (error) {
      request.log.error(error, 'Failed to get whale analysis');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'WHALE_ANALYSIS_ERROR',
          message: 'Failed to retrieve whale movement analysis',
        }
      });
    }
  });

  // Get whale wallet information
  fastify.get<{
    Querystring: WhaleWalletQuery;
  }>('/wallet', {
    schema: {
      querystring: WhaleWalletQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                address: { type: 'string' },
                label: { type: 'string' },
                category: { type: 'string', enum: ['exchange', 'whale', 'dev', 'unknown'] },
                totalTransactions: { type: 'number' },
                totalVolume: { type: 'number' },
                firstSeen: { type: 'string', format: 'date-time' },
                lastSeen: { type: 'string', format: 'date-time' },
                isActive: { type: 'boolean' },
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: WhaleWalletQuery }>, reply: FastifyReply) => {
    try {
      const { address } = request.query;

      const whaleWallet = await whaleTrackingService.getWhaleWallet(address);

      if (!whaleWallet) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'WHALE_WALLET_NOT_FOUND',
            message: 'Whale wallet not found',
          }
        });
      }

      const response: ApiResponse = {
        success: true,
        data: whaleWallet,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        }
      };

      return reply.send(response);
    } catch (error) {
      request.log.error(error, 'Failed to get whale wallet');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'WHALE_WALLET_ERROR',
          message: 'Failed to retrieve whale wallet information',
        }
      });
    }
  });

  // Get top whale wallets for a coin
  fastify.get<{
    Querystring: TopWhaleWalletsQuery;
  }>('/top-wallets', {
    schema: {
      querystring: TopWhaleWalletsQuerySchema,
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
                  address: { type: 'string' },
                  label: { type: 'string' },
                  category: { type: 'string', enum: ['exchange', 'whale', 'dev', 'unknown'] },
                  totalTransactions: { type: 'number' },
                  totalVolume: { type: 'number' },
                  firstSeen: { type: 'string', format: 'date-time' },
                  lastSeen: { type: 'string', format: 'date-time' },
                  isActive: { type: 'boolean' },
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: TopWhaleWalletsQuery }>, reply: FastifyReply) => {
    try {
      const { coinId, limit } = request.query;

      const topWallets = await whaleTrackingService.getTopWhaleWallets(coinId, limit);

      const response: ApiResponse = {
        success: true,
        data: topWallets,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        }
      };

      return reply.send(response);
    } catch (error) {
      request.log.error(error, 'Failed to get top whale wallets');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'TOP_WHALE_WALLETS_ERROR',
          message: 'Failed to retrieve top whale wallets',
        }
      });
    }
  });

  // Process whale transactions for a coin (admin/background job endpoint)
  fastify.post<{
    Body: { coinId: number; contractAddress: string; network: string };
  }>('/process', {
    schema: {
      body: {
        type: 'object',
        required: ['coinId', 'contractAddress', 'network'],
        properties: {
          coinId: { type: 'number' },
          contractAddress: { type: 'string' },
          network: { type: 'string' },
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                processedCount: { type: 'number' },
                message: { type: 'string' },
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: { coinId: number; contractAddress: string; network: string } }>, reply: FastifyReply) => {
    try {
      const { coinId, contractAddress, network } = request.body;

      const processedTransactions = await whaleTrackingService.processWhaleTransactions(
        coinId,
        contractAddress,
        network
      );

      const response: ApiResponse = {
        success: true,
        data: {
          processedCount: processedTransactions.length,
          message: `Successfully processed ${processedTransactions.length} whale transactions`,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        }
      };

      return reply.send(response);
    } catch (error) {
      request.log.error(error, 'Failed to process whale transactions');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'WHALE_PROCESSING_ERROR',
          message: 'Failed to process whale transactions',
        }
      });
    }
  });
}