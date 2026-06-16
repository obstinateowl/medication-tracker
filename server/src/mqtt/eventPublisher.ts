import type { MqttClient } from "mqtt";
import type { MqttMedState } from "./gatherStates.js";

type EdgeState = {
  lastCanTakeNow: boolean | null;
  reminderSent: boolean;
  initialized: boolean;
};

const edgeStateByKey = new Map<string, EdgeState>();

function stateKey(profileId: number, medicationId: number): string {
  return `p${profileId}_m${medicationId}`;
}

function publishJson(
  client: MqttClient,
  topic: string,
  payload: Record<string, unknown>
): void {
  client.publish(topic, JSON.stringify(payload), { qos: 1, retain: false });
}

export function processMqttEvents(
  client: MqttClient,
  states: MqttMedState[],
  topicPrefix: string
): void {
  const currentKeys = new Set<string>();

  for (const entry of states) {
    const key = stateKey(entry.profileId, entry.medicationId);
    currentKeys.add(key);

    let edge = edgeStateByKey.get(key);
    if (!edge) {
      edge = { lastCanTakeNow: null, reminderSent: false, initialized: false };
      edgeStateByKey.set(key, edge);
    }

    const { state, notify_when_due, notify_minutes_before, profileName } = entry;

    if (!edge.initialized) {
      edge.lastCanTakeNow = state.can_take_now;
      edge.reminderSent = false;
      edge.initialized = true;
      continue;
    }

    if (
      notify_when_due &&
      edge.lastCanTakeNow === false &&
      state.can_take_now
    ) {
      publishJson(client, `${topicPrefix}/events/due`, {
        event: "due",
        profile_id: entry.profileId,
        profile: profileName,
        medication_id: entry.medicationId,
        medication: state.name,
        blocked_reason: state.blocked_reason,
      });
    }

    if (
      notify_minutes_before != null &&
      state.interval_minutes != null &&
      !state.can_take_now &&
      state.seconds_remaining > 0 &&
      state.seconds_remaining <= notify_minutes_before * 60 &&
      !edge.reminderSent
    ) {
      publishJson(client, `${topicPrefix}/events/reminder`, {
        event: "reminder",
        profile_id: entry.profileId,
        profile: profileName,
        medication_id: entry.medicationId,
        medication: state.name,
        minutes_before: notify_minutes_before,
        seconds_remaining: state.seconds_remaining,
        next_allowed_at: state.next_allowed_at,
      });
      edge.reminderSent = true;
    }

    if (edge.lastCanTakeNow === true && !state.can_take_now) {
      edge.reminderSent = false;
    }
    if (state.can_take_now) {
      edge.reminderSent = false;
    }

    edge.lastCanTakeNow = state.can_take_now;
  }

  for (const key of edgeStateByKey.keys()) {
    if (!currentKeys.has(key)) {
      edgeStateByKey.delete(key);
    }
  }
}

export function resetMqttEventState(): void {
  edgeStateByKey.clear();
}
