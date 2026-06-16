import pool, { type ProfileRow } from "../db.js";
import type { MedStatus } from "../medStatus.js";
import { getProfileMedicationsForProfile } from "../profileMedicationQueries.js";

export type MqttMedState = {
  profileId: number;
  profileName: string;
  medicationId: number;
  state: MedStatus;
  notify_when_due: boolean;
  notify_minutes_before: number | null;
};

export async function gatherMqttStates(): Promise<MqttMedState[]> {
  const [profiles] = await pool.query<ProfileRow[]>(
    "SELECT id, name, created_at FROM profiles ORDER BY name"
  );

  const results: MqttMedState[] = [];
  for (const profile of profiles) {
    const medications = await getProfileMedicationsForProfile(profile.id);
    for (const med of medications) {
      const { notify_when_due, notify_minutes_before, ...state } = med;
      results.push({
        profileId: profile.id,
        profileName: profile.name,
        medicationId: med.id,
        state,
        notify_when_due,
        notify_minutes_before,
      });
    }
  }
  return results;
}
