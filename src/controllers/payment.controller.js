import * as paymentService from '../services/payment.service.js';
import { success } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';

export const createOrder = async (request, reply) => {
  const result = await paymentService.createOrder(
    request.user.id,
    request.body.planId,
    request.body.idempotencyKey,
  );
  reply.status(HTTP_STATUS.CREATED).send(success(result));
};

export const createQr = async (request, reply) => {
  const result = await paymentService.createQrCode(
    request.user.id,
    request.body.planId,
    request.body.idempotencyKey,
    request.body.description,
    request.body.type,
  );
  reply.status(HTTP_STATUS.CREATED).send(success(result));
};

export const verify = async (request, reply) => {
  const result = await paymentService.verifyPayment(request.user.id, request.body);
  reply.send(success(result));
};

export const webhook = async (request, reply) => {
  const signature = request.headers['x-razorpay-signature'];
  await paymentService.handleWebhook(request.rawBody, signature, request.body);
  reply.send(success(null));
};

export const history = async (request, reply) => {
  const { limit, cursor } = request.query;
  const result = await paymentService.getPaymentHistory(request.user.id, {
    limit: limit ? Number(limit) : undefined,
    cursor,
  });
  reply.send(success(result));
};
