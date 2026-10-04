import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useSyncStatus } from '../firebase/offline';

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
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { online, pending } = useSyncStatus();

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!isOwnerOrAdmin) return;
    const q = query(collection(db, 'sales'), where('voidStatus', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => setPendingVoidCount(snap.size));
    const unsubRequests = onSnapshot(
      query(collection(db, 'inventoryRequests'), where('status', '==', 'pending')),
      (snap) => setPendingRequestCount(snap.size),
    );
    return () => { unsub(); unsubRequests(); };
  }, [isOwnerOrAdmin]);

  const initials = (profile?.name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="d-flex app-shell" style={{ minHeight: '100vh' }}>
      {(!online || pending > 0) && (
        <div className={`sync-banner d-print-none ${online ? 'syncing' : 'offline'}`} role="status">
          <i className={`bi ${online ? 'bi-arrow-repeat' : 'bi-wifi-off'}`}></i>{' '}
          {online
            ? `Syncing ${pending} change${pending === 1 ? '' : 's'} to the server…`
            : `No internet — keep selling. Everything is saved on this device and will sync automatically.${pending ? ` (${pending} waiting)` : ''}`}
        </div>
      )}
      <header className="app-topbar d-lg-none d-print-none">
        <button type="button" className="btn btn-link text-white p-0 fs-3 lh-1" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          <i className="bi bi-list"></i>
        </button>
        <span className="fw-bold">Sarisari POS</span>
        <span className="avatar rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: 32, height: 32, fontSize: '0.8rem' }}>{initials}</span>
      </header>
      {menuOpen && <div className="app-backdrop d-lg-none" onClick={() => setMenuOpen(false)}></div>}
      <nav className={`app-sidebar d-flex flex-column flex-shrink-0 p-3 text-white ${menuOpen ? 'open' : ''}`}>
        <a href="/" className="brand d-flex align-items-center gap-2 mb-1 text-white text-decoration-none fs-5">
          <span className="brand-icon flex-shrink-0"><i className="bi bi-shop fs-6"></i></span>
          <span>Sarisari POS</span>
        </a>
        <hr />
        <ul className="nav nav-pills flex-column mb-auto gap-1">
          <SidebarLink to="/" icon="bi-grid-1x2-fill">Dashboard</SidebarLink>
          <SidebarLink to="/pos" icon="bi-cart3">POS</SidebarLink>
          <SidebarLink to="/inventory" icon="bi-box-seam-fill">Inventory</SidebarLink>
          <SidebarLink to="/stock-in" icon="bi-box-arrow-in-down">Stock In</SidebarLink>
          <SidebarLink to="/customers" icon="bi-people">Customers</SidebarLink>
          <SidebarLink to="/reports" icon="bi-graph-up-arrow">Reports</SidebarLink>
          <SidebarLink to="/expenses" icon="bi-wallet2">Expenses</SidebarLink>
          {isOwnerOrAdmin && <SidebarLink to="/approvals" icon="bi-clipboard-check" badge={pendingRequestCount}>Approvals</SidebarLink>}
          {isOwnerOrAdmin && (
            <SidebarLink to="/void-requests" icon="bi-shield-exclamation" badge={pendingVoidCount}>Void Requests</SidebarLink>
          )}
          {profile?.role === 'owner' && <SidebarLink to="/users" icon="bi-people-fill">Users</SidebarLink>}
        </ul>
        <hr />
        <div className="dropdown">
          <a href="#" className="user-chip d-flex align-items-center gap-2 text-white text-decoration-none dropdown-toggle" data-bs-toggle="dropdown">
            <span className="avatar rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 32, height: 32, fontSize: '0.8rem' }}>
              {initials}
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

      <main className="app-main flex-grow-1 p-3 p-md-4" style={{ overflowY: 'auto' }}>
        {header && <div className="page-header mb-3 mb-md-4">{header}</div>}
        {children}
      </main>
    </div>
  );
}
