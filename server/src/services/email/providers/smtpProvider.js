const nodemailer = require('nodemailer');
const env = require('../../../config/env');

let transporter = null;

/**
 * Lazily creates a single shared SMTP transport. Works with any SMTP-compatible
 * provider (Gmail, Outlook/Office365, Zoho, private mail servers, etc.) — only the
 * host/port/secure/credentials in .env change, this code never does.
 */
function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure, // true for port 465 (SSL), false for 587/25 (STARTTLS)
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });

  return transporter;
}

/**
 * @param {{from: string, to: string, subject: string, text: string, html: string}} message
 */
async function sendMail({ from, to, subject, text, html }) {
  const info = await getTransporter().sendMail({ from, to, subject, text, html });
  return { id: info.messageId };
}

module.exports = { sendMail };
