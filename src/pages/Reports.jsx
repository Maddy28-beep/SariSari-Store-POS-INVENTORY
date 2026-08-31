import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { getSalesInRange, getSaleItemsInRange, summarizeReports, getStockReport } from '../services/reports';
import { getAllUsers } from '../services/users';

const PERIODS = { daily: 'Today', weekly: 'This Week', monthly: 'This Month' };

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period') || 'daily';

  const [summary, setSummary] = useState(null);
  const [stock, setStock] = useState(null);
  const [usersById, setUsersById] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [sales, items, stockReport, users] = await Promise.all([
        getSalesInRange(period),
        getSaleItemsInRange(period),
        getStockReport(),
        getAllUsers(),
      ]);
      setUsersById(Object.fromEntries(users.map((u) => [u.id, u.name])));
      setSummary(summarizeReports(sales, items));
      setStock(stockReport);
      setLoading(false);
    })();
  }, [period]);

  return (
    <Layout header={<h2 className="h4 mb-0">📈 Reports</h2>}>
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
            <div className="col-md-6">
              <div className="card stat-card h-100">
                <div className="card-body">
                  <div className="text-secondary small text-uppercase">Total Sales ({PERIODS[period]})</div>
                  <div className="fs-3 fw-bold">₱{summary.totalSales.toFixed(2)}</div>
                  <div className="text-secondary small">{summary.transactionCount} transactions</div>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card stat-card h-100">
                <div className="card-body">
                  <div className="text-secondary small text-uppercase">Inventory Valuation</div>
                  <div className="fs-5">Cost: ₱{stock.costValue.toFixed(2)}</div>
                  <div className="fs-5">Retail: ₱{stock.retailValue.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header">🏆 Best-Selling Products</div>
                <ul className="list-group list-group-flush">
                  {summary.bestSellers.length === 0 ? (
                    <li className="list-group-item text-secondary text-center py-4">No sales in this period.</li>
                  ) : summary.bestSellers.map((item) => (
                    <li key={item.productName} className="list-group-item d-flex justify-content-between">
                      <span>{item.productName}</span>
                      <span className="text-secondary">{item.qty} sold — ₱{item.revenue.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header">💳 Payment Method Summary</div>
                <ul className="list-group list-group-flush">
                  {summary.paymentSummary.length === 0 ? (
                    <li className="list-group-item text-secondary text-center py-4">No sales in this period.</li>
                  ) : summary.paymentSummary.map((item) => (
                    <li key={item.method} className="list-group-item d-flex justify-content-between">
                      <span className="text-uppercase">{item.method}</span>
                      <span className="text-secondary">{item.count} txns — ₱{item.total.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header">👤 Cashier Sales</div>
            <ul className="list-group list-group-flush">
              {summary.cashierSummary.length === 0 ? (
                <li className="list-group-item text-secondary text-center py-4">No sales in this period.</li>
              ) : summary.cashierSummary.map((item) => (
                <li key={item.cashierId} className="list-group-item d-flex justify-content-between">
                  <span>{usersById[item.cashierId] || '—'}</span>
                  <span className="text-secondary">{item.count} txns — ₱{item.total.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="row g-3">
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header text-warning-emphasis">⚠ Low Stock Products</div>
                <ul className="list-group list-group-flush">
                  {stock.lowStock.length === 0 ? (
                    <li className="list-group-item text-secondary text-center py-4">Nothing low on stock.</li>
                  ) : stock.lowStock.map((p) => (
                    <li key={p.id} className="list-group-item d-flex justify-content-between">
                      <span>{p.name}</span>
                      <span className="badge text-bg-warning">{p.currentStock} {p.unit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header text-danger-emphasis">🔴 Out of Stock Products</div>
                <ul className="list-group list-group-flush">
                  {stock.outOfStock.length === 0 ? (
                    <li className="list-group-item text-secondary text-center py-4">Nothing out of stock.</li>
                  ) : stock.outOfStock.map((p) => (
                    <li key={p.id} className="list-group-item d-flex justify-content-between">
                      <span>{p.name}</span>
                      <span className="badge text-bg-danger">OUT</span>
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
