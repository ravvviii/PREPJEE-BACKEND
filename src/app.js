import Fastify from 'fastify';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import securityPlugins from './plugins/security.js';
import docsPlugin from './plugins/docs.js';
import registerRoutes from './routes/index.js';

export const buildApp = () => {
  const app = Fastify({
    logger: {
      level: env.isDev ? 'debug' : 'info',
      transport: env.isDev ? { target: 'pino-pretty' } : undefined,
    },
  });

  app.register(securityPlugins);
  app.register(docsPlugin);
  app.register(registerRoutes);

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  return app;
};
