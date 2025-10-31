# sever_ProjectII

Express-based Node.js project integrating VNPAY example views and a small API for product/table management.

## What this repo contains
- `app.js` — main Express app
- `routes/` — `order` (VNPAY pages) and `api` (login, products, tables)
- `views/` — Jade (Pug) templates (order, refund, success, etc.)
- `stylesheets/` — CSS (bootstrap.min.css, jumbotron-narrow.css, style.css)
- `config/default.json` — configuration (DB, JWT secret, etc.)

## Prerequisites
- Node.js (v14+ recommended; tested with Node 22 in this workspace)
- MySQL server (or accessible DB matching `config/default.json`)

## Quick start
1. Install dependencies

```powershell
npm install
```

2. Configure DB and secrets
- Edit `config/default.json` or provide environment-specific config.
- Typical keys: `dbConfig` (host, user, password, database) and `JWT_SECRET`.

3. Start the server

```powershell
npm start
# or
node app.js
```

4. Open in browser
- Default: http://localhost:3000 -> redirects to `/order`

## Useful endpoints
- `GET /order` — VNPAY order page (view)
- `POST /order/create_payment_url` — create payment request
- `POST /order/querydr` — query payment
- `POST /order/refund` — refund
- `POST /api/login` — authenticate (returns JWT)
- `GET /api/products` — requires JWT
- Admin routes (require admin JWT): `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id`

## Notes / recent fixes
- Static middleware was adjusted to ensure the `stylesheets` folder is served (CSS 404s were fixed).
- Minor Jade formatting warnings were fixed for `views/order.jade` and `views/refund.jade` (spacing/indentation of inline inputs).

## Troubleshooting
- If you get `EADDRINUSE` when starting, another process is using port 3000. Stop that process or set `PORT` env var.
- CSS 404s -> verify `stylesheets/` exists (it does) and `app.js` static config serves it.

## Development tips
- Add `.env` for sensitive settings if needed and list them in `.gitignore`.
- Consider hashing passwords (bcrypt) instead of plaintext in DB.

---
If you'd like, I can also add a short CONTRIBUTING.md or a script in `package.json` to seed sample data.