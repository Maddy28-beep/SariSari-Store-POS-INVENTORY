import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { lookupByBarcode } from '../services/products';
import { getSuppliers } from '../services/catalog';
import { stockIn } from '../services/inventory';

export default function StockIn() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const barcodeRef = useRef(null);

  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [items, setItems] = useState([]);
  const [scanError, setScanError] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    getSuppliers().then(setSuppliers);
    barcodeRef.current?.focus();
  }, []);

  async function scanBarcode() {
    setScanError('');
    const code = barcodeInput.trim();
    if (!code) return;

    const product = await lookupByBarcode(code);

    if (!product) {
      setScanError(`⚠️ Barcode "${code}" is not registered.`);
      if (confirm(`Barcode ${code} not found. Add it as a new product?`)) {
        navigate(`/inventory/new?barcode=${encodeURIComponent(code)}`);
        return;
      }
    } else {
      setItems((prev) => {
        const existing = prev.find((i) => i.productId === product.id);
        if (existing) {
          return prev.map((i) => (i.productId === product.id ? { ...i, quantity: i.quantity + (product.allowDecimal ? 0.01 : 1) } : i));
        }
        return [...prev, {
          productId: product.id,
          name: product.name,
          quantity: 1,
          costPrice: product.costPrice,
          allowDecimal: product.allowDecimal,
        }];
      });
    }

    setBarcodeInput('');
    barcodeRef.current?.focus();
  }

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: Number(value) } : item)));
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setStatus('');
    try {
      for (const item of items) {
        await stockIn(item.productId, item.quantity, item.costPrice, { supplierId: supplierId || null, userId: profile.id });
      }
      setItems([]);
      setStatus('Stock received and inventory updated.');
    } catch (err) {
      setScanError(err.message || 'Something went wrong saving the receiving.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout header={<h2 className="h4 mb-0">📥 Receive Stock</h2>}>
      {status && <div className="alert alert-success">{status}</div>}

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-8">
              <label className="form-label">Scan Barcode</label>
              <input
                type="text" className="form-control scan-input" placeholder="Scan or type barcode, then Enter"
                ref={barcodeRef} value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); scanBarcode(); } }}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Supplier (optional)</label>
              <select className="form-select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— None —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          {scanError && <div className="small text-danger mt-2">{scanError}</div>}
        </div>
      </div>

      <div className="card mb-3">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Product</th>
                <th style={{ width: 140 }}>Qty Received</th>
                <th style={{ width: 160 }}>Cost Price (₱)</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-secondary py-5">Scan products as they arrive from the supplier.</td></tr>
              ) : items.map((item, index) => (
                <tr key={item.productId}>
                  <td>{item.name}</td>
                  <td>
                    <input type="number" className="form-control form-control-sm" min="0.001" step={item.allowDecimal ? 0.01 : 1} value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} />
                  </td>
                  <td>
                    <input type="number" className="form-control form-control-sm" min="0" step="0.01" value={item.costPrice} onChange={(e) => updateItem(index, 'costPrice', e.target.value)} />
                  </td>
                  <td><button className="btn btn-sm btn-link text-danger" onClick={() => removeItem(index)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="d-flex justify-content-end">
        <button className="btn btn-success btn-lg" disabled={items.length === 0 || saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'SAVE RECEIVING'}
        </button>
      </div>
    </Layout>
  );
}
