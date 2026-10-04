import { useEffect, useState } from 'react';
import { getMyRequests } from '../services/requests';

const BADGE = { pending: 'text-bg-warning', approved: 'text-bg-success', rejected: 'text-bg-danger' };

/** A cashier's own inventory requests and where each one stands. */
export default function MyRequests({ userId }) {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    if (userId) getMyRequests(userId).then(setRequests).catch(() => {});
  }, [userId]);

  if (requests.length === 0) return null;

  return (
    <div className="card mb-3">
      <div className="card-header d-flex align-items-center gap-2">
        <i className="bi bi-hourglass-split text-secondary"></i> My Inventory Requests
      </div>
      <ul className="list-group list-group-flush">
        {requests.slice(0, 8).map((r) => (
          <li key={r.id} className="list-group-item d-flex justify-content-between align-items-center gap-2">
            <span>
              {r.kind === 'product' ? `New product: ${r.payload.name}` : `Stock in (${r.payload.items.length} item${r.payload.items.length === 1 ? '' : 's'})`}
              {r.status === 'rejected' && r.reviewNote && <span className="text-secondary small"> — {r.reviewNote}</span>}
            </span>
            <span className={`badge ${BADGE[r.status]}`}>{r.status === 'pending' ? 'waiting for owner' : r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
