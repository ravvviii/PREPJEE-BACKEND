import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { env } from '../config/env.js';

export default async function docsPlugin(fastify) {
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
