import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { getSalesInRange, getSaleItemsInRange, getStockReport } from '../services/reports';
import { getRecentSales } from '../services/sales';
import { getAllUsers } from '../services/users';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [sales, items, stock, recent, users] = await Promise.all([
        getSalesInRange('daily'),
        getSaleItemsInRange('daily'),
        getStockReport(),
        getRecentSales(8),
        getAllUsers(),
      ]);

      const salesTotal = sales.reduce((sum, s) => sum + s.total, 0);
      const itemsSold = items.reduce((sum, i) => sum + i.quantity, 0);

      setUsersById(Object.fromEntries(users.map((u) => [u.id, u.name])));
      setStats({
        salesTotal,
        transactionCount: sales.length,
        itemsSold,
        lowStockCount: stock.lowStock.length,
        outOfStockCount: stock.outOfStock.length,
      });
      setRecentSales(recent);
      setLoading(false);
    })();
  }, []);

  return (
    <Layout header={
      <>
        <h2 className="h4 mb-0">Dashboard</h2>
        <p className="text-secondary mb-0">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </>
    }>
      {loading || !stats ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <div className="card stat-card h-100">
                <div className="card-body">
                  <div className="text-secondary small text-uppercase">Today's Sales</div>
                  <div className="fs-3 fw-bold">₱{stats.salesTotal.toFixed(2)}</div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card stat-card h-100">
                <div className="card-body">
                  <div className="text-secondary small text-uppercase">Transactions</div>
                  <div className="fs-3 fw-bold">{stats.transactionCount}</div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card stat-card h-100">
                <div className="card-body">
                  <div className="text-secondary small text-uppercase">Items Sold</div>
                  <div className="fs-3 fw-bold">{stats.itemsSold}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className="card stat-card warning h-100">
                <div className="card-body d-flex justify-content-between align-items-center">
                  <div>
                    <div className="text-secondary small text-uppercase">⚠ Low Stock</div>
                    <div className="fs-4 fw-bold">{stats.lowStockCount} products</div>
                  </div>
                  <Link to="/inventory?stock_status=low" className="btn btn-sm btn-outline-warning">View</Link>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card stat-card danger h-100">
                <div className="card-body d-flex justify-content-between align-items-center">
                  <div>
                    <div className="text-secondary small text-uppercase">🔴 Out of Stock</div>
                    <div className="fs-4 fw-bold">{stats.outOfStockCount} products</div>
                  </div>
                  <Link to="/inventory?stock_status=out" className="btn btn-sm btn-outline-danger">View</Link>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Recent Sales</div>
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Transaction #</th>
                    <th>Cashier</th>
                    <th>Payment</th>
                    <th className="text-end">Total</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-secondary py-4">No sales yet today.</td></tr>
                  ) : recentSales.map((sale) => (
                    <tr key={sale.id}>
                      <td><Link to={`/pos/receipt/${sale.id}`}>{sale.transactionNo}</Link></td>
                      <td>{usersById[sale.cashierId] || '—'}</td>
                      <td className="text-uppercase">{sale.paymentMethod}</td>
                      <td className="text-end">₱{sale.total.toFixed(2)}</td>
                      <td>{sale.createdAt?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
