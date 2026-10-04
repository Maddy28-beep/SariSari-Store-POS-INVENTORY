import { useEffect, useState } from 'react';
import { getCustomers, addCustomer } from '../services/customers';

/** Optional: attach a sale to a customer so their purchase history builds up. */
export default function CustomerPicker({ value, onChange, userId }) {
  const [customers, setCustomers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { getCustomers().then(setCustomers).catch(() => {}); }, []);

  async function handleAdd() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const c = await addCustomer(form, userId);
      setCustomers((prev) => [...prev, c].sort((a, b) => a.nameLower.localeCompare(b.nameLower)));
      onChange(c);
      setForm({ name: '', phone: '' });
      setAdding(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-3">
      <label className="form-label small fw-semibold d-flex justify-content-between">
        <span>Customer (optional)</span>
        <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setAdding((a) => !a)}>
          {adding ? 'Cancel' : '+ New'}
        </button>
      </label>
      {adding ? (
        <div className="d-grid gap-2">
          <input className="form-control form-control-sm" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="form-control form-control-sm" placeholder="Phone (optional)" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <button type="button" className="btn btn-sm btn-primary" disabled={saving || !form.name.trim()} onClick={handleAdd}>Save customer</button>
        </div>
      ) : (
        <select
          className="form-select form-select-sm"
          value={value?.id || ''}
          onChange={(e) => onChange(customers.find((c) => c.id === e.target.value) || null)}
        >
          <option value="">Walk-in customer</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>)}
        </select>
      )}
    </div>
  );
}
