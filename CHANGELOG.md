# Changelog

## 1.3.0

- Dose history page: edit time or remove past doses (linked from Today's log)
- Today's log section on My Meds with Dose history button

## 1.2.1

- Compact medication tiles on My Meds (inline actions, tighter layout)

## 1.2.0

- My Meds tab rename; 7-day dose bar chart on home view
- Dose history API: `GET /api/doses/history`

## 1.1.0

- MQTT discovery: publish medication state to Mosquitto for Home Assistant automations
- New app options: `mqtt_enabled`, `mqtt_host`, credentials, topic prefix
- Immediate MQTT refresh after dose log or quick-button assignment change

## 1.0.5

- Fix Ingress: inject API base path into index.html (static middleware was skipping it)
- Health endpoint always returns 200 so UI shows database errors instead of "API unreachable"
- Use relative API paths as fallback under HA Ingress

## 1.0.4

- Fix AppArmor profile: remove restrictive Node subprofile that blocked /tmp and shared libs (segfault on startup)
- Ensure `libstdc++` is installed for Alpine Node.js

## 1.0.3

- Replace mysql2 (native) with pure-JS mysql driver to fix segfault on HA Alpine
- Single-stage Dockerfile build on HA base image

## 1.0.2

- Fix HA crash (segfault): use official Node binary instead of Alpine apk nodejs

## 1.0.1

- Production deploy: Docker Compose, `npm run start:prod`, `scripts/install.sh`
- Default MariaDB host `127.0.0.1`; HA docs for MariaDB add-on (`core-mariadb`)

## 1.0.0

- Initial Home Assistant app release
- Ingress web UI with MariaDB-backed medication tracking
- Optional dose intervals and customizable waiting messages
