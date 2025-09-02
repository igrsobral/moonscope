import fastifyPlugin from 'fastify-plugin';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

/**
 * Swagger documentation plugin
 * Configures API documentation with authentication support
 */
async function swaggerPlugin(fastify: FastifyInstance) {
  // Register Swagger for API spec generation
  await fastify.register(fastifySwagger, {
    swagger: {
      info: {
        title: 'Meme Coin Analyzer API',
        description: 'A comprehensive Web3 application API for real-time meme coin analysis, sentiment tracking, and trading insights.',
        version: '1.0.0',
      },
      host: 'localhost:3001',
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        bearerAuth: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'JWT token obtained from /api/v1/auth/login endpoint. Format: Bearer <token>',
        },
      },
    },
  });

  // Register Swagger UI
  await fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      tryItOutEnabled: true,
    },
    staticCSP: true,
  });

  // Add a route to get the Swagger JSON spec
  fastify.get('/api-spec', async () => {
    return fastify.swagger();
  });

  fastify.log.info('Swagger documentation configured at /docs');
}

export default fastifyPlugin(swaggerPlugin, {
  name: 'swagger',
  dependencies: [],
});