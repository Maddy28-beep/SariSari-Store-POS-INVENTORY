import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { getAllUsers } from '../services/users';

const ROLE_ICON = { owner: 'bi-star-fill', admin: 'bi-shield-fill', cashier: 'bi-person-badge' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllUsers().then((u) => { setUsers(u); setLoading(false); });
  }, []);

  return (
    <Layout header={
      <div className="d-flex justify-content-between align-items-center">
        <h2 className="h4 mb-0 d-flex align-items-center gap-2"><i className="bi bi-people-fill text-primary"></i> Users</h2>
        <Link to="/users/new" className="btn btn-primary d-flex align-items-center gap-2">
          <i className="bi bi-person-plus"></i> Add User
        </Link>
      </div>
    }>
      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-5"><div className="spinner-border text-primary" /></td></tr>
              ) : users.map((u) => (
                <tr key={u.id}>
                  <td className="fw-semibold">{u.name}</td>
                  <td className="text-secondary">{u.email}</td>
                  <td className="text-capitalize">
                    <span className="d-inline-flex align-items-center gap-1">
                      <i className={`bi ${ROLE_ICON[u.role] || 'bi-person'} text-secondary`}></i> {u.role || '—'}
                    </span>
                  </td>
                  <td>
                    {u.isActive
                      ? <span className="badge text-bg-success d-inline-flex align-items-center gap-1"><i className="bi bi-check-circle-fill"></i> Active</span>
                      : <span className="badge text-bg-secondary d-inline-flex align-items-center gap-1"><i className="bi bi-dash-circle-fill"></i> Inactive</span>}
                  </td>
                  <td>
                    <Link to={`/users/${u.id}/edit`} className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1">
                      <i className="bi bi-pencil"></i> Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
