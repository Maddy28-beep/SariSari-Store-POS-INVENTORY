import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { createStaffUser } from '../services/users';

export default function UserCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'cashier' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await createStaffUser(form);
      navigate('/users');
    } catch (err) {
      setError(err.code === 'auth/email-already-in-use' ? 'This email is already registered.' : (err.message || 'Something went wrong.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout header={<h2 className="h4 mb-0">Add User</h2>}>
      <div className="card mx-auto" style={{ maxWidth: 480 }}>
        <div className="card-body">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Name</label>
              <input type="text" className="form-control" value={form.name} onChange={(e) => update('name', e.target.value)} required autoFocus />
            </div>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={form.email} onChange={(e) => update('email', e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input type="password" className="form-control" value={form.password} onChange={(e) => update('password', e.target.value)} minLength={6} required />
            </div>
            <div className="mb-3">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={(e) => update('role', e.target.value)} required>
                <option value="cashier">Cashier</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <div className="d-flex justify-content-between">
              <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/users')}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
