import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageSkeleton from '../components/PageSkeleton';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { getSalesInRange, getSaleItemsInRange, getRefundsInRange, summarizeReports, getStockReport } from '../services/reports';
import { getAllUsers } from '../services/users';
import { getExpensesInRange, summarizeExpenses } from '../services/expenses';
import { downloadCsv } from '../utils/csv';

const PERIODS = { daily: 'Today', weekly: 'This Week', monthly: 'This Month', custom: 'Pick dates' };
const todayStr = () => new Date().toLocaleDateString('en-CA');

export default function Reports() {
  const { isOwnerOrAdmin, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const periodKey = searchParams.get('period') || 'daily';
  const from = searchParams.get('from') || todayStr();
  const to = searchParams.get('to') || from;
  // Services take either a preset name or an explicit {from, to} range.
  const period = periodKey === 'custom' ? { from, to } : periodKey;
  const periodLabel = periodKey === 'custom' ? (from === to ? from : `${from} to ${to}`) : PERIODS[periodKey];

  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [stock, setStock] = useState(null);
  const [usersById, setUsersById] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [sales, items, stockReport, users, expenseList, refundList] = await Promise.all([
        getSalesInRange(period, isOwnerOrAdmin ? null : profile.id),
        getSaleItemsInRange(period),
        getStockReport(),
        getAllUsers(),
        isOwnerOrAdmin ? getExpensesInRange(period) : Promise.resolve([]),
        isOwnerOrAdmin ? getRefundsInRange(period) : Promise.resolve([]),
      ]);
      setUsersById(Object.fromEntries(users.map((u) => [u.id, u.name])));
      setSummary(summarizeReports(sales, items));
      setExpenses(expenseList);
      setRefunds(refundList);
      setStock(stockReport);
      setLoading(false);
    })();
  }, [periodKey, from, to, isOwnerOrAdmin, profile.id]);

  const expenseSummary = summarizeExpenses(expenses);
  const refundTotal = refunds.reduce((sum, r) => sum + r.amount, 0);
  const net = (summary?.totalSales || 0) - refundTotal - expenseSummary.total;
  // Money organised by where it physically is: cash in the drawer vs GCash in the phone.
  const paid = (method) => summary?.paymentSummary.find((p) => p.method === method)?.total || 0;
  const cashDrawer = paid('cash') - refundTotal - expenseSummary.total;

  function handleDownload() {
    const peso = (n) => n.toFixed(2);
    const rows = [
      ['Sarisari POS Report', periodLabel],
      ['Generated', new Date().toLocaleString()],
      [],
      ['SUMMARY'],
      ['Total sales', peso(summary.totalSales)],
      ['Transactions', summary.transactionCount],
      ...(isOwnerOrAdmin ? [['Refunds', peso(refundTotal)], ['Total expenses', peso(expenseSummary.total)], ['Net (sales - refunds - expenses)', peso(net)], ['Cash sales', peso(paid('cash'))], ['GCash sales', peso(paid('gcash'))], ['Expected cash in drawer (cash - refunds - expenses)', peso(cashDrawer)]] : []),
      [],
      ['PAYMENT METHODS'], ['Method', 'Payments', 'Total'],
      ...summary.paymentSummary.map((p) => [p.method, p.count, peso(p.total)]),
      [],
      ['BEST SELLERS'], ['Product', 'Qty sold', 'Revenue'],
      ...summary.bestSellers.map((b) => [b.productName, b.qty, peso(b.revenue)]),
      [],
      ['CASHIER SALES'], ['Cashier', 'Transactions', 'Total'],
      ...summary.cashierSummary.map((c) => [usersById[c.cashierId] || '', c.count, peso(c.total)]),
      ...(isOwnerOrAdmin ? [
        [],
        ['EXPENSES BY CATEGORY'], ['Category', 'Amount'],
        ...expenseSummary.byCategory.map((c) => [c.category, peso(c.amount)]),
        [],
        ['EXPENSE DETAILS'], ['Date', 'Category', 'Description', 'Amount'],
        ...expenses.map((e) => [e.createdAt?.toDate?.().toLocaleString() || '', e.category, e.description, peso(e.amount)]),
      ] : []),
    ];
    downloadCsv(`sarisari-report-${periodKey === 'custom' ? `${from}_to_${to}` : periodKey}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <Layout header={
      <div className="d-flex justify-content-between align-items-center gap-2">
        <h2 className="h4 mb-0 d-flex align-items-center gap-2"><i className="bi bi-graph-up-arrow text-primary"></i> Reports</h2>
        {summary && (
          <div className="d-flex gap-2 d-print-none">
            <button className="btn btn-outline-secondary btn-sm" onClick={() => window.print()}><i className="bi bi-printer"></i> Print / PDF</button>
            <button className="btn btn-primary btn-sm" onClick={handleDownload}><i className="bi bi-download"></i> Download CSV</button>
          </div>
        )}
      </div>
    }>
      <ul className="nav nav-tabs mb-3">
        {Object.entries(PERIODS).map(([key, label]) => (
          <li className="nav-item" key={key}>
            <button
              className={`nav-link ${periodKey === key ? 'active' : ''}`}
              onClick={() => setSearchParams(key === 'custom' ? { period: key, from, to } : { period: key })}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>

      {periodKey === 'custom' && (
        <div className="d-flex flex-wrap align-items-end gap-3 mb-3 d-print-none">
          <div>
            <label className="form-label small fw-semibold mb-1">From</label>
            <input type="date" className="form-control" value={from} max={to} onChange={(e) => setSearchParams({ period: 'custom', from: e.target.value, to })} />
          </div>
          <div>
            <label className="form-label small fw-semibold mb-1">To</label>
            <input type="date" className="form-control" value={to} min={from} max={todayStr()} onChange={(e) => setSearchParams({ period: 'custom', from, to: e.target.value })} />
          </div>
        </div>
      )}

      <div className="d-none d-print-block mb-3">
        <h3 className="h5 mb-0">Sarisari POS — Sales Report</h3>
        <div className="text-secondary">{periodLabel}</div>
      </div>

      {loading || !summary || !stock ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="row g-3 mb-4">
            <div className={isOwnerOrAdmin ? 'col-md-3' : 'col-12'}>
              <StatCard
                icon="bi-cash-stack"
                label={`Total Sales (${periodLabel})`}
                value={`₱${summary.totalSales.toFixed(2)}`}
                sublabel={`${summary.transactionCount} transactions`}
              />
            </div>
            {isOwnerOrAdmin && (
              <>
                <div className="col-md-3">
                  <StatCard icon="bi-wallet2" variant="warning" label="Expenses" value={`₱${expenseSummary.total.toFixed(2)}`} sublabel={`${expenses.length} entries · refunds ₱${refundTotal.toFixed(2)}`} />
                </div>
                <div className="col-md-3">
                  <StatCard icon="bi-piggy-bank" variant={net < 0 ? 'danger' : undefined} label="Net (Sales − Refunds − Expenses)" value={`₱${net.toFixed(2)}`} />
                </div>
              </>
            )}
            {isOwnerOrAdmin && (
              <div className="col-md-3">
                <StatCard
                  icon="bi-archive"
                  label="Inventory Valuation"
                  value={`₱${stock.retailValue.toFixed(2)}`}
                  sublabel={`Cost: ₱${stock.costValue.toFixed(2)}`}
                />
              </div>
            )}
          </div>

          {isOwnerOrAdmin && (
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <StatCard icon="bi-cash-coin" label="Cash in drawer (expected)" value={`₱${cashDrawer.toFixed(2)}`} sublabel="cash sales − refunds − expenses" />
              </div>
              <div className="col-md-4">
                <StatCard icon="bi-phone" label="GCash received" value={`₱${paid('gcash').toFixed(2)}`} sublabel="should match your GCash wallet" />
              </div>
              <div className="col-md-4">
                <StatCard icon="bi-arrow-return-left" label="Refunds" value={`₱${refundTotal.toFixed(2)}`} sublabel={`${refunds.length} refund${refunds.length === 1 ? '' : 's'}`} />
              </div>
            </div>
          )}

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header d-flex align-items-center gap-2">
                  <i className="bi bi-trophy-fill text-warning"></i> Best-Selling Products
                </div>
                <ul className="list-group list-group-flush">
                  {summary.bestSellers.length === 0 ? (
                    <li className="list-group-item text-secondary text-center py-4">No sales in this period.</li>
                  ) : summary.bestSellers.map((item) => (
                    <li key={item.productName} className="list-group-item d-flex justify-content-between">
                      <span className="fw-semibold">{item.productName}</span>
                      <span className="text-secondary">{item.qty} sold — ₱{item.revenue.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header d-flex align-items-center gap-2">
                  <i className="bi bi-credit-card-fill text-secondary"></i> Payment Method Summary
                </div>
                <ul className="list-group list-group-flush">
                  {summary.paymentSummary.length === 0 ? (
                    <li className="list-group-item text-secondary text-center py-4">No sales in this period.</li>
                  ) : summary.paymentSummary.map((item) => (
                    <li key={item.method} className="list-group-item d-flex justify-content-between">
                      <span className="text-uppercase fw-semibold">{item.method}</span>
                      <span className="text-secondary">{item.count} payments — ₱{item.total.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header d-flex align-items-center gap-2">
              <i className="bi bi-person-fill text-secondary"></i> Cashier Sales
            </div>
            <ul className="list-group list-group-flush">
              {summary.cashierSummary.length === 0 ? (
                <li className="list-group-item text-secondary text-center py-4">No sales in this period.</li>
              ) : summary.cashierSummary.map((item) => (
                <li key={item.cashierId} className="list-group-item d-flex justify-content-between">
                  <span className="fw-semibold">{usersById[item.cashierId] || '—'}</span>
                  <span className="text-secondary">{item.count} txns — ₱{item.total.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="row g-3">
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header d-flex align-items-center gap-2 text-warning-emphasis">
                  <i className="bi bi-exclamation-triangle-fill"></i> Low Stock Products
                </div>
                <ul className="list-group list-group-flush">
                  {stock.lowStock.length === 0 ? (
                    <li className="list-group-item text-secondary text-center py-4">Nothing low on stock.</li>
                  ) : stock.lowStock.map((p) => (
                    <li key={p.id} className="list-group-item d-flex justify-content-between">
                      <span className="fw-semibold">{p.name}</span>
                      <span className="badge text-bg-warning">{p.currentStock} {p.unit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header d-flex align-items-center gap-2 text-danger-emphasis">
                  <i className="bi bi-x-octagon-fill"></i> Out of Stock Products
                </div>
                <ul className="list-group list-group-flush">
                  {stock.outOfStock.length === 0 ? (
                    <li className="list-group-item text-secondary text-center py-4">Nothing out of stock.</li>
                  ) : stock.outOfStock.map((p) => (
                    <li key={p.id} className="list-group-item d-flex justify-content-between">
                      <span className="fw-semibold">{p.name}</span>
                      <span className="badge text-bg-danger">Out</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
