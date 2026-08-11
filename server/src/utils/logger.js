/**
 * Minimal structured logger. Swap this module out for pino/winston later if needed —
 * every call site uses the same info/warn/error interface.
 *
 * IMPORTANT: never pass raw env vars, credentials, or full error objects containing
 * transport internals to this logger. Use `sanitizeError` first for anything caught
 * from nodemailer / provider SDKs.
 */

const LEVELS = ['error', 'warn', 'info', 'debug'];
const currentLevel = LEVELS.includes(process.env.LOG_LEVEL) ? process.env.LOG_LEVEL : 'info';
const currentLevelIndex = LEVELS.indexOf(currentLevel);

function timestamp() {
  return new Date().toISOString();
}

function write(level, message, meta) {
  const levelIndex = LEVELS.indexOf(level);
  if (levelIndex > currentLevelIndex) return;

  const line = `[${timestamp()}] [${level.toUpperCase()}] ${message}`;
  const payload = meta ? `${line} ${JSON.stringify(meta)}` : line;

  if (level === 'error') {
    console.error(payload);
  } else if (level === 'warn') {
    console.warn(payload);
  } else {
    console.log(payload);
  }
}

/**
 * Strips anything that looks like credentials/secrets from an error before logging it.
 * SMTP/HTTP client errors sometimes embed request config (including auth headers) —
 * we only keep a safe subset of fields.
 */
function sanitizeError(err) {
  if (!err) return { message: 'Unknown error' };
  const safe = {
    message: err.message,
    name: err.name,
    code: err.code,
  };
  // Some SMTP errors include a `command` (e.g. "AUTH PLAIN") but never the credential
  // payload itself, so it's safe to keep for debugging deliverability issues.
  if (err.command) safe.command = err.command;
  if (err.responseCode) safe.responseCode = err.responseCode;
  // Resend/SendGrid provider errors attach a truncated copy of the API's JSON error body
  // (e.g. "sender not verified", "invalid API key") — never the key/token itself, since
  // providers reject bad auth with a generic message rather than echoing it back.
  if (err.details) safe.details = String(err.details).slice(0, 300);
  return safe;
}

module.exports = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  debug: (message, meta) => write('debug', message, meta),
  sanitizeError,
};
