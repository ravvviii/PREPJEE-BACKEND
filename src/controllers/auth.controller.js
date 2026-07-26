import * as authService from '../services/auth.service.js';
import { success } from '../utils/response.js';

export const sendOtp = async (request, reply) => {
  const { phone } = request.body;
  const result = await authService.sendOtp(phone);
  reply.send(success(result));
};

export const verifyOtp = async (request, reply) => {
  const { phone, otp } = request.body;
  const { user, accessToken, refreshToken } = await authService.verifyOtp(phone, otp);
  reply.send(
    success({
      accessToken,
      refreshToken,
      user: { id: user.id, phone: user.phone, name: user.name, email: user.email },
    }),
  );
};

export const refresh = async (request, reply) => {
  const { refreshToken } = request.body;
  const result = await authService.refreshUserSession(refreshToken);
  reply.send(success(result));
};

export const logout = async (request, reply) => {
  const { refreshToken } = request.body;
  await authService.logout(refreshToken);
  reply.send(success(null));
};
