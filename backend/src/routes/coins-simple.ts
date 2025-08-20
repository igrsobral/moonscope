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
  fastify.get('/coins', async (request: FastifyRequest, reply: FastifyReply) => {
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
  });

  // Get coin by ID
  fastify.get('/coins/:id', async (request: FastifyRequest, reply: FastifyReply) => {
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
  });

  // Get coin by contract address
  fastify.get('/coins/address/:address', async (request: FastifyRequest, reply: FastifyReply) => {
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
  });

  // Create new coin
  fastify.post('/coins', async (request: FastifyRequest, reply: FastifyReply) => {
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
  });

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