import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getCategories, getUnits, getSuppliers } from '../services/catalog';
import { getProduct, updateProduct } from '../services/products';
import { adjustStock } from '../services/inventory';

export default function ProductEdit() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { productId } = useParams();

  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustStatus, setAdjustStatus] = useState('');

  useEffect(() => {
    (async () => {
      const [c, u, s, product] = await Promise.all([getCategories(), getUnits(), getSuppliers(), getProduct(productId)]);
      setCategories(c);
      setUnits(u);
      setSuppliers(s);
      setForm(product);
    })();
  }, [productId]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const unit = units.find((u) => u.id === form.unitId);
      await updateProduct(productId, {
        barcode: form.barcode || null,
        name: form.name,
        categoryId: form.categoryId || null,
        unitId: form.unitId,
        supplierId: form.supplierId || null,
        costPrice: Number(form.costPrice),
        sellingPrice: Number(form.sellingPrice),
        reorderLevel: Number(form.reorderLevel),
        status: form.status,
      }, unit);
      navigate('/inventory');
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdjust(e) {
    e.preventDefault();
    setAdjustStatus('');
    const qty = Number(adjustQty);
    if (!qty || !adjustReason) return;

    await adjustStock(productId, qty, adjustReason, profile.id);
    const updated = await getProduct(productId);
    setForm(updated);
    setAdjustQty('');
    setAdjustReason('');
    setAdjustStatus(`Stock adjusted by ${qty}.`);
  }

  if (!form) {
    return <Layout><div className="text-center py-5"><div className="spinner-border text-primary" /></div></Layout>;
  }

  return (
    <Layout header={<h2 className="h4 mb-0">Edit Product</h2>}>
      <div className="row g-3 justify-content-center">
        <div className="col-lg-6">
          <div className="card">
            <div className="card-body">
              {error && <div className="alert alert-danger py-2">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">Barcode</label>
                  <input type="text" className="form-control scan-input" value={form.barcode || ''} onChange={(e) => update('barcode', e.target.value)} />
                </div>

                <div className="mb-3">
                  <label className="form-label">Product Name</label>
                  <input type="text" className="form-control" value={form.name} onChange={(e) => update('name', e.target.value)} required />
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Category</label>
                    <select className="form-select" value={form.categoryId || ''} onChange={(e) => update('categoryId', e.target.value)}>
                      <option value="">— None —</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Unit</label>
                    <select className="form-select" value={form.unitId} onChange={(e) => update('unitId', e.target.value)} required>
                      {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                    </select>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Supplier</label>
                  <select className="form-select" value={form.supplierId || ''} onChange={(e) => update('supplierId', e.target.value)}>
                    <option value="">— None —</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Cost Price (₱)</label>
                    <input type="number" className="form-control" step="0.01" min="0" value={form.costPrice} onChange={(e) => update('costPrice', e.target.value)} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Selling Price (₱)</label>
                    <input type="number" className="form-control" step="0.01" min="0" value={form.sellingPrice} onChange={(e) => update('sellingPrice', e.target.value)} required />
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Reorder Level</label>
                    <input type="number" className="form-control" step="0.001" min="0" value={form.reorderLevel} onChange={(e) => update('reorderLevel', e.target.value)} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={form.status} onChange={(e) => update('status', e.target.value)} required>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="d-flex justify-content-between">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/inventory')}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Saving…' : 'SAVE CHANGES'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card">
            <div className="card-header">Adjust Stock</div>
            <div className="card-body">
              <p className="text-secondary small">Current stock: <strong>{form.currentStock} {form.unit}</strong></p>
              {adjustStatus && <div className="alert alert-success py-2 small">{adjustStatus}</div>}
              <form onSubmit={handleAdjust}>
                <div className="mb-2">
                  <label className="form-label">Adjustment (+ or -)</label>
                  <input type="number" className="form-control" step="0.001" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Reason</label>
                  <input type="text" className="form-control" placeholder="e.g. damaged, recount, spoilage" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-outline-secondary w-100">Apply Adjustment</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
