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
