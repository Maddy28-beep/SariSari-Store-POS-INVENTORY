import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { getCustomers, addCustomer, getCustomerSales } from '../services/customers';

function History({ customer }) {
  const [sales, setSales] = useState(null);

  useEffect(() => {
    getCustomerSales(customer.id).then(setSales);
  }, [customer.id]);

  if (!sales) return <div className="text-center py-4"><div className="spinner-border text-primary" /></div>;

  const valid = sales.filter((s) => s.status === 'completed');
  const spent = valid.reduce((sum, s) => sum + s.total, 0);

  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-4"><StatCard icon="bi-cash-stack" label="Total spent" value={`₱${spent.toFixed(2)}`} /></div>
        <div className="col-4"><StatCard icon="bi-receipt" label="Purchases" value={valid.length} /></div>
        <div className="col-4"><StatCard icon="bi-calendar-check" label="Last visit" value={valid[0]?.createdAt?.toDate?.().toLocaleDateString() || '—'} /></div>
      </div>
      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead><tr><th>Date</th><th>Receipt #</th><th>Payment</th><th className="text-end">Total</th></tr></thead>
            <tbody>
              {sales.length === 0 ? (
                <tr><td colSpan={4}><div className="empty-state"><i className="bi bi-inbox"></i>No purchases yet.</div></td></tr>
              ) : sales.map((s) => (
                <tr key={s.id}>
                  <td className="text-secondary text-nowrap">{s.createdAt?.toDate?.().toLocaleString() || '—'}</td>
                  <td><Link to={`/pos/receipt/${s.id}`} className="font-monospace small fw-semibold">{s.transactionNo}</Link>{s.status === 'voided' && <span className="badge text-bg-danger ms-2">voided</span>}</td>
                  <td><span className="badge text-bg-light border text-uppercase">{s.paymentMethod}</span></td>
                  <td className="text-end fw-semibold">₱{s.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function Customers() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setCustomers(await getCustomers());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () => customers.filter((c) => !q || c.nameLower?.includes(q) || (c.phone || '').includes(q)),
    [customers, q],
  );

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const c = await addCustomer(form, profile.id);
      setForm({ name: '', phone: '' });
      await load();
      setSelected(c);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout header={<h2 className="h4 mb-0 d-flex align-items-center gap-2"><i className="bi bi-people text-primary"></i> Customers</h2>}>
      <div className="row g-3">
        <div className="col-lg-4">
          <form className="card mb-3" onSubmit={handleAdd}>
            <div className="card-body d-grid gap-2">
              <input className="form-control" placeholder="New customer name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="form-control" placeholder="Phone (optional)" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <button className="btn btn-primary" disabled={saving || !form.name.trim()}><i className="bi bi-person-plus"></i> Add customer</button>
            </div>
          </form>
          <input className="form-control mb-2" placeholder="Search name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="list-group">
            {loading ? (
              <div className="text-center py-4"><div className="spinner-border text-primary" /></div>
            ) : visible.length === 0 ? (
              <div className="list-group-item text-secondary text-center">No customers yet.</div>
            ) : visible.map((c) => (
              <button key={c.id} className={`list-group-item list-group-item-action ${selected?.id === c.id ? 'active' : ''}`} onClick={() => setSelected(c)}>
                <div className="fw-semibold">{c.name}</div>
                {c.phone && <div className="small opacity-75">{c.phone}</div>}
              </button>
            ))}
          </div>
        </div>
        <div className="col-lg-8">
          {selected ? (
            <>
              <h3 className="h5 mb-3">{selected.name}{selected.phone && <span className="text-secondary fw-normal"> · {selected.phone}</span>}</h3>
              <History customer={selected} />
            </>
          ) : (
            <div className="card"><div className="empty-state"><i className="bi bi-person-lines-fill"></i>Pick a customer to see their purchase history.</div></div>
          )}
        </div>
      </div>
    </Layout>
  );
}
