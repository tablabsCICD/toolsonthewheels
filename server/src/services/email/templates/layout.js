const escapeHtml = require('../../../utils/escapeHtml');

const INK = '#0c0b09';
const CREAM = '#ece3d2';
const GOLD = '#cbaa6c';
const MUTED = '#9b8f78';

/**
 * Wraps template-specific body HTML in a minimal, email-client-safe shell
 * (inline styles only — <style> blocks are unreliable across mail clients).
 */
function renderLayout({ businessName, title, bodyHtml }) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f1ec;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:${INK};border-radius:6px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px;border-bottom:2px solid ${GOLD};">
              <span style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${GOLD};font-weight:bold;">${escapeHtml(businessName)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:${CREAM};font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(203,170,108,.25);color:${MUTED};font-size:12px;">
              This is an automated message from the ${escapeHtml(businessName)} website booking form.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** A single label/value row used in both templates' detail tables. */
function detailRow(label, value) {
  return `<tr>
    <td style="padding:6px 0;color:${MUTED};font-size:13px;text-transform:uppercase;letter-spacing:1px;vertical-align:top;white-space:nowrap;padding-right:16px;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;color:${CREAM};font-size:15px;">${escapeHtml(value) || '—'}</td>
  </tr>`;
}

function detailsTable(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">${rows.join('')}</table>`;
}

module.exports = { renderLayout, detailRow, detailsTable, COLORS: { INK, CREAM, GOLD, MUTED } };
