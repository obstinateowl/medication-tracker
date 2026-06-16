import type { DoseLogRow } from "./dbTypes.js";
import { lastNDaysRange } from "./doseHistory.js";

const DOSE_LOG_SELECT = `
  SELECT dl.id, dl.profile_id, dl.medication_id, dl.taken_at, dl.logged_by_profile_id,
         m.name AS medication_name,
         lb.name AS logged_by_name
  FROM dose_logs dl
  INNER JOIN medications m ON m.id = dl.medication_id
  LEFT JOIN profiles lb ON lb.id = dl.logged_by_profile_id
`;

export async function fetchDoseLogById(
  pool: { query: <T>(sql: string, params?: unknown[]) => Promise<[T, unknown]> },
  logId: number
): Promise<DoseLogRow | null> {
  const [rows] = await pool.query<DoseLogRow[]>(
    `${DOSE_LOG_SELECT} WHERE dl.id = ?`,
    [logId]
  );
  return rows[0] ?? null;
}

export async function fetchDoseLogsForProfile(
  pool: { query: <T>(sql: string, params?: unknown[]) => Promise<[T, unknown]> },
  profileId: number,
  days = 30
): Promise<DoseLogRow[]> {
  const { rangeStart } = lastNDaysRange(days);
  const [rows] = await pool.query<DoseLogRow[]>(
    `${DOSE_LOG_SELECT}
     WHERE dl.profile_id = ? AND dl.taken_at >= ?
     ORDER BY dl.taken_at DESC
     LIMIT 500`,
    [profileId, rangeStart]
  );
  return rows;
}

export { DOSE_LOG_SELECT };
