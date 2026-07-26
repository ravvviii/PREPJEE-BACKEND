import * as attemptRepository from '../repositories/attempt.repository.js';
import * as questionRepository from '../repositories/question.repository.js';
import * as optionRepository from '../repositories/option.repository.js';
import * as chapterRepository from '../repositories/chapter.repository.js';
import * as solutionRepository from '../repositories/solution.repository.js';
import * as progressRepository from '../repositories/progress.repository.js';
import { AppError } from '../utils/app-error.js';
import { trackEvent } from '../modules/analytics/index.js';
import { HTTP_STATUS, AMPLITUDE_EVENTS } from '../constants/index.js';

const computeAccuracy = (row) => ({
  totalAttempts: row.total_attempts,
  correctAttempts: row.correct_attempts,
  accuracyPercent:
    row.total_attempts > 0 ? Math.round((row.correct_attempts / row.total_attempts) * 100) : 0,
});

export const submitAnswer = async (userId, questionId, { selectedOptionId, timeTakenSeconds }) => {
  const question = await questionRepository.findById(questionId);
  if (!question || !question.is_published) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND, 'QUESTION_NOT_FOUND');
  }

  const allOptions = await optionRepository.findByQuestionId(questionId);

  // Read before inserting the new attempt below — tells us whether this
  // submission is what could newly complete the chapter (see the check
  // after the insert).
  const hadAttemptedBefore = await attemptRepository.existsForUserAndQuestion(
    userId,
    questionId,
  );

  let isCorrect = false;
  if (selectedOptionId) {
    const selectedOption = allOptions.find((option) => option.id === selectedOptionId);
    if (!selectedOption) {
      throw new AppError(
        'This option does not belong to the question',
        HTTP_STATUS.BAD_REQUEST,
        'OPTION_QUESTION_MISMATCH',
      );
    }
    isCorrect = selectedOption.is_correct;
  }

  const attempt = await attemptRepository.create({
    userId,
    questionId,
    selectedOptionId,
    isCorrect,
    timeTakenSeconds,
  });

  const correctOptionIds = allOptions.filter((option) => option.is_correct).map((o) => o.id);

  // Only becomes visible to the student now — they've committed to an
  // answer, so it's no longer an answer-leak (see Phase 12's decision).
  const solution = await solutionRepository.findByQuestionId(questionId);

  await trackEvent(AMPLITUDE_EVENTS.SUBMITTED_ANSWER, userId, {
    question_id: questionId,
    is_correct: isCorrect,
  });

  if (solution) {
    await trackEvent(AMPLITUDE_EVENTS.VIEWED_SOLUTION, userId, { question_id: questionId });
  }

  // Only worth checking if this was a genuinely new question for the user —
  // otherwise the chapter's attempted-question count hasn't changed, so it
  // can't be the attempt that newly completes it (that would have already
  // fired on whichever earlier attempt did change the count).
  if (!hadAttemptedBefore) {
    const nowComplete = await progressRepository.isChapterComplete(userId, question.chapter_id);
    if (nowComplete) {
      await trackEvent(AMPLITUDE_EVENTS.COMPLETED_CHAPTER, userId, {
        chapter_id: question.chapter_id,
      });
    }
  }

  return {
    attemptId: attempt.id,
    isCorrect,
    correctOptionIds,
    explanation: solution
      ? {
          explanationText: solution.explanation_text,
          solutionImageUrl: solution.solution_image_url,
        }
      : null,
  };
};

export const getQuestionAccuracy = async (questionId) => {
  if (!(await questionRepository.findById(questionId))) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND, 'QUESTION_NOT_FOUND');
  }
  const row = await attemptRepository.getQuestionAccuracy(questionId);
  return computeAccuracy(row);
};

export const getUserChapterAccuracy = async (userId, chapterId) => {
  if (!(await chapterRepository.findById(chapterId))) {
    throw new AppError('Chapter not found', HTTP_STATUS.NOT_FOUND, 'CHAPTER_NOT_FOUND');
  }
  const row = await attemptRepository.getUserChapterAccuracy(userId, chapterId);
  return computeAccuracy(row);
};
