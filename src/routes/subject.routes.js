import { list } from '../controllers/subject.controller.js';

// Public — subjects are non-sensitive reference data, useful even before login.
export default async function subjectRoutes(fastify) {
  fastify.get(
    '/subjects',
    {
      schema: {
        description: 'List subjects (cursor-paginated)',
        tags: ['subjects'],
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
