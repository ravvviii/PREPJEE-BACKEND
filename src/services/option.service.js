import * as optionRepository from '../repositories/option.repository.js';
import * as questionRepository from '../repositories/question.repository.js';
import { AppError } from '../utils/app-error.js';
import { HTTP_STATUS } from '../constants/index.js';

const serializeOption = (option, { includeCorrectness } = {}) => ({
  id: option.id,
  questionId: option.question_id,
  optionText: option.option_text,
  optionImageUrl: option.option_image_url,
  orderIndex: option.order_index,
  ...(includeCorrectness ? { isCorrect: option.is_correct } : {}),
});

export const listOptionsForAdmin = async (questionId) => {
  if (!(await questionRepository.findById(questionId))) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND, 'QUESTION_NOT_FOUND');
  }
  const options = await optionRepository.findByQuestionId(questionId);
  return options.map((option) => serializeOption(option, { includeCorrectness: true }));
};

// Used to embed options into the student-facing question detail response
// (Phase 10) — never exposes isCorrect, so a student can't inspect the
// answer before submitting.
export const listOptionsForStudent = async (questionId) => {
  const options = await optionRepository.findByQuestionId(questionId);
  return options.map((option) => serializeOption(option));
};

export const createOption = async (
  questionId,
  { optionText, optionImageUrl, isCorrect, orderIndex },
) => {
  if (!(await questionRepository.findById(questionId))) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND, 'QUESTION_NOT_FOUND');
  }

  const resolvedOrderIndex = orderIndex ?? (await optionRepository.countByQuestionId(questionId));
  const option = await optionRepository.create({
    questionId,
    optionText,
    optionImageUrl,
    isCorrect,
    orderIndex: resolvedOrderIndex,
  });
  return serializeOption(option, { includeCorrectness: true });
};

export const updateOption = async (id, fields) => {
  const option = await optionRepository.update(id, fields);
  if (!option) {
    throw new AppError('Option not found', HTTP_STATUS.NOT_FOUND, 'OPTION_NOT_FOUND');
  }
  return serializeOption(option, { includeCorrectness: true });
};

export const deleteOption = async (id) => {
  const option = await optionRepository.remove(id);
  if (!option) {
    throw new AppError('Option not found', HTTP_STATUS.NOT_FOUND, 'OPTION_NOT_FOUND');
  }
};
