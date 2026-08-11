const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../utils/asyncHandler');
const { appointmentValidationRules } = require('../validators/appointment.validator');
const { createAppointment } = require('../controllers/appointments.controller');
const env = require('../config/env');

const router = Router();

// Throttles the booking endpoint specifically so a spam burst can't hammer the
// SMTP/provider account or the owner's inbox. Keyed by IP.
const bookingLimiter = rateLimit({
  windowMs: env.rateLimit.windowMinutes * 60 * 1000,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please wait a few minutes before trying again.',
  },
});

router.post('/', bookingLimiter, appointmentValidationRules, asyncHandler(createAppointment));

module.exports = router;
