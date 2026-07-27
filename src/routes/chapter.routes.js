import { list } from '../controllers/chapter.controller.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';

// Public — same reasoning as subjects/classes.
export default async function chapterRoutes(fastify) {
  fastify.get(
    '/chapters',
    {
      preHandler: optionalAuth,
      schema: {
        description:
          'List/search chapters (cursor-paginated; filter by subjectId/classId, or search by name)',
        tags: ['chapters'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            cursor: { type: 'string' },
            subjectId: { type: 'string', format: 'uuid' },
            classId: { type: 'string', format: 'uuid' },
            search: { type: 'string', minLength: 1, maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
    },
    list,
  );
}
