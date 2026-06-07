import React, { useState } from 'react';
import {
  Box, TextField, Button, Typography, Alert,
  InputAdornment, IconButton, Divider, CircularProgress
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import GrassIcon from '@mui/icons-material/Grass';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupsIcon from '@mui/icons-material/Groups';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const STATS = [
  { icon: <GroupsIcon sx={{ fontSize: 20, color: '#A5D6A7' }} />, value: '1,200+', label: 'Farmers' },
  { icon: <TrendingUpIcon sx={{ fontSize: 20, color: '#A5D6A7' }} />, value: '₹50Cr+', label: 'Traded' },
  { icon: <AgricultureIcon sx={{ fontSize: 20, color: '#A5D6A7' }} />, value: '28', label: 'States' },
];

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@agriconnect.com', password: 'password123' },
  { role: 'Farmer', email: 'farmer1@example.com', password: 'password123' },
  { role: 'Buyer', email: 'buyer1@example.com', password: 'password123' },
];

const Login = ({ setUser }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

      {/* ── Left hero panel ── */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' },
        flex: '0 0 58%',
        position: 'relative',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        p: 6,
        backgroundImage: 'url(https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1400&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(170deg, rgba(27,94,32,0.35) 0%, rgba(15,55,18,0.93) 80%)',
        },
      }}>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5} mb={5}>
            <GrassIcon sx={{ color: '#A5D6A7', fontSize: 44 }} />
            <Typography variant="h4" fontWeight={800} color="white" letterSpacing={0.5}>
              AgriConnect
            </Typography>
          </Box>

          <Typography variant="h3" fontWeight={800} color="white" mb={1.5} lineHeight={1.15}
            sx={{ fontSize: { md: '2.2rem', lg: '2.8rem' } }}>
            Connecting Farmers<br />to Global Markets
          </Typography>
          <Typography variant="h6" color="rgba(255,255,255,0.75)" mb={5} fontWeight={300} lineHeight={1.6}>
            Sell directly. Earn more. Grow faster.<br />
            India's most trusted agri-marketplace.
          </Typography>

          {/* Stats row */}
          <Box display="flex" gap={4} flexWrap="wrap" mb={4}>
            {STATS.map(s => (
              <Box key={s.label} display="flex" alignItems="center" gap={1}>
                {s.icon}
                <Box>
                  <Typography variant="h5" fontWeight="bold" color="white" lineHeight={1}>{s.value}</Typography>
                  <Typography variant="caption" color="rgba(255,255,255,0.65)">{s.label}</Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {/* Testimonial */}
          <Box sx={{
            p: 2.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)',
            maxWidth: 460
          }}>
            <Typography variant="body2" color="rgba(255,255,255,0.9)" fontStyle="italic" mb={1}>
              "AgriConnect helped me sell directly to buyers in Delhi without middlemen.
              My income doubled in the first season."
            </Typography>
            <Typography variant="caption" color="#A5D6A7" fontWeight={600}>
              — Rajesh Singh, Wheat Farmer, Punjab
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Right form panel ── */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        p: { xs: 3, md: 6 },
        bgcolor: 'white',
        overflow: 'auto',
      }}>
        <Box sx={{ width: '100%', maxWidth: 420 }}>
          {/* Mobile-only logo */}
          <Box display={{ xs: 'flex', md: 'none' }} alignItems="center" gap={1} mb={4}>
            <GrassIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h5" fontWeight="bold" color="primary">AgriConnect</Typography>
          </Box>

          <Typography variant="h4" fontWeight={800} color="text.primary" mb={0.5}>
            Welcome back
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={3.5}>
            Sign in to your AgriConnect account
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>{error}</Alert>
          )}

          <form onSubmit={handleLogin}>
            <TextField
              fullWidth label="Email Address" type="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" fontSize="small" />
                  </InputAdornment>
                )
              }}
            />
            <TextField
              fullWidth label="Password" required
              type={showPassword ? 'text' : 'password'}
              value={password} onChange={e => setPassword(e.target.value)}
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
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
                py: 1.6, fontSize: '1rem', fontWeight: 700,
                background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 60%, #388E3C 100%)',
                boxShadow: '0 4px 20px rgba(46,125,50,0.4)',
                '&:hover': { background: 'linear-gradient(135deg, #155218 0%, #256626 60%, #2d7434 100%)' },
                mb: 2,
              }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
            </Button>
          </form>

          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="text.secondary">OR</Typography>
          </Divider>

          <Box textAlign="center" mb={3}>
            <Typography variant="body2" color="text.secondary">
              Don't have an account?{' '}
              <Typography
                component="span" variant="body2" color="primary"
                fontWeight={700} sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                onClick={() => navigate('/register')}
              >
                Create account
              </Typography>
            </Typography>
          </Box>

          {/* Demo credentials */}
          <Box sx={{
            p: 2, bgcolor: '#F1F8E9', borderRadius: 2,
            border: '1px solid #C8E6C9'
          }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}
              display="block" mb={1} textTransform="uppercase" letterSpacing={0.5}>
              Demo Accounts (click to fill)
            </Typography>
            {DEMO_ACCOUNTS.map(cred => (
              <Box
                key={cred.role}
                onClick={() => { setEmail(cred.email); setPassword(cred.password); }}
                sx={{
                  cursor: 'pointer', py: 0.5, px: 1, mb: 0.5, borderRadius: 1,
                  '&:hover': { bgcolor: '#E8F5E9' },
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <Typography variant="caption" fontWeight={600} color="primary.dark">
                  {cred.role}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {cred.email}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
