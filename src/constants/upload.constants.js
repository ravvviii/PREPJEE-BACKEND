export const UPLOAD = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  EXTENSION_BY_MIME: {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  },
  // Whitelisted so a caller-supplied "folder" can never be used to construct
  // an arbitrary R2 key — Question (Phase 10), Solution (Phase 12), and User
  // (Phase 6) modules all reuse this same set.
  FOLDERS: {
    QUESTIONS: 'questions',
    SOLUTIONS: 'solutions',
    PROFILES: 'profiles',
    MISC: 'misc',
  },
};
