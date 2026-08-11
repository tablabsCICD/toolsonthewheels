const { body, validationResult } = require('express-validator');

// Must mirror the <option> values in index.html's #cs (consultForm) select exactly.
const SERVICE_OPTIONS = [
  'Paint Work',
  'Door Installation',
  'Window Finishing',
  'Kitchen Cabinets',
  'Drywall Installation',
  'Tiling',
  'Patch Work',
  'Plumbing Work',
  'Finishing (Baseboards & Trims)',
  'Flooring',
  'Basement Renovation',
  'Washroom Renovation',
  'Maintenance Services',
  'Multiple / Not sure',
];

// Must mirror the <option> values in index.html's #ct (consultForm) select exactly.
const TIME_OPTIONS = ['Morning (8am – 12pm)', 'Afternoon (12pm – 4pm)', 'Evening (4pm – 7pm)', 'No preference'];

// Deliberately uses a literal space, not \s — \s also matches \r/\n/\t, which would let
// a value like "5141234567\r\n" slip through as "valid" while carrying a header-injection payload.
const PHONE_PATTERN = /^[0-9+()\-. ]{7,20}$/;

/**
 * Strips ASCII control characters, INCLUDING \r and \n, for single-line fields
 * (name, phone, service, date, time) that get interpolated into email subject
 * lines or "to"/"from" headers — embedded CRLF there is a header-injection vector.
 */
function stripControlCharsStrict(value) {
  if (typeof value !== 'string') return value;
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1F\x7F]/g, '');
}

/** Same as above but preserves \n and \t — used only for the multi-line notes field. */
function stripControlCharsAllowNewlines(value) {
  if (typeof value !== 'string') return value;
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// The business operates in the Greater Toronto Area — "today" for booking-date validation
// must be evaluated in this timezone regardless of where the server process actually runs
// (most hosts default to UTC), or evening bookings get wrongly rejected as "in the past".
const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || 'America/Toronto';
const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}); // en-CA formats as YYYY-MM-DD, which sorts/compares correctly as a plain string

/** Returns today's date (optionally + N years) as a YYYY-MM-DD string in BUSINESS_TIMEZONE. */
function todayDateString(addYears = 0) {
  const now = new Date();
  if (addYears) now.setFullYear(now.getFullYear() + addYears);
  return businessDateFormatter.format(now);
}

const appointmentValidationRules = [
  body('name')
    .trim()
    .customSanitizer(stripControlCharsStrict)
    .isLength({ min: 2, max: 100 })
    .withMessage('Please enter your full name (2–100 characters).'),

  body('phone')
    .trim()
    .customSanitizer(stripControlCharsStrict)
    .matches(PHONE_PATTERN)
    .withMessage('Please enter a valid phone number.'),

  body('email')
    .trim()
    .customSanitizer(stripControlCharsStrict)
    .isEmail()
    .withMessage('Please enter a valid email address.')
    // Disable every provider-specific rewrite (Gmail dot/plus-addressing, Outlook/Yahoo/iCloud
    // sub-addressing) — sanitizing should normalize format, not silently change which mailbox
    // the customer actually receives their confirmation at.
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false,
    }),

  body('service')
    .trim()
    .isIn(SERVICE_OPTIONS)
    .withMessage('Please select a valid service from the list.'),

  body('date')
    .trim()
    .isISO8601({ strict: true })
    .withMessage('Please choose a valid preferred date.')
    .bail()
    .custom((value) => {
      // Compare as YYYY-MM-DD strings in the business's own timezone, not the server's —
      // a server running in UTC would otherwise reject a legitimate same-day booking made
      // in the evening in Toronto (already "tomorrow" in UTC).
      const todayInBusinessTz = todayDateString();
      const maxFutureInBusinessTz = todayDateString(2);

      if (value < todayInBusinessTz) throw new Error('Preferred date cannot be in the past.');
      if (value > maxFutureInBusinessTz) throw new Error('Preferred date is too far in the future.');
      return true;
    }),

  body('time')
    .trim()
    .isIn(TIME_OPTIONS)
    .withMessage('Please select a valid time slot.'),

  body('notes')
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer(stripControlCharsAllowNewlines)
    .isLength({ max: 2000 })
    .withMessage('Additional notes must be under 2000 characters.'),

  // Honeypot — real visitors never see or fill this field (hidden via CSS in index.html).
  body('website').optional({ checkFalsy: true }).trim(),
];

function collectValidationErrors(req) {
  const result = validationResult(req);
  if (result.isEmpty()) return null;
  return result.array().map((e) => ({ field: e.path, message: e.msg }));
}

/** Bots that auto-fill every field will trip this; real users leave it blank. */
function isHoneypotTriggered(req) {
  return Boolean(req.body && req.body.website && req.body.website.trim().length > 0);
}

module.exports = {
  appointmentValidationRules,
  collectValidationErrors,
  isHoneypotTriggered,
  SERVICE_OPTIONS,
  TIME_OPTIONS,
};
