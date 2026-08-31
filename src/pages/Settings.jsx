import { useState } from 'react';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile } from '../services/users';
import { seedDefaults } from '../services/catalog';

export default function Settings() {
  const { user, profile } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [nameStatus, setNameStatus] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [seedStatus, setSeedStatus] = useState('');

  async function handleNameSubmit(e) {
    e.preventDefault();
    await updateProfile(user, { displayName: name });
    await updateUserProfile(user.uid, { name });
    setNameStatus('Saved.');
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordStatus('');
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setPasswordStatus('Password updated.');
    } catch {
      setPasswordError('Current password is incorrect.');
    }
  }

  return (
    <Layout header={<h2 className="h4 mb-0">Settings</h2>}>
      <div className="d-flex flex-column gap-4" style={{ maxWidth: 480 }}>
        <div className="card">
          <div className="card-body">
            <h2 className="h5 mb-3">Profile</h2>
            <form onSubmit={handleNameSubmit} className="d-flex flex-column gap-3">
              <div>
                <label className="form-label">Name</label>
                <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="d-flex align-items-center gap-3">
                <button type="submit" className="btn btn-primary">Save</button>
                {nameStatus && <span className="text-success small">{nameStatus}</span>}
              </div>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <h2 className="h5 mb-3">Change Password</h2>
            {passwordError && <div className="alert alert-danger py-2">{passwordError}</div>}
            <form onSubmit={handlePasswordSubmit} className="d-flex flex-column gap-3">
              <div>
                <label className="form-label">Current Password</label>
                <input type="password" className="form-control" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              </div>
              <div>
                <label className="form-label">New Password</label>
                <input type="password" className="form-control" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required />
              </div>
              <div className="d-flex align-items-center gap-3">
                <button type="submit" className="btn btn-primary">Save</button>
                {passwordStatus && <span className="text-success small">{passwordStatus}</span>}
              </div>
            </form>
          </div>
        </div>

        {profile?.role === 'owner' && (
          <div className="card">
            <div className="card-body">
              <h2 className="h5 mb-2">Store Setup</h2>
              <p className="text-secondary small">
                One-time setup: creates default categories (Snacks, Drinks, Grocery, …) and units (pc, kg, L, sack, …)
                if none exist yet.
              </p>
              <button
                type="button" className="btn btn-outline-secondary"
                onClick={async () => { await seedDefaults(); setSeedStatus('Default categories and units are ready.'); }}
              >
                Seed Default Categories &amp; Units
              </button>
              {seedStatus && <div className="text-success small mt-2">{seedStatus}</div>}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
