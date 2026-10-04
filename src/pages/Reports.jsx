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
  { key: 'daily', label: 'Today', heading: 'Daily Sales Report' },
  { key: 'yesterday', label: 'Yesterday', heading: 'Daily Sales Report' },
  { key: 'weekly', label: 'This week', heading: 'Weekly Sales Report' },
  { key: 'lastWeek', label: 'Last week', heading: 'Weekly Sales Report' },
  { key: 'monthly', label: 'This month', heading: 'Monthly Sales Report' },
  { key: 'lastMonth', label: 'Last month', heading: 'Monthly Sales Report' },
  { key: 'custom', label: 'Custom range', heading: 'Sales Report' },
];

const todayStr = () => new Date().toLocaleDateString('en-CA');
const money = (n) => `₱${(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fullDate = (d) => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const sameDay = (a, b) => a.toDateString() === b.toDateString();

/** "Cash", "GCash (ref 1234)", "Cash + GCash" - how the customer paid, in plain words. */
function payLabel(sale) {
  const legs = sale.payments || [{ method: sale.paymentMethod, reference: sale.paymentReference }];
  return legs
    .map((p) => (p.method === 'gcash' ? `GCash${p.reference ? ` (${p.reference})` : ''}` : p.method === 'cash' ? 'Cash' : p.method))
    .join(' + ');
}

function Details({ title, hint, children }) {
  return (
    <section className="mb-4">
      <h3 className="h6 mb-1">{title}</h3>
      {hint && <p className="text-secondary small mb-2">{hint}</p>}
      <div className="table-responsive report-table">{children}</div>
    </section>
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
  const [itemsBySale, setItemsBySale] = useState({});
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
      saleList.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
      const bySale = {};
      items.forEach((i) => { (bySale[i.saleId] ||= []).push(i); });
      setItemsBySale(bySale);
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
  const multiDay = !sameDay(startDate, endDate);
  const dateText = multiDay ? `${fullDate(startDate)} – ${fullDate(endDate)}` : fullDate(startDate);

  const gross = sales.reduce((sum, s) => sum + (s.subtotal ?? s.total), 0);
  const discounts = sales.reduce((sum, s) => sum + (s.discount || 0), 0);
  const collected = sales.reduce((sum, s) => sum + s.total, 0);

  const paid = (method) => summary?.paymentSummary.find((p) => p.method === method)?.total || 0;
  const expenseSummary = summarizeExpenses(expenses);
  const refundTotal = refunds.reduce((sum, r) => sum + r.amount, 0);
  const netCash = paid('cash') - refundTotal - expenseSummary.total;
  const netAfter = collected - refundTotal - expenseSummary.total;

  const itemsText = (s) => (itemsBySale[s.id] || []).map((i) => `${i.productName} ×${i.quantity}`).join(', ');
  const when = (s) => {
    const d = s.createdAt?.toDate?.();
    if (!d) return '—';
    return multiDay
      ? d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const cashierRows = (() => {
    const by = {};
    sales.forEach((s) => {
      by[s.cashierId] ||= { cashierId: s.cashierId, count: 0, net: 0 };
      by[s.cashierId].count += 1;
      by[s.cashierId].net += s.total;
    });
    return Object.values(by).sort((a, b) => b.net - a.net);
  })();

  function handleDownload() {
    const n = (x) => (x || 0).toFixed(2);
    const rows = [
      [preset.heading, dateText],
      ['Printed', `${new Date().toLocaleString()} by ${profile.name}`],
      [],
      ['Time', 'Receipt #', 'Items', 'Customer', 'Cashier', 'Payment', 'Amount', 'Discount', 'Paid'],
      ...sales.map((s) => [s.createdAt?.toDate?.().toLocaleString() || '', s.transactionNo, itemsText(s), s.customerName || 'Walk-in', usersById[s.cashierId] || '', payLabel(s), n(s.subtotal ?? s.total), n(s.discount), n(s.total)]),
      ['Totals', '', '', '', '', '', n(gross), n(discounts), n(collected)],
      [],
      ['Cash collected', n(paid('cash'))],
      ['GCash collected', n(paid('gcash'))],
      ['Total collected', n(collected)],
      ...(isOwnerOrAdmin ? [
        ['Refunds', n(refundTotal)], ['Expenses', n(expenseSummary.total)],
        ['Net cash (cash - refunds - expenses)', n(netCash)], ['Net after expenses', n(netAfter)],
        [],
        ['EXPENSES'], ['Time', 'Category', 'Description', 'Amount'],
        ...expenses.map((e) => [e.createdAt?.toDate?.().toLocaleString() || '', e.category, e.description, n(e.amount)]),
        [],
        ['REFUNDS'], ['Time', 'Receipt #', 'Reason', 'Amount'],
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
        <>
          {/* ---- The report sheet: one table + a summary strip ---- */}
          <div className="report-sheet">
            <h3 className="report-sheet-title">{preset.heading}</h3>
            <div className="report-sheet-sub">
              <span>Date: {dateText}</span>
              <span>Time: {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              <span>Prepared by: {profile.name}</span>
              {!isOwnerOrAdmin && <span>(your own sales)</span>}
            </div>

            <div className="table-responsive report-table">
              <table className="table table-hover align-middle report-main">
                <thead>
                  <tr>
                    <th className="col-hide-sm">{multiDay ? 'Date' : 'Time'}</th>
                    <th>Receipt #</th>
                    <th className="col-hide-md">Items</th>
                    <th className="col-hide-md">Customer</th>
                    <th className="col-hide-sm">Cashier</th>
                    <th className="col-hide-sm">Payment</th>
                    <th className="text-end col-hide-sm">Amount</th>
                    <th className="text-end col-hide-sm">Discount</th>
                    <th className="text-end">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 ? (
                    <tr><td colSpan={9} className="text-center text-secondary py-4">No sales in this period.</td></tr>
                  ) : sales.map((s) => (
                    <tr key={s.id}>
                      <td className="text-nowrap col-hide-sm">{when(s)}</td>
                      <td>
                        <Link to={`/pos/receipt/${s.id}`} className="font-monospace small fw-semibold">{s.transactionNo}</Link>
                        <div className="d-sm-none small text-secondary">{when(s)}</div>
                        <div className="d-xl-none small text-secondary report-items">{itemsText(s)}</div>
                      </td>
                      <td className="col-hide-md report-items">{itemsText(s)}</td>
                      <td className="col-hide-md">{s.customerName || <span className="text-secondary">Walk-in</span>}</td>
                      <td className="col-hide-sm">{usersById[s.cashierId] || '—'}</td>
                      <td className="col-hide-sm">{payLabel(s)}</td>
                      <td className="text-end col-hide-sm">{money(s.subtotal ?? s.total)}</td>
                      <td className="text-end col-hide-sm">{s.discount ? money(s.discount) : ''}</td>
                      <td className="text-end fw-semibold">
                        {money(s.total)}
                        <div className="d-sm-none small text-secondary fw-normal pay-sub">{payLabel(s)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {sales.length > 0 && (
                  <tfoot>
                    <tr className="table-total">
                      <td className="col-hide-sm"></td>
                      <td>Totals ({sales.length})</td>
                      <td className="col-hide-md"></td><td className="col-hide-md"></td><td className="col-hide-sm"></td><td className="col-hide-sm"></td>
                      <td className="text-end col-hide-sm">{money(gross)}</td>
                      <td className="text-end col-hide-sm">{money(discounts)}</td>
                      <td className="text-end">{money(collected)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="report-strip">
              <div><span>Cash collected</span> <strong>{money(paid('cash'))}</strong></div>
              <div><span>GCash collected</span> <strong>{money(paid('gcash'))}</strong></div>
              <div><span>Total collected</span> <strong>{money(collected)}</strong></div>
              {isOwnerOrAdmin && (
                <>
                  <div><span>Refunds</span> <strong>{money(refundTotal)}</strong></div>
                  <div><span>Expenses</span> <strong>{money(expenseSummary.total)}</strong></div>
                  <div><span>Net cash</span> <strong>{money(netCash)}</strong></div>
                  <div className="highlight"><span>Net after expenses</span> <strong>{money(netAfter)}</strong></div>
                </>
              )}
            </div>
            {isOwnerOrAdmin && (
              <p className="report-footnote">
                Net cash = cash collected − refunds − expenses (what should be in the drawer). Net after expenses = total collected − refunds − expenses. Voided sales are not counted.
              </p>
            )}
          </div>

          {/* ---- Extra breakdowns (screen only, tucked away) ---- */}
          <details className="card mt-3 d-print-none">
            <summary className="card-body fw-semibold" style={{ cursor: 'pointer' }}>
              <i className="bi bi-list-ul me-2"></i>More details — best sellers, cashiers{isOwnerOrAdmin ? ', expenses, refunds' : ''}, stock
            </summary>
            <div className="card-body pt-0">
              <Details title="Best-selling products">
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
              </Details>

              <Details title="Sales by cashier">
                <table className="table align-middle">
                  <thead><tr><th>Cashier</th><th className="text-end">Transactions</th><th className="text-end">Paid</th></tr></thead>
                  <tbody>
                    {cashierRows.length === 0 ? (
                      <tr><td colSpan={3} className="text-center text-secondary py-3">No sales in this period.</td></tr>
                    ) : cashierRows.map((c) => (
                      <tr key={c.cashierId}><td className="fw-semibold">{usersById[c.cashierId] || '—'}</td><td className="text-end">{c.count}</td><td className="text-end">{money(c.net)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </Details>

              {isOwnerOrAdmin && (
                <>
                  <Details title={`Expenses (${expenses.length})`} hint={expenseSummary.byCategory.map((c) => `${c.category} ${money(c.amount)}`).join(' · ') || undefined}>
                    <table className="table align-middle">
                      <thead><tr><th>{multiDay ? 'Date' : 'Time'}</th><th>Category</th><th>Description</th><th className="text-end">Amount</th></tr></thead>
                      <tbody>
                        {expenses.length === 0 ? (
                          <tr><td colSpan={4} className="text-center text-secondary py-3">No expenses in this period.</td></tr>
                        ) : expenses.map((e) => (
                          <tr key={e.id}><td className="text-nowrap text-secondary">{when(e)}</td><td>{e.category}</td><td>{e.description}</td><td className="text-end fw-semibold">{money(e.amount)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </Details>

                  <Details title={`Refunds (${refunds.length})`}>
                    <table className="table align-middle">
                      <thead><tr><th>{multiDay ? 'Date' : 'Time'}</th><th>Receipt #</th><th>Reason</th><th className="text-end">Amount</th></tr></thead>
                      <tbody>
                        {refunds.length === 0 ? (
                          <tr><td colSpan={4} className="text-center text-secondary py-3">No refunds in this period.</td></tr>
                        ) : refunds.map((r) => (
                          <tr key={r.id}><td className="text-nowrap text-secondary">{when(r)}</td><td className="font-monospace small">{r.transactionNo}</td><td>{r.reason}</td><td className="text-end fw-semibold">{money(r.amount)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </Details>
                </>
              )}

              <Details title={`Low stock (${stock.lowStock.length}) & out of stock (${stock.outOfStock.length})`}>
                <table className="table align-middle">
                  <tbody>
                    {stock.lowStock.length + stock.outOfStock.length === 0 ? (
                      <tr><td className="text-center text-secondary py-3">Everything is well stocked.</td></tr>
                    ) : (
                      <>
                        {stock.outOfStock.map((p) => (
                          <tr key={p.id}><td className="fw-semibold">{p.name}</td><td className="text-end"><span className="badge text-bg-danger">Out</span></td></tr>
                        ))}
                        {stock.lowStock.map((p) => (
                          <tr key={p.id}><td className="fw-semibold">{p.name}</td><td className="text-end"><span className="badge text-bg-warning">{p.currentStock} {p.unit}</span></td></tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </Details>

              {isOwnerOrAdmin && (
                <p className="text-secondary small mb-0">
                  Inventory valuation: {money(stock.retailValue)} at selling price · {money(stock.costValue)} at cost.
                </p>
              )}
            </div>
          </details>
        </>
      )}
    </Layout>
  );
}
