import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  const prisma = new PrismaClient({
    log: fastify.config.NODE_ENV === 'development' 
      ? ['query', 'info', 'warn', 'error'] 
      : ['error'],
    errorFormat: 'pretty',
  });

  try {
    await prisma.$connect();
    fastify.log.info('Database connected successfully');
  } catch (error) {
    fastify.log.error({ error }, 'Failed to connect to database');
    
    if (fastify.config.NODE_ENV === 'test') {
      fastify.log.warn('Database connection failed in test environment, continuing...');
    } else {
      throw error;
    }
  }

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (instance) => {
    instance.log.info('Disconnecting from database...');
    await instance.prisma.$disconnect();
    instance.log.info('Database disconnected');
  });

  fastify.addHook('onReady', async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      fastify.log.info('Database health check passed');
    } catch (error) {
      fastify.log.error({ error }, 'Database health check failed');
      
      if (fastify.config.NODE_ENV !== 'test') {
        throw error;
      }
    }
  });
};

export default fp(databasePlugin, {
  name: 'database',
});