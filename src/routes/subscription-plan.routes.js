import { list } from '../controllers/subscription-plan.controller.js';

// Public — a student needs to see pricing before subscribing.
export default async function subscriptionPlanRoutes(fastify) {
  fastify.get(
    '/subscription-plans',
    {
      schema: {
        description: 'List active subscription plans',
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
