# Tools on the Wheels — Backend

Legacy/local Express API for the appointment-booking email notifications. The
deployed shared-hosting site now uses `api/appointments.php`, but this Node
server is still useful for local previews and as a reference implementation.

## What it does

When a visitor submits the **Schedule a Consultation** form, the frontend
`POST`s the booking to `/api/appointments` instead of opening the visitor's
email client. The API validates and sanitizes the data, then sends two emails:

1. **Owner notification** → `OWNER_EMAIL`, with every submitted field.
2. **Customer confirmation** → the email address the visitor entered, thanking
   them and summarizing what they submitted.

The owner email is the critical path — if it fails to send, the request is
reported back to the browser as a failure. The customer confirmation is
best-effort: if it bounces (e.g. a typo'd address), the booking still counts
as received since the owner was already notified.

## Project layout

```
server/
  src/
    index.js                  internal entry point (starts the HTTP server)
    app.js                    Express app: middleware, static frontend, routes
    config/env.js             loads & validates .env, fails fast if misconfigured
    routes/appointments.routes.js
    controllers/appointments.controller.js
    services/
      appointment.service.js  orchestrates the two-email booking flow
      email/
        emailService.js       high-level send functions, uses the active provider
        providers/            one module per provider, same sendMail() contract
          smtpProvider.js       nodemailer — Gmail / Outlook / Zoho / any SMTP host
          resendProvider.js     Resend HTTP API
          sendgridProvider.js   SendGrid HTTP API
        templates/             email subject/text/html builders
    validators/appointment.validator.js   express-validator rules + honeypot check
    middleware/errorHandler.js, notFound.js
    utils/logger.js, escapeHtml.js, asyncHandler.js
```

## Setup

```bash
cd server
npm install
cp .env.example .env
# edit .env with real values (see "SMTP email" below)
npm start          # or: npm run dev  (auto-restarts on file changes)
```

The server serves the site at `http://localhost:PORT/` (default port `3000`)
and the API at `http://localhost:PORT/api/appointments`.

## Legacy Node entrypoint

Only use this if you intentionally deploy the Express backend instead of the
PHP endpoint. For ordinary shared-hosting deployment, upload the root site files
and `api/appointments.php` as described in the root README.

If a host supports Node/Passenger, its Application Manager would use:

- Application root/path: `toolsonthewheels/server`
- Startup file: `app.js`
- Start command: `npm start` if the UI asks for one
- Node version: `18` or newer

`server/app.js` simply starts `src/index.js`; it exists because cPanel/Passenger
commonly expects an `app.js` startup file.

## SMTP email

For the legacy Node backend, keep `EMAIL_PROVIDER=smtp` in `.env` and leave
the existing SMTP service values in place:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=...
SMTP_PORT=...
SMTP_SECURE=...
SMTP_USER=...
SMTP_PASS=...
```

Gmail SMTP requires a 16-character App Password, not the normal account
password.

## Security notes

- Credentials only ever live in `.env` (gitignored) — never in source code.
- All booking fields are validated and whitelisted (`express-validator`); the
  service/time-slot fields must match the exact options in `index.html`.
- User-supplied text is HTML-escaped before being interpolated into the email
  templates, preventing HTML/script injection into either inbox.
- The booking endpoint is rate-limited per IP (`RATE_LIMIT_MAX` requests per
  `RATE_LIMIT_WINDOW_MINUTES`).
- A hidden honeypot field (`website`) silently absorbs bot submissions without
  sending any email or revealing to the bot that it was detected.
- `helmet` sets standard security headers; error responses never leak stack
  traces or internal error details to the client — only a generic message.
- The logger never prints credential values, only which env vars are missing
  (on startup) and safe error metadata (message/code) on failure.

## Extending to the other forms

Only the consultation/appointment form was wired up, per the current scope.
The "Request a Quote" and "Sign up" forms still use the original `mailto:`
behavior. Pointing them at this same backend would mean: add a route +
controller (they can reuse `emailService`/providers as-is), then swap their
`mailto(...)` call in `js/script.js` for a `fetch()` call the same way
`consultForm`'s handler works.
