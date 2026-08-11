const logger = require('../utils/logger');

/**
 * Centralized error handler — must be registered last, after all routes.
 * Never forwards err.message / err.stack to the client; those are logged
 * server-side only via logger.sanitizeError.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error('Unhandled request error', {
    path: req.path,
    method: req.method,
    error: logger.sanitizeError(err),
  });

  if (res.headersSent) return;

  // express.json() throws a SyntaxError for malformed JSON bodies.
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ success: false, message: 'Malformed request body.' });
  }

  res.status(500).json({
    success: false,
    message: 'Something went wrong on our end. Please try again shortly.',
  });
}

module.exports = errorHandler;
