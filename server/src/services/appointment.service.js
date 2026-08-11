const emailService = require('./email/emailService');
const logger = require('../utils/logger');

/**
 * Runs the full booking flow for one appointment request.
 *
 * Owner notification is the critical path — if it fails, the booking is
 * considered failed (the business would never learn about the request), so the
 * error is re-thrown for the controller to turn into a 502-style response.
 *
 * Customer confirmation is best-effort — a bounce or typo'd address shouldn't make
 * a successfully-received booking look like it failed.
 *
 * @param {object} booking sanitized booking fields: name, phone, email, service, date, time, notes
 * @returns {Promise<{confirmationSent: boolean}>}
 */
async function submitAppointment(booking) {
  await emailService.sendOwnerNotification(booking);

  let confirmationSent = true;
  try {
    await emailService.sendCustomerConfirmation(booking);
  } catch (err) {
    confirmationSent = false;
    logger.warn('Customer confirmation email failed (booking still recorded with owner)', {
      error: logger.sanitizeError(err),
    });
  }

  return { confirmationSent };
}

module.exports = { submitAppointment };
