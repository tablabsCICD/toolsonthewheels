const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const env = require('./config/env');
const appointmentsRoutes = require('./routes/appointments.routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const FRONTEND_ROOT = path.join(__dirname, '..', '..', 'public');

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

  const allowedOrigins = env.corsOrigin === '*' ? '*' : env.corsOrigin.split(',').map((o) => o.trim());
  app.use(cors({ origin: allowedOrigins }));

  // Frontend always sends JSON (see js/script.js) — no urlencoded parser needed.
  app.use(express.json({ limit: '20kb' }));

  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`, { ip: req.ip });
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok' }));
  app.use('/api/appointments', appointmentsRoutes);

  // Serve the static frontend from ../../public (index.html, css/, js/, assets/) untouched.
  app.use(express.static(FRONTEND_ROOT));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
