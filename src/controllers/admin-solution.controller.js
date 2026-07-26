import * as solutionService from '../services/solution.service.js';
import { success } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';

export const get = async (request, reply) => {
  const solution = await solutionService.getSolutionForAdmin(request.params.questionId);
  reply.send(success(solution));
};

export const create = async (request, reply) => {
  const solution = await solutionService.createSolution(request.params.questionId, request.body);
  reply.status(HTTP_STATUS.CREATED).send(success(solution));
};

export const update = async (request, reply) => {
  const solution = await solutionService.updateSolution(request.params.questionId, request.body);
  reply.send(success(solution));
};

export const remove = async (request, reply) => {
  await solutionService.deleteSolution(request.params.questionId);
  reply.send(success(null));
};
