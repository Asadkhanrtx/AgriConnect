import React, { useState } from 'react';
import {
  Box, TextField, Button, Typography, Alert,
  InputAdornment, IconButton, Divider, CircularProgress
} from '@mui/material';
import { motion } from 'framer-motion';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import SpaIcon from '@mui/icons-material/Spa';
import GroupsIcon from '@mui/icons-material/Groups';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const STATS = [
  { icon: <GroupsIcon sx={{ fontSize: 18, color: '#A3B18A' }} />, value: '1,200+', label: 'Farmers' },
  { icon: <TrendingUpIcon sx={{ fontSize: 18, color: '#D9A441' }} />, value: '₹50Cr+', label: 'Traded' },
  { icon: <AgricultureIcon sx={{ fontSize: 18, color: '#A3B18A' }} />, value: '28', label: 'States' },
];

const DEMO_ACCOUNTS = [
  { role: 'Admin',  email: 'admin@agriconnect.com', password: 'password123' },
  { role: 'Farmer', email: 'farmer1@example.com',   password: 'password123' },
  { role: 'Buyer',  email: 'buyer1@example.com',    password: 'password123' },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' } }),
};

const Login = ({ setUser }) => {
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

      {/* ── Left hero panel ───────────────────────────────────────────────────── */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' },
        flex: '0 0 56%',
        position: 'relative',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        p: 7,
        backgroundImage: 'url(https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1600&q=85)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 40%',
        '&::before': {
          content: '""', position: 'absolute', inset: 0,
          background: 'linear-gradient(165deg, rgba(18,53,36,0.3) 0%, rgba(10,31,21,0.94) 80%)',
        },
      }}>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <Box display="flex" alignItems="center" gap={1.5} mb={6}>
              <Box sx={{
                width: 40, height: 40, borderRadius: '12px',
                background: 'linear-gradient(135deg, #A3B18A, #D9A441)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <SpaIcon sx={{ color: '#123524', fontSize: 22 }} />
              </Box>
              <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, fontSize: '1.35rem', color: 'white', letterSpacing: '-0.02em' }}>
                AgriConnect
              </Typography>
            </Box>
          </motion.div>

          <motion.div custom={0} variants={fadeUp} initial="initial" animate="animate">
            <Typography sx={{
              fontFamily: '"Satoshi", sans-serif', fontWeight: 800,
              fontSize: { md: '2.4rem', lg: '3rem' }, color: 'white',
              lineHeight: 1.1, mb: 1.5, letterSpacing: '-0.03em',
            }}>
              Connecting Farmers<br />
              <Box component="span" sx={{ color: '#D9A441' }}>to Global Markets</Box>
            </Typography>
          </motion.div>

          <motion.div custom={1} variants={fadeUp} initial="initial" animate="animate">
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.65)', mb: 5, fontWeight: 300, lineHeight: 1.6, maxWidth: 440 }}>
              Sell directly. Earn more. Grow faster.<br />India's most trusted agri-marketplace.
            </Typography>
          </motion.div>

          {/* Stats */}
          <motion.div custom={2} variants={fadeUp} initial="initial" animate="animate">
            <Box display="flex" gap={3.5} mb={5} flexWrap="wrap">
              {STATS.map(s => (
                <Box key={s.label} display="flex" alignItems="center" gap={1}>
                  {s.icon}
                  <Box>
                    <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, color: 'white', fontSize: '1.2rem', lineHeight: 1 }}>
                      {s.value}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>{s.label}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </motion.div>

          {/* Testimonial */}
          <motion.div custom={3} variants={fadeUp} initial="initial" animate="animate">
            <Box sx={{
              p: 2.5, borderRadius: '14px',
              background: 'rgba(255,255,255,0.07)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)',
              maxWidth: 460,
            }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.88)', fontStyle: 'italic', lineHeight: 1.7 }}>
                "AgriConnect helped me sell directly to buyers in Delhi without middlemen.
                My income doubled in the first season."
              </Typography>
              <Typography variant="caption" sx={{ color: '#A3B18A', fontWeight: 700, display: 'block', mt: 1 }}>
                — Rajesh Singh, Wheat Farmer, Punjab
              </Typography>
            </Box>
          </motion.div>
        </Box>
      </Box>

      {/* ── Right form panel ──────────────────────────────────────────────────── */}
      <Box sx={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        p: { xs: 3, md: 6 },
        background: '#F8F7F2',
        overflow: 'auto',
      }}>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ width: '100%', maxWidth: 420 }}
        >
          {/* Mobile logo */}
          <Box display={{ xs: 'flex', md: 'none' }} alignItems="center" gap={1.5} mb={4}>
            <Box sx={{
              width: 36, height: 36, borderRadius: '10px',
              background: 'linear-gradient(135deg, #123524, #3E5F44)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <SpaIcon sx={{ color: '#A3B18A', fontSize: 20 }} />
            </Box>
            <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, fontSize: '1.1rem', color: '#123524' }}>
              AgriConnect
            </Typography>
          </Box>

          <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, fontSize: '1.9rem', color: '#123524', mb: 0.5, letterSpacing: '-0.02em' }}>
            Welcome back
          </Typography>
          <Typography variant="body1" sx={{ color: '#5a6b5c', mb: 3.5 }}>
            Sign in to your AgriConnect account
          </Typography>

          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <Alert severity="error" sx={{ mb: 2.5, borderRadius: '10px' }}>{error}</Alert>
            </motion.div>
          )}

          <form onSubmit={handleLogin}>
            <TextField
              fullWidth label="Email Address" type="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><EmailIcon sx={{ color: '#A3B18A', fontSize: 18 }} /></InputAdornment>
              }}
            />
            <TextField
              fullWidth label="Password" required
              type={showPassword ? 'text' : 'password'}
              value={password} onChange={e => setPassword(e.target.value)}
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: '#A3B18A', fontSize: 18 }} /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPassword(p => !p)} edge="end">
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <Button
              type="submit" fullWidth variant="contained" size="large"
              disabled={loading}
              sx={{
                py: 1.6, fontSize: '1rem', fontWeight: 700, borderRadius: '12px',
                background: 'linear-gradient(135deg, #123524 0%, #3E5F44 100%)',
                boxShadow: '0 6px 24px rgba(18,53,36,0.32)',
                '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 8px 28px rgba(18,53,36,0.40)' },
                transition: 'all 0.2s',
                mb: 2,
              }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
            </Button>
          </form>

          <Divider sx={{ my: 2, borderColor: 'rgba(18,53,36,0.08)' }}>
            <Typography variant="caption" sx={{ color: '#A3B18A' }}>OR</Typography>
          </Divider>

          <Box textAlign="center" mb={3}>
            <Typography variant="body2" color="text.secondary">
              Don't have an account?{' '}
              <Box component="span" onClick={() => navigate('/register')} sx={{
                color: '#D9A441', fontWeight: 700, cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' },
              }}>
                Create account
              </Box>
            </Typography>
          </Box>

          {/* Demo credentials */}
          <Box sx={{
            p: 2, bgcolor: 'rgba(18,53,36,0.04)', borderRadius: '12px',
            border: '1px solid rgba(18,53,36,0.08)',
          }}>
            <Typography variant="caption" sx={{
              color: '#5a6b5c', fontWeight: 700,
              display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.68rem',
            }}>
              Demo Accounts — click to fill
            </Typography>
            {DEMO_ACCOUNTS.map(cred => (
              <Box key={cred.role}
                onClick={() => { setEmail(cred.email); setPassword(cred.password); }}
                sx={{
                  cursor: 'pointer', py: 0.6, px: 1, mb: 0.4, borderRadius: '7px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  '&:hover': { bgcolor: 'rgba(18,53,36,0.06)' }, transition: 'background 0.15s',
                }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#3E5F44' }}>{cred.role}</Typography>
                <Typography variant="caption" sx={{ color: '#9aab9c' }}>{cred.email}</Typography>
              </Box>
            ))}
          </Box>
        </motion.div>
      </Box>
    </Box>
  );
};

export default Login;
