import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!profile) {
    return (
      <div className="d-flex justify-content-center align-items-center flex-column" style={{ minHeight: '100vh' }}>
        <p className="text-secondary">Your account has no role assigned yet. Ask the store owner to set one up.</p>
      </div>
    );
  }

  if (!profile.isActive) {
    return (
      <div className="d-flex justify-content-center align-items-center flex-column" style={{ minHeight: '100vh' }}>
        <p className="text-danger">Your account has been deactivated.</p>
      </div>
    );
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
