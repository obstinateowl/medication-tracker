export function parseNotifyWhenDue(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function parseNotifyMinutesBefore(
  value: unknown
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 1440 || !Number.isInteger(n)) {
    return {
      ok: false,
      error: "notify_minutes_before must be between 1 and 1440, or empty",
    };
  }
  return { ok: true, value: n };
}
