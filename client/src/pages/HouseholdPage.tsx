import { useCallback, useEffect, useState } from "react";
import { api, type HouseholdProfile, type MedStatus } from "../api";
import { MedCard } from "../components/MedCard";
import { TodaysLogSection } from "../components/TodaysLogSection";
import { useActiveProfile } from "../context/ProfileContext";
import { formatDateTime } from "../utils/time";

type PendingLog = {
  profileId: number;
  profileName: string;
  med: MedStatus;
  takenAt?: string;
};

export function HouseholdPage() {
  const { activeProfile } = useActiveProfile();
  const [overview, setOverview] = useState<HouseholdProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingKey, setLoggingKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingLog | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getHouseholdOverview();
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load household data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const performLog = async (pending: PendingLog) => {
    if (!activeProfile) return;
    const key = `${pending.profileId}-${pending.med.id}`;
    setLoggingKey(key);
    setError("");
    try {
      await api.logDose({
        profile_id: pending.profileId,
        medication_id: pending.med.id,
        logged_by_profile_id: activeProfile.id,
        ...(pending.takenAt ? { taken_at: pending.takenAt } : {}),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log dose");
    } finally {
      setLoggingKey(null);
      setConfirm(null);
    }
  };

  const requestLog = (pending: PendingLog) => {
    if (!activeProfile) return;
    if (pending.profileId !== activeProfile.id) {
      setConfirm(pending);
      return;
    }
    void performLog(pending);
  };

  if (!activeProfile) return null;

  return (
    <div className="page">
      <h1>Household</h1>
      <p className="subtitle">
        View everyone&apos;s timers and log doses on their behalf.
      </p>
      {loading && <p className="muted">Loading...</p>}
      {error && <p className="error">{error}</p>}

      {overview.map(({ profile, medications, logs_today }) => (
        <section key={profile.id} className="household-section card">
          <h2>{profile.name}</h2>

          {medications.length === 0 ? (
            <p className="muted">No medications assigned.</p>
          ) : (
            <div className="med-grid">
              {medications.map((med) => (
                <MedCard
                  key={med.id}
                  med={med}
                  targetProfileName={profile.name}
                  activeProfileId={activeProfile.id}
                  targetProfileId={profile.id}
                  onLog={(m) =>
                    requestLog({
                      profileId: profile.id,
                      profileName: profile.name,
                      med: m,
                    })
                  }
                  onLogAtTime={(m, takenAt) =>
                    requestLog({
                      profileId: profile.id,
                      profileName: profile.name,
                      med: m,
                      takenAt,
                    })
                  }
                  logging={loggingKey === `${profile.id}-${med.id}`}
                />
              ))}
            </div>
          )}

          <TodaysLogSection
            logs={logs_today}
            historyLink={`/history?profile_id=${profile.id}`}
          />
        </section>
      ))}

      {confirm && (
        <div className="modal-backdrop" onClick={() => setConfirm(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h2>Confirm dose</h2>
            <p>
              Log <strong>{confirm.med.name}</strong> for{" "}
              <strong>{confirm.profileName}</strong>
              {confirm.takenAt ? (
                <>
                  {" "}
                  at <strong>{formatDateTime(confirm.takenAt)}</strong>
                </>
              ) : null}
              ?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void performLog(confirm)}
              >
                Log dose
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
