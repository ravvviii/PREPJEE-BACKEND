// Console adapter until an email provider is configured. Production should
// replace this export with an email implementation; the API never returns the
// token, so account-reset secrets cannot leak through HTTP responses.
let lastSent = null;

const sendPasswordResetViaConsole = async (email, token, expiresInMinutes) => {
  console.log(
    `[PASSWORD RESET] ${email} -> token=${token} (expires in ${expiresInMinutes} minutes; console adapter)`,
  );
  lastSent = { email, token };
};

export const sendPasswordReset = sendPasswordResetViaConsole;
export const getLastSentPasswordReset = () => lastSent;
