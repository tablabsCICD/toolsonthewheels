const env = require('../../config/env');
const { getEmailProvider } = require('./providers');
const ownerNotificationTemplate = require('./templates/ownerNotification');
const customerConfirmationTemplate = require('./templates/customerConfirmation');
const logger = require('../../utils/logger');

const templateContext = {
  businessName: env.businessName,
  businessPhone: env.businessPhone,
};

/**
 * Sends the internal notification to the business owner about a new booking.
 * Throws on failure — this is the critical-path email, callers should treat
 * a failure here as the booking submission failing.
 */
async function sendOwnerNotification(booking) {
  const provider = getEmailProvider();
  const { subject, text, html } = ownerNotificationTemplate(booking, templateContext);

  await provider.sendMail({
    from: env.emailFrom,
    to: env.ownerEmail,
    subject,
    text,
    html,
  });

  logger.info('Owner notification email sent', { provider: env.emailProvider });
}

/**
 * Sends the confirmation email to the customer. Callers should treat failure here
 * as non-fatal (best-effort) — the owner has already been notified of the booking.
 */
async function sendCustomerConfirmation(booking) {
  const provider = getEmailProvider();
  const { subject, text, html } = customerConfirmationTemplate(booking, templateContext);

  await provider.sendMail({
    from: env.emailFrom,
    to: booking.email,
    subject,
    text,
    html,
  });

  logger.info('Customer confirmation email sent', { provider: env.emailProvider });
}

module.exports = { sendOwnerNotification, sendCustomerConfirmation };
