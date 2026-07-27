import { list } from '../controllers/subscription-plan.controller.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';

// Public — a student needs to see pricing before subscribing.
export default async function subscriptionPlanRoutes(fastify) {
  fastify.get(
    '/subscription-plans',
    {
      preHandler: optionalAuth,
      schema: {
        description:
          "List active subscription plans; when authenticated, only plans matching the user's bucket are returned",
        tags: ['subscription-plans'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            cursor: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
    },
    list,
  );
}
