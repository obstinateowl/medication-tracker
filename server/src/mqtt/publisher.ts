import mqtt, { type MqttClient } from "mqtt";
import { config } from "../config.js";
import { discoveryObjectId, entityKey } from "./entityKey.js";
import type { MqttMedState } from "./gatherStates.js";

const DEVICE = {
  identifiers: ["medication_tracker"],
  name: "Medication Tracker",
  manufacturer: "Medication Tracker",
  model: "Household medications",
};

type DiscoverySpec = {
  component: "binary_sensor" | "sensor";
  objectId: string;
  payload: Record<string, unknown>;
};

function availabilityOptions(prefix: string) {
  return {
    availability_topic: `${prefix}/status`,
    payload_available: "online",
    payload_not_available: "offline",
  };
}

function buildDiscoverySpecs(
  entry: MqttMedState,
  stateTopic: string,
  prefix: string
): DiscoverySpec[] {
  const { profileId, profileName, medicationId, state } = entry;
  const label = `${profileName} ${state.name}`;
  const baseKey = entityKey(profileId, medicationId);
  const avail = availabilityOptions(prefix);
  const device = { device: DEVICE };

  return [
    {
      component: "binary_sensor",
      objectId: discoveryObjectId(profileId, medicationId, "due"),
      payload: {
        name: `${label} due`,
        unique_id: `medication_tracker_${baseKey}_due`,
        state_topic: stateTopic,
        value_template: "{{ 'ON' if value_json.can_take_now else 'OFF' }}",
        payload_on: "ON",
        payload_off: "OFF",
        icon: "mdi:pill",
        ...avail,
        ...device,
      },
    },
    {
      component: "sensor",
      objectId: discoveryObjectId(profileId, medicationId, "seconds"),
      payload: {
        name: `${label} seconds remaining`,
        unique_id: `medication_tracker_${baseKey}_seconds`,
        state_topic: stateTopic,
        value_template: "{{ value_json.seconds_remaining | int(0) }}",
        unit_of_measurement: "s",
        icon: "mdi:timer-sand",
        state_class: "measurement",
        ...avail,
        ...device,
      },
    },
    {
      component: "sensor",
      objectId: discoveryObjectId(profileId, medicationId, "next_dose"),
      payload: {
        name: `${label} next dose`,
        unique_id: `medication_tracker_${baseKey}_next_dose`,
        state_topic: stateTopic,
        value_template: "{{ value_json.next_allowed_at }}",
        device_class: "timestamp",
        icon: "mdi:clock-outline",
        ...avail,
        ...device,
      },
    },
    {
      component: "sensor",
      objectId: discoveryObjectId(profileId, medicationId, "doses_today"),
      payload: {
        name: `${label} doses today`,
        unique_id: `medication_tracker_${baseKey}_doses_today`,
        state_topic: stateTopic,
        value_template: "{{ value_json.doses_today | int(0) }}",
        state_class: "measurement",
        icon: "mdi:counter",
        ...avail,
        ...device,
      },
    },
  ];
}

function statePayload(entry: MqttMedState): string {
  const { profileName, state } = entry;
  return JSON.stringify({
    profile: profileName,
    medication: state.name,
    can_take_now: state.can_take_now,
    seconds_remaining: state.seconds_remaining,
    next_allowed_at: state.next_allowed_at,
    doses_today: state.doses_today,
    blocked_reason: state.blocked_reason,
    waiting_message: state.waiting_message,
  });
}

export class MqttHaPublisher {
  private client: MqttClient | null = null;
  private connected = false;
  private readonly knownDiscoveryKeys = new Set<string>();
  private readonly prefix = config.mqtt.topicPrefix;
  private readonly discoveryPrefix = config.mqtt.discoveryPrefix;

  async connect(): Promise<void> {
    const { host, port, user, password } = config.mqtt;
    const url = `mqtt://${host}:${port}`;
    const clientId = `medication_tracker_${Math.random().toString(16).slice(2, 10)}`;

    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect(url, {
        clientId,
        username: user || undefined,
        password: password || undefined,
        reconnectPeriod: 5000,
        connectTimeout: 10_000,
      });

      client.once("connect", () => {
        this.client = client;
        this.connected = true;
        console.log(`[mqtt] Connected to ${host}:${port}`);
        client.publish(`${this.prefix}/status`, "online", { retain: true, qos: 1 });
        resolve();
      });

      client.once("error", (err) => {
        client.end(true);
        reject(err);
      });

      client.on("reconnect", () => {
        console.log("[mqtt] Reconnecting...");
      });

      client.on("close", () => {
        this.connected = false;
      });
    });
  }

  async sync(states: MqttMedState[]): Promise<void> {
    if (!this.client || !this.connected) {
      return;
    }

    const currentKeys = new Set<string>();

    for (const entry of states) {
      const stateTopic = `${this.prefix}/profile/${entry.profileId}/med/${entry.medicationId}/state`;
      const specs = buildDiscoverySpecs(entry, stateTopic, this.prefix);

      for (const spec of specs) {
        const discoveryTopic = `${this.discoveryPrefix}/${spec.component}/medication_tracker/${spec.objectId}/config`;
        currentKeys.add(discoveryTopic);
        if (!this.knownDiscoveryKeys.has(discoveryTopic)) {
          this.client.publish(discoveryTopic, JSON.stringify(spec.payload), {
            retain: true,
            qos: 1,
          });
          this.knownDiscoveryKeys.add(discoveryTopic);
        }
      }

      this.client.publish(stateTopic, statePayload(entry), {
        retain: true,
        qos: 1,
      });
    }

    for (const oldTopic of this.knownDiscoveryKeys) {
      if (!currentKeys.has(oldTopic)) {
        this.client.publish(oldTopic, "", { retain: true, qos: 1 });
        this.knownDiscoveryKeys.delete(oldTopic);
      }
    }

    console.log(`[mqtt] Published ${states.length} medication state(s)`);
  }

  async shutdown(): Promise<void> {
    if (!this.client) return;
    this.client.publish(`${this.prefix}/status`, "offline", {
      retain: true,
      qos: 1,
    });
    await new Promise<void>((resolve) => {
      this.client!.end(false, {}, () => resolve());
    });
    this.client = null;
    this.connected = false;
  }
}
