import { add, remove, list } from '../controllers/bookmark.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

export default async function bookmarkRoutes(fastify) {
  fastify.post(
    '/questions/:id/bookmark',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Bookmark a question (idempotent — safe to call more than once)',
        tags: ['bookmarks'],
        params: idParamSchema,
      },
    },
    add,
  );

  fastify.delete(
    '/questions/:id/bookmark',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Remove a bookmark (idempotent — safe even if not bookmarked)',
        tags: ['bookmarks'],
        params: idParamSchema,
      },
    },
    remove,
  );

  fastify.get(
    '/bookmarks',
    {
      preHandler: requireAuth,
      schema: {
        description:
          "List the logged-in user's bookmarked questions (cursor-paginated; excludes questions later unpublished/deleted)",
        tags: ['bookmarks'],
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
