import Amplitude from 'amplitude';
import { env } from '../../config/env.js';
import { getCommonProperties } from './common-properties.js';

let client = null;
let initialized = false;

const init = () => {
  if (initialized) return;
  const apiKey = env.amplitude.apiKey;
  if (!apiKey) {
    console.warn('[Amplitude] AMPLITUDE_API_KEY not set — analytics disabled.');
    client = null;
  } else {
    client = new Amplitude.default(apiKey);
  }
  initialized = true;
};

// Amplitude requires a string user_id of at least 5 characters.
const amplitudeUserId = (userId) => `user_${userId}`;

export const trackEvent = async (event, userId, props = {}, sessionId = null) => {
  init();
  const eventProperties = { ...getCommonProperties(), ...props };

  if (env.isDev) {
    console.log('[Amplitude:dev]', event, { userId, ...eventProperties });
  }

  if (!client) return false;

  try {
    await client.track({
      event_type: event,
      user_id: amplitudeUserId(userId),
      event_properties: eventProperties,
      ...(sessionId && { session_id: sessionId }),
    });
    return true;
  } catch (error) {
    console.error('[Amplitude] Failed to track event', event, error.message);
    return false;
  }
};

export const setUserProperties = async (userId, properties) => {
  init();
  if (env.isDev) {
    console.log('[Amplitude:dev] identify', { userId, ...properties });
  }
  if (!client) return false;

  try {
    await client.identify({ user_id: amplitudeUserId(userId), user_properties: properties });
    return true;
  } catch (error) {
    console.error('[Amplitude] Failed to set user properties', error.message);
    return false;
  }
};

export default { trackEvent, setUserProperties };
