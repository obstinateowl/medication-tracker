export const MEDICATION_COLUMNS =
  "id, name, interval_minutes, max_per_day, waiting_message, created_at";

export const MEDICATION_COLUMNS_M = MEDICATION_COLUMNS.split(", ")
  .map((col) => `m.${col}`)
  .join(", ");

export function parseOptionalIntervalMinutes(
  value: unknown
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return {
      ok: false,
      error: "interval_minutes must be a positive number when set",
    };
  }
  return { ok: true, value: Math.round(n) };
}

export function parseWaitingMessage(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value).trim();
  return s || null;
}
