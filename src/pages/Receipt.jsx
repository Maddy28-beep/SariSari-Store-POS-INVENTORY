import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageSkeleton from '../components/PageSkeleton';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getSaleWithItems } from '../services/sales';
import { requestVoid, approveVoid, rejectVoid } from '../services/voids';
import { submitRefundRequest, applyRefund, getRefundsForSale, refundAmount } from '../services/requests';

/** Plain-text receipt for sharing by Messenger / SMS / email / any app. */
function receiptText(sale) {
  const peso = (n) => `P${n.toFixed(2)}`;
  const lines = [
    'SARI-SARI STORE - Official Receipt',
    `Receipt #: ${sale.transactionNo}`,
    `Date: ${sale.createdAt?.toDate?.().toLocaleString() || ''}`,
    ...(sale.customerName ? [`Customer: ${sale.customerName}`] : []),
    '--------------------------------',
    ...sale.items.map((i) => `${i.productName} x${i.quantity}  ${peso(i.lineTotal)}`),
    '--------------------------------',
    `Subtotal: ${peso(sale.subtotal)}`,
    ...(sale.discount > 0 ? [`Discount: -${peso(sale.discount)}`] : []),
    `TOTAL: ${peso(sale.total)}`,
    `Paid via: ${sale.paymentMethod.toUpperCase()}`,
    ...(sale.changeAmount > 0 ? [`Change: ${peso(sale.changeAmount)}`] : []),
    'Thank you!',
  ];
  return lines.join('\n');
}

/** Sales created before the `payments` array existed only have the flat legacy fields. */
function legacyPayments(sale) {
  if (sale.paymentMethod === 'cash') {
    return [{ method: 'cash', amount: sale.total, tendered: sale.amountTendered, change: sale.changeAmount }];
  }
  return [{ method: sale.paymentMethod, amount: sale.total, reference: sale.paymentReference }];
}

