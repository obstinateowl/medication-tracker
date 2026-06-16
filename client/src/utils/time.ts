export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Ready";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Value for `<input type="datetime-local" />` in local time. */
export function toDatetimeLocalValue(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parse datetime-local input to ISO string for the API. */
export function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString();
}

export function intervalLabel(minutes: number | null): string {
  if (minutes == null) return "No fixed interval";
  if (minutes % 60 === 0 && minutes >= 60) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

const DEFAULT_WAITING_MESSAGE = "Next dose in {time}";

/** Format waiting status using optional template; `{time}` is replaced with countdown. */
export function formatWaitingMessage(
  template: string | null | undefined,
  countdown: string
): string {
  const t = template?.trim() || DEFAULT_WAITING_MESSAGE;
  if (t.includes("{time}")) {
    return t.replace("{time}", countdown);
  }
  return `${t} ${countdown}`;
}
