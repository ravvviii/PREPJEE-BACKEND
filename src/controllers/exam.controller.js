import * as examService from '../services/exam.service.js';
import { success } from '../utils/response.js';

export const list = async (request, reply) => {
  const exams = await examService.listExams();
  reply.send(success(exams));
};
