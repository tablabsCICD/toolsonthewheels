const env = require('../../../config/env');

const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * @param {{from: string, to: string, subject: string, text: string, html: string}} message
 */
async function sendMail({ from, to, subject, text, html }) {
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resend.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const err = new Error(`Resend API responded with ${response.status}`);
    err.code = 'RESEND_API_ERROR';
    err.responseCode = response.status;
    err.details = body.slice(0, 500);
    throw err;
  }

  const data = await response.json();
  return { id: data.id };
}

module.exports = { sendMail };
