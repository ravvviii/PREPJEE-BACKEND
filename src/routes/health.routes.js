import { getHealth } from '../controllers/health.controller.js';

const healthResponseSchema = {
  200: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          uptime: { type: 'number' },
        },
      },
      error: { type: 'null' },
    },
  },
};

// Registered unversioned and at root, not under /api/v1 — load balancers and
// Render's health check hit this path directly and shouldn't need to know
// about API versioning.
export default async function healthRoutes(fastify) {
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Service health check',
        tags: ['health'],
        response: healthResponseSchema,
      },
    },
    getHealth,
  );
}
