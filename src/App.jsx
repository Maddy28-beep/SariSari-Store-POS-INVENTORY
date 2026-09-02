import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pos from './pages/Pos';
import Receipt from './pages/Receipt';
import Inventory from './pages/Inventory';
import ProductCreate from './pages/ProductCreate';
import ProductEdit from './pages/ProductEdit';
import ProductLabel from './pages/ProductLabel';
import StockIn from './pages/StockIn';
import Reports from './pages/Reports';
import Users from './pages/Users';
import UserCreate from './pages/UserCreate';
import UserEdit from './pages/UserEdit';
import Settings from './pages/Settings';
import VoidRequests from './pages/VoidRequests';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/pos" element={<ProtectedRoute><Pos /></ProtectedRoute>} />
      <Route path="/pos/receipt/:saleId" element={<ProtectedRoute><Receipt /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      <Route path="/inventory/new" element={<ProtectedRoute roles={['owner', 'admin']}><ProductCreate /></ProtectedRoute>} />
      <Route path="/inventory/:productId/edit" element={<ProtectedRoute roles={['owner', 'admin']}><ProductEdit /></ProtectedRoute>} />
      <Route path="/inventory/:productId/label" element={<ProtectedRoute roles={['owner', 'admin']}><ProductLabel /></ProtectedRoute>} />
      <Route path="/stock-in" element={<ProtectedRoute roles={['owner', 'admin']}><StockIn /></ProtectedRoute>} />
      <Route path="/void-requests" element={<ProtectedRoute roles={['owner', 'admin']}><VoidRequests /></ProtectedRoute>} />

      <Route path="/users" element={<ProtectedRoute roles={['owner']}><Users /></ProtectedRoute>} />
      <Route path="/users/new" element={<ProtectedRoute roles={['owner']}><UserCreate /></ProtectedRoute>} />
      <Route path="/users/:userId/edit" element={<ProtectedRoute roles={['owner']}><UserEdit /></ProtectedRoute>} />
    </Routes>
  );
}
