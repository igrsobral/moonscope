import { buildApp } from './app.js';

const start = async (): Promise<void> => {
  let fastify;

  try {
    fastify = await buildApp();

    const port = fastify.config.PORT;
    const host = fastify.config.HOST;

    await fastify.listen({ port, host });

    fastify.log.info({
      server: {
        host,
        port,
        environment: fastify.config.NODE_ENV,
      },
    }, `🚀 Server listening on http://${host}:${port}`);

  } catch (err) {
    if (fastify) {
      fastify.log.error(err, 'Failed to start server');
    } else {
      console.error('Failed to build application:', err);
    }
    process.exit(1);
  }
};


const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

  setTimeout(() => {
    console.log('⏰ Forcing shutdown after timeout');
    process.exit(1);
  }, 10000); // 10 second timeout

  try {
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

start();
