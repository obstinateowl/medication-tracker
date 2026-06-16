import { useState } from "react";
import { api, type Profile } from "../api";

type ProfilePickerProps = {
  profiles: Profile[];
  onSelect: (profile: Profile) => void;
  onProfileCreated: (profile: Profile) => void;
};

export function ProfilePicker({
  profiles,
  onSelect,
  onProfileCreated,
}: ProfilePickerProps) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError("");
    try {
      const profile = await api.createProfile(name);
      onProfileCreated(profile);
      onSelect(profile);
      setNewName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create profile");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page profile-picker">
      <h1>Who&apos;s using the app?</h1>
      <p className="subtitle">Select your profile or create a new one.</p>

      <div className="profile-grid">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            className="profile-btn"
            onClick={() => onSelect(profile)}
          >
            {profile.name}
          </button>
        ))}
      </div>

      <form className="card" onSubmit={handleCreate}>
        <h2>New profile</h2>
        <label>
          Name
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Mom"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={creating}>
          {creating ? "Creating..." : "Create profile"}
        </button>
      </form>
    </div>
  );
}
