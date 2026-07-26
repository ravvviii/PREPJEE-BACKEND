import { randomInt } from 'node:crypto';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import * as userRepository from '../repositories/user.repository.js';
import * as adminRepository from '../repositories/admin.repository.js';
import * as otpRepository from '../repositories/otp.repository.js';
import * as refreshTokenRepository from '../repositories/refresh-token.repository.js';
import { sendOtp as sendOtpViaProvider } from '../modules/otp/otp-provider.js';
import { hashToken } from '../utils/hash.js';
import { comparePassword } from '../utils/password.js';
import {
  signUserAccessToken,
  signRefreshToken,
  signAdminAccessToken,
  verifyToken,
  getTokenExpiryDate,
} from '../utils/jwt.js';
import { AppError } from '../utils/app-error.js';
import { trackEvent } from '../modules/analytics/index.js';
import {
  AMPLITUDE_EVENTS,
  OTP,
  OTP_REDIS_KEYS,
  HTTP_STATUS,
  JWT_TOKEN_TYPE,
  JWT_PRINCIPAL,
} from '../constants/index.js';

export const sendOtp = async (phone) => {
  const cooldownKey = OTP_REDIS_KEYS.cooldown(phone);
  if (await redis.exists(cooldownKey)) {
    throw new AppError(
      'Please wait before requesting another OTP',
      HTTP_STATUS.TOO_MANY_REQUESTS,
      'OTP_COOLDOWN',
    );
  }

  const sendCountKey = OTP_REDIS_KEYS.sendCount(phone);
  const sendCount = await redis.incr(sendCountKey);
  if (sendCount === 1) {
    await redis.expire(sendCountKey, 3600);
  }
  if (sendCount > OTP.MAX_SENDS_PER_HOUR) {
    throw new AppError(
      'Too many OTP requests. Try again later.',
      HTTP_STATUS.TOO_MANY_REQUESTS,
      'OTP_RATE_LIMITED',
    );
  }

  const code = randomInt(100000, 1_000_000).toString();
  const expiresAt = new Date(Date.now() + OTP.EXPIRY_SECONDS * 1000);

  await otpRepository.create({ phone, codeHash: hashToken(code), expiresAt });
  await redis.set(cooldownKey, '1', 'EX', OTP.RESEND_COOLDOWN_SECONDS);
  await sendOtpViaProvider(phone, code);

  return { expiresInSeconds: OTP.EXPIRY_SECONDS };
};

export const verifyOtp = async (phone, code) => {
  const otpRow = await otpRepository.findLatestActiveForPhone(phone);

  if (!otpRow) {
    await trackEvent(AMPLITUDE_EVENTS.ERROR_API_LOGIN, phone, { reason: 'no_active_otp' });
    throw new AppError('No active OTP for this phone number', HTTP_STATUS.BAD_REQUEST, 'OTP_NOT_FOUND');
  }

  if (new Date(otpRow.expires_at) < new Date()) {
    await trackEvent(AMPLITUDE_EVENTS.ERROR_API_LOGIN, phone, { reason: 'expired' });
    throw new AppError('OTP has expired', HTTP_STATUS.BAD_REQUEST, 'OTP_EXPIRED');
  }

  if (otpRow.attempt_count >= OTP.MAX_VERIFY_ATTEMPTS) {
    await trackEvent(AMPLITUDE_EVENTS.ERROR_API_LOGIN, phone, { reason: 'too_many_attempts' });
    throw new AppError(
      'Too many incorrect attempts. Request a new OTP.',
      HTTP_STATUS.BAD_REQUEST,
      'OTP_MAX_ATTEMPTS',
    );
  }

  if (hashToken(code) !== otpRow.code_hash) {
    await otpRepository.incrementAttempts(otpRow.id);
    await trackEvent(AMPLITUDE_EVENTS.ERROR_API_LOGIN, phone, { reason: 'incorrect_code' });
    throw new AppError('Incorrect OTP', HTTP_STATUS.BAD_REQUEST, 'OTP_INCORRECT');
  }

  await otpRepository.markUsed(otpRow.id);

  let user = await userRepository.findByPhone(phone);
  if (!user) {
    user = await userRepository.create({ phone });
  }

  const accessToken = signUserAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  await refreshTokenRepository.create({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: getTokenExpiryDate(refreshToken),
  });

  await trackEvent(AMPLITUDE_EVENTS.LOGIN, user.id);
  await trackEvent(AMPLITUDE_EVENTS.SUCCESS_API_LOGIN, user.id);

  return { user, accessToken, refreshToken };
};

export const refreshUserSession = async (oldRefreshToken) => {
  let payload;
  try {
    payload = verifyToken(oldRefreshToken, env.jwt.refreshSecret);
  } catch {
    throw new AppError('Invalid or expired refresh token', HTTP_STATUS.UNAUTHORIZED, 'INVALID_REFRESH_TOKEN');
  }

  if (payload.tokenType !== JWT_TOKEN_TYPE.REFRESH || payload.principal !== JWT_PRINCIPAL.USER) {
    throw new AppError('Invalid refresh token', HTTP_STATUS.UNAUTHORIZED, 'INVALID_REFRESH_TOKEN');
  }

  const storedToken = await refreshTokenRepository.findByTokenHash(hashToken(oldRefreshToken));

  if (!storedToken || storedToken.revoked_at || new Date(storedToken.expires_at) < new Date()) {
    throw new AppError(
      'Refresh token is no longer valid',
      HTTP_STATUS.UNAUTHORIZED,
      'INVALID_REFRESH_TOKEN',
    );
  }

  // Rotation: the old token is dead the moment it's used, whether or not the
  // caller was the legitimate holder — reuse of a rotated-out token is a
  // signal worth having, even though we don't act on it beyond this yet.
  await refreshTokenRepository.revoke(storedToken.id);

  const accessToken = signUserAccessToken(payload.sub);
  const newRefreshToken = signRefreshToken(payload.sub);
  await refreshTokenRepository.create({
    userId: payload.sub,
    tokenHash: hashToken(newRefreshToken),
    expiresAt: getTokenExpiryDate(newRefreshToken),
  });

  return { accessToken, refreshToken: newRefreshToken };
};

export const logout = async (refreshToken) => {
  const storedToken = await refreshTokenRepository.findByTokenHash(hashToken(refreshToken));
  if (storedToken && !storedToken.revoked_at) {
    await refreshTokenRepository.revoke(storedToken.id);
  }
  // Idempotent by design — logging out an already-revoked or unknown token
  // still looks like a successful logout to the caller.
};

export const adminLogin = async (email, password) => {
  const admin = await adminRepository.findByEmail(email);

  // Same error for "no such admin" and "wrong password" — don't let the
  // response shape reveal whether an email exists.
  if (!admin || !(await comparePassword(password, admin.password_hash))) {
    throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED, 'INVALID_CREDENTIALS');
  }

  const accessToken = signAdminAccessToken(admin.id, admin.role);
  return { admin, accessToken };
};
