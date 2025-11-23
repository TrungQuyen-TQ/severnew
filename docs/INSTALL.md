# Installation & Run (Development)

## Prerequisites
- Node.js (v14+ recommended; tested with Node 22)
- MySQL server
- Git

## Basic setup
1. Clone repo

```powershell
git clone <repo-url>
cd sever_ProjectII
```

2. Install dependencies

```powershell
npm install
```

3. Configure DB and secrets
- Edit `config/default.json` (or create `config/production.json`) and set `dbConfig` and `JWT_SECRET`.

Example (`config/default.json`):

```json
"dbConfig": {
  "host": "127.0.0.1",
  "user": "root",
  "password": "root123!",
  "database": "mydb"
}
```

4. Prepare database
- Create the database and tables (use provided SQL or your schema). Example:

```sql
CREATE DATABASE IF NOT EXISTS mydb;
-- create users, products, tables, orders, order_details, etc.
```

5. Start server

```powershell
npm start
# or development
npm run dev
```

6. Access
- Web UI: `http://localhost:3000` (redirects to `/order`)
- API endpoints prefix: `http://localhost:3000/api`

## Notes
- Use `config` package to manage environment-specific configuration.
- For production, set `PORT` env var and provide secure `JWT_SECRET` and DB credentials.
- Use HTTPS in production and set secure cookie flags accordingly.