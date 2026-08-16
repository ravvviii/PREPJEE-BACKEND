import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/utils/password.js';

// A content-attribution account for anything seeded programmatically
// (questions/options/solutions/question_sets all require a real admins.id
// via created_by). Not meant to be logged into — the password is random and
// discarded immediately.
export const SYSTEM_ADMIN_EMAIL = 'system-content@prepjee.internal';

export const seed = async (client) => {
  const passwordHash = await hashPassword(randomUUID());
  await client.query(
    `INSERT INTO admins (name, email, password_hash, role)
     VALUES ('System Content', $1, $2, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [SYSTEM_ADMIN_EMAIL, passwordHash],
  );
};
