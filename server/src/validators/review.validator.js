const { body, validationResult } = require('express-validator');

/** Strips ASCII control characters, including \r/\n — this feeds an email-based lookup key, not a header, but keeping it single-line avoids weird rendering. */
function stripControlCharsStrict(value) {
  if (typeof value !== 'string') return value;
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1F\x7F]/g, '');
}

/** Same as above but preserves \n — the review text is the only multi-line field here. */
function stripControlCharsAllowNewlines(value) {
  if (typeof value !== 'string') return value;
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

const reviewValidationRules = [
  body('name')
    .trim()
    .customSanitizer(stripControlCharsStrict)
    .isLength({ min: 2, max: 100 })
    .withMessage('Please enter your name (2–100 characters).'),

  body('email')
    .trim()
    .customSanitizer(stripControlCharsStrict)
    .toLowerCase()
    .isEmail()
    .withMessage('Please enter a valid email address — it identifies your review so you can edit it later.'),

  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Please choose a rating from 1 to 5 stars.')
    .toInt(),

  body('text')
    .trim()
    .customSanitizer(stripControlCharsAllowNewlines)
    .isLength({ min: 10, max: 1000 })
    .withMessage('Reviews must be between 10 and 1000 characters.'),

  // Honeypot — real visitors never see or fill this field (hidden via CSS in index.html).
  body('website').optional({ checkFalsy: true }).trim(),
];

function collectValidationErrors(req) {
  const result = validationResult(req);
  if (result.isEmpty()) return null;
  return result.array().map((e) => ({ field: e.path, message: e.msg }));
}

function isHoneypotTriggered(req) {
  return Boolean(req.body && req.body.website && req.body.website.trim().length > 0);
}

module.exports = { reviewValidationRules, collectValidationErrors, isHoneypotTriggered };
