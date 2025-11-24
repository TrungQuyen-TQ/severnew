# Developer Guide

## Project layout
- `app.js` - main Express application
- `routes/` - Express route handlers
- `views/` - Jade templates for VNPAY views
- `public/` - static assets (HTML, JS, CSS)
- `stylesheets/` - CSS files
- `config/default.json` - development configuration

## Run locally
1. Install deps
```powershell
npm install
```
2. Start server
```powershell
npm run dev
```
3. Open `http://localhost:3000`

## Coding conventions
- Use `config` package for environment config (`config/default.json`).
- Passwords must be stored hashed (bcrypt).
- Use async/await for DB calls with `mysql2/promise`.
- Routes should export a router (ESM `export default` or CommonJS `module.exports`) — `app.js` handles both types.

## Adding a new route
1. Create file in `routes/` and export default router.
2. Use `config.get('dbConfig')` to get DB credentials.
3. Add route to `app.js` (use `_router` normalization if needed).

## Running tests
- Add tests under `tests/` and run via npm script (not yet provided).

## Useful commands
```powershell
npm start        # production start
npm run dev      # nodemon development
npm test         # (if you add tests)
```

## Seeding data
- Create a `scripts/seed.js` to insert test users/products.

## Security notes for developers
- Never commit `config/production.json` with secrets.
- Avoid logging plaintext passwords; remove debug logs that print passwords.