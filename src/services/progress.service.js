import * as progressRepository from '../repositories/progress.repository.js';
import * as userRepository from '../repositories/user.repository.js';
import * as attemptRepository from '../repositories/attempt.repository.js';
import { PROGRESS } from '../constants/index.js';

export const getProgress = async (userId) => {
  const user = await userRepository.findById(userId);

  const [
    solvedQuestionsCount,
    attemptedQuestionsCount,
    completedChapters,
    totalPublished,
    studyHistoryRows,
    attemptStats,
    dailyActivityRows,
    weakChapterRows,
    difficultyRows,
  ] = await Promise.all([
    progressRepository.getSolvedQuestionsCount(userId),
    progressRepository.getAttemptedQuestionsCount(userId),
    progressRepository.getCompletedChapters(userId),
    progressRepository.getTotalPublishedQuestions({ classId: user.class_id }),
    progressRepository.getStudyHistory(userId, PROGRESS.STUDY_HISTORY_LIMIT),
    attemptRepository.getStatsByUserId(userId),
    progressRepository.getDailyActivity(userId),
    progressRepository.getWeakChapters(userId),
    progressRepository.getDifficultyPerformance(userId),
  ]);

  const progressPercent =
    totalPublished > 0 ? Math.round((solvedQuestionsCount / totalPublished) * 100) : 0;

  const activityDates = new Set(
    dailyActivityRows.map((row) => new Date(row.activity_date).toISOString().slice(0, 10)),
  );
  let dailyStreak = 0;
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  // A streak remains alive until the end of the current day. If the student
  // has not studied today yet, begin counting from yesterday.
  if (!activityDates.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (activityDates.has(cursor.toISOString().slice(0, 10))) {
    dailyStreak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const overallAccuracy =
    attemptStats.total_attempts > 0
      ? Math.round((attemptStats.correct_attempts / attemptStats.total_attempts) * 100)
      : 0;

  return {
    progressPercent,
    solvedQuestionsCount,
    attemptedQuestionsCount,
    overallAccuracy,
    dailyStreak,
    completedChapters: completedChapters.map((chapter) => ({
      id: chapter.id,
      name: chapter.name,
    })),
    studyHistory: studyHistoryRows.map((row) => ({
      questionId: row.question_id,
      chapterName: row.chapter_name,
      isCorrect: row.is_correct,
      attemptedAt: row.attempted_at,
    })),
    dailyActivity: dailyActivityRows.map((row) => ({
      date: new Date(row.activity_date).toISOString().slice(0, 10),
      attemptCount: row.attempt_count,
      correctCount: row.correct_count,
    })),
    weakChapters: weakChapterRows.map((row) => ({
      id: row.id,
      name: row.name,
      totalAttempts: row.total_attempts,
      correctAttempts: row.correct_attempts,
      accuracyPercent: row.accuracy_percent,
    })),
    difficultyPerformance: difficultyRows.map((row) => ({
      difficulty: row.difficulty,
      totalAttempts: row.total_attempts,
      correctAttempts: row.correct_attempts,
      accuracyPercent:
        row.total_attempts > 0
          ? Math.round((row.correct_attempts / row.total_attempts) * 100)
          : 0,
    })),
  };
};
