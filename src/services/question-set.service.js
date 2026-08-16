import * as questionSetRepository from '../repositories/question-set.repository.js';
import * as optionRepository from '../repositories/option.repository.js';
import { AppError } from '../utils/app-error.js';
import { HTTP_STATUS } from '../constants/index.js';

export const serializeSet = (set) => ({
  id: set.id,
  subjectId: set.subject_id,
  classId: set.class_id,
  chapterId: set.chapter_id,
  examId: set.exam_id,
  type: set.type,
  name: set.name,
  durationSeconds: set.duration_seconds,
  questionCount: set.question_count,
  orderIndex: set.order_index,
});

const serializeQuestionForAttempt = (question, options) => ({
  id: question.id,
  chapterId: question.chapter_id,
  difficulty: question.difficulty,
  answerType: question.answer_type,
  questionText: question.question_text,
  questionImageUrl: question.question_image_url,
  // Numerical questions carry no options rows at all — the client renders a
  // numeric input instead of a choice list.
  options: options.map((option) => ({
    id: option.id,
    optionText: option.option_text,
    optionImageUrl: option.option_image_url,
    orderIndex: option.order_index,
  })),
});

export const listSets = async ({ subjectId, classId, chapterId, type, examId }) => {
  const sets = await questionSetRepository.list({ subjectId, classId, chapterId, type, examId });
  return sets.map(serializeSet);
};

export const getSetById = async (id) => {
  const set = await questionSetRepository.findById(id);
  if (!set || !set.is_active) {
    throw new AppError('Question set not found', HTTP_STATUS.NOT_FOUND, 'QUESTION_SET_NOT_FOUND');
  }
  return set;
};

// Question order + full option lists for a set — used both when starting an
// attempt (options without correctness) and internally at grading time.
export const getSetQuestions = async (setId) => {
  const questions = await questionSetRepository.getItemsWithQuestions(setId);
  return Promise.all(
    questions.map(async (question) => ({
      question,
      options: await optionRepository.findByQuestionId(question.id),
    })),
  );
};

export const serializeQuestionsForAttempt = (questionsWithOptions) =>
  questionsWithOptions.map(({ question, options }) => serializeQuestionForAttempt(question, options));
