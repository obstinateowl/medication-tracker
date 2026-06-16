import { useCallback, useEffect, useState } from "react";
import { api, type Medication, type Profile, type ProfileMedication } from "../api";
import { useActiveProfile } from "../context/ProfileContext";
import { intervalLabel } from "../utils/time";

export function SettingsPage() {
  const { activeProfile } = useActiveProfile();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [assignmentProfileId, setAssignmentProfileId] = useState<number | null>(
    null
  );
  const [assignedIds, setAssignedIds] = useState<Set<number>>(new Set());
  const [assignedMeds, setAssignedMeds] = useState<ProfileMedication[]>([]);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [medForm, setMedForm] = useState({
    name: "",
    intervalHours: "",
    intervalMinutes: "",
    maxPerDay: "",
    waitingMessage: "",
  });
  const [editingMedId, setEditingMedId] = useState<number | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [renameProfileId, setRenameProfileId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const loadBase = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profs, meds] = await Promise.all([
        api.getProfiles(),
        api.getMedications(),
      ]);
      setProfiles(profs);
      setMedications(meds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAssignments = useCallback(async (profileId: number) => {
    setLoadingAssignments(true);
    setError("");
    try {
      const assigned = await api.getProfileMedications(profileId);
      setAssignedMeds(assigned);
      setAssignedIds(new Set(assigned.map((m) => m.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assignments");
    } finally {
      setLoadingAssignments(false);
    }
  }, []);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (!activeProfile) return;
    setAssignmentProfileId((prev) => {
      if (prev != null && profiles.some((p) => p.id === prev)) return prev;
      return activeProfile.id;
    });
  }, [activeProfile, profiles]);

  useEffect(() => {
    if (assignmentProfileId == null) return;
    void loadAssignments(assignmentProfileId);
  }, [assignmentProfileId, loadAssignments]);

  const assignmentProfile = profiles.find((p) => p.id === assignmentProfileId);

  const resetMedForm = () => {
    setMedForm({
      name: "",
      intervalHours: "",
      intervalMinutes: "",
      maxPerDay: "",
      waitingMessage: "",
    });
    setEditingMedId(null);
  };

  const parseIntervalMinutes = (): number | null => {
    const hoursRaw = medForm.intervalHours.trim();
    const minsRaw = medForm.intervalMinutes.trim();
    if (!hoursRaw && !minsRaw) return null;
    const hours = Number(hoursRaw) || 0;
    const mins = Number(minsRaw) || 0;
    const total = hours * 60 + mins;
    return total > 0 ? total : null;
  };

  const handleMedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = medForm.name.trim();
    const intervalMinutes = parseIntervalMinutes();
    const maxPerDay = medForm.maxPerDay.trim()
      ? Number(medForm.maxPerDay)
      : null;
    const waitingMessage = medForm.waitingMessage.trim() || null;

    if (!name) {
      setError("Name is required");
      return;
    }
    if (
      (medForm.intervalHours.trim() || medForm.intervalMinutes.trim()) &&
      intervalMinutes == null
    ) {
      setError("Interval must be greater than zero when set");
      return;
    }

    setError("");
    try {
      const payload = {
        name,
        interval_minutes: intervalMinutes,
        max_per_day: maxPerDay,
        waiting_message: waitingMessage,
      };
      if (editingMedId) {
        await api.updateMedication(editingMedId, payload);
        setMessage("Medication updated");
      } else {
        await api.createMedication(payload);
        setMessage("Medication created");
      }
      resetMedForm();
      await loadBase();
      if (assignmentProfileId != null) {
        await loadAssignments(assignmentProfileId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save medication");
    }
  };

  const startEditMed = (med: Medication) => {
    setEditingMedId(med.id);
    setMedForm({
      name: med.name,
      intervalHours:
        med.interval_minutes != null
          ? String(Math.floor(med.interval_minutes / 60))
          : "",
      intervalMinutes:
        med.interval_minutes != null
          ? String(med.interval_minutes % 60)
          : "",
      maxPerDay: med.max_per_day != null ? String(med.max_per_day) : "",
      waitingMessage: med.waiting_message ?? "",
    });
  };

  const handleDeleteMed = async (id: number) => {
    if (!confirm("Delete this medication and all related logs?")) return;
    try {
      await api.deleteMedication(id);
      setMessage("Medication deleted");
      await loadBase();
      if (assignmentProfileId != null) {
        await loadAssignments(assignmentProfileId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const toggleAssigned = (medId: number) => {
    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(medId)) next.delete(medId);
      else next.add(medId);
      return next;
    });
  };

  const saveAssignments = async () => {
    if (assignmentProfileId == null) return;
    setError("");
    try {
      const updated = await api.setProfileMedications(assignmentProfileId, [
        ...assignedIds,
      ]);
      setAssignedMeds(updated);
      setAssignedIds(new Set(updated.map((m) => m.id)));
      const name = assignmentProfile?.name ?? "Profile";
      setMessage(`Quick buttons updated for ${name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save assignments");
    }
  };

  const updateNotification = (
    medId: number,
    patch: Partial<Pick<ProfileMedication, "notify_when_due" | "notify_minutes_before">>
  ) => {
    setAssignedMeds((prev) =>
      prev.map((m) => (m.id === medId ? { ...m, ...patch } : m))
    );
  };

  const saveNotifications = async () => {
    if (assignmentProfileId == null) return;
    setError("");
    setSavingNotifications(true);
    try {
      const updated = await api.setMedicationNotifications(
        assignmentProfileId,
        assignedMeds.map((m) => ({
          medication_id: m.id,
          notify_when_due: m.notify_when_due,
          notify_minutes_before: m.notify_minutes_before,
        }))
      );
      setAssignedMeds(updated);
      const name = assignmentProfile?.name ?? "Profile";
      setMessage(`Notification settings saved for ${name}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save notification settings"
      );
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newProfileName.trim();
    if (!name) return;
    try {
      const profile = await api.createProfile(name);
      setNewProfileName("");
      setMessage("Profile created");
      await loadBase();
      setAssignmentProfileId(profile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create profile");
    }
  };

  const handleRenameProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameProfileId) return;
    try {
      await api.updateProfile(renameProfileId, renameValue.trim());
      setRenameProfileId(null);
      setMessage("Profile renamed");
      await loadBase();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename profile");
    }
  };

  if (!activeProfile) return null;

  return (
    <div className="page settings">
      <h1>Settings</h1>
      {loading && <p className="muted">Loading...</p>}
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <section className="card">
        <h2>Medications (household)</h2>
        <form className="form-grid" onSubmit={handleMedSubmit}>
          <label>
            Name
            <input
              value={medForm.name}
              onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
              required
            />
          </label>
          <label>
            Interval (hours, optional)
            <input
              type="number"
              min="0"
              value={medForm.intervalHours}
              onChange={(e) =>
                setMedForm({ ...medForm, intervalHours: e.target.value })
              }
              placeholder="Leave blank for no timer"
            />
          </label>
          <label>
            Interval (minutes, optional)
            <input
              type="number"
              min="0"
              max="59"
              value={medForm.intervalMinutes}
              onChange={(e) =>
                setMedForm({ ...medForm, intervalMinutes: e.target.value })
              }
              placeholder="Leave blank for no timer"
            />
          </label>
          <label>
            Max per day (optional)
            <input
              type="number"
              min="1"
              value={medForm.maxPerDay}
              onChange={(e) =>
                setMedForm({ ...medForm, maxPerDay: e.target.value })
              }
              placeholder="No limit"
            />
          </label>
          <label>
            Waiting message (optional)
            <input
              value={medForm.waitingMessage}
              onChange={(e) =>
                setMedForm({ ...medForm, waitingMessage: e.target.value })
              }
              placeholder="Next dose in {time}"
            />
          </label>
          <p className="muted form-hint">
            Use {"{time}"} where the countdown should appear. Only applies when
            an interval is set.
          </p>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {editingMedId ? "Update medication" : "Add medication"}
            </button>
            {editingMedId && (
              <button type="button" className="btn" onClick={resetMedForm}>
                Cancel edit
              </button>
            )}
          </div>
        </form>

        <ul className="item-list">
          {medications.map((med) => (
            <li key={med.id}>
              <div>
                <strong>{med.name}</strong>
                <span className="muted">
                  {" "}
                  —{" "}
                  {med.interval_minutes != null
                    ? `every ${intervalLabel(med.interval_minutes)}`
                    : intervalLabel(null)}
                  {med.max_per_day != null
                    ? `, max ${med.max_per_day}/day`
                    : ""}
                </span>
              </div>
              <div className="item-actions">
                <button type="button" className="btn btn-sm" onClick={() => startEditMed(med)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => void handleDeleteMed(med.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Profiles</h2>
        <ul className="item-list">
          {profiles.map((p) => (
            <li key={p.id}>
              {renameProfileId === p.id ? (
                <form className="inline-form" onSubmit={handleRenameProfile}>
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="btn btn-sm btn-primary">
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setRenameProfileId(null)}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span>
                    {p.name}
                    {p.id === activeProfile.id && (
                      <span className="muted"> (you)</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setRenameProfileId(p.id);
                      setRenameValue(p.name);
                    }}
                  >
                    Rename
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        <form className="inline-form" onSubmit={handleCreateProfile}>
          <input
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="New profile name"
          />
          <button type="submit" className="btn btn-sm btn-primary">
            Add profile
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Quick buttons</h2>
        <p className="muted">
          Choose which medications appear on a profile&apos;s home screen.
        </p>
        <label className="profile-select-label">
          Profile
          <select
            value={assignmentProfileId ?? ""}
            onChange={(e) => setAssignmentProfileId(Number(e.target.value))}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.id === activeProfile.id ? " (you)" : ""}
              </option>
            ))}
          </select>
        </label>

        {medications.length === 0 ? (
          <p className="muted">Add medications above first.</p>
        ) : loadingAssignments ? (
          <p className="muted">Loading assignments...</p>
        ) : (
          <>
            <ul className="checkbox-list">
              {medications.map((med) => (
                <li key={med.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={assignedIds.has(med.id)}
                      onChange={() => toggleAssigned(med.id)}
                    />
                    {med.name}
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void saveAssignments()}
            >
              Save for {assignmentProfile?.name ?? "profile"}
            </button>
          </>
        )}
      </section>

      <section className="card">
        <h2>Notifications</h2>
        <p className="muted">
          Choose which assigned medications publish MQTT events for Home Assistant
          automations. Requires Mosquitto and the MQTT integration.
        </p>
        <label className="profile-select-label">
          Profile
          <select
            value={assignmentProfileId ?? ""}
            onChange={(e) => setAssignmentProfileId(Number(e.target.value))}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.id === activeProfile.id ? " (you)" : ""}
              </option>
            ))}
          </select>
        </label>

        {loadingAssignments ? (
          <p className="muted">Loading...</p>
        ) : assignedMeds.length === 0 ? (
          <p className="muted">
            Assign medications under Quick buttons first.
          </p>
        ) : (
          <>
            <ul className="notify-list">
              {assignedMeds.map((med) => (
                <li key={med.id} className="notify-row">
                  <div className="notify-row-main">
                    <strong>{med.name}</strong>
                    <label className="notify-toggle">
                      <input
                        type="checkbox"
                        checked={med.notify_when_due}
                        onChange={(e) =>
                          updateNotification(med.id, {
                            notify_when_due: e.target.checked,
                          })
                        }
                      />
                      Notify when due
                    </label>
                  </div>
                  <label className="notify-reminder">
                    Remind before (min)
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      placeholder="Off"
                      disabled={med.interval_minutes == null}
                      value={med.notify_minutes_before ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        updateNotification(med.id, {
                          notify_minutes_before: raw
                            ? Number(raw)
                            : null,
                        });
                      }}
                    />
                  </label>
                  {med.interval_minutes == null && (
                    <p className="muted notify-hint">
                      Early reminder requires an interval on the medication.
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-primary"
              disabled={savingNotifications}
              onClick={() => void saveNotifications()}
            >
              {savingNotifications
                ? "Saving..."
                : `Save notifications for ${assignmentProfile?.name ?? "profile"}`}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
