import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getAllProducts, stockStatus } from '../services/products';
import { getCategories } from '../services/catalog';

export default function Inventory() {
  const { isOwnerOrAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');

  const stockFilter = searchParams.get('stock_status') || '';

  useEffect(() => {
    (async () => {
      const [productList, categoryList] = await Promise.all([getAllProducts(), getCategories()]);
      setProducts(productList);
      setCategories(Object.fromEntries(categoryList.map((c) => [c.id, c.name])));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.barcode || '').includes(q));
    }
    if (stockFilter === 'low') list = list.filter((p) => stockStatus(p) === 'low');
    if (stockFilter === 'out') list = list.filter((p) => stockStatus(p) === 'out');
    return list;
  }, [products, search, stockFilter]);

  function handleFilterChange(value) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set('stock_status', value); else params.delete('stock_status');
    setSearchParams(params);
  }

  return (
    <Layout header={
      <div className="d-flex justify-content-between align-items-center">
        <h2 className="h4 mb-0">📦 Inventory</h2>
        {isOwnerOrAdmin && <Link to="/inventory/new" className="btn btn-primary">+ Add Product</Link>}
      </div>
    }>
      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-6">
              <input type="text" className="form-control" placeholder="🔍 Search / Scan Barcode" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="col-md-3">
              <select className="form-select" value={stockFilter} onChange={(e) => handleFilterChange(e.target.value)}>
                <option value="">All statuses</option>
                <option value="low">Low stock</option>
                <option value="out">Out of stock</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Product</th>
                <th>Barcode</th>
                <th>Category</th>
                <th className="text-end">Price</th>
                <th className="text-end">Stock</th>
                <th>Status</th>
                {isOwnerOrAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-secondary py-5">No products found.</td></tr>
              ) : filtered.map((product) => {
                const status = stockStatus(product);
                return (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td className="font-monospace small">{product.barcode || '—'}</td>
                    <td>{categories[product.categoryId] || '—'}</td>
                    <td className="text-end">₱{product.sellingPrice.toFixed(2)}</td>
                    <td className="text-end">{product.currentStock} {product.unit}</td>
                    <td>
                      {status === 'out' && <span className="badge text-bg-danger">OUT</span>}
                      {status === 'low' && <span className="badge text-bg-warning">LOW</span>}
                      {status === 'ok' && <span className="badge text-bg-success">OK</span>}
                      {product.status === 'inactive' && <span className="badge text-bg-secondary ms-1">INACTIVE</span>}
                    </td>
                    {isOwnerOrAdmin && (
                      <td><Link to={`/inventory/${product.id}/edit`} className="btn btn-sm btn-outline-secondary">Edit</Link></td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
