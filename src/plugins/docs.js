import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { env } from '../config/env.js';

async function docsPlugin(fastify) {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'PrepJEE API',
        version: env.amplitude.appVersion,
      },
      servers: [{ url: `/api/v1` }],
    },
  });

  await fastify.register(swaggerUI, {
    routePrefix: '/docs',
  });
}

// Same reasoning as security.js: without fastify-plugin this would register
// in its own isolated branch, and @fastify/swagger might not reliably see
// routes registered in sibling branches (routes/index.js) when building the
// OpenAPI spec.
export default fp(docsPlugin);
