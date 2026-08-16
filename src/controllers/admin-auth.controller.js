import * as authService from '../services/auth.service.js';
import { success } from '../utils/response.js';

export const login = async (request, reply) => {
  const { email, password } = request.body;
  const { admin, accessToken } = await authService.adminLogin(email, password);
  reply.send(
    success({
      accessToken,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    }),
  );
};

export const forgotPassword = async (request, reply) => {
  const result = await authService.requestAdminPasswordReset(request.body.email);
  reply.send(success(result));
};

export const resetPassword = async (request, reply) => {
  const { token, password } = request.body;
  await authService.resetAdminPassword(token, password);
  reply.send(success({ message: 'Password reset successfully.' }));
};
