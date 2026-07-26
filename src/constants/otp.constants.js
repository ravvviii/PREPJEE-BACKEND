export const OTP = {
  LENGTH: 6,
  EXPIRY_SECONDS: 300,
  MAX_VERIFY_ATTEMPTS: 5,
  RESEND_COOLDOWN_SECONDS: 60,
  MAX_SENDS_PER_HOUR: 5,
};

// Redis key prefixes for OTP rate limiting — centralized so auth.service.js
// never hand-builds these strings inline.
export const OTP_REDIS_KEYS = {
  cooldown: (phone) => `otp:cooldown:${phone}`,
  sendCount: (phone) => `otp:sendcount:${phone}`,
};
