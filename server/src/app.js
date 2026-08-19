const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const env = require('./config/env');
const appointmentsRoutes = require('./routes/appointments.routes');
const reviewsRoutes = require('./routes/reviews.routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const FRONTEND_ROOT = path.join(__dirname, '..', '..');
const STATIC_DIRS = ['assets', 'css', 'js'];

function isLoopbackOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin);
}

function buildCorsOptions() {
  if (env.corsOrigin === '*') return { origin: '*' };

  const allowedOrigins = env.corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      // Local file previews send Origin: null. Allow that only when the configured
      // API origin is loopback, so index.html can submit during local testing.
      if (origin === 'null' && allowedOrigins.some(isLoopbackOrigin)) return callback(null, true);

      return callback(null, allowedOrigins.includes(origin));
    },
  };
}

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // needed for correct req.ip behind a reverse proxy/load balancer

  app.use(
    helmet({
      // The site embeds Google Fonts + inline styles from the existing frontend;
      // a strict default CSP would break it, so this stays permissive for now.
      // Tighten this if/when the frontend adopts a nonce-based CSP.
      contentSecurityPolicy: false,
    })
  );

  app.use(cors(buildCorsOptions()));

  // Frontend always sends JSON (see js/script.js) — no urlencoded parser needed.
  app.use(express.json({ limit: '20kb' }));

  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`, { ip: req.ip });
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok' }));
  app.use('/api/appointments', appointmentsRoutes);
  app.use('/api/reviews', reviewsRoutes);

  // Serve only the flattened frontend files, not the rest of the project root.
  STATIC_DIRS.forEach((dir) => {
    app.use(`/${dir}`, express.static(path.join(FRONTEND_ROOT, dir)));
  });
  app.get(['/', '/index.html'], (_req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
