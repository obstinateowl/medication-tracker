import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Profile } from "../api";

const STORAGE_KEY = "medtracker_active_profile_id";

type ProfileContextValue = {
  activeProfile: Profile | null;
  setActiveProfile: (profile: Profile | null) => void;
  loading: boolean;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({
  profiles,
  children,
}: {
  profiles: Profile[];
  children: ReactNode;
}) {
  const [activeProfile, setActiveProfileState] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && profiles.length > 0) {
      const match = profiles.find((p) => p.id === Number(stored));
      setActiveProfileState(match ?? profiles[0] ?? null);
    } else if (profiles.length === 1) {
      setActiveProfileState(profiles[0]);
    }
    setLoading(false);
  }, [profiles]);

  const setActiveProfile = (profile: Profile | null) => {
    setActiveProfileState(profile);
    if (profile) {
      localStorage.setItem(STORAGE_KEY, String(profile.id));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <ProfileContext.Provider value={{ activeProfile, setActiveProfile, loading }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useActiveProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useActiveProfile must be used within ProfileProvider");
  }
  return ctx;
}
