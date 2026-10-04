import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { getSalesInRange, getSaleItemsInRange, summarizeReports, getStockReport } from '../services/reports';
import { getAllUsers } from '../services/users';
import { getExpensesInRange, summarizeExpenses } from '../services/expenses';
import { downloadCsv } from '../utils/csv';

const PERIODS = { daily: 'Today', weekly: 'This Week', monthly: 'This Month' };

export default function Reports() {
  const { isOwnerOrAdmin, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period') || 'daily';

  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [stock, setStock] = useState(null);
  const [usersById, setUsersById] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [sales, items, stockReport, users, expenseList] = await Promise.all([
        getSalesInRange(period, isOwnerOrAdmin ? null : profile.id),
        getSaleItemsInRange(period),
        getStockReport(),
        getAllUsers(),
        isOwnerOrAdmin ? getExpensesInRange(period) : Promise.resolve([]),
      ]);
      setUsersById(Object.fromEntries(users.map((u) => [u.id, u.name])));
      setSummary(summarizeReports(sales, items));
      setExpenses(expenseList);
      setStock(stockReport);
      setLoading(false);
    })();
  }, [period, isOwnerOrAdmin, profile.id]);

  const expenseSummary = summarizeExpenses(expenses);
  const net = (summary?.totalSales || 0) - expenseSummary.total;

  function handleDownload() {
    const peso = (n) => n.toFixed(2);
    const rows = [
      ['Sarisari POS Report', PERIODS[period]],
      ['Generated', new Date().toLocaleString()],
      [],
      ['SUMMARY'],
      ['Total sales', peso(summary.totalSales)],
      ['Transactions', summary.transactionCount],
      ...(isOwnerOrAdmin ? [['Total expenses', peso(expenseSummary.total)], ['Net (sales - expenses)', peso(net)]] : []),
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
    downloadCsv(`sarisari-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
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
              className={`nav-link ${period === key ? 'active' : ''}`}
              onClick={() => setSearchParams({ period: key })}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>

      {loading || !summary || !stock ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : (
        <>
          <div className="row g-3 mb-4">
            <div className={isOwnerOrAdmin ? 'col-md-3' : 'col-12'}>
              <StatCard
                icon="bi-cash-stack"
                label={`Total Sales (${PERIODS[period]})`}
                value={`₱${summary.totalSales.toFixed(2)}`}
                sublabel={`${summary.transactionCount} transactions`}
              />
            </div>
            {isOwnerOrAdmin && (
              <>
                <div className="col-md-3">
                  <StatCard icon="bi-wallet2" variant="warning" label="Expenses" value={`₱${expenseSummary.total.toFixed(2)}`} sublabel={`${expenses.length} entries`} />
                </div>
                <div className="col-md-3">
                  <StatCard icon="bi-piggy-bank" variant={net < 0 ? 'danger' : undefined} label="Net (Sales − Expenses)" value={`₱${net.toFixed(2)}`} />
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
