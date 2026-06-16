import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type DoseLog, type Profile } from "../api";
import { useActiveProfile } from "../context/ProfileContext";
import {
  datetimeLocalToIso,
  formatDateTime,
  toDatetimeLocalValue,
} from "../utils/time";

function formatDayHeading(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function groupLogsByDay(logs: DoseLog[]): { heading: string; logs: DoseLog[] }[] {
  const groups = new Map<string, DoseLog[]>();
  for (const log of logs) {
    const key = log.taken_at.slice(0, 10);
    const list = groups.get(key) ?? [];
    list.push(log);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([_, dayLogs]) => ({
    heading: formatDayHeading(dayLogs[0].taken_at),
    logs: dayLogs,
  }));
}

export function DoseLogHistoryPage() {
  const { activeProfile } = useActiveProfile();
  const [searchParams] = useSearchParams();
  const profileIdParam = searchParams.get("profile_id");
  const profileId = profileIdParam
    ? Number(profileIdParam)
    : activeProfile?.id;

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [days, setDays] = useState(30);
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<DoseLog | null>(null);
  const [editTime, setEditTime] = useState("");
  const [saving, setSaving] = useState(false);

  const profileName = useMemo(() => {
    if (!profileId) return "";
    return profiles.find((p) => p.id === profileId)?.name ?? "Profile";
  }, [profiles, profileId]);

  const load = useCallback(async () => {
    if (!profileId || !Number.isFinite(profileId)) return;
    setLoading(true);
    setError("");
    try {
      const [profileRows, logRows] = await Promise.all([
        api.getProfiles(),
        api.getDoseLogs(profileId, days),
      ]);
      setProfiles(profileRows);
      setLogs(logRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dose history");
    } finally {
      setLoading(false);
    }
  }, [profileId, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => groupLogsByDay(logs), [logs]);

  const openEdit = (log: DoseLog) => {
    setEditing(log);
    setEditTime(toDatetimeLocalValue(new Date(log.taken_at)));
  };

  const saveEdit = async () => {
    if (!editing || !editTime) return;
    const iso = datetimeLocalToIso(editTime);
    if (new Date(iso).getTime() > Date.now()) {
      setError("Time cannot be in the future");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.updateDose(editing.id, iso);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update dose");
    } finally {
      setSaving(false);
    }
  };

  const removeLog = async (log: DoseLog) => {
    if (
      !confirm(
        `Remove ${log.medication_name} logged at ${formatDateTime(log.taken_at)}?`
      )
    ) {
      return;
    }
    setError("");
    try {
      await api.deleteDose(log.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete dose");
    }
  };

  if (!activeProfile) return null;

  if (!profileId || !Number.isFinite(profileId)) {
    return (
      <div className="page">
        <p className="error">Profile not specified.</p>
        <Link to="/">Back to My Meds</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="history-page-header">
        <div>
          <Link to="/" className="history-back">
            ← My Meds
          </Link>
          <h1>Dose history</h1>
          <p className="subtitle">{profileName}</p>
        </div>
        <label className="history-days-filter">
          Show
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </label>
      </div>

      {loading && <p className="muted">Loading...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && logs.length === 0 && (
        <p className="muted">No doses in this period.</p>
      )}

      {grouped.map((group) => (
        <section key={group.heading} className="card history-day-group">
          <h2 className="history-day-heading">{group.heading}</h2>
          <ul className="history-log-list">
            {group.logs.map((log) => (
              <li key={log.id} className="history-log-row">
                <div className="history-log-main">
                  <span className="log-time">
                    {formatDateTime(log.taken_at)}
                  </span>
                  <span className="log-med">{log.medication_name}</span>
                  {log.logged_by_name && (
                    <span className="log-by">logged by {log.logged_by_name}</span>
                  )}
                </div>
                <div className="history-log-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => openEdit(log)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => void removeLog(log)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h2>Edit dose time</h2>
            <p className="muted">{editing.medication_name}</p>
            <label className="time-picker-label">
              Taken at
              <input
                type="datetime-local"
                value={editTime}
                max={toDatetimeLocalValue()}
                onChange={(e) => setEditTime(e.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!editTime || saving}
                onClick={() => void saveEdit()}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
