import Fastify from 'fastify';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import securityPlugins from './plugins/security.js';
import docsPlugin from './plugins/docs.js';
import multipartPlugin from './plugins/multipart.js';
import rawBodyPlugin from './plugins/raw-body.js';
import registerRoutes from './routes/index.js';

export const buildApp = () => {
  const app = Fastify({
    logger: {
      level: env.isDev ? 'debug' : 'info',
      transport: env.isDev ? { target: 'pino-pretty' } : undefined,
    },
  });

  // multipart MUST be registered before securityPlugins: @fastify/compress
  // (inside securityPlugins) wraps the request stream for decompression, and
  // if it registers first, it breaks @fastify/multipart's own stream
  // handling — every multipart upload fails with a 415 Unsupported Media
  // Type. Verified by isolating the plugin stack; don't reorder this.
  app.register(multipartPlugin);
  app.register(rawBodyPlugin);
  app.register(securityPlugins);
  // Swagger UI serves static files via @fastify/static, which has an open,
  // unpatched-upstream path-traversal CVE as of this build (no fixed version
  // @fastify/swagger-ui's dependency range allows yet) — and the full API
  // surface (including every admin route) isn't something to expose publicly
  // anyway. Docs stay available in dev/test, off in production.
  if (!env.isProd) {
    app.register(docsPlugin);
  }
  app.register(registerRoutes);

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  return app;
};
