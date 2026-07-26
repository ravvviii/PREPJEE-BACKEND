import { buildApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabase } from './config/database.js';
import { closeRedis } from './config/redis.js';

const start = async () => {
  const app = buildApp();

  const shutdown = async (signal) => {
    app.log.info(`Received ${signal}, shutting down gracefully`);
    try {
      await app.close();
      await closeDatabase();
      await closeRedis();
      process.exit(0);
    } catch (error) {
      app.log.error(error, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port: env.port, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
