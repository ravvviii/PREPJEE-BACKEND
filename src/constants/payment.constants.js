// Plain strings, not a Postgres ENUM — adding a new provider later is a
// one-line addition here, not a migration (Postgres ENUMs can't add a value
// inside a transaction in older versions, and this changes often enough
// during growth that it's not worth the friction).
export const PAYMENT_PROVIDERS = {
  RAZORPAY: 'razorpay',
  // PHONEPE: 'phonepe', // add here when a second provider is supported —
  // no schema change needed, `payments`/`subscriptions` are already generic.

  // Not a real payment gateway — `subscriptions.provider` doubles as "how did
  // this subscription originate," and an admin's manual comp/support grant is
  // a legitimate origin alongside real payment providers.
  ADMIN_GRANT: 'admin_grant',
};
