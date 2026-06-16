import pool, { type ProfileRow } from "../db.js";
import type { MedStatus } from "../medStatus.js";
import { getMedStatusesForProfile } from "../routes/profileMedications.js";

export type MqttMedState = {
  profileId: number;
  profileName: string;
  medicationId: number;
  state: MedStatus;
};

export async function gatherMqttStates(): Promise<MqttMedState[]> {
  const [profiles] = await pool.query<ProfileRow[]>(
    "SELECT id, name, created_at FROM profiles ORDER BY name"
  );

  const results: MqttMedState[] = [];
  for (const profile of profiles) {
    const medications = await getMedStatusesForProfile(profile.id);
    for (const med of medications) {
      results.push({
        profileId: profile.id,
        profileName: profile.name,
        medicationId: med.id,
        state: med,
      });
    }
  }
  return results;
}
