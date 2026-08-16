import { createSuperAdmin } from '../controllers/internal-admin.controller.js';

export default async function internalAdminRoutes(fastify) {
  fastify.post(
    '/internal/admins/super-admin',
    {
      schema: {
        description: 'Create a super administrator',
        tags: ['internal-admins'],
        body: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            email: { type: 'string', format: 'email', maxLength: 254 },
            password: { type: 'string', minLength: 8, maxLength: 128 },
          },
          additionalProperties: false,
        },
      },
    },
    createSuperAdmin,
  );
}
