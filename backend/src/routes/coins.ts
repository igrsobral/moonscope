import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CoinService } from '../services/coin.js';
import { 
  CoinQuerySchema, 
  CreateCoinSchema, 
  UpdateCoinSchema, 
  CoinParamsSchema,
  CoinAddressParamsSchema,
  PriceHistoryQuerySchema,
  NetworkSchema,
  CreatePriceDataSchema,
  CoinQuery,
  CreateCoin,
  UpdateCoin,
  CoinParams,
  CoinAddressParams,
  PriceHistoryQuery,
  NetworkType,
  CreatePriceData
} from '../schemas/coins.js';

export async function coinsRoutes(fastify: FastifyInstance) {
  const coinService = new CoinService(
    (fastify as any).prisma,
    fastify.log,
    (fastify as any).cache,
    (fastify as any).externalApi
  );

  // Get coins list with filtering and pagination
  fastify.get<{
    Querystring: CoinQuery;
  }>('/coins', async (request: FastifyRequest<{ Querystring: CoinQuery }>, reply: FastifyReply) => {
    // Validate query parameters
    const validatedQuery = CoinQuerySchema.parse(request.query);
    const result = await coinService.getCoins(validatedQuery);
    
    if (result.meta) {
      result.meta.requestId = request.id;
    }
    
    return reply.send(result);
  });

  // Get coin by ID
  fastify.get<{
    Params: CoinParams;
  }>('/coins/:id', {
    schema: {
      tags: ['coins'],
      params: CoinParamsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                address: { type: 'string' },
                symbol: { type: 'string' },
                name: { type: 'string' },
                network: { type: 'string' },
                contractVerified: { type: 'boolean' },
                logoUrl: { type: 'string', nullable: true },
                description: { type: 'string', nullable: true },
                website: { type: 'string', nullable: true },
                socialLinks: { type: 'object' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
                latestPrice: { type: 'object', nullable: true },
                priceHistory: { type: 'array' },
                socialMetrics: { type: 'array', nullable: true },
                riskAssessment: { type: 'object', nullable: true },
                riskScore: { type: 'number', nullable: true },
              },
            },
            meta: { type: 'object' },
          },
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
              },
            },
            meta: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: CoinParams }>, reply: FastifyReply) => {
    const result = await coinService.getCoinById(request.params.id);
    
    if (result.meta) {
      result.meta.requestId = request.id;
    }
    
    if (!result.success) {
      return reply.code(404).send(result);
    }
    
    return reply.send(result);
  });

  // Get coin by contract address
  fastify.get<{
    Params: CoinAddressParams;
  }>('/coins/address/:address', {
    schema: {
      tags: ['coins'],
      params: CoinAddressParamsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            meta: { type: 'object' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'object' },
            meta: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: CoinAddressParams }>, reply: FastifyReply) => {
    const result = await coinService.getCoinByAddress(request.params.address);
    
    if (result.meta) {
      result.meta.requestId = request.id;
    }
    
    if (!result.success) {
      return reply.code(404).send(result);
    }
    
    return reply.send(result);
  });

  // Create new coin
  fastify.post<{
    Body: CreateCoin;
  }>('/coins', {
    schema: {
      tags: ['coins'],
      body: CreateCoinSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                address: { type: 'string' },
                symbol: { type: 'string' },
                name: { type: 'string' },
                network: { type: 'string' },
                contractVerified: { type: 'boolean' },
                logoUrl: { type: 'string', nullable: true },
                description: { type: 'string', nullable: true },
                website: { type: 'string', nullable: true },
                socialLinks: { type: 'object' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
            meta: { type: 'object' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'object' },
            meta: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: CreateCoin }>, reply: FastifyReply) => {
    const result = await coinService.createCoin(request.body);
    
    if (result.meta) {
      result.meta.requestId = request.id;
    }
    
    if (!result.success) {
      return reply.code(400).send(result);
    }
    
    return reply.code(201).send(result);
  });

  // Update coin
  fastify.put<{
    Params: CoinParams;
    Body: UpdateCoin;
  }>('/coins/:id', {
    schema: {
      tags: ['coins'],
      params: CoinParamsSchema,
      body: UpdateCoinSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            meta: { type: 'object' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'object' },
            meta: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: CoinParams; Body: UpdateCoin }>, reply: FastifyReply) => {
    try {
      const result = await coinService.updateCoin(request.params.id, request.body);
      
      if (result.meta) {
        result.meta.requestId = request.id;
      }
      
      return reply.send(result);
    } catch (error: any) {
      if (error.code === 'P2025') { // Prisma record not found
        return reply.code(404).send({
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
      throw error;
    }
  });

  // Delete coin
  fastify.delete<{
    Params: CoinParams;
  }>('/coins/:id', {
    schema: {
      tags: ['coins'],
      params: CoinParamsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            meta: { type: 'object' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'object' },
            meta: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: CoinParams }>, reply: FastifyReply) => {
    try {
      const result = await coinService.deleteCoin(request.params.id);
      
      if (result.meta) {
        result.meta.requestId = request.id;
      }
      
      return reply.send(result);
    } catch (error: any) {
      if (error.code === 'P2025') { // Prisma record not found
        return reply.code(404).send({
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
      throw error;
    }
  });

  // Get price history for a coin
  fastify.get<{
    Params: CoinParams;
    Querystring: PriceHistoryQuery;
  }>('/coins/:id/price-history', {
    schema: {
      tags: ['coins'],
      params: CoinParamsSchema,
      querystring: PriceHistoryQuerySchema,
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
                  coinId: { type: 'number' },
                  price: { type: 'number' },
                  marketCap: { type: 'number' },
                  volume24h: { type: 'number' },
                  liquidity: { type: 'number' },
                  priceChange24h: { type: 'number' },
                  volumeChange24h: { type: 'number' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
            meta: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: CoinParams; Querystring: PriceHistoryQuery }>, reply: FastifyReply) => {
    const result = await coinService.getPriceHistory(request.params.id, request.query);
    
    if (result.meta) {
      result.meta.requestId = request.id;
    }
    
    return reply.send(result);
  });

  // Store price data for a coin
  fastify.post<{
    Body: CreatePriceData;
  }>('/coins/price-data', {
    schema: {
      tags: ['coins'],
      body: CreatePriceDataSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                coinId: { type: 'number' },
                price: { type: 'number' },
                marketCap: { type: 'number' },
                volume24h: { type: 'number' },
                liquidity: { type: 'number' },
                priceChange24h: { type: 'number' },
                volumeChange24h: { type: 'number' },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
            meta: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: CreatePriceData }>, reply: FastifyReply) => {
    const result = await coinService.storePriceData(request.body);
    
    if (result.meta) {
      result.meta.requestId = request.id;
    }
    
    return reply.code(201).send(result);
  });

  // Discover new coins from external APIs
  fastify.post<{
    Body: { network?: NetworkType };
  }>('/coins/discover', {
    schema: {
      tags: ['coins'],
      body: {
        type: 'object',
        properties: {
          network: NetworkSchema,
        },
      },
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
  }, async (request: FastifyRequest<{ Body: { network?: NetworkType } }>, reply: FastifyReply) => {
    const result = await coinService.discoverCoins(request.body.network);
    
    if (result.meta) {
      result.meta.requestId = request.id;
    }
    
    return reply.send(result);
  });

  // Search coins
  fastify.get<{
    Querystring: { q: string };
  }>('/coins/search', {
    schema: {
      tags: ['coins'],
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', minLength: 1, maxLength: 100 },
        },
        required: ['q'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array' },
            meta: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { q: string } }>, reply: FastifyReply) => {
    const result = await coinService.searchCoins(request.query.q);
    
    if (result.meta) {
      result.meta.requestId = request.id;
    }
    
    return reply.send(result);
  });
}