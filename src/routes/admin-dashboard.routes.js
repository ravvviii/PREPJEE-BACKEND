import {
  stats,
  mostAttemptedQuestions,
  weakestChapters,
} from '../controllers/admin-dashboard.controller.js';
import { requireAdminAuth } from '../middlewares/admin-auth.middleware.js';

export default async function adminDashboardRoutes(fastify) {
  fastify.get(
    '/admin/dashboard/stats',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Top-line dashboard aggregates: users, questions, attempts, revenue',
        tags: ['admin-dashboard'],
      },
    },
    stats,
  );

  fastify.get(
    '/admin/dashboard/questions/most-attempted',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Questions ranked by total attempt count, most-attempted first',
        tags: ['admin-dashboard'],
        querystring: {
          type: 'object',
          properties: { limit: { type: 'integer', minimum: 1, maximum: 50 } },
          additionalProperties: false,
        },
      },
    },
    mostAttemptedQuestions,
  );

  fastify.get(
    '/admin/dashboard/chapters/weak',
    {
      preHandler: requireAdminAuth,
      schema: {
        description:
          'Chapters ranked by accuracy, weakest first — minAttempts filters out low-signal chapters (default 5)',
        tags: ['admin-dashboard'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 50 },
            minAttempts: { type: 'integer', minimum: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    weakestChapters,
  );
}
