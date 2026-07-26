import { getHealth, getHealthReady } from '../controllers/health.controller.js';

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

const readyResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: ['object', 'null'], additionalProperties: true },
    error: { type: ['object', 'null'], additionalProperties: true },
  },
};

// Registered unversioned and at root, not under /api/v1 — load balancers and
// Render's health check hit these paths directly and shouldn't need to know
// about API versioning.
export default async function healthRoutes(fastify) {
  // Liveness — process is up, no dependency checks. Safe to poll constantly.
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Liveness check — process is up, no dependency checks',
        tags: ['health'],
        response: healthResponseSchema,
      },
    },
    getHealth,
  );

  // Readiness — pings Postgres + Redis. Use for deploy-gating/debugging, not constant polling.
  fastify.get(
    '/health/ready',
    {
      schema: {
        description: 'Readiness check — verifies Postgres and Redis are reachable',
        tags: ['health'],
        response: { 200: readyResponseSchema, 503: readyResponseSchema },
      },
    },
    getHealthReady,
  );
}
