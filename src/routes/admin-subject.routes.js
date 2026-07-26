import { create, update, remove } from '../controllers/subject.controller.js';
import { requireAdminAuth } from '../middlewares/admin-auth.middleware.js';

const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

export default async function adminSubjectRoutes(fastify) {
  fastify.post(
    '/admin/subjects',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Create a subject',
        tags: ['admin-subjects'],
        body: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string', minLength: 1, maxLength: 200 } },
          additionalProperties: false,
        },
      },
    },
    create,
  );

  fastify.put(
    '/admin/subjects/:id',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Update a subject',
        tags: ['admin-subjects'],
        params: idParamSchema,
        body: {
          type: 'object',
          properties: { name: { type: 'string', minLength: 1, maxLength: 200 } },
          additionalProperties: false,
        },
      },
    },
    update,
  );

  fastify.delete(
    '/admin/subjects/:id',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Soft-delete a subject',
        tags: ['admin-subjects'],
        params: idParamSchema,
      },
    },
    remove,
  );
}
