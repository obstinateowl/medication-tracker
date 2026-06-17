# AGENTS.md

## Cursor Cloud specific instructions

This is a Node/TypeScript monorepo for a household **Medication Tracker** (Home Assistant add-on + standalone). Two workspaces:

- `client/` — React 19 + Vite UI. Dev server on port **5173** (proxies `/api` → `http://localhost:3001`).
- `server/` — Express + TypeScript API (run with `tsx`). Dev server on port **3001**. Uses **MariaDB** via the `mysql` package. MQTT is optional (Home Assistant only).

Standard scripts live in the root, `server/`, and `client/` `package.json` files; consult those rather than duplicating here.

### Running for development

- The update script already installs deps (`npm ci` in root, `server/`, `client/`).
- MariaDB must be running before starting the app or running `npm run check-db`. It is installed but is NOT auto-started on boot. Start it (idempotent) with:
  ```bash
  sudo mkdir -p /var/run/mysqld && sudo chown mysql:mysql /var/run/mysqld
  sudo bash -c 'nohup mariadbd --user=mysql >/tmp/mariadbd.log 2>&1 &'
  ```
  Verify with `sudo mysqladmin ping`.
- Start the app with `npm run dev` (runs server + client concurrently). Open the UI at **http://localhost:5173** (not 3001 — 3001 is the API only in dev). Health check: `curl http://localhost:3001/api/health`.

### Environment / `.env`

- `.env` lives at the repo root and is **gitignored** (copy from `.env.example` if missing). For dev it must use `PORT=3001`, `SERVE_STATIC=false`, `CLIENT_ORIGIN=http://localhost:5173`, and `NODE_ENV=development`. With `SERVE_STATIC=true` the Express server serves the built client itself (production mode) and the Vite proxy is bypassed.
- Local dev DB credentials: user `medtracker`, password `medtracker_dev`, database `medication_tracker` on `127.0.0.1:3306`.

### Database migrations (gotcha)

- For a **fresh** database, run only `server/sql/001_init.sql` then `server/sql/003_profile_medication_notify.sql`.
- Do **not** run `002_optional_interval_waiting_message.sql` on a fresh DB — `001_init.sql` already includes the `waiting_message` column it adds, so `002` errors with a duplicate-column failure. `002` is only for upgrading pre-existing older databases.

### Lint / test / build

- There is **no separate lint step and no automated test framework**. The TypeScript build (`npm run build`, which runs `tsc` for both client and server) is the typecheck/lint equivalent — use it to validate changes.
- The server starts even if the DB is unreachable (it logs a warning); always confirm DB connectivity with `npm run check-db` rather than relying on a clean startup.
