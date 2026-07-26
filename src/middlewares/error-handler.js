import { HTTP_STATUS } from '../constants/index.js';
import { fail } from '../utils/response.js';

export const errorHandler = (error, request, reply) => {
  request.log.error({ err: error }, 'Request error');

  if (error.validation) {
    return reply
      .status(HTTP_STATUS.BAD_REQUEST)
      .send(fail('Validation failed', 'VALIDATION_ERROR', error.validation));
  }

  const statusCode = error.statusCode ?? HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message =
    statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR ? 'Internal server error' : error.message;

  return reply.status(statusCode).send(fail(message, error.code ?? 'ERROR'));
};

export const notFoundHandler = (request, reply) => {
  reply.status(HTTP_STATUS.NOT_FOUND).send(fail(`Route ${request.method} ${request.url} not found`, 'NOT_FOUND'));
};
