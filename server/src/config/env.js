const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const REQUIRED_BY_PROVIDER = {
  smtp: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'],
  resend: ['RESEND_API_KEY'],
  sendgrid: ['SENDGRID_API_KEY'],
};

const provider = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();

const alwaysRequired = ['OWNER_EMAIL', 'EMAIL_FROM'];
const providerRequired = REQUIRED_BY_PROVIDER[provider];

if (!providerRequired) {
  throw new Error(
    `Invalid EMAIL_PROVIDER "${provider}". Must be one of: ${Object.keys(REQUIRED_BY_PROVIDER).join(', ')}`
  );
}

const missing = [...alwaysRequired, ...providerRequired].filter((key) => !process.env[key] || !process.env[key].trim());

if (missing.length) {
  // Never log the values themselves — only which keys are absent.
  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Copy server/.env.example to server/.env and fill them in.'
  );
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  corsOrigin: process.env.CORS_ORIGIN || '*',

  ownerEmail: process.env.OWNER_EMAIL.trim(),
  emailFrom: process.env.EMAIL_FROM.trim(),
  businessName: process.env.BUSINESS_NAME || 'Tools on the Wheels',
  businessPhone: process.env.BUSINESS_PHONE || '',

  emailProvider: provider,

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY,
  },

  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
  },

  rateLimit: {
    windowMinutes: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES, 10) || 15,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 5,
  },
};

module.exports = env;
