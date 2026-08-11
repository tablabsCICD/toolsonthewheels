const env = require('../../../config/env');
const smtpProvider = require('./smtpProvider');
const resendProvider = require('./resendProvider');
const sendgridProvider = require('./sendgridProvider');

const PROVIDERS = {
  smtp: smtpProvider,
  resend: resendProvider,
  sendgrid: sendgridProvider,
};

/**
 * Returns the active email provider based on EMAIL_PROVIDER in .env.
 * Every provider implements the same `sendMail({from, to, subject, text, html})`
 * contract, so callers (emailService.js) never need to know which one is active —
 * switching providers is a single environment variable change.
 */
function getEmailProvider() {
  const provider = PROVIDERS[env.emailProvider];
  if (!provider) {
    throw new Error(`Unknown email provider "${env.emailProvider}"`);
  }
  return provider;
}

module.exports = { getEmailProvider };
