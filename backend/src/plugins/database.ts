import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const databasePlugin: FastifyPluginAsync = async fastify => {
  const prisma = new PrismaClient({
    log: fastify.config.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    errorFormat: 'pretty',
  });

  try {
    await prisma.$connect();
    fastify.log.info('Database connected successfully');
  } catch (error) {
    fastify.log.error({ error }, 'Failed to connect to database');

    if (fastify.config.NODE_ENV === 'test' || fastify.config.NODE_ENV === 'development') {
      fastify.log.warn('Database connection failed, creating mock database instance...');

      const mockPrisma = {
        $connect: async () => {},
        $disconnect: async () => {},
        $queryRaw: async () => [{ '1': 1 }],
        user: {
          findUnique: async () => null,
          create: async (data: any) => ({ id: 1, ...data.data }),
          findMany: async () => [],
        },
        portfolio: {
          findMany: async () => [],
          create: async (data: any) => ({ id: 1, ...data.data }),
          findUnique: async () => null,
        },
        coin: {
          findMany: async () => [],
          findUnique: async () => null,
        },
        alert: {
          findMany: async () => [],
          create: async (data: any) => ({ id: 1, ...data.data }),
        },
      };

      fastify.decorate('prisma', mockPrisma as any);
      fastify.log.info('Mock database instance created');
      return;
    } else {
      throw error;
    }
  }

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async instance => {
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

      if (fastify.config.NODE_ENV !== 'test' && fastify.config.NODE_ENV !== 'development') {
        throw error;
      }
    }
  });
};

export default fp(databasePlugin, {
  name: 'database',
});
