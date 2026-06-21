# RP and Associates — Landing

Single-page marketing site for **RP and Associates**, a custom drinkware, packaging and promotional products manufacturer serving stadiums, restaurants and entertainment venues for 38+ years (Hermosa Beach, CA).

Static HTML/CSS front-end served by a small hardened Express server that also handles the contact form and transactional emails.

> Live: [rpandassociates.com](https://rpandassociates.com)

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Server | Node.js (>= 18) + [Express 4](https://expressjs.com/) |
| Front-end | Static `index.html` + `styles.css` (single-page funnel) |
| Email | [Resend](https://resend.com/) (welcome + internal notification) |
| Abuse control | `express-rate-limit` on the contact endpoint |
| Fonts / icons | Manrope (Google Fonts), [Lucide](https://lucide.dev/) icons |
| Hosting | [Railway](https://railway.app/) |

No build step: the server ships the static files directly.

---

## Project structure

```
.
├── server.js          # Express server: static hosting, /health, /api/contact, security headers
├── index.html         # Single-page site (hero · capabilities · contact)
├── styles.css         # All styling (forest green + lime brand palette)
├── beach.png          # Hero / brand imagery
├── hero-products.png
├── hero-products-v2.png
├── package.json
└── pnpm-lock.yaml
```

The page is a one-scroll funnel with three anchors: `#top` (hero), `#capabilities`, and `#contact`.

---

## Getting started

Prerequisites: Node.js >= 18 and [pnpm](https://pnpm.io/).

```bash
# 1. Install dependencies
pnpm install

# 2. Create a .env file (see below)
cp .env.example .env   # then fill in your key

# 3. Run
pnpm start             # or: pnpm dev
```

The site is served at `http://localhost:3000` (or `PORT` if set).

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | Yes (for contact form) | Resend API key used to send the welcome and notification emails. |
| `PORT` | No | Port to listen on. Defaults to `3000`. Railway injects this automatically. |

Secrets live only in `.env` (git-ignored). Never commit keys.

---

## API

### `GET /health`
Health check used by Railway.

```json
{ "status": "ok", "service": "rp-and-associates", "uptime": 123.45 }
```

### `POST /api/contact`
Receives a contact-form submission, validates and sanitizes it, then sends two emails via Resend (a welcome email to the sender and an internal notification to the RP team).

- Rate limited: **5 requests / 15 min** per IP.
- Required fields: `name`, `email`, `project`, `message`.
- Optional fields: `company`, `phone`.

Request body:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "project": "Custom Drinkware",
  "message": "We need 5,000 branded tumblers.",
  "company": "Acme Stadium",
  "phone": "(555) 123-4567"
}
```

Success response:

```json
{ "ok": true }
```

Email delivery is fire-and-forget: failures are logged server-side and do **not** block the `200` response.

---

## Security

The server applies a strict baseline on every response:

- Content-Security-Policy, HSTS (preload), `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP.
- `x-powered-by` disabled and `trust proxy` enabled (Railway sits behind a proxy).
- Contact input is length-capped and newline-stripped before use.
- Static media cached for 1 year (`immutable`); HTML cached for 5 minutes.

---

## Deployment (Railway)

The app reads `process.env.PORT` and exposes `GET /health`, so it deploys to Railway with no extra config.

```bash
railway up
railway logs        # verify the service is healthy after deploy
```

Set `RESEND_API_KEY` in the Railway service variables before going live.

---

## License

UNLICENSED — private project. All rights reserved.
