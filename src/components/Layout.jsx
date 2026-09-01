import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

function SidebarLink({ to, icon, badge, children }) {
  return (
    <li>
      <NavLink to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end={to === '/'}>
        <i className={`bi ${icon}`}></i>
        <span className="flex-grow-1">{children}</span>
        {badge > 0 && <span className="badge text-bg-danger rounded-pill">{badge}</span>}
      </NavLink>
    </li>
  );
}

export default function Layout({ children, header }) {
  const { profile, logout, isOwnerOrAdmin } = useAuth();
  const [pendingVoidCount, setPendingVoidCount] = useState(0);

  useEffect(() => {
    if (!isOwnerOrAdmin) return;
    const q = query(collection(db, 'sales'), where('voidStatus', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => setPendingVoidCount(snap.size));
    return unsub;
  }, [isOwnerOrAdmin]);

  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      <nav className="app-sidebar d-flex flex-column flex-shrink-0 p-3 text-white" style={{ width: 232 }}>
        <a href="/" className="brand d-flex align-items-center gap-2 mb-3 text-white text-decoration-none fs-5">
          <i className="bi bi-shop fs-4"></i>
          <span>Sarisari POS</span>
        </a>
        <hr />
        <ul className="nav nav-pills flex-column mb-auto gap-1">
          <SidebarLink to="/" icon="bi-grid-1x2-fill">Dashboard</SidebarLink>
          <SidebarLink to="/pos" icon="bi-cart3">POS</SidebarLink>
          <SidebarLink to="/inventory" icon="bi-box-seam-fill">Inventory</SidebarLink>
          {(profile?.role === 'owner' || profile?.role === 'admin') && (
            <SidebarLink to="/stock-in" icon="bi-box-arrow-in-down">Stock In</SidebarLink>
          )}
          <SidebarLink to="/reports" icon="bi-graph-up-arrow">Reports</SidebarLink>
          {isOwnerOrAdmin && (
            <SidebarLink to="/void-requests" icon="bi-shield-exclamation" badge={pendingVoidCount}>Void Requests</SidebarLink>
          )}
          {profile?.role === 'owner' && <SidebarLink to="/users" icon="bi-people-fill">Users</SidebarLink>}
        </ul>
        <hr />
        <div className="dropdown">
          <a href="#" className="d-flex align-items-center gap-2 text-white text-decoration-none dropdown-toggle" data-bs-toggle="dropdown">
            <span className="rounded-circle bg-white bg-opacity-10 d-inline-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 30, height: 30 }}>
              <i className="bi bi-person-fill"></i>
            </span>
            <span className="fw-semibold small text-truncate">{profile?.name}</span>
          </a>
          <ul className="dropdown-menu dropdown-menu-dark text-small shadow">
            <li className="dropdown-item-text text-secondary small text-capitalize">{profile?.role}</li>
            <li><NavLink className="dropdown-item d-flex align-items-center gap-2" to="/settings"><i className="bi bi-gear"></i> Settings</NavLink></li>
            <li><hr className="dropdown-divider" /></li>
            <li>
              <button className="dropdown-item d-flex align-items-center gap-2" onClick={logout}>
                <i className="bi bi-box-arrow-right"></i> Logout
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <main className="flex-grow-1 p-4" style={{ overflowY: 'auto' }}>
        {header && <div className="mb-4">{header}</div>}
        {children}
      </main>
    </div>
  );
}
