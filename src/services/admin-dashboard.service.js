import * as dashboardRepository from '../repositories/dashboard.repository.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
// Below this many attempts, a chapter's accuracy is more noise than signal.
const DEFAULT_MIN_ATTEMPTS = 5;

export const getStats = async () => {
  const [totalUsers, totalPublishedQuestions, totalAttempts, activeSubscriptions, revenue] =
    await Promise.all([
      dashboardRepository.countUsers(),
      dashboardRepository.countPublishedQuestions(),
      dashboardRepository.countAttempts(),
      dashboardRepository.countActiveSubscriptions(),
      dashboardRepository.sumRevenue(),
    ]);

  return {
    totalUsers,
    totalPublishedQuestions,
    totalAttempts,
    activeSubscriptions,
    totalRevenue: { amount: revenue, currency: 'INR' },
  };
};

export const getMostAttemptedQuestions = async ({ limit }) => {
  const rows = await dashboardRepository.mostAttemptedQuestions(
    Math.min(limit || DEFAULT_LIMIT, MAX_LIMIT),
  );
  return rows.map((row) => ({
    questionId: row.id,
    questionText: row.question_text,
    attemptCount: row.attempt_count,
  }));
};

export const getWeakestChapters = async ({ limit, minAttempts }) => {
  const rows = await dashboardRepository.weakestChapters(
    Math.min(limit || DEFAULT_LIMIT, MAX_LIMIT),
    minAttempts || DEFAULT_MIN_ATTEMPTS,
  );
  return rows.map((row) => ({
    chapterId: row.id,
    chapterName: row.name,
    attemptCount: row.attempt_count,
    accuracy: Number(row.accuracy.toFixed(4)),
  }));
};
