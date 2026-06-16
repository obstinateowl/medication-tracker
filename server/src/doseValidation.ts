import pool, { type CountRow, type LastDoseRow, type MedicationRow } from "./db.js";
import { computeMedStatus, startOfLocalDay, endOfLocalDay } from "./medStatus.js";

export type DoseValidationResult =
  | { ok: true }
  | { ok: false; error: string; blocked_reason?: "interval" | "max_per_day" };

export async function validateImmediateDose(
  profileId: number,
  medicationId: number,
  med: MedicationRow,
  now = new Date()
): Promise<DoseValidationResult> {
  const dayStart = startOfLocalDay(now);
  const dayEnd = endOfLocalDay(now);

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS cnt FROM dose_logs
     WHERE profile_id = ? AND medication_id = ? AND taken_at >= ? AND taken_at <= ?`,
    [profileId, medicationId, dayStart, dayEnd]
  );
  const dosesToday = countRows[0]?.cnt ?? 0;

  const [lastRows] = await pool.query<LastDoseRow[]>(
    `SELECT taken_at FROM dose_logs
     WHERE profile_id = ? AND medication_id = ?
     ORDER BY taken_at DESC LIMIT 1`,
    [profileId, medicationId]
  );
  const lastTakenAt = lastRows[0]?.taken_at ?? null;

  const status = computeMedStatus(med, dosesToday, lastTakenAt, now);
  if (!status.can_take_now) {
    return {
      ok: false,
      error:
        status.blocked_reason === "max_per_day"
          ? "Maximum doses per day reached"
          : "Interval timer has not elapsed",
      blocked_reason: status.blocked_reason ?? undefined,
    };
  }

  return { ok: true };
}

export async function validateBackdatedDose(
  profileId: number,
  medicationId: number,
  med: MedicationRow,
  takenAt: Date,
  now = new Date(),
  excludeLogId?: number
): Promise<DoseValidationResult> {
  if (takenAt.getTime() > now.getTime()) {
    return { ok: false, error: "Cannot log a dose in the future" };
  }

  const dayStart = startOfLocalDay(takenAt);
  const dayEnd = endOfLocalDay(takenAt);
  const excludeClause = excludeLogId != null ? " AND id != ?" : "";
  const countParams: unknown[] = [profileId, medicationId, dayStart, dayEnd];
  if (excludeLogId != null) countParams.push(excludeLogId);

  const [countRows] = await pool.query<CountRow[]>(
    `SELECT COUNT(*) AS cnt FROM dose_logs
     WHERE profile_id = ? AND medication_id = ? AND taken_at >= ? AND taken_at <= ?${excludeClause}`,
    countParams
  );
  const dosesOnDay = countRows[0]?.cnt ?? 0;

  if (med.max_per_day != null && dosesOnDay >= med.max_per_day) {
    return {
      ok: false,
      error: "Maximum doses per day reached for that date",
      blocked_reason: "max_per_day",
    };
  }

  if (med.interval_minutes != null) {
    const intervalMs = med.interval_minutes * 60_000;

    const prevParams: unknown[] = [profileId, medicationId, takenAt];
    if (excludeLogId != null) prevParams.push(excludeLogId);
    const [prevRows] = await pool.query<LastDoseRow[]>(
      `SELECT taken_at FROM dose_logs
       WHERE profile_id = ? AND medication_id = ? AND taken_at < ?${excludeClause}
       ORDER BY taken_at DESC LIMIT 1`,
      prevParams
    );
    if (prevRows[0]) {
      const earliest = prevRows[0].taken_at.getTime() + intervalMs;
      if (takenAt.getTime() < earliest) {
        return {
          ok: false,
          error: "Too soon after the previous dose",
          blocked_reason: "interval",
        };
      }
    }

    const nextParams: unknown[] = [profileId, medicationId, takenAt];
    if (excludeLogId != null) nextParams.push(excludeLogId);
    const [nextRows] = await pool.query<LastDoseRow[]>(
      `SELECT taken_at FROM dose_logs
       WHERE profile_id = ? AND medication_id = ? AND taken_at > ?${excludeClause}
       ORDER BY taken_at ASC LIMIT 1`,
      nextParams
    );
    if (nextRows[0]) {
      const latest = nextRows[0].taken_at.getTime() - intervalMs;
      if (takenAt.getTime() > latest) {
        return {
          ok: false,
          error: "Too close to a dose logged after this time",
          blocked_reason: "interval",
        };
      }
    }
  }

  return { ok: true };
}

export async function validateEditedDose(
  logId: number,
  profileId: number,
  medicationId: number,
  med: MedicationRow,
  takenAt: Date,
  now = new Date()
): Promise<DoseValidationResult> {
  return validateBackdatedDose(
    profileId,
    medicationId,
    med,
    takenAt,
    now,
    logId
  );
}

export function parseTakenAt(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}
