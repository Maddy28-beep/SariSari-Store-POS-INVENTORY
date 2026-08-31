import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function SidebarLink({ to, children }) {
  return (
    <li>
      <NavLink to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : 'text-white'}`}>
        {children}
      </NavLink>
    </li>
  );
}

export default function Layout({ children, header }) {
  const { profile, logout } = useAuth();

  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      <nav className="d-flex flex-column flex-shrink-0 p-3 bg-dark text-white" style={{ width: 220 }}>
        <a href="/" className="d-flex align-items-center mb-3 text-white text-decoration-none">
          <span className="fs-4">🏪 Sarisari POS</span>
        </a>
        <hr />
        <ul className="nav nav-pills flex-column mb-auto">
          <SidebarLink to="/">📊 Dashboard</SidebarLink>
          <SidebarLink to="/pos">🛒 POS</SidebarLink>
          <SidebarLink to="/inventory">📦 Inventory</SidebarLink>
          {(profile?.role === 'owner' || profile?.role === 'admin') && (
            <SidebarLink to="/stock-in">📥 Stock In</SidebarLink>
          )}
          <SidebarLink to="/reports">📈 Reports</SidebarLink>
          {profile?.role === 'owner' && <SidebarLink to="/users">👥 Users</SidebarLink>}
        </ul>
        <hr />
        <div className="dropdown">
          <a href="#" className="d-flex align-items-center text-white text-decoration-none dropdown-toggle" data-bs-toggle="dropdown">
            <span>{profile?.name}</span>
          </a>
          <ul className="dropdown-menu dropdown-menu-dark text-small shadow">
            <li className="dropdown-item-text text-secondary small">{profile?.role}</li>
            <li><NavLink className="dropdown-item" to="/settings">Settings</NavLink></li>
            <li><hr className="dropdown-divider" /></li>
            <li><button className="dropdown-item" onClick={logout}>🚪 Logout</button></li>
          </ul>
        </div>
      </nav>

      <main className="flex-grow-1 p-4" style={{ backgroundColor: '#f8f9fa', overflowY: 'auto' }}>
        {header && <div className="mb-4">{header}</div>}
        {children}
      </main>
    </div>
  );
}
