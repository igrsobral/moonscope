import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { ExternalApiService } from '../services/external-api-service.js';

declare module 'fastify' {
  interface FastifyInstance {
    externalApi: ExternalApiService;
  }
}

export default fp(
  async function (fastify: FastifyInstance) {
    if (!fastify.config.MORALIS_API_KEY) {
      fastify.log.warn(
        'MORALIS_API_KEY not provided, external API service will have limited functionality'
      );
    }

    const externalApiService = new ExternalApiService({
      coinGecko: {
        apiKey: fastify.config.COINGECKO_API_KEY || undefined,
        timeout: 30000,
      },
      moralis: {
        apiKey: fastify.config.MORALIS_API_KEY || 'dummy-key',
      },
      logger: fastify.log,
    });

    fastify.decorate('externalApi', externalApiService);

    fastify.addHook('onClose', async () => {
      fastify.log.info('External API service shutting down');
    });
  },
  {
    name: 'external-api',
    dependencies: ['env'],
  }
);
