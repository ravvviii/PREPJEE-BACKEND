import * as solutionRepository from '../repositories/solution.repository.js';
import * as questionRepository from '../repositories/question.repository.js';
import { AppError } from '../utils/app-error.js';
import { HTTP_STATUS } from '../constants/index.js';

const serializeSolution = (solution) => ({
  id: solution.id,
  questionId: solution.question_id,
  explanationText: solution.explanation_text,
  solutionImageUrl: solution.solution_image_url,
  createdAt: solution.created_at,
  updatedAt: solution.updated_at,
});

const assertQuestionExists = async (questionId) => {
  if (!(await questionRepository.findById(questionId))) {
    throw new AppError('Question not found', HTTP_STATUS.NOT_FOUND, 'QUESTION_NOT_FOUND');
  }
};

export const getSolutionForAdmin = async (questionId) => {
  await assertQuestionExists(questionId);
  const solution = await solutionRepository.findByQuestionId(questionId);
  if (!solution) {
    throw new AppError('Solution not found', HTTP_STATUS.NOT_FOUND, 'SOLUTION_NOT_FOUND');
  }
  return serializeSolution(solution);
};

export const createSolution = async (questionId, { explanationText, solutionImageUrl }) => {
  await assertQuestionExists(questionId);

  if (await solutionRepository.findByQuestionId(questionId)) {
    throw new AppError(
      'A solution already exists for this question',
      HTTP_STATUS.CONFLICT,
      'SOLUTION_ALREADY_EXISTS',
    );
  }

  const solution = await solutionRepository.create({
    questionId,
    explanationText,
    solutionImageUrl,
  });
  return serializeSolution(solution);
};

export const updateSolution = async (questionId, fields) => {
  const solution = await solutionRepository.update(questionId, fields);
  if (!solution) {
    throw new AppError('Solution not found', HTTP_STATUS.NOT_FOUND, 'SOLUTION_NOT_FOUND');
  }
  return serializeSolution(solution);
};

export const deleteSolution = async (questionId) => {
  const solution = await solutionRepository.remove(questionId);
  if (!solution) {
    throw new AppError('Solution not found', HTTP_STATUS.NOT_FOUND, 'SOLUTION_NOT_FOUND');
  }
};
