import { NavLink, Outlet } from "react-router-dom";
import { useActiveProfile } from "../context/ProfileContext";

export function Layout() {
  const { activeProfile, setActiveProfile } = useActiveProfile();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-top">
          <h1 className="app-title">Med Tracker</h1>
          {activeProfile && (
            <button
              type="button"
              className="profile-switch"
              onClick={() => setActiveProfile(null)}
              title="Switch profile"
            >
              {activeProfile.name}
            </button>
          )}
        </div>
        <nav className="nav-tabs">
          <NavLink to="/" end>
            My Meds
          </NavLink>
          <NavLink to="/household">Household</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
