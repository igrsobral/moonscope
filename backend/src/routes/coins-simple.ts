import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CoinService } from '../services/coin.js';
import {
  CoinQuerySchema,
  CreateCoinSchema,
  UpdateCoinSchema,
  CoinParamsSchema,
  CoinAddressParamsSchema,
  PriceHistoryQuerySchema,
  CreatePriceDataSchema,
} from '../schemas/coins.js';

export async function coinsRoutes(fastify: FastifyInstance) {
  const coinService = new CoinService(
    (fastify as any).prisma,
    fastify.log,
    (fastify as any).cache,
    (fastify as any).externalApi
  );

  // Get coins list with filtering and pagination
  fastify.get(
    '/coins',
    {
      schema: {
        description: 'Get paginated list of meme coins with filtering options',
        tags: ['Coins'],
        querystring: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
              description: 'Page number for pagination',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Number of items per page',
            },
            sortBy: {
              type: 'string',
              enum: ['price', 'marketCap', 'volume', 'riskScore', 'name', 'symbol'],
              default: 'marketCap',
              description: 'Field to sort by',
            },
            sortOrder: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc',
              description: 'Sort order',
            },
            network: {
              type: 'string',
              enum: ['ethereum', 'bsc', 'polygon', 'solana'],
              description: 'Filter by blockchain network',
            },
            minMarketCap: {
              type: 'number',
              minimum: 0,
              description: 'Minimum market cap filter',
            },
            maxRiskScore: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              description: 'Maximum risk score filter',
            },
            search: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Search by coin name or symbol',
            },
          },
        },
        response: {
          200: {
            description: 'List of coins retrieved successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'array',
                items: { $ref: '#/components/schemas/Coin' },
              },
              meta: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string', format: 'date-time' },
                  requestId: { type: 'string' },
                  pagination: { $ref: '#/components/schemas/PaginationMeta' },
                },
              },
            },
          },
          400: { $ref: '#/components/schemas/ValidationError' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validatedQuery = CoinQuerySchema.parse(request.query);
        const result = await coinService.getCoins(validatedQuery);

        if (result.meta) {
          result.meta.requestId = request.id;
        }

        return reply.send(result);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
              details: error.errors,
            },
            meta: {
              timestamp: new Date().toISOString(),
              requestId: request.id,
            },
          });
        }
        throw error;
      }
    }
  );

  // Get coin by ID
  fastify.get(
    '/coins/:id',
    {
      schema: {
        description: 'Get detailed information about a specific coin by ID',
        tags: ['Coins'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'integer',
              minimum: 1,
              description: 'Coin ID',
              example: 1,
            },
          },
        },
        response: {
          200: {
            description: 'Coin details retrieved successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: { $ref: '#/components/schemas/Coin' },
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
          404: { $ref: '#/components/schemas/NotFoundError' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validatedParams = CoinParamsSchema.parse(request.params);
        const result = await coinService.getCoinById(validatedParams.id);

        if (result.meta) {
          result.meta.requestId = request.id;
        }

        if (!result.success) {
          return reply.code(404).send(result);
        }

        return reply.send(result);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid parameters',
              details: error.errors,
            },
            meta: {
              timestamp: new Date().toISOString(),
              requestId: request.id,
            },
          });
        }
        throw error;
      }
    }
  );

  // Get coin by contract address
  fastify.get(
    '/coins/address/:address',
    {
      schema: {
        description: 'Get coin information by contract address',
        tags: ['Coins'],
        params: {
          type: 'object',
          required: ['address'],
          properties: {
            address: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Contract address',
              example: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b5',
            },
          },
        },
        response: {
          200: {
            description: 'Coin details retrieved successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: { $ref: '#/components/schemas/Coin' },
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
          404: { $ref: '#/components/schemas/NotFoundError' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validatedParams = CoinAddressParamsSchema.parse(request.params);
        const result = await coinService.getCoinByAddress(validatedParams.address);

        if (result.meta) {
          result.meta.requestId = request.id;
        }

        if (!result.success) {
          return reply.code(404).send(result);
        }

        return reply.send(result);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid address format',
              details: error.errors,
            },
            meta: {
              timestamp: new Date().toISOString(),
              requestId: request.id,
            },
          });
        }
        throw error;
      }
    }
  );

  // Create new coin
  fastify.post(
    '/coins',
    {
      schema: {
        description: 'Add a new meme coin to the database',
        tags: ['Coins'],
        body: {
          type: 'object',
          required: ['address', 'symbol', 'name', 'network'],
          properties: {
            address: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Contract address',
              example: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b5',
            },
            symbol: {
              type: 'string',
              minLength: 1,
              maxLength: 20,
              description: 'Coin symbol',
              example: 'DOGE',
            },
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Coin name',
              example: 'Dogecoin',
            },
            network: {
              type: 'string',
              enum: ['ethereum', 'bsc', 'polygon', 'solana'],
              description: 'Blockchain network',
              example: 'ethereum',
            },
            contractVerified: {
              type: 'boolean',
              default: false,
              description: 'Whether the contract is verified',
            },
            logoUrl: {
              type: 'string',
              format: 'uri',
              description: 'Logo image URL',
            },
            description: {
              type: 'string',
              maxLength: 1000,
              description: 'Coin description',
            },
            website: {
              type: 'string',
              format: 'uri',
              description: 'Official website URL',
            },
            socialLinks: {
              type: 'object',
              properties: {
                twitter: { type: 'string', format: 'uri' },
                telegram: { type: 'string', format: 'uri' },
                discord: { type: 'string', format: 'uri' },
              },
            },
          },
        },
        response: {
          201: {
            description: 'Coin created successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: { $ref: '#/components/schemas/Coin' },
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validatedData = CreateCoinSchema.parse(request.body);
        const result = await coinService.createCoin(validatedData);

        if (result.meta) {
          result.meta.requestId = request.id;
        }

        if (!result.success) {
          return reply.code(400).send(result);
        }

        return reply.code(201).send(result);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid coin data',
              details: error.errors,
            },
            meta: {
              timestamp: new Date().toISOString(),
              requestId: request.id,
            },
          });
        }
        throw error;
      }
    }
  );

  // Update coin
  fastify.put('/coins/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedParams = CoinParamsSchema.parse(request.params);
      const validatedData = UpdateCoinSchema.parse(request.body);
      const result = await coinService.updateCoin(validatedParams.id, validatedData);

      if (result.meta) {
        result.meta.requestId = request.id;
      }

      return reply.send(result);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid data',
            details: error.errors,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
      if (error.code === 'P2025') {
        // Prisma record not found
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
  fastify.delete('/coins/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedParams = CoinParamsSchema.parse(request.params);
      const result = await coinService.deleteCoin(validatedParams.id);

      if (result.meta) {
        result.meta.requestId = request.id;
      }

      return reply.send(result);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid parameters',
            details: error.errors,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }
      if (error.code === 'P2025') {
        // Prisma record not found
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
  fastify.get('/coins/:id/price-history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedParams = CoinParamsSchema.parse(request.params);
      const validatedQuery = PriceHistoryQuerySchema.parse(request.query);
      const result = await coinService.getPriceHistory(validatedParams.id, validatedQuery);

      if (result.meta) {
        result.meta.requestId = request.id;
      }

      return reply.send(result);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid parameters',
            details: error.errors,
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

  // Store price data for a coin
  fastify.post('/coins/price-data', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedData = CreatePriceDataSchema.parse(request.body);
      const result = await coinService.storePriceData(validatedData);

      if (result.meta) {
        result.meta.requestId = request.id;
      }

      return reply.code(201).send(result);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid price data',
            details: error.errors,
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

  // Search coins
  fastify.get('/coins/search', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = (request.query as any)?.q;
      if (!query || typeof query !== 'string' || query.length < 1) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query parameter "q" is required and must be at least 1 character',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
        });
      }

      const result = await coinService.searchCoins(query);

      if (result.meta) {
        result.meta.requestId = request.id;
      }

      return reply.send(result);
    } catch (error) {
      throw error;
    }
  });
}
