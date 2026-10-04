import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageSkeleton from '../components/PageSkeleton';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import {
  getSalesInRange, getSaleItemsInRange, getRefundsInRange, summarizeReports, getStockReport, rangeFor,
} from '../services/reports';
import { getAllUsers } from '../services/users';
import { getExpensesInRange, summarizeExpenses } from '../services/expenses';
import { downloadCsv } from '../utils/csv';

const PRESETS = [
  { key: 'daily', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'weekly', label: 'This week' },
  { key: 'lastWeek', label: 'Last week' },
  { key: 'monthly', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'custom', label: 'Custom range' },
];

const todayStr = () => new Date().toLocaleDateString('en-CA');
const money = (n) => `₱${(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fullDate = (d) => d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
const sameDay = (a, b) => a.toDateString() === b.toDateString();

function Section({ title, hint, children }) {
  return (
    <section className="report-section mb-4">
      <h3 className="h6 mb-1">{title}</h3>
      {hint && <p className="text-secondary small mb-2">{hint}</p>}
      <div className="table-responsive report-table">{children}</div>
    </section>
  );
}

function Kpi({ label, value, emphasis }) {
  return (
    <div className="report-kpi">
      <div className="report-kpi-label">{label}</div>
      <div className={`report-kpi-value ${emphasis ? 'emphasis' : ''}`}>{value}</div>
    </div>
  );
}

export default function Reports() {
  const { isOwnerOrAdmin, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const periodKey = searchParams.get('period') || 'daily';
  const from = searchParams.get('from') || todayStr();
  const to = searchParams.get('to') || from;
  // Services take either a preset name or an explicit {from, to} range.
  const period = periodKey === 'custom' ? { from, to } : periodKey;

  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [stock, setStock] = useState(null);
  const [usersById, setUsersById] = useState({});
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [saleList, items, stockReport, users, expenseList, refundList] = await Promise.all([
        getSalesInRange(period, isOwnerOrAdmin ? null : profile.id),
        getSaleItemsInRange(period),
        getStockReport(),
        getAllUsers(),
        isOwnerOrAdmin ? getExpensesInRange(period) : Promise.resolve([]),
        isOwnerOrAdmin ? getRefundsInRange(period) : Promise.resolve([]),
      ]);
      setUsersById(Object.fromEntries(users.map((u) => [u.id, u.name])));
      saleList.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setSales(saleList);
      setSummary(summarizeReports(saleList, items));
      setExpenses(expenseList);
      setRefunds(refundList);
      setStock(stockReport);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey, from, to, isOwnerOrAdmin, profile.id, reloadTick]);

  // ---- derived figures ----
  const { start, end } = rangeFor(period);
  const startDate = start.toDate();
  const endDate = end.toDate();
  const preset = PRESETS.find((p) => p.key === periodKey);
  const dateText = sameDay(startDate, endDate) ? fullDate(startDate) : `${fullDate(startDate)} – ${fullDate(endDate)}`;
  const title = periodKey === 'custom' ? `Custom range — ${dateText}` : `${preset.label} — ${dateText}`;
  const multiDay = !sameDay(startDate, endDate);

  const gross = sales.reduce((sum, s) => sum + (s.subtotal ?? s.total), 0);
  const discounts = sales.reduce((sum, s) => sum + (s.discount || 0), 0);
  const net = sales.reduce((sum, s) => sum + s.total, 0);

  const expenseSummary = summarizeExpenses(expenses);
  const refundTotal = refunds.reduce((sum, r) => sum + r.amount, 0);
  const bottomLine = net - refundTotal - expenseSummary.total;
  const paid = (method) => summary?.paymentSummary.find((p) => p.method === method)?.total || 0;
  const cashDrawer = paid('cash') - refundTotal - expenseSummary.total;

  const cashierRows = (() => {
    const by = {};
    sales.forEach((s) => {
      by[s.cashierId] ||= { cashierId: s.cashierId, count: 0, gross: 0, discount: 0, net: 0 };
      by[s.cashierId].count += 1;
      by[s.cashierId].gross += s.subtotal ?? s.total;
      by[s.cashierId].discount += s.discount || 0;
      by[s.cashierId].net += s.total;
    });
    return Object.values(by).sort((a, b) => b.net - a.net);
  })();

  const when = (s) => {
    const d = s.createdAt?.toDate?.();
    if (!d) return '—';
    return multiDay
      ? d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  function handleDownload() {
    const n = (x) => (x || 0).toFixed(2);
    const rows = [
      ['Sarisari POS — Sales Report', title],
      ['Printed', `${new Date().toLocaleString()} by ${profile.name}`],
      [],
      ['SUMMARY'],
      ['Gross sales', n(gross)], ['Discounts', n(discounts)], ['Net sales', n(net)], ['Transactions', sales.length],
      ...(isOwnerOrAdmin ? [
        ['Refunds', n(refundTotal)], ['Expenses', n(expenseSummary.total)], ['Net after refunds & expenses', n(bottomLine)],
        ['Cash sales', n(paid('cash'))], ['GCash sales', n(paid('gcash'))], ['Expected cash in drawer', n(cashDrawer)],
      ] : []),
      [],
      ['SALES BY PAYMENT METHOD'], ['Method', 'Payments', 'Amount'],
      ...summary.paymentSummary.map((p) => [p.method, p.count, n(p.total)]),
      [],
      ['SALES BY CASHIER'], ['Cashier', 'Transactions', 'Gross', 'Discounts', 'Net'],
      ...cashierRows.map((c) => [usersById[c.cashierId] || '', c.count, n(c.gross), n(c.discount), n(c.net)]),
      [],
      ['TRANSACTIONS'], ['Date', 'Receipt #', 'Cashier', 'Customer', 'Payment', 'Gross', 'Discount', 'Net'],
      ...sales.map((s) => [s.createdAt?.toDate?.().toLocaleString() || '', s.transactionNo, usersById[s.cashierId] || '', s.customerName || '', s.paymentMethod, n(s.subtotal ?? s.total), n(s.discount), n(s.total)]),
      [],
      ['BEST SELLERS'], ['Product', 'Qty sold', 'Revenue'],
      ...summary.bestSellers.map((b) => [b.productName, b.qty, n(b.revenue)]),
      ...(isOwnerOrAdmin ? [
        [],
        ['EXPENSES'], ['Date', 'Category', 'Description', 'Amount'],
        ...expenses.map((e) => [e.createdAt?.toDate?.().toLocaleString() || '', e.category, e.description, n(e.amount)]),
        [],
        ['REFUNDS'], ['Date', 'Receipt #', 'Reason', 'Amount'],
        ...refunds.map((r) => [r.createdAt?.toDate?.().toLocaleString() || '', r.transactionNo, r.reason, n(r.amount)]),
      ] : []),
    ];
    downloadCsv(`sarisari-report-${periodKey === 'custom' ? `${from}_to_${to}` : periodKey}-${todayStr()}.csv`, rows);
  }

  function pickPreset(key) {
    setSearchParams(key === 'custom' ? { period: key, from, to } : { period: key });
  }

  return (
    <Layout header={<h2 className="h4 mb-0 d-flex align-items-center gap-2"><i className="bi bi-graph-up-arrow text-primary"></i> Reports</h2>}>
      {/* ---- Report period ---- */}
      <div className="card mb-3 d-print-none">
        <div className="card-body">
          <h3 className="h6 mb-3">Report period</h3>
          <div className="chip-row mb-3">
            {PRESETS.map((p) => (
              <button key={p.key} type="button" className={`chip ${periodKey === p.key ? 'active' : ''}`} onClick={() => pickPreset(p.key)}>
                {p.label}
              </button>
            ))}
          </div>

          {periodKey === 'custom' && (
            <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
              <div>
                <label className="form-label mb-1">From</label>
                <input type="date" className="form-control" value={from} max={to} onChange={(e) => setSearchParams({ period: 'custom', from: e.target.value, to })} />
              </div>
              <div>
                <label className="form-label mb-1">To</label>
                <input type="date" className="form-control" value={to} min={from} max={todayStr()} onChange={(e) => setSearchParams({ period: 'custom', from, to: e.target.value })} />
              </div>
            </div>
          )}

          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setReloadTick((t) => t + 1)}>
              <i className="bi bi-arrow-clockwise"></i> Refresh
            </button>
            <button type="button" className="btn btn-outline-secondary" disabled={loading} onClick={() => window.print()}>
              <i className="bi bi-printer"></i> Print
            </button>
            <button type="button" className="btn btn-outline-secondary" disabled={loading} onClick={handleDownload}>
              <i className="bi bi-filetype-csv"></i> Excel (CSV)
            </button>
            <button type="button" className="btn btn-primary" disabled={loading} onClick={() => window.print()} title="Choose “Save as PDF” as the printer">
              <i className="bi bi-file-earmark-arrow-down"></i> Save as PDF
            </button>
          </div>
        </div>
      </div>

      {loading || !summary || !stock ? (
        <PageSkeleton />
      ) : (
        <div className="card report-card">
          <div className="card-body">
            <h3 className="report-title">{title}</h3>
            <p className="text-secondary mb-3">
              Printed {new Date().toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit', hour: 'numeric', minute: '2-digit' })}
              <span className="small"> · system timestamp (read-only) · </span>{profile.name}
              {!isOwnerOrAdmin && <span className="small"> · showing your own sales</span>}
            </p>

            <div className="report-kpis mb-3">
              <Kpi label="Gross sales" value={money(gross)} />
              <Kpi label="Discounts" value={money(discounts)} />
              <Kpi label="Net sales" value={money(net)} />
              {isOwnerOrAdmin
                ? <Kpi label="Net after refunds & expenses" value={money(bottomLine)} emphasis />
                : <Kpi label="Transactions" value={sales.length} emphasis />}
            </div>

            <p className="text-secondary small mb-4">
              {isOwnerOrAdmin
                ? <>Refunds ({refunds.length}) of {money(refundTotal)} and expenses ({expenses.length}) of {money(expenseSummary.total)} are deducted only in the last figure — Gross, Discounts and Net sales are straight from the receipts. </>
                : null}
              Voided sales are not counted.
            </p>

            <Section title="Sales by payment method" hint="Where the money actually came in.">
              <table className="table align-middle">
                <thead><tr><th>Method</th><th className="text-end">Payments</th><th className="text-end">Amount</th><th className="text-end col-hide-sm">Share</th></tr></thead>
                <tbody>
                  {summary.paymentSummary.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-secondary py-3">No sales in this period.</td></tr>
                  ) : summary.paymentSummary.map((p) => (
                    <tr key={p.method}>
                      <td className="text-uppercase fw-semibold">{p.method}</td>
                      <td className="text-end">{p.count}</td>
                      <td className="text-end fw-semibold">{money(p.total)}</td>
                      <td className="text-end col-hide-sm text-secondary">{net ? `${((p.total / net) * 100).toFixed(0)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {isOwnerOrAdmin && (
              <Section title="Cash drawer & GCash" hint="Count the drawer against this at closing.">
                <table className="table align-middle">
                  <tbody>
                    <tr><td>Cash received from sales</td><td className="text-end">{money(paid('cash'))}</td></tr>
                    <tr><td>Less: refunds paid out</td><td className="text-end text-danger">− {money(refundTotal)}</td></tr>
                    <tr><td>Less: expenses paid from the drawer</td><td className="text-end text-danger">− {money(expenseSummary.total)}</td></tr>
                    <tr className="table-total"><td>Expected cash in drawer</td><td className="text-end">{money(cashDrawer)}</td></tr>
                    <tr><td>GCash received (should match the wallet)</td><td className="text-end fw-semibold">{money(paid('gcash'))}</td></tr>
                  </tbody>
                </table>
              </Section>
            )}

            <Section title={`Sales by cashier (${cashierRows.length})`}>
              <table className="table align-middle">
                <thead><tr><th>Cashier</th><th className="text-end">Txns</th><th className="text-end col-hide-sm">Gross</th><th className="text-end col-hide-sm">Discounts</th><th className="text-end">Net</th></tr></thead>
                <tbody>
                  {cashierRows.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-secondary py-3">No sales in this period.</td></tr>
                  ) : cashierRows.map((c) => (
                    <tr key={c.cashierId}>
                      <td className="fw-semibold">{usersById[c.cashierId] || '—'}</td>
                      <td className="text-end">{c.count}</td>
                      <td className="text-end col-hide-sm">{money(c.gross)}</td>
                      <td className="text-end col-hide-sm">{money(c.discount)}</td>
                      <td className="text-end fw-semibold">{money(c.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title={`Transactions (${sales.length})`} hint="One row per receipt, newest first.">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>{multiDay ? 'Date' : 'Time'}</th><th>Receipt #</th><th className="col-hide-sm">Cashier</th><th className="col-hide-sm">Customer</th>
                    <th className="col-hide-sm">Payment</th><th className="text-end col-hide-sm">Gross</th><th className="text-end col-hide-sm">Discount</th><th className="text-end">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 ? (
                    <tr><td colSpan={8} className="text-center text-secondary py-3">No sales in this period.</td></tr>
                  ) : sales.map((s) => (
                    <tr key={s.id}>
                      <td className="text-nowrap text-secondary">{when(s)}</td>
                      <td><Link to={`/pos/receipt/${s.id}`} className="font-monospace small fw-semibold">{s.transactionNo}</Link></td>
                      <td className="col-hide-sm">{usersById[s.cashierId] || '—'}</td>
                      <td className="col-hide-sm">{s.customerName || <span className="text-secondary">Walk-in</span>}</td>
                      <td className="col-hide-sm"><span className="badge text-bg-light text-uppercase">{s.paymentMethod}</span></td>
                      <td className="text-end col-hide-sm">{(s.subtotal ?? s.total).toFixed(2)}</td>
                      <td className="text-end col-hide-sm">{s.discount ? s.discount.toFixed(2) : '—'}</td>
                      <td className="text-end fw-semibold">{s.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                {sales.length > 0 && (
                  <tfoot>
                    <tr className="table-total">
                      <td colSpan={2}>Total</td><td className="col-hide-sm"></td><td className="col-hide-sm"></td><td className="col-hide-sm"></td>
                      <td className="text-end col-hide-sm">{gross.toFixed(2)}</td><td className="text-end col-hide-sm">{discounts.toFixed(2)}</td><td className="text-end">{net.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </Section>

            <Section title="Best-selling products">
              <table className="table align-middle">
                <thead><tr><th>Product</th><th className="text-end">Qty sold</th><th className="text-end">Revenue</th></tr></thead>
                <tbody>
                  {summary.bestSellers.length === 0 ? (
                    <tr><td colSpan={3} className="text-center text-secondary py-3">No sales in this period.</td></tr>
                  ) : summary.bestSellers.map((b) => (
                    <tr key={b.productName}><td className="fw-semibold">{b.productName}</td><td className="text-end">{b.qty}</td><td className="text-end">{money(b.revenue)}</td></tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {isOwnerOrAdmin && (
              <>
                <Section title={`Expenses (${expenses.length})`} hint={expenseSummary.byCategory.map((c) => `${c.category} ${money(c.amount)}`).join(' · ') || undefined}>
                  <table className="table align-middle">
                    <thead><tr><th>{multiDay ? 'Date' : 'Time'}</th><th>Category</th><th>Description</th><th className="text-end">Amount</th></tr></thead>
                    <tbody>
                      {expenses.length === 0 ? (
                        <tr><td colSpan={4} className="text-center text-secondary py-3">No expenses in this period.</td></tr>
                      ) : expenses.map((e) => (
                        <tr key={e.id}>
                          <td className="text-nowrap text-secondary">{when(e)}</td>
                          <td><span className="badge text-bg-light">{e.category}</span></td>
                          <td>{e.description}</td>
                          <td className="text-end fw-semibold">{e.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>

                <Section title={`Refunds (${refunds.length})`} hint="Partial returns — the items went back into stock.">
                  <table className="table align-middle">
                    <thead><tr><th>{multiDay ? 'Date' : 'Time'}</th><th>Receipt #</th><th className="col-hide-sm">Reason</th><th className="text-end">Amount</th></tr></thead>
                    <tbody>
                      {refunds.length === 0 ? (
                        <tr><td colSpan={4} className="text-center text-secondary py-3">No refunds in this period.</td></tr>
                      ) : refunds.map((r) => (
                        <tr key={r.id}>
                          <td className="text-nowrap text-secondary">{when(r)}</td>
                          <td className="font-monospace small">{r.transactionNo}</td>
                          <td className="col-hide-sm">{r.reason}</td>
                          <td className="text-end fw-semibold">{r.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              </>
            )}

            <div className="row g-4">
              <div className="col-md-6">
                <Section title={`Low stock (${stock.lowStock.length})`}>
                  <table className="table align-middle">
                    <tbody>
                      {stock.lowStock.length === 0 ? (
                        <tr><td className="text-center text-secondary py-3">Nothing low on stock.</td></tr>
                      ) : stock.lowStock.map((p) => (
                        <tr key={p.id}><td className="fw-semibold">{p.name}</td><td className="text-end"><span className="badge text-bg-warning">{p.currentStock} {p.unit}</span></td></tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              </div>
              <div className="col-md-6">
                <Section title={`Out of stock (${stock.outOfStock.length})`}>
                  <table className="table align-middle">
                    <tbody>
                      {stock.outOfStock.length === 0 ? (
                        <tr><td className="text-center text-secondary py-3">Nothing out of stock.</td></tr>
                      ) : stock.outOfStock.map((p) => (
                        <tr key={p.id}><td className="fw-semibold">{p.name}</td><td className="text-end"><span className="badge text-bg-danger">Out</span></td></tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              </div>
            </div>

            {isOwnerOrAdmin && (
              <p className="text-secondary small mb-0">
                Inventory valuation: {money(stock.retailValue)} at selling price · {money(stock.costValue)} at cost.
              </p>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
