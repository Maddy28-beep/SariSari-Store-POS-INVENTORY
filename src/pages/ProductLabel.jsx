import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import BarcodeImage from '../components/BarcodeImage';
import { getProduct } from '../services/products';

export default function ProductLabel() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [copies, setCopies] = useState(10);

  useEffect(() => {
    getProduct(productId).then(setProduct);
  }, [productId]);

  if (!product) {
    return <Layout><div className="text-center py-5"><div className="spinner-border text-primary" /></div></Layout>;
  }

  if (!product.barcode) {
    return (
      <Layout header={<h2 className="h4 mb-0 d-flex align-items-center gap-2"><i className="bi bi-upc text-primary"></i> Print Barcode Label</h2>}>
        <div className="alert alert-warning d-flex align-items-center gap-2">
          <i className="bi bi-exclamation-triangle-fill"></i>
          "{product.name}" doesn't have a barcode yet.
        </div>
        <Link to={`/inventory/${productId}/edit`} className="btn btn-primary">Go add one</Link>
      </Layout>
    );
  }

  return (
    <Layout header={
      <div className="d-flex justify-content-between align-items-center d-print-none">
        <h2 className="h4 mb-0 d-flex align-items-center gap-2"><i className="bi bi-upc text-primary"></i> Print Barcode Label</h2>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/inventory')}>
          <i className="bi bi-arrow-left me-1"></i>Back to Inventory
        </button>
      </div>
    }>
      <div className="card mb-3 d-print-none">
        <div className="card-body d-flex align-items-end gap-3">
          <div>
            <label className="form-label small fw-semibold">Copies</label>
            <input
              type="number" className="form-control" min="1" max="200" style={{ width: 100 }}
              value={copies} onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <button className="btn btn-primary d-flex align-items-center gap-2" onClick={() => window.print()}>
            <i className="bi bi-printer"></i> Print {copies} Label{copies > 1 ? 's' : ''}
          </button>
          <span className="text-secondary small">Cut along the label borders after printing.</span>
        </div>
      </div>

      <div className="label-sheet">
        {Array.from({ length: copies }).map((_, i) => (
          <div className="label-card" key={i}>
            <div className="small fw-semibold text-truncate">{product.name}</div>
            <BarcodeImage value={product.barcode} width={1.6} height={40} fontSize={11} />
            <div className="small">₱{product.sellingPrice.toFixed(2)} / {product.unit}</div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