export default function Receipt() {
  const { saleId } = useParams();
  const { profile, isOwnerOrAdmin } = useAuth();
  const [sale, setSale] = useState(null);
  const [showVoidForm, setShowVoidForm] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const [showRefund, setShowRefund] = useState(false);
  const [refundQty, setRefundQty] = useState({});
  const [refundReason, setRefundReason] = useState('');
  const [refundedQty, setRefundedQty] = useState({});
  const [refundNotice, setRefundNotice] = useState('');

  async function load() {
    const data = await getSaleWithItems(saleId);
    setSale(data);
    if (isOwnerOrAdmin) {
      const done = {};
      (await getRefundsForSale(saleId)).forEach((r) => r.lines.forEach((l) => { done[l.productId] = (done[l.productId] || 0) + l.quantity; }));
      setRefundedQty(done);
    }
  }

  async function handleShare() {
    const text = receiptText(sale);
    try {
      if (navigator.share) {
        await navigator.share({ title: `Receipt ${sale.transactionNo}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareStatus('Receipt text copied - paste it into Messenger, SMS or email.');
      }
    } catch {
      /* user closed the share sheet */
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(receiptText(sale));
    setShareStatus('Receipt text copied - paste it into Messenger, SMS or email.');
  }

  // One line per product (a product scanned twice is two rows on the sale).
  function refundableLines() {
    const byProduct = {};
    sale.items.forEach((i) => {
      byProduct[i.productId] ||= { productId: i.productId, productName: i.productName, unitPrice: i.unitPrice, sold: 0 };
      byProduct[i.productId].sold += i.quantity;
    });
    return Object.values(byProduct).map((l) => ({ ...l, left: l.sold - (refundedQty[l.productId] || 0) }));
  }

  async function handleRefund(e) {
    e.preventDefault();
    setError('');
    const lines = refundableLines()
      .map((l) => ({ productId: l.productId, productName: l.productName, unitPrice: l.unitPrice, quantity: Number(refundQty[l.productId]) || 0, left: l.left }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) return setError('Enter how many of each item are being returned.');
    const tooMany = lines.find((l) => l.quantity > l.left + 1e-9);
    if (tooMany) return setError(`Only ${tooMany.left} of "${tooMany.productName}" can still be refunded.`);

    setSubmitting(true);
    try {
      const clean = lines.map(({ left, ...rest }) => rest);
      const payload = { saleId, transactionNo: sale.transactionNo, reason: refundReason, lines: clean, amount: refundAmount(clean) };
      if (isOwnerOrAdmin) {
        await applyRefund(payload, profile.id);
        setRefundNotice(`Refund of ₱${payload.amount.toFixed(2)} recorded and stock restored.`);
      } else {
        await submitRefundRequest({ sale: { id: saleId, transactionNo: sale.transactionNo }, lines: clean, reason: refundReason }, profile.id);
        setRefundNotice(`Refund of ₱${payload.amount.toFixed(2)} sent to the owner for approval.`);
      }
      setShowRefund(false);
      setRefundQty({});
      setRefundReason('');
      await load();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
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
        <PageSkeleton />
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
          <button onClick={handleShare} className="btn btn-outline-primary btn-sm ms-2"><i className="bi bi-share me-1"></i>Share</button>
          <button onClick={handleCopy} className="btn btn-outline-primary btn-sm ms-2"><i className="bi bi-clipboard me-1"></i>Copy</button>
          <button onClick={() => window.print()} className="btn btn-primary btn-sm ms-2"><i className="bi bi-printer me-1"></i>Print</button>
        </div>
      </div>
    }>
      <div className="card receipt-card mx-auto shadow-sm" style={{ maxWidth: 380 }}>
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
            {sale.customerName && <div>Customer: {sale.customerName}</div>}
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
          {(sale.payments || legacyPayments(sale)).map((p, idx) => (
            <div key={idx} className="mt-1">
              {sale.paymentMethod === 'split' && (
                <div className="small text-secondary text-uppercase">{p.method}</div>
              )}
              {p.method === 'cash' ? (
                <>
                  <div className="d-flex justify-content-between">
                    <span>{sale.paymentMethod === 'split' ? 'Cash portion' : 'Amount'}</span>
                    <span>₱{p.amount.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>Tendered</span>
                    <span>₱{p.tendered.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>Change</span>
                    <span>₱{p.change.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="d-flex justify-content-between">
                    <span>{sale.paymentMethod === 'split' ? 'GCash portion' : 'Amount'}</span>
                    <span>₱{p.amount.toFixed(2)}</span>
                  </div>
                  {p.reference && (
                    <div className="d-flex justify-content-between">
                      <span>Reference</span>
                      <span>{p.reference}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

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

        {shareStatus && <div className="alert alert-success py-2 small">{shareStatus}</div>}
        {refundNotice && <div className="alert alert-success py-2 small">{refundNotice}</div>}

        {sale.status === 'completed' && !showRefund && (
          <button className="btn btn-outline-warning w-100 mb-2 d-flex align-items-center justify-content-center gap-2" onClick={() => setShowRefund(true)}>
            <i className="bi bi-arrow-return-left"></i> {isOwnerOrAdmin ? 'Refund Items' : 'Request Refund'}
          </button>
        )}

        {sale.status === 'completed' && showRefund && (
          <form onSubmit={handleRefund} className="card mb-2">
            <div className="card-body">
              <div className="fw-semibold mb-2">Items being returned</div>
              {refundableLines().map((l) => (
                <div key={l.productId} className="d-flex align-items-center justify-content-between gap-2 mb-2">
                  <span className="small">{l.productName} <span className="text-secondary">(max {l.left})</span></span>
                  <input
                    type="number" className="form-control form-control-sm" style={{ width: 90 }} min="0" max={l.left} step="any"
                    disabled={l.left <= 0}
                    value={refundQty[l.productId] ?? ''} onChange={(e) => setRefundQty({ ...refundQty, [l.productId]: e.target.value })}
                  />
                </div>
              ))}
              <input className="form-control form-control-sm mb-2" placeholder="Reason" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} required />
              {!isOwnerOrAdmin && <div className="small text-secondary mb-2">The owner has to approve this before the refund and stock return happen.</div>}
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary flex-fill" onClick={() => setShowRefund(false)}>Cancel</button>
                <button type="submit" className="btn btn-warning flex-fill" disabled={submitting}>{isOwnerOrAdmin ? 'Refund' : 'Send for Approval'}</button>
              </div>
            </div>
          </form>
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
