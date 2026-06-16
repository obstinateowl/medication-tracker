import dotenv from "dotenv";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../../.env");
const isHaAddon = process.env.HA_ADDON === "1";
const isProduction = process.env.NODE_ENV === "production";

if (!isHaAddon && existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (!isHaAddon) {
  dotenv.config();
}

export const envPathResolved = envPath;
export const envFileFound = existsSync(envPath);

const defaultPort = isHaAddon ? 8099 : Number(process.env.PORT ?? 8099);
const serveStatic =
  process.env.SERVE_STATIC === "true" ||
  (isProduction && process.env.SERVE_STATIC !== "false");

export const config = {
  isHaAddon,
  isProduction,
  port: Number(process.env.PORT ?? defaultPort),
  host: process.env.HOST ?? "0.0.0.0",
  clientOrigins: isHaAddon || serveStatic
    ? true
    : (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
  db: {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "medication_tracker",
  },
  mqtt: {
    enabled:
      process.env.MQTT_ENABLED === "true" ||
      process.env.MQTT_ENABLED === "1",
    host: process.env.MQTT_HOST ?? "core-mosquitto",
    port: Number(process.env.MQTT_PORT ?? 1883),
    user: process.env.MQTT_USER ?? "",
    password: process.env.MQTT_PASSWORD ?? "",
    topicPrefix: process.env.MQTT_TOPIC_PREFIX ?? "medication_tracker",
    discoveryPrefix: process.env.MQTT_DISCOVERY_PREFIX ?? "homeassistant",
    pollIntervalMs: Number(process.env.MQTT_POLL_INTERVAL_MS ?? 60_000),
  },
  staticDir: serveStatic ? join(__dirname, "../../client/dist") : null,
};

/** Safe subset for logs and API responses — never includes password. */
export function getDbConfigPublic() {
  return {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    database: config.db.database,
    envFile: isHaAddon ? "(Home Assistant app options)" : envPathResolved,
    envFileFound: isHaAddon || envFileFound,
  };
}
