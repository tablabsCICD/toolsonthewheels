# Tools on the Wheels

Business website with a booking form that emails the owner and the customer
when a consultation is scheduled.

## Project layout

```
.
├── public/            static frontend — served as-is, no build step
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── assets/
└── server/            Express API + static file server
    ├── src/
    ├── package.json
    └── .env.example   copy to .env and fill in real values
```

A single Node process (`server/`) serves both `public/` and the
`/api/appointments` endpoint the booking form calls — see
[server/README.md](server/README.md) for how the email-sending backend
works and how to configure it.

## Run locally

```bash
npm run install:server
cp server/.env.example server/.env   # then fill in real values
npm start
```

Visit `http://localhost:3000`.

## Deploy

See [GODADDY_DEPLOYMENT.md](GODADDY_DEPLOYMENT.md) for the GoDaddy/cPanel
deployment walkthrough for `toolsonthewheels.com`.
