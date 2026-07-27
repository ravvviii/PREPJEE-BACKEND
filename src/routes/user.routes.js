import { getMe, updateProfile, uploadAvatar } from '../controllers/user.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export default async function userRoutes(fastify) {
  fastify.get(
    '/users/me',
    {
      preHandler: requireAuth,
      schema: {
        description: "Get the logged-in user's own profile",
        tags: ['users'],
      },
    },
    getMe,
  );

  fastify.put(
    '/users/profile',
    {
      preHandler: requireAuth,
      schema: {
        description: "Update the logged-in user's own profile (not phone — that's the login identity)",
        tags: ['users'],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            email: { type: 'string', format: 'email' },
            avatarUrl: { type: 'string', format: 'uri' },
            classId: { type: 'string', format: 'uuid' },
            targetExamId: { type: 'string', format: 'uuid' },
          },
          additionalProperties: false,
        },
      },
    },
    updateProfile,
  );

  fastify.post(
    '/users/avatar',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Upload and set the logged-in user avatar (jpeg/png/webp, max 10MB)',
        tags: ['users'],
        consumes: ['multipart/form-data'],
      },
    },
    uploadAvatar,
  );
}
