import { useEffect, useState } from 'react';
import { submitDiscountRequest, watchRequest } from '../services/requests';

/**
 * Owner/Admin: type a discount and it applies at once.
 * Cashier: type a discount, send it for approval, and it unlocks the moment an
 * owner/admin approves it (one use only, for exactly that amount).
 */
export default function DiscountControl({ isOwnerOrAdmin, subtotal, discount, onDiscountChange, onApprovalChange, userId }) {
  const [draft, setDraft] = useState('');
  const [requestId, setRequestId] = useState(null);
  const [status, setStatus] = useState(null); // pending | approved | rejected
  const [error, setError] = useState('');

  useEffect(() => {
    if (!requestId) return;
    return watchRequest(requestId, (data) => {
      if (!data) return;
      setStatus(data.status);
      if (data.status === 'approved') {
        onDiscountChange(data.payload.amount);
        onApprovalChange(requestId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  // Sale finished or cart cleared elsewhere: start fresh.
  useEffect(() => {
    if (!isOwnerOrAdmin && Number(discount) === 0 && status === 'approved') {
      setRequestId(null); setStatus(null); setDraft(''); onApprovalChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discount]);

  if (isOwnerOrAdmin) {
    return (
      <div className="mb-3">
        <label className="form-label small fw-semibold">Discount (₱)</label>
        <input type="number" className="form-control" min="0" step="0.01" value={discount} onChange={(e) => onDiscountChange(e.target.value)} />
      </div>
    );
  }

  async function handleRequest() {
    setError('');
    const amount = Number(draft);
    if (!(amount > 0)) return setError('Enter the discount amount.');
    if (amount >= subtotal) return setError('Discount must be less than the sale total.');
    if (!navigator.onLine) return setError('Discounts need the owner/admin to approve, which needs an internet connection.');
    try {
      const id = await submitDiscountRequest({ amount, subtotal }, userId);
      setStatus('pending');
      setRequestId(id);
    } catch (err) {
      setError(err.message || 'Could not send the request.');
    }
  }

  function reset() {
    setRequestId(null); setStatus(null); setDraft(''); setError('');
    onDiscountChange(0); onApprovalChange(null);
  }

  return (
    <div className="mb-3">
      <label className="form-label small fw-semibold">Discount (₱) <span className="text-secondary fw-normal">- needs owner/admin approval</span></label>
      {status === 'approved' ? (
        <div className="alert alert-success py-2 small d-flex justify-content-between align-items-center mb-0">
          <span><i className="bi bi-check-circle-fill me-1"></i> ₱{Number(discount).toFixed(2)} discount approved</span>
          <button type="button" className="btn btn-sm btn-link p-0" onClick={reset}>Remove</button>
        </div>
      ) : status === 'pending' ? (
        <div className="alert alert-warning py-2 small d-flex justify-content-between align-items-center mb-0">
          <span><span className="spinner-border spinner-border-sm me-2"></span>Waiting for owner/admin to approve ₱{Number(draft).toFixed(2)}…</span>
          <button type="button" className="btn btn-sm btn-link p-0" onClick={reset}>Cancel</button>
        </div>
      ) : (
        <>
          {status === 'rejected' && <div className="alert alert-danger py-2 small">The discount was declined.</div>}
          <div className="input-group">
            <input type="number" className="form-control" min="0" step="0.01" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button type="button" className="btn btn-outline-primary" onClick={handleRequest}>Request</button>
          </div>
        </>
      )}
      {error && <div className="small text-danger mt-1">{error}</div>}
    </div>
  );
}
