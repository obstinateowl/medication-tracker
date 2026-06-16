import { config } from "../config.js";
import { gatherMqttStates } from "./gatherStates.js";
import { processMqttEvents } from "./eventPublisher.js";
import { MqttHaPublisher } from "./publisher.js";

let publisher: MqttHaPublisher | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let refreshInFlight = false;

async function runSync(): Promise<void> {
  if (!publisher || refreshInFlight) return;
  refreshInFlight = true;
  try {
    const states = await gatherMqttStates();
    await publisher.sync(states);
    if (publisher.client) {
      processMqttEvents(publisher.client, states, config.mqtt.topicPrefix);
    }
  } catch (err) {
    console.error("[mqtt] Sync failed:", err);
  } finally {
    refreshInFlight = false;
  }
}

export function refreshMqttState(): void {
  void runSync();
}

export async function startMqttPoller(): Promise<void> {
  if (!config.mqtt.enabled) {
    console.log("[mqtt] Disabled (set mqtt_enabled / MQTT_ENABLED=true to enable)");
    return;
  }

  publisher = new MqttHaPublisher();
  try {
    await publisher.connect();
  } catch (err) {
    console.error(
      `[mqtt] Could not connect to ${config.mqtt.host}:${config.mqtt.port}:`,
      err
    );
    console.warn("[mqtt] App will run without MQTT; fix broker settings and restart.");
    publisher = null;
    return;
  }

  await runSync();

  pollTimer = setInterval(() => {
    void runSync();
  }, config.mqtt.pollIntervalMs);

  console.log(
    `[mqtt] Home Assistant discovery active (poll every ${config.mqtt.pollIntervalMs / 1000}s)`
  );
}

export async function stopMqttPoller(): Promise<void> {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (publisher) {
    await publisher.shutdown();
    publisher = null;
  }
}
