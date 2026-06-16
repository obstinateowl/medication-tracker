#!/usr/bin/env node
/**
 * Patch config.yaml options defaults from environment variables.
 * Usage: node scripts/patch-ha-config.mjs path/to/config.yaml
 */
import fs from "fs";

const configPath = process.argv[2];
if (!configPath) {
  console.error("Usage: patch-ha-config.mjs <config.yaml>");
  process.exit(1);
}

const options = {
  db_host: process.env.DB_HOST ?? "core-mariadb",
  db_port: Number(process.env.DB_PORT ?? 3306),
  db_user: process.env.DB_USER ?? "medtracker",
  db_password: process.env.DB_PASSWORD ?? "",
  db_name: process.env.DB_NAME ?? "medication_tracker",
  mqtt_enabled:
    process.env.MQTT_ENABLED === "true" || process.env.MQTT_ENABLED === "1",
  mqtt_host: process.env.MQTT_HOST ?? "core-mosquitto",
  mqtt_port: Number(process.env.MQTT_PORT ?? 1883),
  mqtt_user: process.env.MQTT_USER ?? "",
  mqtt_password: process.env.MQTT_PASSWORD ?? "",
  mqtt_topic_prefix: process.env.MQTT_TOPIC_PREFIX ?? "medication_tracker",
};

function yamlValue(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  const escaped = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

let text = fs.readFileSync(configPath, "utf8");

const optionsStart = text.indexOf("options:");
const schemaStart = text.indexOf("schema:");
if (optionsStart === -1 || schemaStart === -1 || schemaStart < optionsStart) {
  console.error("Could not find options/schema sections in config.yaml");
  process.exit(1);
}

let optionsBlock = text.slice(optionsStart, schemaStart);

for (const [key, value] of Object.entries(options)) {
  const re = new RegExp(`^(  ${key}:).*`, "m");
  if (!re.test(optionsBlock)) {
    console.error(`Missing option key in config.yaml options: ${key}`);
    process.exit(1);
  }
  optionsBlock = optionsBlock.replace(re, `$1 ${yamlValue(value)}`);
}

text = text.slice(0, optionsStart) + optionsBlock + text.slice(schemaStart);

fs.writeFileSync(configPath, text);
console.log(`Patched ${configPath} with deploy.local.env options`);
