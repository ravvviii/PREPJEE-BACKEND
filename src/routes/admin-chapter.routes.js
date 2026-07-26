import { create, update, remove } from '../controllers/chapter.controller.js';
import { requireAdminAuth } from '../middlewares/admin-auth.middleware.js';

const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

export default async function adminChapterRoutes(fastify) {
  fastify.post(
    '/admin/chapters',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Create a chapter under a subject + class',
        tags: ['admin-chapters'],
        body: {
          type: 'object',
          required: ['subjectId', 'classId', 'name'],
          properties: {
            subjectId: { type: 'string', format: 'uuid' },
            classId: { type: 'string', format: 'uuid' },
            name: { type: 'string', minLength: 1, maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
    },
    create,
  );

  fastify.put(
    '/admin/chapters/:id',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Update a chapter',
        tags: ['admin-chapters'],
        params: idParamSchema,
        body: {
          type: 'object',
          properties: {
            subjectId: { type: 'string', format: 'uuid' },
            classId: { type: 'string', format: 'uuid' },
            name: { type: 'string', minLength: 1, maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
    },
    update,
  );

  fastify.delete(
    '/admin/chapters/:id',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Soft-delete a chapter',
        tags: ['admin-chapters'],
        params: idParamSchema,
      },
    },
    remove,
  );
}
