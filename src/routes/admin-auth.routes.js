import { login } from '../controllers/admin-auth.controller.js';

export default async function adminAuthRoutes(fastify) {
  fastify.post(
    '/admin/auth/login',
    {
      schema: {
        description: 'Admin login with email + password',
        tags: ['admin-auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
          },
          additionalProperties: false,
        },
      },
    },
    login,
  );
}
