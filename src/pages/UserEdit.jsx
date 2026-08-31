import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import Layout from '../components/Layout';
import { updateUserProfile, sendStaffPasswordReset } from '../services/users';

export default function UserEdit() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'users', userId)).then((snap) => setForm(snap.exists() ? { id: snap.id, ...snap.data() } : null));
  }, [userId]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateUserProfile(userId, { name: form.name, role: form.role, isActive: form.isActive });
      navigate('/users');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    await sendStaffPasswordReset(form.email);
    setStatus(`Password reset email sent to ${form.email}.`);
  }

  if (!form) {
    return <Layout><div className="text-center py-5"><div className="spinner-border text-primary" /></div></Layout>;
  }

  return (
    <Layout header={<h2 className="h4 mb-0">Edit User</h2>}>
      <div className="card mx-auto" style={{ maxWidth: 480 }}>
        <div className="card-body">
          {status && <div className="alert alert-success py-2">{status}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Name</label>
              <input type="text" className="form-control" value={form.name} onChange={(e) => update('name', e.target.value)} required autoFocus />
            </div>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={form.email} disabled />
              <div className="form-text">Email can't be changed here.</div>
            </div>
            <div className="mb-3">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={(e) => update('role', e.target.value)} required>
                <option value="cashier">Cashier</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <div className="mb-3 form-check">
              <input type="checkbox" className="form-check-input" id="isActive" checked={form.isActive} onChange={(e) => update('isActive', e.target.checked)} />
              <label className="form-check-label" htmlFor="isActive">Active</label>
            </div>
            <div className="d-flex justify-content-between mb-3">
              <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/users')}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
            <button type="button" className="btn btn-outline-warning btn-sm w-100" onClick={handleResetPassword}>
              Send Password Reset Email
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
