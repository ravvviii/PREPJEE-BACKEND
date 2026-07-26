// Thrown by services, caught by the global error handler (middlewares/error-handler.js),
// which already reads `error.statusCode` / `error.code` off any thrown error.
export class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
