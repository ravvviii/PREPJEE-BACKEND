import { create, update, remove } from '../controllers/class.controller.js';
import { requireAdminAuth } from '../middlewares/admin-auth.middleware.js';

const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

export default async function adminClassRoutes(fastify) {
  fastify.post(
    '/admin/classes',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Create a class',
        tags: ['admin-classes'],
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
    '/admin/classes/:id',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Update a class',
        tags: ['admin-classes'],
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
    '/admin/classes/:id',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Soft-delete a class',
        tags: ['admin-classes'],
        params: idParamSchema,
      },
    },
    remove,
  );
}
