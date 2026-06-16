import { useEffect, useState } from "react";
import type { MedStatus } from "../api";
import {
  datetimeLocalToIso,
  formatCountdown,
  formatDateTime,
  formatWaitingMessage,
  toDatetimeLocalValue,
} from "../utils/time";

type MedCardProps = {
  med: MedStatus;
  targetProfileName: string;
  activeProfileId: number;
  targetProfileId: number;
  onLog: (med: MedStatus) => void;
  onLogAtTime: (med: MedStatus, takenAt: string) => void;
  logging?: boolean;
};

export function MedCard({
  med,
  targetProfileName,
  activeProfileId,
  targetProfileId,
  onLog,
  onLogAtTime,
  logging = false,
}: MedCardProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(med.seconds_remaining);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [timeValue, setTimeValue] = useState(() => toDatetimeLocalValue());

  useEffect(() => {
    setSecondsRemaining(med.seconds_remaining);
  }, [med.seconds_remaining, med.id]);

  useEffect(() => {
    if (med.can_take_now || !med.next_allowed_at) return;

    const tick = () => {
      const diff = Math.ceil(
        (new Date(med.next_allowed_at!).getTime() - Date.now()) / 1000
      );
      setSecondsRemaining(Math.max(0, diff));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [med.can_take_now, med.next_allowed_at]);

  const canTake =
    med.can_take_now ||
    (secondsRemaining <= 0 && med.blocked_reason === "interval");
  const isBlockedByMax = med.blocked_reason === "max_per_day";
  const loggingForOther = targetProfileId !== activeProfileId;

  let statusText = "Ready to take";
  if (isBlockedByMax) {
    statusText = "Max reached today";
  } else if (!canTake && med.interval_minutes != null) {
    statusText = formatWaitingMessage(
      med.waiting_message,
      formatCountdown(secondsRemaining)
    );
  }

  const openTimeModal = () => {
    setTimeValue(toDatetimeLocalValue());
    setShowTimeModal(true);
  };

  const submitTimeLog = () => {
    if (!timeValue) return;
    const iso = datetimeLocalToIso(timeValue);
    if (new Date(iso).getTime() > Date.now()) return;
    setShowTimeModal(false);
    onLogAtTime(med, iso);
  };

  const previewIso = timeValue ? datetimeLocalToIso(timeValue) : "";
  const timeInFuture = previewIso
    ? new Date(previewIso).getTime() > Date.now()
    : false;

  return (
    <>
      <article className="med-card">
        <div className="med-card-header">
          <h3>{med.name}</h3>
          <span className="dose-count">
            {med.doses_today}
            {med.max_per_day != null ? `/${med.max_per_day}` : ""}
          </span>
        </div>
        <p className={`med-status ${canTake ? "ready" : "waiting"}`}>{statusText}</p>
        <div className="med-actions">
          <button
            type="button"
            className="btn btn-primary btn-log"
            disabled={!canTake || logging}
            onClick={() => onLog(med)}
          >
            {logging
              ? "Logging..."
              : loggingForOther
                ? `Log for ${targetProfileName}`
                : "Log dose"}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={logging}
            onClick={openTimeModal}
          >
            Log at time
          </button>
        </div>
      </article>

      {showTimeModal && (
        <div className="modal-backdrop" onClick={() => setShowTimeModal(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h2>Log at specific time</h2>
            <p className="muted">
              {med.name}
              {loggingForOther ? ` for ${targetProfileName}` : ""}
            </p>
            <label className="time-picker-label">
              When was it taken?
              <input
                type="datetime-local"
                value={timeValue}
                max={toDatetimeLocalValue()}
                onChange={(e) => setTimeValue(e.target.value)}
              />
            </label>
            {timeInFuture && (
              <p className="error">Time cannot be in the future</p>
            )}
            {previewIso && !timeInFuture && (
              <p className="muted preview-time">
                Logging as {formatDateTime(previewIso)}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setShowTimeModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!timeValue || timeInFuture || logging}
                onClick={submitTimeLog}
              >
                Log dose
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
