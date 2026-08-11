const { renderLayout, detailRow, detailsTable, COLORS } = require('./layout');
const escapeHtml = require('../../../utils/escapeHtml');

/**
 * @param {object} booking sanitized booking fields
 * @param {object} opts { businessName }
 * @returns {{subject: string, text: string, html: string}}
 */
function ownerNotificationTemplate(booking, { businessName }) {
  const subject = `New consultation request: ${booking.service} — ${booking.name}`;

  const rows = [
    detailRow('Name', booking.name),
    detailRow('Phone', booking.phone),
    detailRow('Email', booking.email),
    detailRow('Service', booking.service),
    detailRow('Preferred date', booking.date),
    detailRow('Preferred time', booking.time),
  ];

  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:bold;color:${COLORS.GOLD};">New consultation request</p>
    <p style="margin:0 0 4px;color:${COLORS.MUTED};">A new booking came in through the website consultation form.</p>
    ${detailsTable(rows)}
    <p style="margin:18px 0 4px;color:${COLORS.MUTED};font-size:13px;text-transform:uppercase;letter-spacing:1px;">Additional notes</p>
    <p style="margin:0;white-space:pre-wrap;">${booking.notes ? escapeHtml(booking.notes) : `<span style="color:${COLORS.MUTED}">None provided</span>`}</p>
  `;

  const html = renderLayout({ businessName, title: subject, bodyHtml });

  const text = [
    'New consultation request',
    '',
    `Name: ${booking.name}`,
    `Phone: ${booking.phone}`,
    `Email: ${booking.email}`,
    `Service: ${booking.service}`,
    `Preferred date: ${booking.date}`,
    `Preferred time: ${booking.time}`,
    '',
    'Additional notes:',
    booking.notes || 'None provided',
  ].join('\n');

  return { subject, text, html };
}

module.exports = ownerNotificationTemplate;
