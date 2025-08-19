import fastifyPlugin from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance } from 'fastify';

/**
 * JWT plugin configuration for authentication
 */
async function jwtPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyJwt, {
    secret: fastify.config.JWT_SECRET,
    sign: {
      algorithm: 'HS256',
      expiresIn: '7d', // Token expires in 7 days
    },
    verify: {
      algorithms: ['HS256'],
    },
    messages: {
      badRequestErrorMessage: 'Format is Authorization: Bearer [token]',
      noAuthorizationInHeaderMessage: 'Authorization header is missing',
      authorizationTokenExpiredMessage: 'Authorization token expired',
      authorizationTokenInvalid: 'Authorization token is invalid',
    },
  });

  // Add authentication decorator
  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      const response = {
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
        },
      };
      
      return reply.code(401).send(response);
    }
  });
}

export default fastifyPlugin(jwtPlugin, {
  name: 'jwt-plugin',
});