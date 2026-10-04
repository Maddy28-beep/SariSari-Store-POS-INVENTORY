import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import CustomerPicker from '../components/CustomerPicker';
import DiscountControl from '../components/DiscountControl';
import { useAuth } from '../context/AuthContext';
import { lookupByBarcode, getAllProducts } from '../services/products';
import { getCategories } from '../services/catalog';
import { checkout } from '../services/sales';

function stepFor(p) {
  if (!p.allowDecimal) return 1;
  return p.unit === 'sack' ? 0.5 : 0.01;
}

export default function Pos() {
  const { profile, isOwnerOrAdmin } = useAuth();
  const navigate = useNavigate();

  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [customer, setCustomer] = useState(null);
  const [discountRequestId, setDiscountRequestId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [gcashAmount, setGcashAmount] = useState('');
  const [scanError, setScanError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const barcodeRef = useRef(null);

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  useEffect(() => {
    Promise.all([getAllProducts(), getCategories()]).then(([p, c]) => {
      setProducts(p.filter((x) => x.status === 'active'));
      setCategories(c);
    });
  }, []);

  const q = searchQuery.trim().toLowerCase();
  const visibleProducts = products.filter((p) =>
    (activeCategory === 'all' || p.categoryId === activeCategory) &&
    (!q || p.name.toLowerCase().includes(q)),
  );

  const subtotal = cart.reduce((sum, i) => sum + i.sellingPrice * i.quantity, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const change = (Number(amountTendered) || 0) - total;

  const gcashPortion = Number(gcashAmount) || 0;
  const cashRemaining = Math.max(0, total - gcashPortion);
  const splitChange = (Number(amountTendered) || 0) - cashRemaining;
  const splitValid = gcashPortion > 0 && gcashPortion < total && (Number(amountTendered) || 0) >= cashRemaining;

  const canCheckout = cart.length > 0 && (
    paymentMethod === 'gcash' ||
    (paymentMethod === 'cash' && (Number(amountTendered) || 0) >= total) ||
    (paymentMethod === 'split' && splitValid)
  );

  function addProduct(p) {
    if (p.currentStock <= 0) {
      setScanError(`"${p.name}" is out of stock.`);
      return;
    }
    setScanError('');

    setCart((prev) => {
      const existing = prev.find((i) => i.productId === p.id);
      if (existing) {
        const step = stepFor(p);
        if (existing.quantity + step > p.currentStock) {
          setScanError(`Only ${p.currentStock} ${p.unit} of "${p.name}" available.`);
          return prev;
        }
        return prev.map((i) => (i.productId === p.id ? { ...i, quantity: i.quantity + step } : i));
      }
      return [...prev, {
        productId: p.id,
        name: p.name,
        sellingPrice: p.sellingPrice,
        quantity: 1,
        unit: p.unit,
        allowDecimal: p.allowDecimal,
        maxStock: p.currentStock,
      }];
    });
  }

  async function scanBarcode() {
    setScanError('');
    const code = barcodeInput.trim();
    if (!code) return;

    const product = await lookupByBarcode(code);

    if (!product) {
      setScanError(`Barcode "${code}" is not registered.`);
      if (isOwnerOrAdmin && confirm(`Barcode ${code} not found. Add it as a new product?`)) {
        navigate(`/inventory/new?barcode=${encodeURIComponent(code)}`);
        return;
      }
    } else {
      addProduct(product);
    }

    setBarcodeInput('');
    barcodeRef.current?.focus();
  }

  function updateQty(index, delta) {
    setCart((prev) => {
      const item = prev[index];
      const step = stepFor(item);
      let qty = Math.round((item.quantity + delta * step) * 100) / 100;
      if (qty <= 0) return prev.filter((_, i) => i !== index);
      if (item.maxStock && qty > item.maxStock) qty = item.maxStock;
      return prev.map((i, idx) => (idx === index ? { ...i, quantity: qty } : i));
    });
  }

  function setQty(index, value) {
    setCart((prev) => prev.map((i, idx) => {
      if (idx !== index) return i;
      let qty = Number(value) || 0;
      if (i.maxStock && qty > i.maxStock) qty = i.maxStock;
      return { ...i, quantity: qty };
    }));
  }

  function removeItem(index) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCheckout() {
    setCheckoutError('');
    setSubmitting(true);
    try {
      const { saleId } = await checkout({
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        discount: Number(discount) || 0,
        paymentMethod,
        amountTendered: paymentMethod === 'gcash' ? total : Number(amountTendered) || 0,
        paymentReference: paymentReference || null,
        gcashAmount: paymentMethod === 'split' ? gcashPortion : undefined,
        cashierId: profile.id,
        customer,
        discountRequestId: isOwnerOrAdmin ? null : discountRequestId,
      });
      navigate(`/pos/receipt/${saleId}`);
    } catch (err) {
      setCheckoutError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout header={
      <div className="d-flex justify-content-between align-items-center">
        <h2 className="h4 mb-0 d-flex align-items-center gap-2"><i className="bi bi-cart3 text-primary"></i> Point of Sale</h2>
        <span className="text-secondary d-flex align-items-center gap-2">
          <i className="bi bi-person-circle"></i> {profile?.name}
        </span>
      </div>
    }>
      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card mb-3">
            <div className="card-body">
              <div className="row g-2">
                <div className="col-md-7">
                  <label className="form-label small fw-semibold d-flex align-items-center gap-1">
                    <i className="bi bi-upc-scan"></i> Scan Barcode
                  </label>
                  <input
                    type="text" className="form-control scan-input" placeholder="Scan or type barcode, then Enter"
                    ref={barcodeRef} value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); scanBarcode(); } }}
                  />
                </div>
                <div className="col-md-5">
                  <label className="form-label small fw-semibold d-flex align-items-center gap-1">
                    <i className="bi bi-search"></i> Search Product
                  </label>
                  <input
                    type="text" className="form-control" placeholder="Type to filter the product list"
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              {scanError && (
                <div className="small text-danger mt-2 d-flex align-items-center gap-1">
                  <i className="bi bi-exclamation-circle"></i> {scanError}
                </div>
              )}
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-body">
              <div className="d-flex gap-2 flex-wrap mb-3">
                {[{ id: 'all', name: 'All' }, ...categories].map((c) => (
                  <button
                    key={c.id} type="button"
                    className={`btn btn-sm rounded-pill ${activeCategory === c.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setActiveCategory(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="row g-2" style={{ maxHeight: 340, overflowY: 'auto' }}>
                {visibleProducts.length === 0 ? (
                  <div className="empty-state"><i className="bi bi-box-seam"></i>No products found.</div>
                ) : visibleProducts.map((p) => (
                  <div className="col-6 col-md-4 col-xl-3" key={p.id}>
                    <button
                      type="button" disabled={p.currentStock <= 0}
                      className="btn pos-tile w-100 h-100 text-start d-flex flex-column justify-content-between"
                      onClick={() => addProduct(p)}
                    >
                      <span className="small fw-semibold text-body">{p.name}</span>
                      <span className="d-flex justify-content-between align-items-center mt-1">
                        <span className="fw-bold text-primary">₱{p.sellingPrice.toFixed(2)}</span>
                        <span className={`small ${p.currentStock <= 0 ? 'text-danger' : 'text-secondary'}`}>
                          {p.currentStock <= 0 ? 'Out' : `${p.currentStock} ${p.unit}`}
                        </span>
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ width: 160 }}>Qty</th>
                    <th className="text-end">Price</th>
                    <th className="text-end">Total</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="empty-state">
                          <i className="bi bi-upc-scan"></i>
                          Scan a barcode or tap a product above to begin.
                        </div>
                      </td>
                    </tr>
                  ) : cart.map((item, index) => (
                    <tr key={item.productId} className="pos-cart-row">
                      <td className="fw-semibold">{item.name}</td>
                      <td>
                        <div className="input-group input-group-sm">
                          <button className="btn btn-outline-secondary" onClick={() => updateQty(index, -1)}><i className="bi bi-dash"></i></button>
                          <input
                            type="number" className="form-control text-center"
                            step={stepFor(item)}
                            value={item.quantity}
                            onChange={(e) => setQty(index, e.target.value)}
                          />
                          <button className="btn btn-outline-secondary" onClick={() => updateQty(index, 1)}><i className="bi bi-plus"></i></button>
                        </div>
                      </td>
                      <td className="text-end">₱{item.sellingPrice.toFixed(2)}</td>
                      <td className="text-end fw-semibold">₱{(item.sellingPrice * item.quantity).toFixed(2)}</td>
                      <td><button className="btn btn-sm btn-link text-danger" onClick={() => removeItem(index)}><i className="bi bi-trash3"></i></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card">
            <div className="card-body">
              <div className="d-flex justify-content-between mb-2 text-secondary">
                <span>Subtotal</span>
                <span>₱{subtotal.toFixed(2)}</span>
              </div>
              <CustomerPicker value={customer} onChange={setCustomer} userId={profile.id} />
              <DiscountControl
                isOwnerOrAdmin={isOwnerOrAdmin}
                subtotal={subtotal}
                discount={discount}
                onDiscountChange={setDiscount}
                onApprovalChange={setDiscountRequestId}
                userId={profile.id}
              />
              <hr />
              <div className="d-flex justify-content-between fs-4 fw-bold mb-3">
                <span>TOTAL</span>
                <span className="text-primary">₱{total.toFixed(2)}</span>
              </div>

              <div className="btn-group w-100 mb-3">
                {[
                  { key: 'cash', icon: 'bi-cash', label: 'Cash' },
                  { key: 'gcash', icon: 'bi-phone', label: 'GCash' },
                  { key: 'split', icon: 'bi-arrow-left-right', label: 'Split' },
                ].map((pm) => (
                  <button
                    key={pm.key} type="button"
                    className={`btn d-flex align-items-center justify-content-center gap-1 ${paymentMethod === pm.key ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setPaymentMethod(pm.key)}
                  >
                    <i className={`bi ${pm.icon}`}></i> {pm.label}
                  </button>
                ))}
              </div>

              {paymentMethod === 'cash' && (
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Cash Tendered</label>
                  <input type="number" className="form-control form-control-lg" min="0" step="0.01" value={amountTendered} onChange={(e) => setAmountTendered(e.target.value)} />
                  <div className="d-flex justify-content-between mt-2 fs-5">
                    <span className="text-secondary">Change</span>
                    <span className={`fw-bold ${change < 0 ? 'text-danger' : 'text-success'}`}>₱{change.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {paymentMethod === 'gcash' && (
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Reference Number (optional)</label>
                  <input type="text" className="form-control" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
                </div>
              )}

              {paymentMethod === 'split' && (
                <div className="mb-3 d-flex flex-column gap-2">
                  <div>
                    <label className="form-label small fw-semibold">GCash Amount</label>
                    <input type="number" className="form-control" min="0" step="0.01" max={total} value={gcashAmount} onChange={(e) => setGcashAmount(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label small fw-semibold">GCash Reference (optional)</label>
                    <input type="text" className="form-control" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
                  </div>
                  <div className="d-flex justify-content-between text-secondary small">
                    <span>Remaining balance (cash)</span>
                    <span>₱{cashRemaining.toFixed(2)}</span>
                  </div>
                  <div>
                    <label className="form-label small fw-semibold">Cash Tendered</label>
                    <input type="number" className="form-control form-control-lg" min="0" step="0.01" value={amountTendered} onChange={(e) => setAmountTendered(e.target.value)} />
                  </div>
                  <div className="d-flex justify-content-between fs-5">
                    <span className="text-secondary">Change</span>
                    <span className={`fw-bold ${splitChange < 0 ? 'text-danger' : 'text-success'}`}>₱{splitChange.toFixed(2)}</span>
                  </div>
                  {gcashPortion >= total && gcashPortion > 0 && (
                    <div className="small text-danger d-flex align-items-center gap-1">
                      <i className="bi bi-exclamation-circle"></i> GCash amount must be less than the total — the rest comes from cash.
                    </div>
                  )}
                </div>
              )}

              <button className="btn btn-success btn-lg w-100 d-flex align-items-center justify-content-center gap-2" disabled={!canCheckout || submitting} onClick={handleCheckout}>
                {submitting ? (
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                ) : (
                  <i className="bi bi-check-circle-fill"></i>
                )}
                {submitting ? 'Processing…' : 'Complete Sale'}
              </button>
              {checkoutError && (
                <div className="small text-danger mt-2 d-flex align-items-center gap-1">
                  <i className="bi bi-exclamation-circle"></i> {checkoutError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
