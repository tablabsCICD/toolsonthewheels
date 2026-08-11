const env = require('../../../config/env');

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';

/** Parses `"Name <email@example.com>"` into { name, email } for SendGrid's payload shape. */
function parseAddress(input) {
  const match = /^(.*)<(.+)>$/.exec(input);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
  }
  return { email: input.trim() };
}

/**
 * @param {{from: string, to: string, subject: string, text: string, html: string}} message
 */
async function sendMail({ from, to, subject, text, html }) {
  const response = await fetch(SENDGRID_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.sendgrid.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: parseAddress(from),
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const err = new Error(`SendGrid API responded with ${response.status}`);
    err.code = 'SENDGRID_API_ERROR';
    err.responseCode = response.status;
    err.details = body.slice(0, 500);
    throw err;
  }

  // SendGrid returns 202 with no body; the message id comes back in a header.
  return { id: response.headers.get('x-message-id') || null };
}

module.exports = { sendMail };
