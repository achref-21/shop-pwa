import { Outlet, NavLink } from "react-router-dom";
import { useOnline } from "@/hooks/useOnline";
import "./AppLayout.css";

export default function AppLayout() {
  const isOnline = useOnline();

  return (
    <div className="app-shell">
      {/* Enhanced Header */}
      <header className="app-header">
        <div className="header-glow"></div>
        <div className="header-content">
          <div className="header-branding">
            <div className="header-icon-wrapper">
              <span className="header-icon">🏪</span>
            </div>
            <div className="header-text">
              <h1 className="header-title">ShopManager</h1>
              <p className="header-subtitle">Gestion commerciale simplifiée</p>
            </div>
          </div>
          <div className={`header-status ${!isOnline ? 'offline' : ''}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              {isOnline ? "En ligne" : "Hors ligne"}
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* Bottom navigation (mobile PWA) */}
      <nav className="bottom-nav">
        <NavLink 
          to="/paiements" 
          className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
        >
          <span className="nav-icon">💳</span>
          <span className="nav-label">Paiements</span>
        </NavLink>
        <NavLink 
          to="/recette" 
          className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
        >
          <span className="nav-icon">💰</span>
          <span className="nav-label">Recette</span>
        </NavLink>
        <NavLink 
          to="/fournisseurs" 
          className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
        >
          <span className="nav-icon">🏢</span>
          <span className="nav-label">Fournisseurs</span>
        </NavLink>
        <NavLink 
          to="/resume-journalier" 
          className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">Journalier</span>
        </NavLink>
        <NavLink 
          to="/synthese-periodique" 
          className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
        >
          <span className="nav-icon">📈</span>
          <span className="nav-label">Synthèse</span>
        </NavLink>
        <NavLink 
          to="/recherche-paiements" 
          className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
        >
          <span className="nav-icon">🔍</span>
          <span className="nav-label">Recherche</span>
        </NavLink>
      </nav>
    </div>
  );
}
