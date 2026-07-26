import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import adminAuthRoutes from './admin-auth.routes.js';
import uploadRoutes from './upload.routes.js';
import userRoutes from './user.routes.js';
import subjectRoutes from './subject.routes.js';
import adminSubjectRoutes from './admin-subject.routes.js';
import classRoutes from './class.routes.js';
import adminClassRoutes from './admin-class.routes.js';
import chapterRoutes from './chapter.routes.js';
import adminChapterRoutes from './admin-chapter.routes.js';
import questionRoutes from './question.routes.js';
import adminQuestionRoutes from './admin-question.routes.js';
import adminOptionRoutes from './admin-option.routes.js';
import adminSolutionRoutes from './admin-solution.routes.js';
import attemptRoutes from './attempt.routes.js';
import progressRoutes from './progress.routes.js';

// Each phase adds its own `xRoutes` import + `v1.register(...)` line here.
// Nothing outside this file needs to know the version prefix exists.
async function v1Routes(v1) {
  v1.register(authRoutes);
  v1.register(adminAuthRoutes);
  v1.register(uploadRoutes);
  v1.register(userRoutes);
  v1.register(subjectRoutes);
  v1.register(adminSubjectRoutes);
  v1.register(classRoutes);
  v1.register(adminClassRoutes);
  v1.register(chapterRoutes);
  v1.register(adminChapterRoutes);
  v1.register(questionRoutes);
  v1.register(adminQuestionRoutes);
  v1.register(adminOptionRoutes);
  v1.register(adminSolutionRoutes);
  v1.register(attemptRoutes);
  v1.register(progressRoutes);
  // Phase 15: v1.register(bookmarkRoutes)
  // ...
}

export default async function registerRoutes(fastify) {
  fastify.register(healthRoutes);
  fastify.register(v1Routes, { prefix: '/api/v1' });
}
