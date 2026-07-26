import * as userService from '../services/user.service.js';
import { success } from '../utils/response.js';

export const getMe = async (request, reply) => {
  const profile = await userService.getProfile(request.user.id);
  reply.send(success(profile));
};

export const updateProfile = async (request, reply) => {
  const profile = await userService.updateProfile(request.user.id, request.body);
  reply.send(success(profile));
};
