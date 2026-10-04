import { useEffect, useState } from 'react';
import PageSkeleton from '../components/PageSkeleton';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getPendingRequests, approveRequest, rejectRequest } from '../services/requests';
import { getAllUsers } from '../services/users';

function RequestDetails({ req }) {
  const p = req.payload;
  if (req.kind === 'product') {
    return (
      <div>
        <div className="fw-semibold">New product: {p.name}</div>
        <div className="text-secondary small">
          {p.barcode ? `Barcode ${p.barcode} · ` : 'No barcode · '}
          Cost ₱{p.costPrice.toFixed(2)} · Sell ₱{p.sellingPrice.toFixed(2)}
          {p.unitAbbreviation ? ` · per ${p.unitAbbreviation}` : ''} · Initial stock {p.initialStock}
        </div>
      </div>
    );
  }
  if (req.kind === 'discount') {
    return (
      <div>
        <div className="fw-semibold">Discount ₱{p.amount.toFixed(2)} on a ₱{p.subtotal.toFixed(2)} sale</div>
        {p.reason && <div className="small text-secondary">Reason: {p.reason}</div>}
        <div className="small text-secondary">The customer is waiting at the counter.</div>
      </div>
    );
  }
  if (req.kind === 'refund') {
    return (
      <div>
        <div className="fw-semibold">Refund ₱{p.amount.toFixed(2)} on {p.transactionNo}</div>
        <ul className="text-secondary small mb-0 ps-3">
          {p.lines.map((l) => <li key={l.productId}>{l.productName} x{l.quantity}</li>)}
        </ul>
        <div className="small text-secondary">Reason: {p.reason}</div>
      </div>
    );
  }
  return (
    <div>
      <div className="fw-semibold">Stock in ({p.items.length} item{p.items.length === 1 ? '' : 's'})</div>
      <ul className="text-secondary small mb-0 ps-3">
        {p.items.map((i) => <li key={i.productId}>{i.name} — {i.quantity} @ ₱{i.costPrice.toFixed(2)}</li>)}
      </ul>
    </div>
  );
}

export default function Approvals() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    const [reqs, users] = await Promise.all([getPendingRequests(), getAllUsers()]);
    setUsersById(Object.fromEntries(users.map((u) => [u.id, u.name])));
    setRequests(reqs);
    setLoading(false);
  }

  // Discount requests have a customer waiting, so keep the list fresh.
  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  async function run(req, action) {
    setError('');
    setBusyId(req.id);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }

  const handleApprove = (req) => run(req, () => approveRequest(req, profile.id));
  const handleReject = (req) => {
    const note = window.prompt('Reason for rejecting (optional):');
    if (note === null) return;
    run(req, () => rejectRequest(req, profile.id, note));
  };

  return (
    <Layout header={<h2 className="h4 mb-0 d-flex align-items-center gap-2"><i className="bi bi-clipboard-check text-primary"></i> Inventory Approvals</h2>}>
      <p className="text-secondary">Products and stock-ins added by cashiers only reach the inventory after you approve them here.</p>
      {error && <div className="alert alert-danger py-2">{error}</div>}

      {loading ? (
        <PageSkeleton />
      ) : requests.length === 0 ? (
        <div className="card"><div className="empty-state"><i className="bi bi-inbox"></i>Nothing waiting for approval.</div></div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {requests.map((req) => (
            <div className="card" key={req.id}>
              <div className="card-body d-flex flex-wrap justify-content-between align-items-start gap-3">
                <div>
                  <RequestDetails req={req} />
                  <div className="text-secondary small mt-1">
                    Requested by {usersById[req.requestedBy] || '—'} · {req.createdAt?.toDate?.().toLocaleString() || ''}
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-success btn-sm" disabled={busyId === req.id} onClick={() => handleApprove(req)}>
                    <i className="bi bi-check-lg"></i> Approve
                  </button>
                  <button className="btn btn-outline-danger btn-sm" disabled={busyId === req.id} onClick={() => handleReject(req)}>
                    <i className="bi bi-x-lg"></i> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
