import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getSaleWithItems } from '../services/sales';
import { requestVoid, approveVoid, rejectVoid } from '../services/voids';

export default function Receipt() {
  const { saleId } = useParams();
  const { profile, isOwnerOrAdmin } = useAuth();
  const [sale, setSale] = useState(null);
  const [showVoidForm, setShowVoidForm] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const data = await getSaleWithItems(saleId);
    setSale(data);
  }

  useEffect(() => { load(); }, [saleId]);

  async function handleRequestVoid(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await requestVoid(saleId, voidReason, profile.id);
      setVoidReason('');
      setShowVoidForm(false);
      await load();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove() {
    setError('');
    setSubmitting(true);
    try {
      await approveVoid(saleId, profile.id);
      await load();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    const note = window.prompt('Reason for rejecting this void request (optional):') || '';
    setError('');
    setSubmitting(true);
    try {
      await rejectVoid(saleId, profile.id, note);
      await load();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!sale) {
    return (
      <Layout>
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      </Layout>
    );
  }

  const canRequestVoid = sale.status === 'completed' && (!sale.voidStatus || sale.voidStatus === 'rejected');

  return (
    <Layout header={
      <div className="d-flex justify-content-between align-items-center">
        <h2 className="h4 mb-0 d-flex align-items-center gap-2"><i className="bi bi-receipt text-primary"></i> Receipt</h2>
        <div className="d-print-none">
          <Link to="/pos" className="btn btn-outline-secondary btn-sm"><i className="bi bi-arrow-left me-1"></i>New Sale</Link>
          <button onClick={() => window.print()} className="btn btn-primary btn-sm ms-2"><i className="bi bi-printer me-1"></i>Print</button>
        </div>
      </div>
    }>
      <div className="card mx-auto shadow-sm" style={{ maxWidth: 380 }}>
        <div className="card-body font-monospace">
          <div className="text-center mb-3">
            <div
              className="rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
              style={{
                width: 44, height: 44,
                background: sale.status === 'voided' ? '#fbe4e2' : 'var(--bs-primary-bg-subtle)',
                color: sale.status === 'voided' ? '#8f251d' : 'var(--bs-primary-text-emphasis)',
              }}
            >
              <i className={`bi ${sale.status === 'voided' ? 'bi-x-lg' : 'bi-check-lg'} fs-4`}></i>
            </div>
            <div className="fw-bold fs-5">SARI-SARI STORE</div>
            <div className="small text-secondary">Official Receipt</div>
            {sale.status === 'voided' && <span className="badge text-bg-danger mt-2">Voided</span>}
          </div>

          <div className="small mb-2">
            <div>Date: {sale.createdAt?.toDate?.().toLocaleString() || '—'}</div>
            <div>Transaction #: {sale.transactionNo}</div>
          </div>

          <hr />

          {sale.items.map((item) => (
            <div key={item.id} className="d-flex justify-content-between small">
              <span>{item.productName} x{item.quantity}</span>
              <span>₱{item.lineTotal.toFixed(2)}</span>
            </div>
          ))}

          <hr />

          <div className="d-flex justify-content-between">
            <span>Subtotal</span>
            <span>₱{sale.subtotal.toFixed(2)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="d-flex justify-content-between">
              <span>Discount</span>
              <span>-₱{sale.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="d-flex justify-content-between fw-bold fs-5">
            <span>TOTAL</span>
            <span>₱{sale.total.toFixed(2)}</span>
          </div>

          <hr />

          <div className="d-flex justify-content-between">
            <span>Payment</span>
            <span className="text-uppercase">{sale.paymentMethod}</span>
          </div>
          {sale.paymentMethod === 'cash' ? (
            <>
              <div className="d-flex justify-content-between">
                <span>Tendered</span>
                <span>₱{sale.amountTendered.toFixed(2)}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span>Change</span>
                <span>₱{sale.changeAmount.toFixed(2)}</span>
              </div>
            </>
          ) : sale.paymentReference && (
            <div className="d-flex justify-content-between">
              <span>Reference</span>
              <span>{sale.paymentReference}</span>
            </div>
          )}

          <div className="text-center mt-4 fw-bold">Thank you!</div>
        </div>
      </div>

      <div className="mx-auto mt-3 d-print-none" style={{ maxWidth: 380 }}>
        {error && (
          <div className="alert alert-danger d-flex align-items-center gap-2 py-2">
            <i className="bi bi-exclamation-circle-fill"></i> {error}
          </div>
        )}

        {sale.status === 'voided' && (
          <div className="alert alert-secondary small mb-0">
            <i className="bi bi-info-circle me-1"></i>
            Voided by an owner/admin on {sale.voidReviewedAt?.toDate?.().toLocaleString() || '—'}.
          </div>
        )}

        {sale.voidStatus === 'pending' && (
          <div className="card border-warning">
            <div className="card-body">
              <div className="d-flex align-items-center gap-2 text-warning-emphasis fw-semibold mb-1">
                <i className="bi bi-hourglass-split"></i> Void requested — pending approval
              </div>
              <p className="small text-secondary mb-2">Reason: {sale.voidReason}</p>
              {isOwnerOrAdmin ? (
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-success d-flex align-items-center gap-1" disabled={submitting} onClick={handleApprove}>
                    <i className="bi bi-check-lg"></i> Approve Void
                  </button>
                  <button className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1" disabled={submitting} onClick={handleReject}>
                    <i className="bi bi-x-lg"></i> Reject
                  </button>
                </div>
              ) : (
                <p className="small text-secondary mb-0">Waiting for an owner or admin to review this request.</p>
              )}
            </div>
          </div>
        )}

        {sale.voidStatus === 'rejected' && (
          <div className="alert alert-secondary small">
            <i className="bi bi-info-circle me-1"></i>
            A previous void request was rejected{sale.voidReviewNote ? `: ${sale.voidReviewNote}` : '.'}
          </div>
        )}

        {canRequestVoid && !showVoidForm && (
          <button className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2" onClick={() => setShowVoidForm(true)}>
            <i className="bi bi-exclamation-triangle"></i> Request Void
          </button>
        )}

        {canRequestVoid && showVoidForm && (
          <form onSubmit={handleRequestVoid} className="card">
            <div className="card-body">
              <label className="form-label small fw-semibold">Why does this sale need to be voided?</label>
              <textarea className="form-control mb-2" rows={2} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} required />
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary flex-fill" onClick={() => setShowVoidForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger flex-fill d-flex align-items-center justify-content-center gap-2" disabled={submitting}>
                  {submitting ? <span className="spinner-border spinner-border-sm" role="status"></span> : <i className="bi bi-send"></i>}
                  Submit Request
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
}
