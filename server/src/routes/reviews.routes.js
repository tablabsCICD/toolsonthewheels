const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../utils/asyncHandler');
const { reviewValidationRules } = require('../validators/review.validator');
const { listReviews, submitReview } = require('../controllers/reviews.controller');
const env = require('../config/env');

const router = Router();

// Same window/max as the booking form's limiter — keyed by IP, only on the write path.
const reviewLimiter = rateLimit({
  windowMs: env.rateLimit.windowMinutes * 60 * 1000,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please wait a few minutes before trying again.',
  },
});

router.get('/', asyncHandler(listReviews));
router.post('/', reviewLimiter, reviewValidationRules, asyncHandler(submitReview));

module.exports = router;
