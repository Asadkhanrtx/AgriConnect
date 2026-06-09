import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import FarmerDashboard from './pages/Farmer/Dashboard';
import BuyerDashboard from './pages/Buyer/Dashboard';
import AdminDashboard from './pages/Admin/Dashboard';
import Navbar from './components/Navbar';
import axios from 'axios';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

function PageTransition({ children }) {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setUser(res.data.user))
        .catch(() => { localStorage.removeItem('token'); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh"
      sx={{ background: '#F8F7F2' }}>
      <Box sx={{ textAlign: 'center' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>
          <CircularProgress sx={{ color: '#123524' }} size={40} thickness={3} />
        </motion.div>
      </Box>
    </Box>
  );

  const dashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'FARMER') return '/farmer';
    if (user.role === 'BUYER') return '/buyer';
    return '/admin';
  };

  return (
    <Box sx={{ minHeight: '100vh', background: '#F8F7F2', position: 'relative' }}>
      {/* Ambient background blobs */}
      <Box sx={{
        position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
      }}>
        <Box sx={{
          position: 'absolute', top: '-15%', right: '-10%',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(163,177,138,0.18) 0%, transparent 70%)',
        }} />
        <Box sx={{
          position: 'absolute', bottom: '-10%', left: '-8%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(217,164,65,0.12) 0%, transparent 70%)',
        }} />
        <Box sx={{
          position: 'absolute', top: '40%', left: '30%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(18,53,36,0.04) 0%, transparent 70%)',
        }} />
      </Box>

      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Navbar user={user} setUser={setUser} />

        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/login" element={
              !user
                ? <PageTransition><Login setUser={setUser} /></PageTransition>
                : <Navigate to={dashboardPath()} />
            } />
            <Route path="/register" element={
              !user
                ? <PageTransition><Register setUser={setUser} /></PageTransition>
                : <Navigate to={dashboardPath()} />
            } />
            <Route path="/*" element={
              <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1440, mx: 'auto' }}>
                <Routes>
                  <Route path="/" element={<Navigate to={dashboardPath()} />} />
                  <Route path="/farmer/*" element={
                    user?.role === 'FARMER'
                      ? <PageTransition><FarmerDashboard user={user} /></PageTransition>
                      : <Navigate to="/login" />
                  } />
                  <Route path="/buyer/*" element={
                    user?.role === 'BUYER'
                      ? <PageTransition><BuyerDashboard user={user} /></PageTransition>
                      : <Navigate to="/login" />
                  } />
                  <Route path="/admin/*" element={
                    user?.role === 'ADMIN'
                      ? <PageTransition><AdminDashboard user={user} /></PageTransition>
                      : <Navigate to="/login" />
                  } />
                  <Route path="*" element={<Navigate to={dashboardPath()} />} />
                </Routes>
              </Box>
            } />
          </Routes>
        </AnimatePresence>
      </Box>
    </Box>
  );
}

export default App;
