import * as setAttemptRepository from '../repositories/set-attempt.repository.js';
import * as questionSetRepository from '../repositories/question-set.repository.js';
import * as questionSetService from './question-set.service.js';
import * as solutionRepository from '../repositories/solution.repository.js';
import * as attemptRepository from '../repositories/attempt.repository.js';
import * as progressRepository from '../repositories/progress.repository.js';
import { AppError } from '../utils/app-error.js';
import { trackEvent } from '../modules/analytics/index.js';
import { HTTP_STATUS, AMPLITUDE_EVENTS } from '../constants/index.js';

const serializeSetAttempt = (setAttempt) => ({
  id: setAttempt.id,
  setId: setAttempt.set_id,
  status: setAttempt.status,
  totalQuestions: setAttempt.total_questions,
  correctCount: setAttempt.correct_count,
  scorePercent: setAttempt.score_percent,
  startedAt: setAttempt.started_at,
  expiresAt: setAttempt.expires_at,
  submittedAt: setAttempt.submitted_at,
});

export const startAttempt = async (userId, setId) => {
  const set = await questionSetService.getSetById(setId);

  const existing = await setAttemptRepository.findInProgress(userId, setId);
  const questionsWithOptions = await questionSetService.getSetQuestions(setId);
  if (questionsWithOptions.length === 0) {
    throw new AppError(
      'This set has no questions yet',
      HTTP_STATUS.CONFLICT,
      'QUESTION_SET_EMPTY',
    );
  }

  let setAttempt = existing;
  if (!setAttempt) {
    const expiresAt = new Date(Date.now() + set.duration_seconds * 1000);
    setAttempt = await setAttemptRepository.create({
      userId,
      setId,
      totalQuestions: questionsWithOptions.length,
      expiresAt,
    });
    await trackEvent(AMPLITUDE_EVENTS.SET_ATTEMPT_STARTED, userId, {
      set_id: setId,
      set_type: set.type,
    });
  }

  return {
    attempt: serializeSetAttempt(setAttempt),
    questions: questionSetService.serializeQuestionsForAttempt(questionsWithOptions),
  };
};

const gradeAnswer = (question, options, answer) => {
  if (question.answer_type === 'numerical') {
    const submitted = answer?.numericalAnswer;
    if (submitted == null) {
      return { isCorrect: false, selectedOptionId: null, selectedOptionIds: null, numericalAnswer: null };
    }
    const target = Number(question.numerical_answer);
    const tolerance = Number(question.numerical_tolerance) || 0;
    const isCorrect = Math.abs(Number(submitted) - target) <= tolerance;
    return { isCorrect, selectedOptionId: null, selectedOptionIds: null, numericalAnswer: submitted };
  }

  const correctOptionIds = options
    .filter((option) => option.is_correct)
    .map((option) => option.id)
    .sort();

  if (question.answer_type === 'multi_correct') {
    const selected = [...(answer?.selectedOptionIds ?? [])].sort();
    const isCorrect =
      selected.length === correctOptionIds.length &&
      selected.every((id, index) => id === correctOptionIds[index]);
    return { isCorrect, selectedOptionId: null, selectedOptionIds: answer?.selectedOptionIds ?? null, numericalAnswer: null };
  }

  // single_correct
  const selectedOptionId = answer?.selectedOptionId ?? null;
  const isCorrect = selectedOptionId != null && correctOptionIds.includes(selectedOptionId);
  return { isCorrect, selectedOptionId, selectedOptionIds: null, numericalAnswer: null };
};

