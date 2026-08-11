const appointmentService = require('../services/appointment.service');
const { collectValidationErrors, isHoneypotTriggered } = require('../validators/appointment.validator');
const logger = require('../utils/logger');

const GENERIC_ERROR_MESSAGE =
  "Sorry, something went wrong on our end and we couldn't submit your request. Please try again shortly, or call/text us directly.";

async function createAppointment(req, res) {
  // Silently accept-and-drop suspected bot submissions — no validation details,
  // no emails sent, but the caller sees an ordinary success response.
  if (isHoneypotTriggered(req)) {
    logger.warn('Honeypot triggered on appointment submission — request dropped', { ip: req.ip });
    return res.status(200).json({
      success: true,
      message: 'Thanks! Your consultation request has been received.',
    });
  }

  const errors = collectValidationErrors(req);
  if (errors) {
    return res.status(400).json({
      success: false,
      message: 'Please check the highlighted fields and try again.',
      errors,
    });
  }

  const booking = {
    name: req.body.name,
    phone: req.body.phone,
    email: req.body.email,
    service: req.body.service,
    date: req.body.date,
    time: req.body.time,
    notes: req.body.notes || '',
  };

  try {
    const { confirmationSent } = await appointmentService.submitAppointment(booking);

    logger.info('Appointment booking submitted successfully', {
      service: booking.service,
      confirmationSent,
    });

    return res.status(200).json({
      success: true,
      message: confirmationSent
        ? "Thanks! Your consultation request has been received — we'll be in touch shortly to confirm, and a confirmation email is on its way to you."
        : "Thanks! Your consultation request has been received — we'll be in touch shortly to confirm.",
    });
  } catch (err) {
    logger.error('Failed to submit appointment booking', { error: logger.sanitizeError(err) });

    return res.status(502).json({
      success: false,
      message: GENERIC_ERROR_MESSAGE,
    });
  }
}

module.exports = { createAppointment };
