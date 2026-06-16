import { Link } from "react-router-dom";
import type { DoseLog } from "../api";
import { formatTime } from "../utils/time";

type Props = {
  logs: DoseLog[];
  historyLink: string;
  title?: string;
};

export function TodaysLogSection({
  logs,
  historyLink,
  title = "Today's log",
}: Props) {
  return (
    <div className="logs-section">
      <div className="logs-section-header">
        <h3>{title}</h3>
        <Link to={historyLink} className="btn btn-sm btn-secondary">
          Dose history
        </Link>
      </div>
      {logs.length === 0 ? (
        <p className="muted">No doses logged today.</p>
      ) : (
        <ul className="log-list">
          {logs.map((log) => (
            <li key={log.id}>
              <span className="log-time">{formatTime(log.taken_at)}</span>
              <span className="log-med">{log.medication_name}</span>
              {log.logged_by_name && (
                <span className="log-by">logged by {log.logged_by_name}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
