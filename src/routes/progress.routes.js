import { get } from '../controllers/progress.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export default async function progressRoutes(fastify) {
  fastify.get(
    '/progress',
    {
      preHandler: requireAuth,
      schema: {
        description:
          "The logged-in user's progress dashboard: solved/attempted counts, completed chapters, progress %, recent study history",
        tags: ['progress'],
      },
    },
    get,
  );
}
