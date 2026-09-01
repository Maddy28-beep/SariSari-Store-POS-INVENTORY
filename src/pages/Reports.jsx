import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { getSalesInRange, getSaleItemsInRange, summarizeReports, getStockReport } from '../services/reports';
import { getAllUsers } from '../services/users';

const PERIODS = { daily: 'Today', weekly: 'This Week', monthly: 'This Month' };

export default function Reports() {
  const { isOwnerOrAdmin } = useAuth();
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
  }, [period, isOwnerOrAdmin]);

  return (
    <Layout header={<h2 className="h4 mb-0 d-flex align-items-center gap-2"><i className="bi bi-graph-up-arrow text-primary"></i> Reports</h2>}>
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
            <div className={isOwnerOrAdmin ? 'col-md-6' : 'col-12'}>
              <StatCard
                icon="bi-cash-stack"
                label={`Total Sales (${PERIODS[period]})`}
                value={`₱${summary.totalSales.toFixed(2)}`}
                sublabel={`${summary.transactionCount} transactions`}
              />
            </div>
            {isOwnerOrAdmin && (
              <div className="col-md-6">
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
                      <span className="text-secondary">{item.count} txns — ₱{item.total.toFixed(2)}</span>
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
