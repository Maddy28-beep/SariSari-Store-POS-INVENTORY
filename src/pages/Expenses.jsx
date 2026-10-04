import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { getSalesInRange } from '../services/reports';
import {
  EXPENSE_CATEGORIES, addExpense, deleteExpense, getExpensesInRange, summarizeExpenses,
} from '../services/expenses';

const PERIODS = { daily: 'Today', weekly: 'This Week', monthly: 'This Month' };

export default function Expenses() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period') || 'daily';

  const [expenses, setExpenses] = useState([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ description: '', category: EXPENSE_CATEGORIES[0], amount: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [list, sales] = await Promise.all([getExpensesInRange(period), getSalesInRange(period)]);
    setExpenses(list);
    setSalesTotal(sales.reduce((sum, s) => sum + s.total, 0));
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    const amount = Number(form.amount);
    if (!form.description.trim()) return setError('Enter what the expense was for.');
    if (!(amount > 0)) return setError('Amount must be more than ₱0.');

    setSaving(true);
    try {
      await addExpense({ ...form, amount, recordedBy: profile.id });
      setForm((f) => ({ ...f, description: '', amount: '' }));
      await load();
    } catch (err) {
      setError(err.message || 'Could not save the expense.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this expense?')) return;
    await deleteExpense(id);
    await load();
  }

  const { total, byCategory } = summarizeExpenses(expenses);
  const net = salesTotal - total;

  return (
    <Layout header={<h2 className="h4 mb-0 d-flex align-items-center gap-2"><i className="bi bi-wallet2 text-primary"></i> Expenses</h2>}>
      <ul className="nav nav-tabs mb-3">
        {Object.entries(PERIODS).map(([key, label]) => (
          <li className="nav-item" key={key}>
            <button className={`nav-link ${period === key ? 'active' : ''}`} onClick={() => setSearchParams({ period: key })}>{label}</button>
          </li>
        ))}
      </ul>

      <div className="row g-3 mb-4">
        <div className="col-md-4"><StatCard icon="bi-cash-stack" label="Sales" value={`₱${salesTotal.toFixed(2)}`} /></div>
        <div className="col-md-4"><StatCard icon="bi-wallet2" variant="warning" label="Expenses" value={`₱${total.toFixed(2)}`} sublabel={`${expenses.length} entries`} /></div>
        <div className="col-md-4">
          <StatCard icon="bi-piggy-bank" variant={net < 0 ? 'danger' : undefined} label="Net (Sales − Expenses)" value={`₱${net.toFixed(2)}`} />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-4">
          <form className="card" onSubmit={handleAdd}>
            <div className="card-header">Add expense</div>
            <div className="card-body d-grid gap-3">
              <div>
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">What was it for?</label>
                <input className="form-control" value={form.description} placeholder="e.g. Ice for the cooler" onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Amount (₱)</label>
                <input className="form-control" type="number" min="0" step="0.01" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              {error && <div className="alert alert-danger py-2 mb-0">{error}</div>}
              <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save expense'}</button>
            </div>
          </form>
        </div>

        <div className="col-lg-8">
          {byCategory.length > 0 && (
            <div className="d-flex flex-wrap gap-2 mb-3">
              {byCategory.map((c) => (
                <span key={c.category} className="badge text-bg-light border fs-6 fw-normal">{c.category}: <strong>₱{c.amount.toFixed(2)}</strong></span>
              ))}
            </div>
          )}
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead><tr><th>Time</th><th>Category</th><th>Description</th><th className="text-end">Amount</th><th></th></tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="text-center py-4"><div className="spinner-border text-primary" /></td></tr>
                  ) : expenses.length === 0 ? (
                    <tr><td colSpan={5}><div className="empty-state"><i className="bi bi-inbox"></i>No expenses in this period.</div></td></tr>
                  ) : expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="text-secondary text-nowrap">{e.createdAt?.toDate?.().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || '—'}</td>
                      <td><span className="badge text-bg-light border">{e.category}</span></td>
                      <td>{e.description}</td>
                      <td className="text-end fw-semibold">₱{e.amount.toFixed(2)}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-danger" aria-label="Delete expense" onClick={() => handleDelete(e.id)}><i className="bi bi-trash"></i></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
