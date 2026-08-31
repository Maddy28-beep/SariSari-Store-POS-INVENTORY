import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      setError('Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh', background: 'var(--sari-ink)' }}>
      <div className="d-flex flex-column align-items-center mb-4 text-white">
        <div
          className="rounded-4 d-flex align-items-center justify-content-center mb-3"
          style={{ width: 56, height: 56, background: 'var(--bs-primary)' }}
        >
          <i className="bi bi-shop fs-3"></i>
        </div>
        <div className="fs-4 fw-bold">Sarisari POS</div>
        <div className="text-white-50 small">Store management, made simple</div>
      </div>

      <div className="card shadow-lg border-0" style={{ width: '100%', maxWidth: 380 }}>
        <div className="card-body p-4">
          {error && (
            <div className="alert alert-danger d-flex align-items-center gap-2 py-2">
              <i className="bi bi-exclamation-circle-fill"></i>
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Email</label>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0"><i className="bi bi-envelope text-secondary"></i></span>
                <input type="email" className="form-control border-start-0" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold">Password</label>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0"><i className="bi bi-lock text-secondary"></i></span>
                <input type="password" className="form-control border-start-0" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  Logging in…
                </>
              ) : (
                <>
                  Log in
                  <i className="bi bi-arrow-right"></i>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
