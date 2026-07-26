import { createHash } from 'node:crypto';

// Fast hash for OTP codes and refresh tokens — NOT for passwords (see
// password.js, which uses bcrypt). A 6-digit OTP has only a million possible
// values, so no hash function makes it brute-force resistant; the real
// protection is otp_codes.attempt_count + expires_at, both enforced
// server-side. This hash just means a DB leak doesn't hand out plaintext
// OTPs/tokens directly.
export const hashToken = (value) => createHash('sha256').update(value).digest('hex');
