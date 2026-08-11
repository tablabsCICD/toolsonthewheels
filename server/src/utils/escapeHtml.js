const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes user-supplied text before it is interpolated into an HTML email template.
 * Without this, a booking submission containing e.g. "<img src=x onerror=...>" in the
 * notes field would be rendered as live HTML/script-like markup in the owner's inbox.
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

module.exports = escapeHtml;
