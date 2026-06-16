#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

bashio::log.info "Starting Medication Tracker v${APP_VERSION:-unknown}..."

export HA_ADDON=1
export SERVE_STATIC=true
export NODE_ENV=production
export PORT="8099"
export HOST="0.0.0.0"

export DB_HOST="$(bashio::config 'db_host')"
export DB_PORT="$(bashio::config 'db_port')"
export DB_USER="$(bashio::config 'db_user')"
export DB_PASSWORD="$(bashio::config 'db_password')"
export DB_NAME="$(bashio::config 'db_name')"

export MQTT_ENABLED="$(bashio::config 'mqtt_enabled')"
export MQTT_HOST="$(bashio::config 'mqtt_host')"
export MQTT_PORT="$(bashio::config 'mqtt_port')"
export MQTT_USER="$(bashio::config 'mqtt_user')"
export MQTT_PASSWORD="$(bashio::config 'mqtt_password')"
export MQTT_TOPIC_PREFIX="$(bashio::config 'mqtt_topic_prefix')"

NODE="/usr/bin/node"
if [[ ! -x "$NODE" ]]; then
  NODE="$(command -v node || true)"
fi

if [[ -z "$NODE" || ! -x "$NODE" ]]; then
  bashio::log.error "Node.js not found"
  exit 1
fi

NODE_VERSION="$("$NODE" --version 2>&1)" || {
  bashio::log.error "Node binary crashed when running --version"
  exit 1
}
bashio::log.info "Node ${NODE_VERSION}"
bashio::log.info "MariaDB target: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
if [[ "${MQTT_ENABLED}" == "true" ]]; then
  bashio::log.info "MQTT target: ${MQTT_HOST}:${MQTT_PORT} (topic: ${MQTT_TOPIC_PREFIX})"
fi

cd /app || exit 1
exec "$NODE" server/dist/index.js
