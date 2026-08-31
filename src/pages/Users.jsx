import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { getAllUsers } from '../services/users';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllUsers().then((u) => { setUsers(u); setLoading(false); });
  }, []);

  return (
    <Layout header={
      <div className="d-flex justify-content-between align-items-center">
        <h2 className="h4 mb-0">👥 Users</h2>
        <Link to="/users/new" className="btn btn-primary">+ Add User</Link>
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
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td className="text-capitalize">{u.role || '—'}</td>
                  <td>
                    {u.isActive ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Inactive</span>}
                  </td>
                  <td><Link to={`/users/${u.id}/edit`} className="btn btn-sm btn-outline-secondary">Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
