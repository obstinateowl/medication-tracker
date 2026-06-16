import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type DoseHistoryResponse, type DoseLog, type MedStatus } from "../api";
import { DoseHistoryChart } from "../components/DoseHistoryChart";
import { MedCard } from "../components/MedCard";
import { TodaysLogSection } from "../components/TodaysLogSection";
import { useActiveProfile } from "../context/ProfileContext";

export function HomePage() {
  const { activeProfile } = useActiveProfile();
  const [medications, setMedications] = useState<MedStatus[]>([]);
  const [history, setHistory] = useState<DoseHistoryResponse | null>(null);
  const [logsToday, setLogsToday] = useState<DoseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingId, setLoggingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!activeProfile) return;
    setLoading(true);
    setError("");
    try {
      const [medData, historyData, todayLogs] = await Promise.all([
        api.getProfileMedications(activeProfile.id),
        api.getDoseHistory(activeProfile.id, 7),
        api.getDosesToday(activeProfile.id),
      ]);
      setMedications(medData);
      setHistory(historyData);
      setLogsToday(todayLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load medications");
    } finally {
      setLoading(false);
    }
  }, [activeProfile]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const logDose = async (med: MedStatus, takenAt?: string) => {
    if (!activeProfile) return;
    setLoggingId(med.id);
    setError("");
    try {
      await api.logDose({
        profile_id: activeProfile.id,
        medication_id: med.id,
        logged_by_profile_id: activeProfile.id,
        ...(takenAt ? { taken_at: takenAt } : {}),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log dose");
    } finally {
      setLoggingId(null);
    }
  };

  if (!activeProfile) return null;

  return (
    <div className="page">
      <h1>My medications</h1>
      {loading && <p className="muted">Loading...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && medications.length === 0 && (
        <div className="empty-state card">
          <p>No medications assigned to your quick buttons yet.</p>
          <Link to="/settings" className="btn btn-primary">
            Configure in Settings
          </Link>
        </div>
      )}

      <div className="med-grid">
        {medications.map((med) => (
          <MedCard
            key={med.id}
            med={med}
            targetProfileName={activeProfile.name}
            activeProfileId={activeProfile.id}
            targetProfileId={activeProfile.id}
            onLog={(m) => void logDose(m)}
            onLogAtTime={(m, takenAt) => void logDose(m, takenAt)}
            logging={loggingId === med.id}
          />
        ))}
      </div>

      {!loading && (
        <TodaysLogSection
          logs={logsToday}
          historyLink="/history"
        />
      )}

      {!loading && history && history.medications.length > 0 && (
        <DoseHistoryChart history={history} />
      )}
    </div>
  );
}
