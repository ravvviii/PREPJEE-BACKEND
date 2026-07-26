export const SECURITY = {
  BCRYPT_SALT_ROUNDS: 12,
};

export const RATE_LIMIT = {
  // Applied globally to every route as a baseline abuse/DoS guard.
  GLOBAL_MAX: 300,
  GLOBAL_WINDOW_MS: 60_000,
  // Admin login has no other brute-force defense (unlike OTP verify, which
  // already caps wrong-code attempts per OTP row) — scoped tighter and keyed
  // by the attempted email, not just IP, so distributed attempts against one
  // account are still caught even from different addresses.
  ADMIN_LOGIN_MAX: 5,
  ADMIN_LOGIN_WINDOW_MS: 15 * 60_000,
};
