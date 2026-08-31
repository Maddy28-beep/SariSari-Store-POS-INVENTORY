import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { getSaleWithItems } from '../services/sales';

export default function Receipt() {
  const { saleId } = useParams();
  const [sale, setSale] = useState(null);

  useEffect(() => {
    getSaleWithItems(saleId).then(setSale);
  }, [saleId]);

  if (!sale) {
    return (
      <Layout>
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      </Layout>
    );
  }

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
              style={{ width: 44, height: 44, background: 'var(--bs-primary-bg-subtle)', color: 'var(--bs-primary-text-emphasis)' }}
            >
              <i className="bi bi-check-lg fs-4"></i>
            </div>
            <div className="fw-bold fs-5">SARI-SARI STORE</div>
            <div className="small text-secondary">Official Receipt</div>
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
    </Layout>
  );
}
