export type Profile = {
  id: number;
  name: string;
  created_at: string;
};

export type Medication = {
  id: number;
  name: string;
  interval_minutes: number | null;
  max_per_day: number | null;
  waiting_message: string | null;
  created_at: string;
};

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

export type ProfileMedication = MedStatus & {
  notify_when_due: boolean;
  notify_minutes_before: number | null;
};

export type DoseLog = {
  id: number;
  profile_id: number;
  medication_id: number;
  taken_at: string;
  logged_by_profile_id: number | null;
  medication_name?: string;
  logged_by_name?: string | null;
};

export type HouseholdProfile = {
  profile: Profile;
  medications: MedStatus[];
  logs_today: DoseLog[];
};

export type DbHealth = {
  ok: boolean;
  latencyMs?: number;
  message?: string;
  code?: string | null;
  hint?: string;
  details?: string;
  config?: {
    host: string;
    port: number;
    user: string;
    database: string;
    envFile: string;
    envFileFound: boolean;
  };
};

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

export type HealthResponse = {
  ok: boolean;
  api: boolean;
  database: DbHealth;
};

export class ApiError extends Error {
  code: string | null;
  hint: string | null;
  details: string | null;

  constructor(
    message: string,
    opts?: { code?: string | null; hint?: string | null; details?: string | null }
  ) {
    super(message);
    this.name = "ApiError";
    this.code = opts?.code ?? null;
    this.hint = opts?.hint ?? null;
    this.details = opts?.details ?? null;
  }
}

declare global {
  interface Window {
    __INGRESS_PATH__?: string;
  }
}

function resolveApiPath(path: string): string {
  if (!path.startsWith("/api")) return path;
  const suffix = path.slice(4);
  const ingress = window.__INGRESS_PATH__;
  if (ingress) {
    const base = ingress.replace(/\/$/, "");
    return `${base}/api${suffix}`;
  }
  // Relative path keeps requests under the HA ingress URL when __INGRESS_PATH__ is missing
  return `./api${suffix}`;
}

export function getRouterBasename(): string {
  const ingress = window.__INGRESS_PATH__;
  if (!ingress) return "/";
  return ingress.replace(/\/$/, "") || "/";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(resolveApiPath(path), {
      headers: { "Content-Type": "application/json", ...init?.headers },
      ...init,
    });
  } catch {
    throw new ApiError(
      "Cannot reach the API server. Is it running? Start with: npm run dev",
      {
        hint: "From the project root, run npm run dev. The API should listen on port 3001 and Vite on port 5173.",
      }
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `Request failed (${res.status})`, {
      code: body.code ?? null,
      hint: body.hint ?? null,
      details: body.details ?? null,
    });
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const api = {
  getHealth: () => request<HealthResponse>("/api/health"),
  getProfiles: () => request<Profile[]>("/api/profiles"),
  createProfile: (name: string) =>
    request<Profile>("/api/profiles", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  updateProfile: (id: number, name: string) =>
    request<Profile>(`/api/profiles/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
  getProfileMedications: (profileId: number) =>
    request<ProfileMedication[]>(`/api/profiles/${profileId}/medications`),
  setProfileMedications: (profileId: number, medicationIds: number[]) =>
    request<ProfileMedication[]>(`/api/profiles/${profileId}/medications`, {
      method: "PUT",
      body: JSON.stringify({ medication_ids: medicationIds }),
    }),
  setMedicationNotifications: (
    profileId: number,
    settings: {
      medication_id: number;
      notify_when_due: boolean;
      notify_minutes_before: number | null;
    }[]
  ) =>
    request<ProfileMedication[]>(
      `/api/profiles/${profileId}/medication-notifications`,
      {
        method: "PUT",
        body: JSON.stringify({ settings }),
      }
    ),
  getMedications: () => request<Medication[]>("/api/medications"),
  createMedication: (data: {
    name: string;
    interval_minutes?: number | null;
    max_per_day?: number | null;
    waiting_message?: string | null;
  }) =>
    request<Medication>("/api/medications", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateMedication: (
    id: number,
    data: {
      name: string;
      interval_minutes?: number | null;
      max_per_day?: number | null;
      waiting_message?: string | null;
    }
  ) =>
    request<Medication>(`/api/medications/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteMedication: (id: number) =>
    request<void>(`/api/medications/${id}`, { method: "DELETE" }),
  logDose: (data: {
    profile_id: number;
    medication_id: number;
    logged_by_profile_id?: number;
    taken_at?: string;
  }) =>
    request<{ log: DoseLog; status: MedStatus }>("/api/doses", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getDosesToday: (profileId?: number) =>
    request<DoseLog[]>(
      profileId
        ? `/api/doses/today?profile_id=${profileId}`
        : "/api/doses/today"
    ),
  getDoseHistory: (profileId: number, days = 7) =>
    request<DoseHistoryResponse>(
      `/api/doses/history?profile_id=${profileId}&days=${days}`
    ),
  getDoseLogs: (profileId: number, days = 30) =>
    request<DoseLog[]>(
      `/api/doses/logs?profile_id=${profileId}&days=${days}`
    ),
  updateDose: (id: number, taken_at: string) =>
    request<DoseLog>(`/api/doses/${id}`, {
      method: "PUT",
      body: JSON.stringify({ taken_at }),
    }),
  deleteDose: (id: number) =>
    request<void>(`/api/doses/${id}`, { method: "DELETE" }),
  getHouseholdOverview: () =>
    request<HouseholdProfile[]>("/api/household/overview"),
};
