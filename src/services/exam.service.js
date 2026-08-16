import * as examRepository from '../repositories/exam.repository.js';

const serializeExam = (exam) => ({
  id: exam.id,
  name: exam.name,
});

export const listExams = async () => {
  const rows = await examRepository.list();
  return rows.map(serializeExam);
};
