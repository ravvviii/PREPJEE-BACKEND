import { list, suspend, unsuspend } from '../controllers/admin-user.controller.js';
import { requireAdminAuth } from '../middlewares/admin-auth.middleware.js';

const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

export default async function adminUserRoutes(fastify) {
  fastify.get(
    '/admin/users',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'List/search users by phone, name, or email',
        tags: ['admin-users'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            cursor: { type: 'string' },
            search: { type: 'string', minLength: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    list,
  );

  fastify.post(
    '/admin/users/:id/suspend',
    {
      preHandler: requireAdminAuth,
      schema: {
        description:
          "Suspend a user's account — blocks future login/refresh and revokes their outstanding refresh tokens immediately",
        tags: ['admin-users'],
        params: idParamSchema,
      },
    },
    suspend,
  );

  fastify.post(
    '/admin/users/:id/unsuspend',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: "Lift a suspension on a user's account",
        tags: ['admin-users'],
        params: idParamSchema,
      },
    },
    unsuspend,
  );
}
