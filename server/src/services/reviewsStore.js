const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DATA_PATH = path.join(DATA_DIR, 'reviews.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, '[]\n', 'utf8');

// All reads/writes go through this promise chain so two near-simultaneous requests
// (e.g. two submissions landing in the same tick) can't interleave a read-modify-write
// and silently drop one of them — Node's single-threaded event loop still lets async
// fs calls from different requests interleave between awaits.
let queue = Promise.resolve();
function serialize(fn) {
  const run = queue.then(fn, fn);
  queue = run.then(() => {}, () => {});
  return run;
}

async function readAll() {
  const raw = await fs.promises.readFile(DATA_PATH, 'utf8');
  const parsed = JSON.parse(raw || '[]');
  return Array.isArray(parsed) ? parsed : [];
}

/** Writes via a temp file + rename so a crash mid-write can't corrupt the store. */
async function writeAll(reviews) {
  const tmpPath = `${DATA_PATH}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.writeFile(tmpPath, JSON.stringify(reviews, null, 2), 'utf8');
  await fs.promises.rename(tmpPath, DATA_PATH);
}

function toPublicReview(review) {
  return {
    id: review.id,
    name: review.name,
    rating: review.rating,
    text: review.text,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

/** Reviews are stored (and returned) oldest-first — new ones are appended, edits update in place. */
async function getAllReviews() {
  const reviews = await readAll();
  return reviews.map(toPublicReview);
}

/**
 * Creates a review, or updates the existing one for this email if it already has one.
 * Email is the account key — never exposed via toPublicReview / the API responses.
 */
async function upsertReview({ name, email, rating, text }) {
  return serialize(async () => {
    const reviews = await readAll();
    const emailKey = email.toLowerCase();
    const now = new Date().toISOString();
    const existingIndex = reviews.findIndex((r) => r.email === emailKey);

    let review;
    let isNew;
    if (existingIndex === -1) {
      review = {
        id: crypto.randomUUID(),
        name,
        email: emailKey,
        rating,
        text,
        createdAt: now,
        updatedAt: now,
      };
      reviews.push(review);
      isNew = true;
    } else {
      review = {
        ...reviews[existingIndex],
        name,
        rating,
        text,
        updatedAt: now,
      };
      reviews[existingIndex] = review;
      isNew = false;
    }

    await writeAll(reviews);
    return { review: toPublicReview(review), isNew };
  });
}

module.exports = { getAllReviews, upsertReview };
