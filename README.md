# Medication Tracker

Household medication tracking — log doses, interval timers, max per day, and per-profile quick buttons. Data stored in MariaDB.

## Features

- **Profiles** — household members pick a profile (no login)
- **Medications** — optional interval, optional max/day, custom waiting message
- **Quick buttons** — per-profile med assignment
- **Dose logging** — now or at a specific past time
- **Household view** — see everyone; log on behalf of others
- **Home Assistant app** — Ingress UI in the HA sidebar

## Deployment

HA app files (`config.yaml`, `Dockerfile`, `run.sh`, `build.yaml`, `apparmor.txt`) live at the **repo root** for copying to `/addons/medication_tracker/`.

| Target | Steps |
|--------|--------|
| **Home Assistant** | Copy folder → **Apps → Check for updates** → install → configure DB → [DOCS.md](DOCS.md) |
| **Home Assistant (fast deploy)** | `cp deploy.local.env.example deploy.local.env` → edit → `npm run deploy:ha` |
| **Docker Compose** | `cp .env.example .env` → edit → `docker compose up -d --build` → http://localhost:8099 |
| **Node production** | `bash scripts/install.sh` → edit `.env` → `npm run start:prod` → http://localhost:8099 |
| **Development** | `cp .env.example .env` → `npm install` (+ server/client) → `npm run dev` → http://localhost:5173 |

### MariaDB host

| Where MariaDB runs | `DB_HOST` / app option |
|--------------------|-------------------------|
| Same machine (Docker Compose / Node) | `127.0.0.1` |
| HA **MariaDB add-on** | `core-mariadb` (not `127.0.0.1` — that's the app container) |
| HA host OS on port 3306 | `172.30.32.1` |
| Remote LAN server | that machine's IP |

Default in `.env.example` and HA app options: **`127.0.0.1`**.

## Database setup

```bash
mysql -u root -p < server/sql/001_init.sql
mysql -u root -p medication_tracker < server/sql/002_optional_interval_waiting_message.sql
mysql -u root -p medication_tracker < server/sql/003_profile_medication_notify.sql
```

```sql
CREATE USER 'medtracker'@'%' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON medication_tracker.* TO 'medtracker'@'%';
FLUSH PRIVILEGES;
```

## Configuration (`.env`)

Copy `.env.example` to `.env` (gitignored). Key variables:

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=medtracker
DB_PASSWORD=...
DB_NAME=medication_tracker
PORT=8099
SERVE_STATIC=true    # production: serve built UI from Express
```

For **dev**, use `PORT=3001`, `SERVE_STATIC=false`, and `CLIENT_ORIGIN=http://localhost:5173`.

Check DB connectivity: `npm run check-db`

## Project structure

```
medication-tracker/
  config.yaml           HA app manifest
  Dockerfile            HA app build
  Dockerfile.standalone Docker Compose build
  docker-compose.yml
  run.sh                HA entrypoint
  scripts/install.sh    Production install + build
  DOCS.md               HA guide
  client/               React UI
  server/               Express API
  server/sql/           Migrations
  .env.example
```

## Usage

1. Create or select a profile
2. **Settings** — add meds, assign quick buttons (any profile)
3. **Home** — log doses; countdown when interval set
4. **Household** — monitor others; log on their behalf

## Phase 2 — Home Assistant notifications (MQTT)

The app publishes discovery entities plus **MQTT edge events** (`events/due`, `events/reminder`) to **Mosquitto** (`core-mosquitto`). Configure notification preferences in **Settings → Notifications**, then add one or two HA automations — no per-med entity lists required.

See **[DOCS.md](DOCS.md#mqtt--home-assistant-notifications)** for setup, migration `003`, and example automations.

## Manual test checklist

- [ ] Create profiles and medications
- [ ] Assign quick buttons per profile
- [ ] Log dose; verify countdown (when interval set)
- [ ] Log at time (backdated)
- [ ] Max per day blocks further logs
- [ ] Household view + log on behalf
- [ ] Med without interval — always ready (unless max/day)
