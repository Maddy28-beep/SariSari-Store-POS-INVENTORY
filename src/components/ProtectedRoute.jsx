import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, profile, loading, profileError, logout } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (profileError) {
    return (
      <div className="d-flex justify-content-center align-items-center flex-column text-center p-4" style={{ minHeight: '100vh' }}>
        <i className="bi bi-exclamation-triangle-fill text-danger fs-2 mb-2"></i>
        <p className="text-danger fw-semibold">Couldn't load your account profile.</p>
        <p className="text-secondary small" style={{ maxWidth: 480 }}>
          {profileError.code === 'permission-denied'
            ? 'Firestore is blocking this read — the security rules probably haven\'t been deployed yet ' +
              '(run "firebase deploy --only firestore:rules,firestore:indexes" from the project folder).'
            : profileError.message}
        </p>
        <button className="btn btn-outline-secondary btn-sm mt-2" onClick={logout}>Log out</button>
      </div>
    );
  }

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
