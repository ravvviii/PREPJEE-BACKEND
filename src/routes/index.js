import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import adminAuthRoutes from './admin-auth.routes.js';
import uploadRoutes from './upload.routes.js';

// Each phase adds its own `xRoutes` import + `v1.register(...)` line here.
// Nothing outside this file needs to know the version prefix exists.
async function v1Routes(v1) {
  v1.register(authRoutes);
  v1.register(adminAuthRoutes);
  v1.register(uploadRoutes);
  // Phase 6: v1.register(userRoutes)
  // ...
}

export default async function registerRoutes(fastify) {
  fastify.register(healthRoutes);
  fastify.register(v1Routes, { prefix: '/api/v1' });
}
