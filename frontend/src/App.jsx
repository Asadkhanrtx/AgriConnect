import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import FarmerDashboard from './pages/Farmer/Dashboard';
import BuyerDashboard from './pages/Buyer/Dashboard';
import AdminDashboard from './pages/Admin/Dashboard';
import Navbar from './components/Navbar';
import axios from 'axios';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get('/api/auth/me', { headers: { Authorization: `Bearer \${token}` } })
        .then(res => setUser(res.data.user))
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <>
      <Navbar user={user} setUser={setUser} />
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <Routes>
          <Route path="/" element={<Navigate to={user ? (user.role === 'FARMER' ? '/farmer' : user.role === 'BUYER' ? '/buyer' : '/admin') : '/login'} />} />
          <Route path="/login" element={!user ? <Login setUser={setUser} /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register setUser={setUser} /> : <Navigate to="/" />} />
          
          <Route path="/farmer/*" element={user?.role === 'FARMER' ? <FarmerDashboard user={user} /> : <Navigate to="/login" />} />
          <Route path="/buyer/*" element={user?.role === 'BUYER' ? <BuyerDashboard user={user} /> : <Navigate to="/login" />} />
          <Route path="/admin/*" element={user?.role === 'ADMIN' ? <AdminDashboard user={user} /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </>
  );
}

export default App;
