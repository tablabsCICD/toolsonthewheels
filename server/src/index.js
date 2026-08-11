const env = require('./config/env'); // validates required env vars; throws fast if misconfigured
const createApp = require('./app');
const logger = require('./utils/logger');

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(`Server listening on port ${env.port}`, {
    env: env.nodeEnv,
    emailProvider: env.emailProvider,
  });
});

function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => process.exit(0));
  // Force-exit if connections don't close in time.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { error: logger.sanitizeError(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — exiting', { error: logger.sanitizeError(err) });
  process.exit(1);
});
