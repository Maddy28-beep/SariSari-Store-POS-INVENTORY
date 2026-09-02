import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getCategories, getUnits, getSuppliers } from '../services/catalog';
import { createProduct, lookupByBarcode } from '../services/products';
import { moveStock, InventoryTypes } from '../services/inventory';
import { generateInternalBarcode } from '../utils/barcode';

export default function ProductCreate() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [duplicate, setDuplicate] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [wasGenerated, setWasGenerated] = useState(false);

  const [form, setForm] = useState({
    barcode: searchParams.get('barcode') || '',
    name: '',
    categoryId: '',
    unitId: '',
    supplierId: '',
    costPrice: '',
    sellingPrice: '',
    reorderLevel: 5,
    initialStock: 0,
  });

  useEffect(() => {
    (async () => {
      const [c, u, s] = await Promise.all([getCategories(), getUnits(), getSuppliers()]);
      setCategories(c);
      setUnits(u);
      setSuppliers(s);
      if (u.length && !form.unitId) setForm((f) => ({ ...f, unitId: u[0].id }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkDuplicate(barcode) {
    setDuplicate(null);
    if (!barcode) return;
    const existing = await lookupByBarcode(barcode);
    if (existing) setDuplicate(existing);
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === 'barcode') setWasGenerated(false);
  }

  async function handleGenerateBarcode() {
    setGeneratingBarcode(true);
    setDuplicate(null);
    try {
      let candidate = generateInternalBarcode();
      // Collision odds are astronomically low, but check anyway before committing to it.
      for (let attempt = 0; attempt < 3 && (await lookupByBarcode(candidate)); attempt++) {
        candidate = generateInternalBarcode();
      }
      setForm((f) => ({ ...f, barcode: candidate }));
      setWasGenerated(true);
    } finally {
      setGeneratingBarcode(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (duplicate) {
      setError(`This barcode already belongs to "${duplicate.name}". Use Stock In instead.`);
      return;
    }

    setSubmitting(true);
    try {
      const unit = units.find((u) => u.id === form.unitId);
      const ref = await createProduct({
        barcode: form.barcode || null,
        name: form.name,
        categoryId: form.categoryId || null,
        unitId: form.unitId,
        supplierId: form.supplierId || null,
        costPrice: form.costPrice,
        sellingPrice: form.sellingPrice,
        reorderLevel: form.reorderLevel,
      }, profile.id, unit);

      const initial = Number(form.initialStock) || 0;
      if (initial > 0) {
        await moveStock(ref.id, InventoryTypes.BEGINNING, initial, { note: 'Initial stock on product creation', userId: profile.id });
      }

      navigate(wasGenerated ? `/inventory/${ref.id}/label` : '/inventory');
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout header={<h2 className="h4 mb-0 d-flex align-items-center gap-2"><i className="bi bi-box-seam text-primary"></i> Add New Product</h2>}>
      <div className="card mx-auto shadow-sm" style={{ maxWidth: 560 }}>
        <div className="card-body">
          {error && (
            <div className="alert alert-danger d-flex align-items-center gap-2 py-2">
              <i className="bi bi-exclamation-circle-fill"></i> {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small fw-semibold d-flex align-items-center gap-1">
                <i className="bi bi-upc-scan"></i> Scan Barcode <span className="text-secondary fw-normal">(leave blank if none)</span>
              </label>
              <div className="input-group">
                <input
                  type="text" className="form-control scan-input" value={form.barcode} autoFocus
                  onChange={(e) => update('barcode', e.target.value)}
                  onBlur={(e) => checkDuplicate(e.target.value)}
                />
                <button
                  type="button" className="btn btn-outline-secondary d-flex align-items-center gap-1"
                  disabled={generatingBarcode} onClick={handleGenerateBarcode}
                >
                  {generatingBarcode ? <span className="spinner-border spinner-border-sm" role="status"></span> : <i className="bi bi-magic"></i>}
                  Generate
                </button>
              </div>
              {wasGenerated && (
                <div className="form-text">
                  <i className="bi bi-info-circle me-1"></i>
                  Internal barcode generated — you'll get a printable label right after saving.
                </div>
              )}
              {duplicate && (
                <div className="alert alert-warning mt-2 py-2 small d-flex align-items-start gap-2">
                  <i className="bi bi-exclamation-triangle-fill mt-1"></i>
                  <span>
                    This barcode is already registered to <strong>{duplicate.name}</strong>.{' '}
                    <a href="/stock-in" className="alert-link">Go to Stock In</a> instead.
                  </span>
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold">Product Name</label>
              <input type="text" className="form-control" value={form.name} onChange={(e) => update('name', e.target.value)} required />
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Category</label>
                <select className="form-select" value={form.categoryId} onChange={(e) => update('categoryId', e.target.value)}>
                  <option value="">— None —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Unit</label>
                <select className="form-select" value={form.unitId} onChange={(e) => update('unitId', e.target.value)} required>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                </select>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold">Supplier (optional)</label>
              <select className="form-select" value={form.supplierId} onChange={(e) => update('supplierId', e.target.value)}>
                <option value="">— None —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Cost Price (₱)</label>
                <input type="number" className="form-control" step="0.01" min="0" value={form.costPrice} onChange={(e) => update('costPrice', e.target.value)} required />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Selling Price (₱)</label>
                <input type="number" className="form-control" step="0.01" min="0" value={form.sellingPrice} onChange={(e) => update('sellingPrice', e.target.value)} required />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Reorder Level</label>
                <input type="number" className="form-control" step="0.001" min="0" value={form.reorderLevel} onChange={(e) => update('reorderLevel', e.target.value)} required />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Initial Stock</label>
                <input type="number" className="form-control" step="0.001" min="0" value={form.initialStock} onChange={(e) => update('initialStock', e.target.value)} />
              </div>
            </div>

            <div className="d-flex justify-content-between">
              <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/inventory')}>Cancel</button>
              <button type="submit" className="btn btn-primary d-flex align-items-center gap-2" disabled={submitting}>
                {submitting ? <span className="spinner-border spinner-border-sm" role="status"></span> : <i className="bi bi-check-lg"></i>}
                {submitting ? 'Saving…' : 'Save Product'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
