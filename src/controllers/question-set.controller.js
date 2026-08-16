import * as questionSetService from '../services/question-set.service.js';
import { success } from '../utils/response.js';

export const list = async (request, reply) => {
  const { subjectId, classId, chapterId, type, examId } = request.query;
  const sets = await questionSetService.listSets({ subjectId, classId, chapterId, type, examId });
  reply.send(success(sets));
};