// One batch submit of the whole set (no partial/per-question grading exposed
// mid-attempt) — this is what makes the runner UI a "commit at the end" flow.
export const submitAttempt = async (userId, setAttemptId, answers = []) => {
  const setAttempt = await setAttemptRepository.findById(setAttemptId);
  if (!setAttempt || setAttempt.user_id !== userId) {
    throw new AppError('Set attempt not found', HTTP_STATUS.NOT_FOUND, 'SET_ATTEMPT_NOT_FOUND');
  }
  if (setAttempt.status !== 'in_progress') {
    throw new AppError(
      'This attempt has already been submitted',
      HTTP_STATUS.CONFLICT,
      'SET_ATTEMPT_ALREADY_SUBMITTED',
    );
  }

  const questionsWithOptions = await questionSetService.getSetQuestions(setAttempt.set_id);
  const answersByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));

  // Every question in a set also gets logged to the same per-question `attempts`
  // table the standalone practice flow writes to, so this set/mock run feeds the
  // exact same solved-count / accuracy / weak-chapter / streak pipeline the rest
  // of the dashboard already reads from — a mock isn't a second, disconnected
  // stats system.
  const touchedChapterIds = [...new Set(questionsWithOptions.map(({ question }) => question.chapter_id))];
  const chapterWasCompleteBefore = new Map(
    await Promise.all(
      touchedChapterIds.map(async (chapterId) => [
        chapterId,
        await progressRepository.isChapterComplete(userId, chapterId),
      ]),
    ),
  );

  let correctCount = 0;
  const perQuestionResults = [];

  for (const { question, options } of questionsWithOptions) {
    const answer = answersByQuestionId.get(question.id);
    const graded = gradeAnswer(question, options, answer);
    if (graded.isCorrect) correctCount += 1;

    await setAttemptRepository.insertAnswer({
      setAttemptId,
      questionId: question.id,
      ...graded,
    });

    await attemptRepository.create({
      userId,
      questionId: question.id,
      selectedOptionId: graded.selectedOptionId,
      selectedOptionIds: graded.selectedOptionIds,
      numericalAnswer: graded.numericalAnswer,
      isCorrect: graded.isCorrect,
    });

    const solution = await solutionRepository.findByQuestionId(question.id);
    perQuestionResults.push({
      questionId: question.id,
      isCorrect: graded.isCorrect,
      correctOptionIds: options.filter((option) => option.is_correct).map((option) => option.id),
      correctNumericalAnswer: question.answer_type === 'numerical' ? question.numerical_answer : null,
      yourSelectedOptionId: graded.selectedOptionId,
      yourSelectedOptionIds: graded.selectedOptionIds,
      yourNumericalAnswer: graded.numericalAnswer,
      explanation: solution
        ? { explanationText: solution.explanation_text, solutionImageUrl: solution.solution_image_url }
        : null,
    });
  }

  for (const chapterId of touchedChapterIds) {
    if (chapterWasCompleteBefore.get(chapterId)) continue;
    if (await progressRepository.isChapterComplete(userId, chapterId)) {
      await trackEvent(AMPLITUDE_EVENTS.COMPLETED_CHAPTER, userId, { chapter_id: chapterId });
    }
  }

  const submittedAt = new Date();
  const status = submittedAt > new Date(setAttempt.expires_at) ? 'expired' : 'submitted';
  const scorePercent =
    questionsWithOptions.length > 0 ? Math.round((correctCount / questionsWithOptions.length) * 100) : 0;

  const updated = await setAttemptRepository.submit(setAttemptId, {
    status,
    correctCount,
    scorePercent,
    submittedAt,
  });

  await trackEvent(AMPLITUDE_EVENTS.SET_ATTEMPT_SUBMITTED, userId, {
    set_id: setAttempt.set_id,
    score_percent: scorePercent,
    status,
  });

  return {
    attempt: serializeSetAttempt(updated),
    results: perQuestionResults,
  };
};

export const getAttemptResult = async (userId, setAttemptId) => {
  const setAttempt = await setAttemptRepository.findById(setAttemptId);
  if (!setAttempt || setAttempt.user_id !== userId) {
    throw new AppError('Set attempt not found', HTTP_STATUS.NOT_FOUND, 'SET_ATTEMPT_NOT_FOUND');
  }
  return serializeSetAttempt(setAttempt);
};

export const getMockStats = async (userId) => {
  const [attempted, mockSets] = await Promise.all([
    setAttemptRepository.getMockStatsByUserId(userId),
    questionSetRepository.list({ type: 'mock' }),
  ]);
  return { mocksAttempted: attempted, totalMocks: mockSets.length };
};
