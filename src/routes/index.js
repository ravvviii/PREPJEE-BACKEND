import healthRoutes from './health.routes.js';

// Each phase adds its own `xRoutes` import + `v1.register(...)` line here.
// Nothing outside this file needs to know the version prefix exists.
// eslint-disable-next-line no-unused-vars
async function v1Routes(v1) {
  // Phase 4: v1.register(authRoutes)
  // Phase 6: v1.register(userRoutes)
  // ...
}

export default async function registerRoutes(fastify) {
  fastify.register(healthRoutes);
  fastify.register(v1Routes, { prefix: '/api/v1' });
}
