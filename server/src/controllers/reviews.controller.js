const reviewsStore = require('../services/reviewsStore');
const { collectValidationErrors, isHoneypotTriggered } = require('../validators/review.validator');
const logger = require('../utils/logger');

const GENERIC_ERROR_MESSAGE = "Sorry, something went wrong on our end and we couldn't save your review. Please try again shortly.";

async function listReviews(_req, res) {
  const reviews = await reviewsStore.getAllReviews();
  res.status(200).json({ success: true, reviews });
}

async function submitReview(req, res) {
  // Silently accept-and-drop suspected bot submissions — no validation details,
  // nothing written, but the caller sees an ordinary success response.
  if (isHoneypotTriggered(req)) {
    logger.warn('Honeypot triggered on review submission — request dropped', { ip: req.ip });
    return res.status(200).json({ success: true, message: 'Thanks for your review!' });
  }

  const errors = collectValidationErrors(req);
  if (errors) {
    return res.status(400).json({
      success: false,
      message: 'Please check the highlighted fields and try again.',
      errors,
    });
  }

  try {
    const { review, isNew } = await reviewsStore.upsertReview({
      name: req.body.name,
      email: req.body.email,
      rating: req.body.rating,
      text: req.body.text,
    });

    logger.info('Review saved', { reviewId: review.id, isNew });

    return res.status(200).json({
      success: true,
      isNew,
      review,
      message: isNew ? "Thanks for your review! It's now live below." : 'Your review has been updated.',
    });
  } catch (err) {
    logger.error('Failed to save review', { error: logger.sanitizeError(err) });
    return res.status(502).json({ success: false, message: GENERIC_ERROR_MESSAGE });
  }
}

module.exports = { listReviews, submitReview };
