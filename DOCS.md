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
mysql -u root -p medication_tracker < /path/to/server/sql/003_profile_medication_notify.sql
```

Create the app user:

```sql
CREATE USER 'medtracker'@'%' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON medication_tracker.* TO 'medtracker'@'%';
FLUSH PRIVILEGES;
```

## Updating

1. Copy updated files to `/addons/medication_tracker/`
2. Bump `version` in `config.yaml` (currently **1.4.0**)
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

The app publishes medication state to **Mosquitto** using MQTT discovery (dashboard entities) and **edge events** (automations). Home Assistant sends notifications via `notify.mobile_app` (or any notify platform) in automations you configure.

Design reference: [docs/mqtt-notifications-design.md](docs/mqtt-notifications-design.md)

### Requirements

- **Mosquitto** add-on running on Home Assistant (default host: `core-mosquitto`)
- MQTT credentials from your Mosquitto add-on config (if authentication is enabled)
- **Settings → Devices & services → MQTT** — MQTT integration enabled
- Run migration `003_profile_medication_notify.sql` on existing databases

### Notification preferences (in app)

**Settings → Notifications** (per profile, assigned meds only):

| Option | Meaning |
|--------|---------|
| **Notify when due** | Publish `medication_tracker/events/due` when dose becomes allowed |
| **Remind before (min)** | Publish `medication_tracker/events/reminder` once per cycle, N minutes before due (requires med interval) |

Defaults are **off** — opt in per medication.

### App options (defaults)

| Option | Default | Notes |
|--------|---------|--------|
| `mqtt_enabled` | `true` | Set `false` to disable |
| `mqtt_host` | `core-mosquitto` | Mosquitto add-on hostname |
| `mqtt_port` | `1883` | |
| `mqtt_user` / `mqtt_password` | empty | Match Mosquitto add-on |
| `mqtt_topic_prefix` | `medication_tracker` | State and event topic prefix |

Poll interval defaults to **30 seconds** (`MQTT_POLL_INTERVAL_MS`).

After starting the app, check logs for:

```text
[mqtt] Connected to core-mosquitto:1883
[mqtt] Home Assistant discovery active (poll every 30s)
```

### Discovery entities (per profile + assigned medication)

All grouped under device **Medication Tracker**:

| Entity | Meaning |
|--------|---------|
| `binary_sensor.p{id}_m{id}_due` | `on` when dose is allowed now |
| `sensor.p{id}_m{id}_seconds` | Countdown seconds |
| `sensor.p{id}_m{id}_next_dose` | Next allowed time |
| `sensor.p{id}_m{id}_doses_today` | Doses logged today |

Only medications **assigned to a profile** (Settings → Quick buttons) are published.

### MQTT event topics (for automations)

Non-retained JSON on:

| Topic | When |
|-------|------|
| `medication_tracker/events/due` | Dose becomes allowed (`notify_when_due` enabled) |
| `medication_tracker/events/reminder` | Early reminder window (`notify_minutes_before` enabled) |

Example due payload:

```json
{
  "event": "due",
  "profile_id": 1,
  "profile": "Josh",
  "medication_id": 3,
  "medication": "Ibuprofen",
  "blocked_reason": null
}
```

### Example automation — due (recommended)

One automation handles **all** meds — no entity list to maintain:

```yaml
alias: Medication due
trigger:
  - trigger: mqtt
    topic: medication_tracker/events/due
action:
  - action: notify.mobile_app_your_phone
    data:
      title: "Medication due"
      message: "{{ trigger.payload_json.profile }} — {{ trigger.payload_json.medication }}"
mode: single
```

### Example automation — early reminder

```yaml
alias: Medication reminder
trigger:
  - trigger: mqtt
    topic: medication_tracker/events/reminder
action:
  - action: notify.mobile_app_your_phone
    data:
      title: "Medication reminder"
      message: >
        {{ trigger.payload_json.profile }} — {{ trigger.payload_json.medication }}
        in {{ (trigger.payload_json.seconds_remaining / 60) | round(0) }} minutes
mode: single
```

Route to different phones with a `choose` block on `trigger.payload_json.profile_id`.

### Legacy: per-entity state triggers

You can still trigger on `binary_sensor.*_due` `off` → `on`, but you must add each entity manually as meds are assigned. Prefer MQTT event topics above.

### Troubleshooting MQTT

- **`[mqtt] Could not connect`:** Check `mqtt_host` is `core-mosquitto`, credentials match Mosquitto, Mosquitto add-on is running
- **No entities in HA:** Confirm MQTT integration is loaded; restart the Medication Tracker app after changing assignments
- **No notifications:** Enable **Notify when due** in Settings → Notifications; confirm automations subscribe to `events/due` or `events/reminder`
- **Stale entities:** Removing a profile/med assignment clears discovery on next sync; delete orphaned entities manually if needed

## Security

- Web UI via **Home Assistant Ingress** (authenticated by HA)
- App accepts connections only from Ingress proxy (`172.30.32.2`) and localhost
- DB credentials stored in HA app options
