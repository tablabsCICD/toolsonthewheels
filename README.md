# Tools on the Wheels

Business website with a booking form that emails the owner and the customer
when a consultation is scheduled. The deployed site now uses a PHP endpoint so
shared hosting does not need a running Node process.

## Project layout

```
.
├── index.html         static frontend entry file, no build step
├── css/               stylesheets
├── js/                browser JavaScript
├── assets/            images and videos
├── api/               PHP booking endpoint for production hosting
└── server/            legacy/local Express API + static file server
    ├── src/
    ├── package.json
    └── .env.example   copy to .env and fill in real values
```

The production booking form posts to `api/appointments.php`, which reads the
same email settings from environment variables, `.env`, `api/.env`, or
`server/.env`. Keep real credentials out of git.

Required email settings:

```env
OWNER_EMAIL=toolsonthewheels@gmail.com
EMAIL_FROM="Tools on the Wheels <toolsonthewheels@gmail.com>"
BUSINESS_NAME="Tools on the Wheels"
BUSINESS_PHONE="+1 (514) 571-9041"
EMAIL_PROVIDER=mail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username@example.com
SMTP_PASS=your-smtp-app-password
```

`EMAIL_PROVIDER=mail` is also supported as a fallback when the host's PHP
`mail()` function is configured, but SMTP is preferred.

## Run locally

The deployed site uses PHP. The old Express server is only for legacy local
preview work:

```bash
npm run install:server
cp server/.env.example server/.env   # then fill in real values
npm run start:node
```

Visit `http://localhost:3000`.

## Deploy

Upload the root files (`index.html`, `css/`, `js/`, `assets/`, `api/`, and
`.htaccess`) to the hosting document root. Make sure the same email environment
values are available either through the hosting control panel or a non-public
`.env`/`api/.env` file on the server.

If cPanel/GoDaddy still shows `Failed running 'src/index.js'`, the old Node app
is still enabled. Disable/delete that Node app in cPanel Application Manager;
the booking form should be handled by PHP at `/api/appointments.php`.
