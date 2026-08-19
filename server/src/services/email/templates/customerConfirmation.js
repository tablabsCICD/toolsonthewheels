const { renderLayout, detailRow, detailsTable, COLORS } = require('./layout');
const escapeHtml = require('../../../utils/escapeHtml');

/**
 * @param {object} booking sanitized booking fields
 * @param {object} opts { businessName, businessPhone }
 * @returns {{subject: string, text: string, html: string}}
 */
function customerConfirmationTemplate(booking, { businessName, businessPhone }) {
  const subject = `We received your consultation request — ${businessName}`;

  const rows = [
    detailRow('Service', booking.service),
    detailRow('Preferred date', booking.date),
    detailRow('Preferred time', booking.time),
  ];

  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:bold;color:${COLORS.GOLD};">Thanks, ${escapeHtml(booking.name)}!</p>
    <p style="margin:0 0 4px;">We've received your consultation request and a member of our team will contact you shortly to confirm your appointment.</p>
    <p style="margin:12px 0 4px;color:${COLORS.MUTED};font-size:13px;text-transform:uppercase;letter-spacing:1px;">Your request</p>
    ${detailsTable(rows)}
    <p style="margin:18px 0 4px;color:${COLORS.MUTED};font-size:13px;text-transform:uppercase;letter-spacing:1px;">Project details</p>
    <p style="margin:0;white-space:pre-wrap;">${booking.notes ? escapeHtml(booking.notes) : `<span style="color:${COLORS.MUTED}">None provided</span>`}</p>
    <p style="margin:18px 0 0;color:${COLORS.MUTED};">Questions in the meantime? Call or text us at ${escapeHtml(businessPhone)}.</p>
  `;

  const html = renderLayout({ businessName, title: subject, bodyHtml });

  const text = [
    `Thanks, ${booking.name}!`,
    '',
    "We've received your consultation request and a member of our team will contact you shortly to confirm your appointment.",
    '',
    'Your request:',
    `Service: ${booking.service}`,
    `Preferred date: ${booking.date}`,
    `Preferred time: ${booking.time}`,
    '',
    'Project details:',
    booking.notes || 'None provided',
    '',
    `Questions in the meantime? Call or text us at ${businessPhone}.`,
  ].join('\n');

  return { subject, text, html };
}

module.exports = customerConfirmationTemplate;
