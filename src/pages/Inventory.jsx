import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getAllProducts, stockStatus } from '../services/products';
import { getCategories } from '../services/catalog';

const STATUS_BADGE = {
  out: { icon: 'bi-x-octagon-fill', text: 'text-bg-danger', label: 'Out' },
  low: { icon: 'bi-exclamation-triangle-fill', text: 'text-bg-warning', label: 'Low' },
  ok: { icon: 'bi-check-circle-fill', text: 'text-bg-success', label: 'In Stock' },
};

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
        <h2 className="h4 mb-0 d-flex align-items-center gap-2"><i className="bi bi-box-seam-fill text-primary"></i> Inventory</h2>
        {isOwnerOrAdmin && (
          <Link to="/inventory/new" className="btn btn-primary d-flex align-items-center gap-2">
            <i className="bi bi-plus-lg"></i> Add Product
          </Link>
        )}
      </div>
    }>
      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0"><i className="bi bi-search text-secondary"></i></span>
                <input type="text" className="form-control border-start-0" placeholder="Search / scan barcode" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
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
                <tr>
                  <td colSpan={7} className="text-center text-secondary py-5">
                    <i className="bi bi-inbox fs-1 d-block mb-2 opacity-25"></i>
                    No products found.
                  </td>
                </tr>
              ) : filtered.map((product) => {
                const status = stockStatus(product);
                const badge = STATUS_BADGE[status];
                return (
                  <tr key={product.id}>
                    <td className="fw-semibold">{product.name}</td>
                    <td className="font-monospace small text-secondary">{product.barcode || '—'}</td>
                    <td>{categories[product.categoryId] || '—'}</td>
                    <td className="text-end">₱{product.sellingPrice.toFixed(2)}</td>
                    <td className="text-end">{product.currentStock} {product.unit}</td>
                    <td>
                      <span className={`badge ${badge.text} d-inline-flex align-items-center gap-1`}>
                        <i className={`bi ${badge.icon}`}></i> {badge.label}
                      </span>
                      {product.status === 'inactive' && <span className="badge text-bg-secondary ms-1">Inactive</span>}
                    </td>
                    {isOwnerOrAdmin && (
                      <td>
                        <div className="d-flex gap-1">
                          <Link to={`/inventory/${product.id}/edit`} className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1">
                            <i className="bi bi-pencil"></i> Edit
                          </Link>
                          {product.barcode && (
                            <Link to={`/inventory/${product.id}/label`} className="btn btn-sm btn-outline-secondary" title="Print barcode label">
                              <i className="bi bi-printer"></i>
                            </Link>
                          )}
                        </div>
                      </td>
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
