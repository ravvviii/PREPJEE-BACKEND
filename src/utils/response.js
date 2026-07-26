export const success = (data = null, meta) => ({
  success: true,
  data,
  error: null,
  ...(meta !== undefined && { meta }),
});

export const fail = (message, code = 'ERROR', details) => ({
  success: false,
  data: null,
  error: { code, message, ...(details !== undefined && { details }) },
});
