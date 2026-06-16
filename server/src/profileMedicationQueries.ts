import pool, { type CountRow, type LastDoseRow, type MedicationRow } from "./db.js";
import { MEDICATION_COLUMNS_M } from "./medicationFields.js";
import { computeMedStatus, startOfLocalDay, endOfLocalDay } from "./medStatus.js";
import type { MedStatus } from "./medStatus.js";

export type ProfileMedication = MedStatus & {
  notify_when_due: boolean;
  notify_minutes_before: number | null;
};

export async function getProfileMedicationsForProfile(
  profileId: number
): Promise<ProfileMedication[]> {
  const [rows] = await pool.query<
    (MedicationRow & {
      notify_when_due: number | boolean;
      notify_minutes_before: number | null;
    })[]
  >(
    `SELECT ${MEDICATION_COLUMNS_M},
            pm.notify_when_due, pm.notify_minutes_before
     FROM medications m
     INNER JOIN profile_medications pm ON pm.medication_id = m.id
     WHERE pm.profile_id = ?
     ORDER BY m.name`,
    [profileId]
  );

  const dayStart = startOfLocalDay();
  const dayEnd = endOfLocalDay();
  const now = new Date();

  const results: ProfileMedication[] = [];
  for (const med of rows) {
    const [countRows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) AS cnt FROM dose_logs
       WHERE profile_id = ? AND medication_id = ? AND taken_at >= ? AND taken_at <= ?`,
      [profileId, med.id, dayStart, dayEnd]
    );
    const [lastRows] = await pool.query<LastDoseRow[]>(
      `SELECT taken_at FROM dose_logs
       WHERE profile_id = ? AND medication_id = ?
       ORDER BY taken_at DESC LIMIT 1`,
      [profileId, med.id]
    );
    const status = computeMedStatus(
      med,
      countRows[0]?.cnt ?? 0,
      lastRows[0]?.taken_at ?? null,
      now
    );
    results.push({
      ...status,
      notify_when_due: Boolean(med.notify_when_due),
      notify_minutes_before: med.notify_minutes_before,
    });
  }
  return results;
}

export async function getMedStatusesForProfile(
  profileId: number
): Promise<MedStatus[]> {
  const meds = await getProfileMedicationsForProfile(profileId);
  return meds.map(
    ({ notify_when_due: _n, notify_minutes_before: _m, ...status }) => status
  );
}
