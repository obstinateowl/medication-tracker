import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  api,
  ApiError,
  getRouterBasename,
  type HealthResponse,
  type Profile,
} from "./api";
import { Layout } from "./components/Layout";
import {
  ProfileProvider,
  useActiveProfile,
} from "./context/ProfileContext";
import { HomePage } from "./pages/HomePage";
import { DoseLogHistoryPage } from "./pages/DoseLogHistoryPage";
import { HouseholdPage } from "./pages/HouseholdPage";
import { ProfilePicker } from "./pages/ProfilePicker";
import { SettingsPage } from "./pages/SettingsPage";

type BootState =
  | { status: "loading" }
  | { status: "api_down"; error: ApiError }
  | { status: "db_down"; health: HealthResponse }
  | { status: "ready"; profiles: Profile[] };

function ConnectionErrorPanel({
  title,
  message,
  code,
  hint,
  details,
  config,
  onRetry,
}: {
  title: string;
  message: string;
  code?: string | null;
  hint?: string | null;
  details?: string | null;
  config?: HealthResponse["database"]["config"];
  onRetry: () => void;
}) {
  return (
    <div className="page connection-error">
      <h1>{title}</h1>
      <p className="error">{message}</p>

      <div className="troubleshoot card">
        {code && (
          <p>
            <strong>Error code:</strong> <code>{code}</code>
          </p>
        )}
        {hint && (
          <p>
            <strong>What to try:</strong> {hint}
          </p>
        )}
        {details && (
          <p>
            <strong>Details:</strong> <code>{details}</code>
          </p>
        )}
        {config && (
          <div className="config-summary">
            <strong>Configured connection</strong>
            <ul>
              <li>
                Host: <code>{config.host}:{config.port}</code>
              </li>
              <li>
                Database: <code>{config.database}</code>
              </li>
              <li>
                User: <code>{config.user}</code>
              </li>
              <li>
                .env found: {config.envFileFound ? "yes" : "no"}
              </li>
            </ul>
          </div>
        )}
        {!window.location.pathname.includes("/api/hassio_ingress/") && (
          <p className="muted">
            CLI check: <code>npm run check-db</code> from the project root.
          </p>
        )}
      </div>

      <button type="button" className="btn btn-primary" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function AppRoutes() {
  const [boot, setBoot] = useState<BootState>({ status: "loading" });

  const bootstrap = useCallback(async () => {
    setBoot({ status: "loading" });
    try {
      const health = await api.getHealth();
      if (!health.database.ok) {
        setBoot({ status: "db_down", health });
        return;
      }
      const profiles = await api.getProfiles();
      setBoot({ status: "ready", profiles });
    } catch (err) {
      setBoot({
        status: "api_down",
        error:
          err instanceof ApiError
            ? err
            : new ApiError(err instanceof Error ? err.message : "Unknown error"),
      });
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (boot.status === "loading") {
    return (
      <div className="page">
        <p className="muted">Connecting...</p>
      </div>
    );
  }

  if (boot.status === "api_down") {
    const inHaIngress =
      window.__INGRESS_PATH__ != null ||
      window.location.pathname.includes("/api/hassio_ingress/");
    return (
      <ConnectionErrorPanel
        title="API server unreachable"
        message={boot.error.message}
        code={boot.error.code}
        hint={
          boot.error.hint ??
          (inHaIngress
            ? "Open the app from Home Assistant sidebar (Ingress). Check the add-on log for startup errors."
            : "Run npm run dev from the project root (API on port 3001, Vite on 5173).")
        }
        details={boot.error.details}
        onRetry={() => void bootstrap()}
      />
    );
  }

  if (boot.status === "db_down") {
    const db = boot.health.database;
    return (
      <ConnectionErrorPanel
        title="Database connection failed"
        message={db.message ?? "Cannot connect to MariaDB"}
        code={db.code}
        hint={db.hint}
        details={db.details}
        config={db.config}
        onRetry={() => void bootstrap()}
      />
    );
  }

  return (
    <ProfileProvider profiles={boot.profiles}>
      <AppContent
        profiles={boot.profiles}
        onProfileCreated={(p) =>
          setBoot((prev) =>
            prev.status === "ready"
              ? { status: "ready", profiles: [...prev.profiles, p] }
              : prev
          )
        }
      />
    </ProfileProvider>
  );
}

function AppContent({
  profiles,
  onProfileCreated,
}: {
  profiles: Profile[];
  onProfileCreated: (p: Profile) => void;
}) {
  const { activeProfile, setActiveProfile, loading } = useActiveProfile();

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading...</p>
      </div>
    );
  }

  if (!activeProfile) {
    return (
      <ProfilePicker
        profiles={profiles}
        onSelect={setActiveProfile}
        onProfileCreated={onProfileCreated}
      />
    );
  }

  return (
    <BrowserRouter basename={getRouterBasename()}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="history" element={<DoseLogHistoryPage />} />
          <Route path="household" element={<HouseholdPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return <AppRoutes />;
}
