import type { CSSProperties } from "react";
import type { DoseHistoryResponse } from "../api";

const CHART_COLORS = [
  "var(--chart-0)",
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${Number(month)}/${Number(day)}`;
}

type Props = {
  history: DoseHistoryResponse;
};

export function DoseHistoryChart({ history }: Props) {
  const { days, medications } = history;

  if (medications.length === 0) {
    return null;
  }

  const maxCount = Math.max(
    1,
    ...medications.flatMap((med) => med.daily_counts)
  );

  const hasAnyDoses = medications.some((med) => med.total > 0);

  return (
    <section className="card dose-history-chart" aria-label="Last 7 days dose history">
      <h2 className="dose-history-title">Last 7 days</h2>

      <div className="dose-chart-legend">
        {medications.map((med, index) => (
          <span
            key={med.medication_id}
            className="dose-chart-legend-item"
            style={{ "--chart-color": CHART_COLORS[index % CHART_COLORS.length] } as CSSProperties}
          >
            <span className="dose-chart-swatch" aria-hidden />
            {med.medication_name}
            <span className="dose-chart-legend-total">({med.total})</span>
          </span>
        ))}
      </div>

      {!hasAnyDoses ? (
        <p className="muted dose-history-empty">No doses logged in the last 7 days.</p>
      ) : (
        <div className="dose-chart-plot" role="img">
          {days.map((day, dayIndex) => (
            <div key={day.date} className="dose-chart-day">
              <div className="dose-chart-bars">
                {medications.map((med, medIndex) => {
                  const count = med.daily_counts[dayIndex] ?? 0;
                  const heightPct = (count / maxCount) * 100;
                  return (
                    <div
                      key={med.medication_id}
                      className="dose-chart-bar-wrap"
                      title={`${med.medication_name}: ${count} on ${day.date}`}
                    >
                      <span
                        className="dose-chart-bar"
                        style={{
                          height: count > 0 ? `${Math.max(heightPct, 8)}%` : "0%",
                          background: CHART_COLORS[medIndex % CHART_COLORS.length],
                        }}
                      />
                      {count > 0 && (
                        <span className="dose-chart-bar-value">{count}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <span className="dose-chart-day-label">{day.label}</span>
              <span className="dose-chart-day-date">{shortDate(day.date)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
