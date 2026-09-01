import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
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
      const completedSaleIds = new Set(sales.map((s) => s.id));
      const itemsSold = items
        .filter((i) => completedSaleIds.has(i.saleId))
        .reduce((sum, i) => sum + i.quantity, 0);

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
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <StatCard icon="bi-cash-stack" label="Today's Sales" value={`₱${stats.salesTotal.toFixed(2)}`} />
            </div>
            <div className="col-md-4">
              <StatCard icon="bi-receipt" label="Transactions" value={stats.transactionCount} />
            </div>
            <div className="col-md-4">
              <StatCard icon="bi-bag-check" label="Items Sold" value={stats.itemsSold} />
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <StatCard
                icon="bi-exclamation-triangle-fill"
                variant="warning"
                label="Low Stock"
                value={`${stats.lowStockCount} products`}
                action={<Link to="/inventory?stock_status=low" className="btn btn-sm btn-outline-warning">View</Link>}
              />
            </div>
            <div className="col-md-6">
              <StatCard
                icon="bi-x-octagon-fill"
                variant="danger"
                label="Out of Stock"
                value={`${stats.outOfStockCount} products`}
                action={<Link to="/inventory?stock_status=out" className="btn btn-sm btn-outline-danger">View</Link>}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center gap-2">
              <i className="bi bi-clock-history text-secondary"></i>
              Recent Sales
            </div>
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
                    <tr>
                      <td colSpan={5} className="text-center text-secondary py-5">
                        <i className="bi bi-inbox fs-3 d-block mb-2 opacity-50"></i>
                        No sales yet today.
                      </td>
                    </tr>
                  ) : recentSales.map((sale) => (
                    <tr key={sale.id}>
                      <td><Link to={`/pos/receipt/${sale.id}`} className="font-monospace small fw-semibold">{sale.transactionNo}</Link></td>
                      <td>{usersById[sale.cashierId] || '—'}</td>
                      <td>
                        <span className="badge text-bg-light border text-uppercase">
                          {sale.paymentMethod === 'cash' && <i className="bi bi-cash me-1"></i>}
                          {sale.paymentMethod === 'gcash' && <i className="bi bi-phone me-1"></i>}
                          {sale.paymentMethod === 'other' && <i className="bi bi-three-dots me-1"></i>}
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="text-end fw-semibold">₱{sale.total.toFixed(2)}</td>
                      <td className="text-secondary">{sale.createdAt?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—'}</td>
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
