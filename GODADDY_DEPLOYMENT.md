# GoDaddy cPanel Deployment Guide

This project is now prepared for deployment on GoDaddy Web Hosting/cPanel with
Node.js Application Manager. It should run as one Node app on
`toolsonthewheels.com`.

Important: keep the SMTP email settings exactly as they are in `server/.env`.
The consultation form depends on the Express backend and the existing SMTP flow.

## What This Project Runs

- `public/` contains the live website files: HTML, CSS, JavaScript, images, and
  videos. There is no frontend build step.
- `server/` contains the Express backend. It serves `public/`, exposes
  `/api/health`, and handles booking submissions at `/api/appointments`.
- `server/app.js` is the GoDaddy/cPanel startup file. cPanel should run this
  file, not `public/index.html`.
- `server/tmp/` is included so Passenger/cPanel can restart the app with
  `tmp/restart.txt`.

Do not deploy only `public/` to `public_html`. The page may load, but the
booking form will fail because `/api/appointments` will not exist.

## Required GoDaddy Hosting

The GoDaddy screen in the screenshot is the domain dashboard. To run this app on
GoDaddy, the account also needs Web Hosting/cPanel with Node.js Application
Manager enabled.

If Application Manager is not visible in cPanel, ask GoDaddy support to enable
Node.js/Passenger for the hosting plan or move the app to a GoDaddy plan that
supports Node.js apps.

## Local Preflight

From this project folder:

```bash
npm run install:server
npm start
```

Open:

```text
http://localhost:3000/api/health
```

Expected response:

```json
{"success":true,"status":"ok"}
```

Stop the local server with `Ctrl+C`.

## Files To Upload

Upload the whole project, preserving this structure:

```text
/home/YOUR_CPANEL_USER/toolsonthewheels/
  public/
  server/
    app.js
    package.json
    package-lock.json
    src/
    tmp/
    .env
  package.json
  README.md
  GODADDY_DEPLOYMENT.md
```

The `server/.env` file contains secrets. Upload it securely through cPanel File
Manager, SFTP, or SSH. Do not commit it to Git.

## Environment Settings

Use the existing SMTP settings in `server/.env`. Keep:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=...
SMTP_PORT=...
SMTP_SECURE=...
SMTP_USER=...
SMTP_PASS=...
```

For the live GoDaddy domain, confirm these production values are present:

```env
NODE_ENV=production
CORS_ORIGIN=https://toolsonthewheels.com,https://www.toolsonthewheels.com
OWNER_EMAIL=toolsonthewheels@gmail.com
BUSINESS_NAME="Tools on the Wheels"
BUSINESS_PHONE="+1 (514) 571-9041"
BUSINESS_TIMEZONE=America/Toronto
RATE_LIMIT_WINDOW_MINUTES=15
RATE_LIMIT_MAX=5
```

Leave `PORT` in `.env` only if GoDaddy/cPanel does not provide one. If cPanel
sets `PORT`, the app will use cPanel's value automatically.

## Install Dependencies On GoDaddy

In cPanel Terminal or SSH:

```bash
cd ~/toolsonthewheels/server
npm ci --omit=dev
```

If `npm ci` is not available on the server, run:

```bash
cd ~/toolsonthewheels/server
npm install --omit=dev
```

## Register The Node App In cPanel

In GoDaddy:

1. Go to `My Products`.
2. Open the Web Hosting product and select `Manage`.
3. Open `cPanel Admin`.
4. Open `Application Manager`.
5. Register a new Node.js application with these values:

| Field | Value |
| --- | --- |
| Application name | `Tools on the Wheels` |
| Domain | `toolsonthewheels.com` |
| Base application URL | `/` |
| Application path/root | `toolsonthewheels/server` |
| Startup file | `app.js` |
| Environment | `production` |
| Node.js version | `18` or newer |

If cPanel has an environment-variable editor, add the same values from
`server/.env` there. If not, keep them in `server/.env`.

Start or restart the application from Application Manager.

## Point The GoDaddy Domain To This Hosting

From the screenshot screen:

1. Select the `DNS` tab or click `Manage DNS`.
2. Keep existing email records such as `MX`, SPF, DKIM, and other email-related
   `TXT` records unless GoDaddy or your email provider tells you to change them.
3. Remove conflicting website builder, parking, or forwarding records for `@`
   and `www`.
4. Add or edit these website records using the hosting IP from the GoDaddy cPanel
   dashboard:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| A | `@` | `YOUR_GODADDY_HOSTING_IP` | 1 hour |
| CNAME | `www` | `@` | 1 hour |

If GoDaddy already connected the hosting plan to `toolsonthewheels.com`, these
records may already be correct. DNS can update within an hour, but global
propagation can take up to 48 hours.

## Verify The Live Site

After cPanel shows the app as running and DNS has propagated:

```bash
curl -I https://toolsonthewheels.com
curl https://toolsonthewheels.com/api/health
curl -I https://www.toolsonthewheels.com
```

Expected health response:

```json
{"success":true,"status":"ok"}
```

Then submit one real consultation request from the live page and confirm:

- the form shows a success message
- the owner notification email arrives
- the customer confirmation email arrives

## Restart After Future Uploads

After uploading changed code:

```bash
cd ~/toolsonthewheels/server
touch tmp/restart.txt
```

If dependencies changed:

```bash
cd ~/toolsonthewheels/server
npm ci --omit=dev
touch tmp/restart.txt
```

## Troubleshooting

- Homepage works but booking fails: the Node app is not serving the site, or the
  app was deployed as static files only.
- `/api/health` fails: check cPanel Application Manager logs and confirm the
  startup file is `app.js`.
- App fails immediately: check for missing `.env` values. The app intentionally
  refuses to start when SMTP or owner-email configuration is incomplete.
- Email does not send: keep `EMAIL_PROVIDER=smtp`, then verify the existing
  SMTP username, password/app password, host, port, and secure setting.
- Root domain works but `www` does not: check the `www` CNAME.
- `www` works but root domain does not: check the `@` A record.

## Reference Links

- GoDaddy DNS management:
  https://www.godaddy.com/en-uk/help/manage-dns-records-680
- GoDaddy A record steps:
  https://www.godaddy.com/help/add-or-edit-an-a-record-42546
- GoDaddy CNAME steps:
  https://www.godaddy.com/en-ca/help/add-a-cname-record-19236
- cPanel Node.js application setup:
  https://docs.cpanel.net/knowledge-base/web-services/how-to-install-a-node.js-application/
- GoDaddy cPanel document root:
  https://www.godaddy.com/en-in/help/what-is-my-websites-root-directory-in-my-web-hosting-cpanel-account-16187
