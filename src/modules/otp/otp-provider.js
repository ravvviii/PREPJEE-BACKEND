// No real SMS provider chosen yet (MSG91/Twilio decided later). This console
// adapter is the only implementation for now — swap this export for a real
// provider when one is chosen; nothing else in the codebase needs to change.
let lastSent = null;

const sendOtpViaConsole = async (phone, code) => {
  console.log(`[OTP] ${phone} -> ${code} (console adapter — no SMS provider configured)`);
  lastSent = { phone, code };
};

export const sendOtp = sendOtpViaConsole;

// Test-only convenience: the console adapter is what's active until a real
// SMS provider is chosen, so this is how tests observe the code that "would
// have been texted" — the API itself never returns it.
export const getLastSentOtp = () => lastSent;
