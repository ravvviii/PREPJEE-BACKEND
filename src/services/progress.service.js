import * as progressRepository from '../repositories/progress.repository.js';
import * as userRepository from '../repositories/user.repository.js';
import { PROGRESS } from '../constants/index.js';

export const getProgress = async (userId) => {
  const user = await userRepository.findById(userId);

  const [
    solvedQuestionsCount,
    attemptedQuestionsCount,
    completedChapters,
    totalPublished,
    studyHistoryRows,
  ] = await Promise.all([
    progressRepository.getSolvedQuestionsCount(userId),
    progressRepository.getAttemptedQuestionsCount(userId),
    progressRepository.getCompletedChapters(userId),
    progressRepository.getTotalPublishedQuestions({ classId: user.class_id }),
    progressRepository.getStudyHistory(userId, PROGRESS.STUDY_HISTORY_LIMIT),
  ]);

  const progressPercent =
    totalPublished > 0 ? Math.round((solvedQuestionsCount / totalPublished) * 100) : 0;

  return {
    progressPercent,
    solvedQuestionsCount,
    attemptedQuestionsCount,
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
  };
};
