# Medication Tracker — Home Assistant App

Household medication tracking with dose logging, interval timers, optional max-per-day limits, and per-profile quick buttons.

## Requirements

- Home Assistant with Apps (formerly Add-ons) support
- **MariaDB** on your Home Assistant server (or reachable from it)
- Database and tables created (`server/sql/001_init.sql` and `002_optional_interval_waiting_message.sql`)

## MariaDB on Home Assistant

Default app option `db_host` is **`127.0.0.1`**.

| MariaDB setup | Recommended `db_host` |
|---------------|------------------------|
| **MariaDB add-on** (most common) | `core-mariadb` |
| MariaDB on host OS (port 3306) | `172.30.32.1` or enable **Host network** and use `127.0.0.1` |
| Remote MariaDB on LAN | IP of that machine |

`localhost` / `127.0.0.1` inside this app container refers to the **app container itself**, not other add-ons. If connection fails with `127.0.0.1`, switch to `core-mariadb` for the official MariaDB add-on.

## Installation

1. Copy this entire repository folder to your Home Assistant apps directory:

   ```text
   /addons/medication_tracker/
   ```

   Samba share: `addons` · SSH: `/addons/medication_tracker/`

2. **Settings → Apps → App store** → ⋮ → **Check for updates**

3. Install **Medication Tracker** from **Local apps**

4. Configure database options (default host `127.0.0.1` — change to `core-mariadb` if using the MariaDB add-on)

5. Start the app → **Open Web UI** (Ingress, sidebar: **Medications**)

## Deploy from your dev machine (Samba)

For faster iteration, use a local credentials file and push to the HA addons share:

```bash
cp deploy.local.env.example deploy.local.env
# Edit deploy.local.env — SMB login, MariaDB password, MQTT credentials
npm run deploy:ha
```

Defaults in `deploy.local.env.example` use `db_host=core-mariadb` and `mqtt_host=core-mosquitto`.

The script builds, packages, injects your credentials into the packaged `config.yaml` defaults, and rsyncs to `DEPLOY_SMB_URL` (default `smb://192.168.68.78/addons/`).

If auto-mount fails, set `DEPLOY_MOUNT` to your already-mounted addons path (e.g. a GVFS location from the file manager).

Options:

- `npm run deploy:ha -- --skip-build` — skip compile, package + upload only

**Note:** Changing packaged defaults does not overwrite an already-installed app’s saved options in `/data/options.json`. Update credentials in the app UI if needed, or reinstall.

## Database setup

On your MariaDB server (Home Assistant MariaDB add-on terminal or SSH):

```bash
mysql -u root -p < /path/to/server/sql/001_init.sql
mysql -u root -p medication_tracker < /path/to/server/sql/002_optional_interval_waiting_message.sql
```

Create the app user:

```sql
CREATE USER 'medtracker'@'%' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON medication_tracker.* TO 'medtracker'@'%';
FLUSH PRIVILEGES;
```

## Updating

1. Copy updated files to `/addons/medication_tracker/`
2. Bump `version` in `config.yaml` (currently **1.1.0**)
3. **Check for updates** → update the app

## Other deployment options

This repo also supports **standalone** deploy (same codebase, different packaging):

| Method | Command |
|--------|---------|
| Node (production) | `bash scripts/install.sh` then `npm run start:prod` |
| Docker Compose | `cp .env.example .env` → edit → `docker compose up -d --build` |

See the main [README.md](README.md) for local development with `npm run dev`.

## Troubleshooting

- **App not in Local apps:** Invalid `config.yaml` — **Settings → System → Logs → Supervisor**
- **ECONNREFUSED on 127.0.0.1:** Use `core-mariadb` for the MariaDB add-on (see table above)
- **Blank UI:** Check app logs; first build may take several minutes

## MQTT & Home Assistant notifications

The app publishes medication state to **Mosquitto** using MQTT discovery. Home Assistant creates entities automatically; **you** configure automations to send notifications (`notify.mobile_app`, etc.).

### Requirements

- **Mosquitto** add-on running on Home Assistant (default host: `core-mosquitto`)
- MQTT credentials from your Mosquitto add-on config (if authentication is enabled)
- **Settings → Devices & services → MQTT** — MQTT integration enabled

### App options (defaults)

| Option | Default | Notes |
|--------|---------|--------|
| `mqtt_enabled` | `true` | Set `false` to disable |
| `mqtt_host` | `core-mosquitto` | Mosquitto add-on hostname |
| `mqtt_port` | `1883` | |
| `mqtt_user` / `mqtt_password` | empty | Match Mosquitto add-on |
| `mqtt_topic_prefix` | `medication_tracker` | State topic prefix |

After starting the app, check logs for:

```text
[mqtt] Connected to core-mosquitto:1883
[mqtt] Home Assistant discovery active (poll every 60s)
```

### Entities created (per profile + assigned medication)

All grouped under device **Medication Tracker**:

| Entity | Meaning |
|--------|---------|
| `binary_sensor.<profile>_<med>_due` | `on` when dose is allowed now |
| `sensor.<profile>_<med>_seconds` | Countdown seconds |
| `sensor.<profile>_<med>_next_dose` | Next allowed time |
| `sensor.<profile>_<med>_doses_today` | Doses logged today |

Only medications **assigned to a profile** (Settings → quick buttons) are published.

### Example automation — notify when dose becomes due

**Settings → Automations → Create automation → Edit in YAML:**

```yaml
alias: Medication due reminder
description: Notify when any medication becomes ready to take
trigger:
  - platform: state
    entity_id:
      - binary_sensor.josh_ibuprofen_due
    from: "off"
    to: "on"
action:
  - service: notify.mobile_app
    data:
      title: "Medication due"
      message: "Josh — Ibuprofen is ready to take"
mode: single
```

Replace `entity_id` and message with your entities (find them under **Medication Tracker** device).

For a **shared household alert**, use one automation per med or a single automation with multiple triggers — all can call the same `notify` service.

### Future: early reminder

A per-medication “notify X minutes before due” option is planned. For now, automations trigger when `*_due` turns **on** (dose allowed now).

### Troubleshooting MQTT

- **`[mqtt] Could not connect`:** Check `mqtt_host` is `core-mosquitto`, credentials match Mosquitto, Mosquitto add-on is running
- **No entities in HA:** Confirm MQTT integration is loaded; restart the Medication Tracker app after changing assignments
- **Stale entities:** Removing a profile/med assignment clears discovery on next sync; delete orphaned entities manually if needed

## Security

- Web UI via **Home Assistant Ingress** (authenticated by HA)
- App accepts connections only from Ingress proxy (`172.30.32.2`) and localhost
- DB credentials stored in HA app options
