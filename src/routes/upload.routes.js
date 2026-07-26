import { uploadImage, deleteImage } from '../controllers/upload.controller.js';
import { requireAdminAuth } from '../middlewares/admin-auth.middleware.js';

// Admin-protected for now (content images) — Phase 6 can register a
// user-facing profile-picture route that reuses the same storage.service.js.
export default async function uploadRoutes(fastify) {
  fastify.post(
    '/uploads/image',
    {
      preHandler: requireAdminAuth,
      schema: {
        description:
          'Upload an image to Cloudflare R2. multipart/form-data with a "file" field, ' +
          'plus an optional "folder" field (questions/solutions/profiles/misc).',
        tags: ['uploads'],
        consumes: ['multipart/form-data'],
      },
    },
    uploadImage,
  );

  fastify.delete(
    '/uploads/image',
    {
      preHandler: requireAdminAuth,
      schema: {
        description: 'Delete an image from Cloudflare R2 by its key',
        tags: ['uploads'],
        body: {
          type: 'object',
          required: ['key'],
          properties: { key: { type: 'string' } },
          additionalProperties: false,
        },
      },
    },
    deleteImage,
  );
}
