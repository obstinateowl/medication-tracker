import type { MedicationRow } from "./db.js";

export type MedStatus = {
  id: number;
  name: string;
  interval_minutes: number | null;
  max_per_day: number | null;
  waiting_message: string | null;
  doses_today: number;
  can_take_now: boolean;
  next_allowed_at: string | null;
  seconds_remaining: number;
  blocked_reason: "interval" | "max_per_day" | null;
};

export function startOfLocalDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfLocalDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function computeMedStatus(
  med: MedicationRow,
  dosesToday: number,
  lastTakenAt: Date | null,
  now = new Date()
): MedStatus {
  let canTakeNow = true;
  let blockedReason: MedStatus["blocked_reason"] = null;
  let nextAllowedAt: Date | null = null;
  let secondsRemaining = 0;

  if (med.max_per_day != null && dosesToday >= med.max_per_day) {
    canTakeNow = false;
    blockedReason = "max_per_day";
  }

  if (med.interval_minutes != null && lastTakenAt) {
    nextAllowedAt = new Date(
      lastTakenAt.getTime() + med.interval_minutes * 60_000
    );
    const diffMs = nextAllowedAt.getTime() - now.getTime();
    if (diffMs > 0) {
      canTakeNow = false;
      if (blockedReason === null) {
        blockedReason = "interval";
      }
      secondsRemaining = Math.ceil(diffMs / 1000);
    }
  }

  return {
    id: med.id,
    name: med.name,
    interval_minutes: med.interval_minutes,
    max_per_day: med.max_per_day,
    waiting_message: med.waiting_message,
    doses_today: dosesToday,
    can_take_now: canTakeNow,
    next_allowed_at: nextAllowedAt?.toISOString() ?? null,
    seconds_remaining: secondsRemaining,
    blocked_reason: blockedReason,
  };
}
