import type { RowDataPacket } from "./dbTypes.js";
import { endOfLocalDay, startOfLocalDay } from "./medStatus.js";

export type DoseHistoryDay = {
  date: string;
  label: string;
};

export type DoseHistoryMed = {
  medication_id: number;
  medication_name: string;
  daily_counts: number[];
  total: number;
};

export type DoseHistoryResponse = {
  days: DoseHistoryDay[];
  medications: DoseHistoryMed[];
};

type AssignedMedRow = RowDataPacket & {
  id: number;
  name: string;
};

type CountRow = RowDataPacket & {
  dose_date: string | Date;
  medication_id: number;
  cnt: number;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Inclusive range of the last `dayCount` calendar days ending today (local time). */
export function lastNDaysRange(
  dayCount: number,
  now = new Date()
): {
  days: DoseHistoryDay[];
  rangeStart: Date;
  rangeEnd: Date;
} {
  const end = endOfLocalDay(now);
  const start = startOfLocalDay(now);
  start.setDate(start.getDate() - (dayCount - 1));

  const days: DoseHistoryDay[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push({
      date: formatDateKey(cursor),
      label: DAY_LABELS[cursor.getDay()],
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return { days, rangeStart: start, rangeEnd: end };
}

export async function getDoseHistoryForProfile(
  pool: { query: <T>(sql: string, params?: unknown[]) => Promise<[T, unknown]> },
  profileId: number,
  dayCount = 7
): Promise<DoseHistoryResponse> {
  const { days, rangeStart, rangeEnd } = lastNDaysRange(dayCount);

  const [assigned] = await pool.query<AssignedMedRow[]>(
    `SELECT m.id, m.name
     FROM medications m
     INNER JOIN profile_medications pm ON pm.medication_id = m.id
     WHERE pm.profile_id = ?
     ORDER BY m.name`,
    [profileId]
  );

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT DATE(dl.taken_at) AS dose_date, dl.medication_id, COUNT(*) AS cnt
     FROM dose_logs dl
     INNER JOIN profile_medications pm
       ON pm.profile_id = dl.profile_id AND pm.medication_id = dl.medication_id
     WHERE dl.profile_id = ?
       AND dl.taken_at >= ? AND dl.taken_at <= ?
     GROUP BY DATE(dl.taken_at), dl.medication_id`,
    [profileId, rangeStart, rangeEnd]
  );

  const countMap = new Map<string, number>();
  for (const row of countRows) {
    const dateKey =
      row.dose_date instanceof Date
        ? formatDateKey(row.dose_date)
        : String(row.dose_date).slice(0, 10);
    countMap.set(`${dateKey}|${row.medication_id}`, Number(row.cnt));
  }

  const medications: DoseHistoryMed[] = assigned.map((med) => {
    const daily_counts = days.map(
      (day) => countMap.get(`${day.date}|${med.id}`) ?? 0
    );
    return {
      medication_id: med.id,
      medication_name: med.name,
      daily_counts,
      total: daily_counts.reduce((sum, n) => sum + n, 0),
    };
  });

  return { days, medications };
}
