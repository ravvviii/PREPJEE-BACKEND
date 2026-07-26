import { list } from '../controllers/class.controller.js';

// Public — classes are non-sensitive reference data, useful even before login.
export default async function classRoutes(fastify) {
  fastify.get(
    '/classes',
    {
      schema: {
        description: 'List classes (cursor-paginated)',
        tags: ['classes'],
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
