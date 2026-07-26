import { env } from '../../config/env.js';

// Merged into every Amplitude event automatically, so no call site has to
// remember to attach platform/environment/app version by hand.
export const getCommonProperties = () => ({
  platform: 'backend',
  environment: env.nodeEnv,
  app_version: env.amplitude.appVersion,
});
