import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
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
      axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setUser(res.data.user))
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
      <CircularProgress color="primary" size={48} />
    </Box>
  );

  const dashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'FARMER') return '/farmer';
    if (user.role === 'BUYER') return '/buyer';
    return '/admin';
  };

  return (
    <>
      <Navbar user={user} setUser={setUser} />
      <Routes>
        {/* Auth routes — no container padding, allow full-screen layouts */}
        <Route path="/login" element={!user ? <Login setUser={setUser} /> : <Navigate to={dashboardPath()} />} />
        <Route path="/register" element={!user ? <Register setUser={setUser} /> : <Navigate to={dashboardPath()} />} />

        {/* Dashboard routes — inside a max-width container */}
        <Route path="/*" element={
          <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
            <Routes>
              <Route path="/" element={<Navigate to={dashboardPath()} />} />
              <Route path="/farmer/*" element={user?.role === 'FARMER' ? <FarmerDashboard user={user} /> : <Navigate to="/login" />} />
              <Route path="/buyer/*" element={user?.role === 'BUYER' ? <BuyerDashboard user={user} /> : <Navigate to="/login" />} />
              <Route path="/admin/*" element={user?.role === 'ADMIN' ? <AdminDashboard user={user} /> : <Navigate to="/login" />} />
              <Route path="*" element={<Navigate to={dashboardPath()} />} />
            </Routes>
          </Box>
        } />
      </Routes>
    </>
  );
}

export default App;
