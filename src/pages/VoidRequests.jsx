import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getPendingVoidRequests, approveVoid, rejectVoid } from '../services/voids';
import { getAllUsers } from '../services/users';

export default function VoidRequests() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const [reqs, users] = await Promise.all([getPendingVoidRequests(), getAllUsers()]);
    setUsersById(Object.fromEntries(users.map((u) => [u.id, u.name])));
    setRequests(reqs.sort((a, b) => (b.voidRequestedAt?.toMillis?.() || 0) - (a.voidRequestedAt?.toMillis?.() || 0)));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(saleId) {
    setError('');
    setBusyId(saleId);
    try {
      await approveVoid(saleId, profile.id);
      await load();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(saleId) {
    const note = window.prompt('Reason for rejecting this void request (optional):') || '';
    setError('');
    setBusyId(saleId);
    try {
      await rejectVoid(saleId, profile.id, note);
      await load();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Layout header={
      <h2 className="h4 mb-0 d-flex align-items-center gap-2">
        <i className="bi bi-shield-exclamation text-primary"></i> Void Requests
      </h2>
    }>
      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-circle-fill"></i> {error}
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Transaction #</th>
                <th>Cashier</th>
                <th className="text-end">Total</th>
                <th>Reason</th>
                <th>Requested</th>
                <th style={{ width: 220 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-secondary py-5">
                    <i className="bi bi-check2-circle fs-1 d-block mb-2 opacity-25"></i>
                    No pending void requests.
                  </td>
                </tr>
              ) : requests.map((sale) => (
                <tr key={sale.id}>
                  <td>
                    <Link to={`/pos/receipt/${sale.id}`} className="font-monospace small fw-semibold">{sale.transactionNo}</Link>
                  </td>
                  <td>{usersById[sale.cashierId] || '—'}</td>
                  <td className="text-end fw-semibold">₱{sale.total.toFixed(2)}</td>
                  <td className="small">{sale.voidReason}</td>
                  <td className="text-secondary small">
                    {usersById[sale.voidRequestedBy] || '—'}
                    <br />
                    {sale.voidRequestedAt?.toDate?.().toLocaleString() || '—'}
                  </td>
                  <td>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-success d-flex align-items-center gap-1"
                        disabled={busyId === sale.id}
                        onClick={() => handleApprove(sale.id)}
                      >
                        <i className="bi bi-check-lg"></i> Approve
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                        disabled={busyId === sale.id}
                        onClick={() => handleReject(sale.id)}
                      >
                        <i className="bi bi-x-lg"></i> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
