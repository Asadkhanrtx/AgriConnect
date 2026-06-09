import React, { useState } from 'react';
import {
  Box, TextField, Button, Typography, Alert,
  Select, MenuItem, FormControl, InputLabel,
  InputAdornment, CircularProgress
} from '@mui/material';
import { motion } from 'framer-motion';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import BusinessIcon from '@mui/icons-material/Business';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import SpaIcon from '@mui/icons-material/Spa';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const LOCATION_OPTIONS = [
  { label: 'Mawsynram, Meghalaya',    city: 'Mawsynram',   state: 'Meghalaya',       lat: 25.2967, lon: 91.5833 },
  { label: 'Cherrapunji, Meghalaya',  city: 'Cherrapunji', state: 'Meghalaya',       lat: 25.2844, lon: 91.7267 },
  { label: 'Shillong, Meghalaya',     city: 'Shillong',    state: 'Meghalaya',       lat: 25.5788, lon: 91.8933 },
  { label: 'Gangtok, Sikkim',         city: 'Gangtok',     state: 'Sikkim',          lat: 27.3389, lon: 88.6065 },
  { label: 'Agumbe, Karnataka',       city: 'Agumbe',      state: 'Karnataka',       lat: 13.5025, lon: 75.0929 },
  { label: 'Kochi, Kerala',           city: 'Kochi',       state: 'Kerala',          lat:  9.9312, lon: 76.2673 },
  { label: 'Mangalore, Karnataka',    city: 'Mangalore',   state: 'Karnataka',       lat: 12.9141, lon: 74.8560 },
  { label: 'Nashik, Maharashtra',     city: 'Nashik',      state: 'Maharashtra',     lat: 19.9975, lon: 73.7898 },
  { label: 'Pune, Maharashtra',       city: 'Pune',        state: 'Maharashtra',     lat: 18.5204, lon: 73.8567 },
  { label: 'Amritsar, Punjab',        city: 'Amritsar',    state: 'Punjab',          lat: 31.6340, lon: 74.8723 },
  { label: 'Ludhiana, Punjab',        city: 'Ludhiana',    state: 'Punjab',          lat: 30.9010, lon: 75.8573 },
  { label: 'Hyderabad, Telangana',    city: 'Hyderabad',   state: 'Telangana',       lat: 17.3850, lon: 78.4867 },
  { label: 'Coimbatore, Tamil Nadu',  city: 'Coimbatore',  state: 'Tamil Nadu',      lat: 11.0168, lon: 76.9558 },
  { label: 'Bhopal, Madhya Pradesh',  city: 'Bhopal',      state: 'Madhya Pradesh',  lat: 23.2599, lon: 77.4126 },
  { label: 'Patna, Bihar',            city: 'Patna',       state: 'Bihar',           lat: 25.5941, lon: 85.1376 },
  { label: 'Delhi',                   city: 'Delhi',       state: 'Delhi',           lat: 28.6139, lon: 77.2090 },
  { label: 'Mumbai, Maharashtra',     city: 'Mumbai',      state: 'Maharashtra',     lat: 19.0760, lon: 72.8777 },
  { label: 'Bangalore, Karnataka',    city: 'Bangalore',   state: 'Karnataka',       lat: 12.9716, lon: 77.5946 },
  { label: 'Chennai, Tamil Nadu',     city: 'Chennai',     state: 'Tamil Nadu',      lat: 13.0827, lon: 80.2707 },
  { label: 'Kolkata, West Bengal',    city: 'Kolkata',     state: 'West Bengal',     lat: 22.5726, lon: 88.3639 },
];

const ROLE_INFO = {
  FARMER: {
    title: 'Farmer',
    subtitle: 'Sell your produce directly to buyers across India',
    bullets: ['Create produce listings', 'Receive bids from buyers', 'Track orders & earnings'],
    bg: 'url(https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1200&q=80)',
  },
  BUYER: {
    title: 'Buyer / Wholesaler',
    subtitle: 'Source fresh produce directly from farms',
    bullets: ['Browse 100+ produce categories', 'Place competitive bids', 'Track deliveries in real time'],
    bg: 'url(https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80)',
  },
};

const Register = ({ setUser }) => {
  const [formData, setFormData] = useState({
    role: 'FARMER',
    first_name: '', last_name: '', email: '', phone: '', password: '',
    extra_data: { farm_name: '', location: '', city: '', state: '', lat: null, lon: null, company_name: '' }
  });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set      = (key, val) => setFormData(p => ({ ...p, [key]: val }));
  const setExtra = (key, val) => setFormData(p => ({ ...p, extra_data: { ...p.extra_data, [key]: val } }));

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.password) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true); setError('');
    try {
      await axios.post('/api/auth/register', formData);
      const res = await axios.post('/api/auth/login', { email: formData.email, password: formData.password });
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const info = ROLE_INFO[formData.role];

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

      {/* ── Left hero panel ───────────────────────────────────────────────────── */}
      <motion.div
        key={formData.role}
        initial={{ opacity: 0.7 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{ flex: '0 0 38%', display: 'none' }}
      />
      <Box sx={{
        display: { xs: 'none', md: 'flex' },
        flex: '0 0 38%',
        position: 'relative',
        flexDirection: 'column',
        justifyContent: 'center',
        p: 6,
        backgroundImage: info.bg,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transition: 'background-image 0.5s ease',
        '&::before': {
          content: '""', position: 'absolute', inset: 0,
          background: 'linear-gradient(160deg, rgba(18,53,36,0.45) 0%, rgba(10,31,21,0.94) 100%)',
        },
      }}>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5} mb={5}>
            <Box sx={{
              width: 38, height: 38, borderRadius: '11px',
              background: 'linear-gradient(135deg, #A3B18A, #D9A441)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <SpaIcon sx={{ color: '#123524', fontSize: 20 }} />
            </Box>
            <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, fontSize: '1.15rem', color: 'white', letterSpacing: '-0.02em' }}>
              AgriConnect
            </Typography>
          </Box>

          <Typography sx={{
            fontFamily: '"Satoshi", sans-serif', fontWeight: 800,
            fontSize: '1.9rem', color: 'white', lineHeight: 1.15, mb: 2, letterSpacing: '-0.03em',
          }}>
            Join India's Largest<br />
            <Box component="span" sx={{ color: '#D9A441' }}>AgriMarketplace</Box>
          </Typography>

          {/* Role preview card */}
          <Box sx={{
            p: 2.5, borderRadius: '14px',
            background: 'rgba(255,255,255,0.09)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.14)',
            mb: 3,
          }}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              {formData.role === 'FARMER'
                ? <AgricultureIcon sx={{ fontSize: 36, color: '#A3B18A' }} />
                : <BusinessIcon sx={{ fontSize: 36, color: '#D9A441' }} />
              }
              <Box>
                <Typography variant="h6" fontWeight={700} color="white">{info.title}</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>{info.subtitle}</Typography>
              </Box>
            </Box>
            {info.bullets.map(b => (
              <Box key={b} display="flex" alignItems="center" gap={1} mb={0.75}>
                <CheckCircleIcon sx={{ fontSize: 15, color: '#A3B18A', flexShrink: 0 }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.80)' }}>{b}</Typography>
              </Box>
            ))}
          </Box>

          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>
            Profile updates as you select your role →
          </Typography>
        </Box>
      </Box>

      {/* ── Right form panel ──────────────────────────────────────────────────── */}
      <Box sx={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        p: { xs: 3, md: 5 }, background: '#F8F7F2', overflow: 'auto',
      }}>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ width: '100%', maxWidth: 480 }}
        >
          {/* Mobile logo */}
          <Box display={{ xs: 'flex', md: 'none' }} alignItems="center" gap={1.5} mb={3}>
            <Box sx={{ width: 32, height: 32, borderRadius: '9px', background: 'linear-gradient(135deg, #123524, #3E5F44)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SpaIcon sx={{ color: '#A3B18A', fontSize: 17 }} />
            </Box>
            <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, color: '#123524' }}>AgriConnect</Typography>
          </Box>

          <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, fontSize: '1.8rem', color: '#123524', mb: 0.5, letterSpacing: '-0.02em' }}>
            Create account
          </Typography>
          <Typography variant="body1" sx={{ color: '#5a6b5c', mb: 3 }}>Start trading fresh produce today</Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: '10px' }}>{error}</Alert>
          )}

          <form onSubmit={handleRegister}>
            {/* Role selector */}
            <Box display="flex" gap={1.5} mb={2.5}>
              {['FARMER', 'BUYER'].map(role => (
                <Box key={role}
                  onClick={() => set('role', role)}
                  sx={{
                    flex: 1, p: 1.75, borderRadius: '12px', cursor: 'pointer',
                    border: formData.role === role ? '2px solid #123524' : '2px solid rgba(18,53,36,0.12)',
                    background: formData.role === role ? 'rgba(18,53,36,0.06)' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    transition: 'all 0.2s',
                  }}>
                  {role === 'FARMER'
                    ? <AgricultureIcon sx={{ color: formData.role === role ? '#123524' : '#A3B18A', fontSize: 22 }} />
                    : <BusinessIcon sx={{ color: formData.role === role ? '#123524' : '#A3B18A', fontSize: 22 }} />
                  }
                  <Box>
                    <Typography variant="body2" fontWeight={700} sx={{ color: '#1a2e1d', lineHeight: 1.2 }}>
                      {role === 'FARMER' ? 'Farmer' : 'Buyer'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#9aab9c', lineHeight: 1.3 }}>
                      {role === 'FARMER' ? 'Sell produce' : 'Source produce'}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>

            {/* Name row */}
            <Box display="flex" gap={2} mb={2}>
              <TextField fullWidth label="First Name" required
                value={formData.first_name} onChange={e => set('first_name', e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon sx={{ color: '#A3B18A', fontSize: 18 }} /></InputAdornment> }}
              />
              <TextField fullWidth label="Last Name" required
                value={formData.last_name} onChange={e => set('last_name', e.target.value)}
              />
            </Box>

            {formData.role === 'FARMER' ? (
              <>
                <TextField fullWidth label="Farm Name" required sx={{ mb: 2 }}
                  value={formData.extra_data.farm_name}
                  onChange={e => setExtra('farm_name', e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><AgricultureIcon sx={{ color: '#A3B18A', fontSize: 18 }} /></InputAdornment> }}
                />
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Farm Location</InputLabel>
                  <Select value={formData.extra_data.location} label="Farm Location"
                    onChange={e => {
                      const opt = LOCATION_OPTIONS.find(o => o.label === e.target.value);
                      if (opt) setFormData(p => ({ ...p, extra_data: { ...p.extra_data, location: opt.label, city: opt.city, state: opt.state, lat: opt.lat, lon: opt.lon } }));
                    }}
                    startAdornment={<InputAdornment position="start"><LocationOnIcon sx={{ color: '#A3B18A', fontSize: 18 }} /></InputAdornment>}
                  >
                    {LOCATION_OPTIONS.map(opt => <MenuItem key={opt.label} value={opt.label}>{opt.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </>
            ) : (
              <TextField fullWidth label="Company Name" required sx={{ mb: 2 }}
                value={formData.extra_data.company_name}
                onChange={e => setExtra('company_name', e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><BusinessIcon sx={{ color: '#A3B18A', fontSize: 18 }} /></InputAdornment> }}
              />
            )}

            <TextField fullWidth label="Email Address" type="email" required sx={{ mb: 2 }}
              value={formData.email} onChange={e => set('email', e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon sx={{ color: '#A3B18A', fontSize: 18 }} /></InputAdornment> }}
            />
            <TextField fullWidth label="Phone Number" sx={{ mb: 2 }}
              value={formData.phone} onChange={e => set('phone', e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><PhoneIcon sx={{ color: '#A3B18A', fontSize: 18 }} /></InputAdornment> }}
            />
            <TextField fullWidth label="Password" type="password" required sx={{ mb: 3 }}
              value={formData.password} onChange={e => set('password', e.target.value)}
              helperText="Minimum 8 characters"
              InputProps={{ startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: '#A3B18A', fontSize: 18 }} /></InputAdornment> }}
            />

            <Button type="submit" fullWidth variant="contained" size="large"
              disabled={loading}
              sx={{
                py: 1.6, fontSize: '1rem', fontWeight: 700, borderRadius: '12px',
                background: 'linear-gradient(135deg, #123524 0%, #3E5F44 100%)',
                boxShadow: '0 6px 24px rgba(18,53,36,0.32)',
                '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 8px 28px rgba(18,53,36,0.40)' },
                transition: 'all 0.2s', mb: 2,
              }}>
              {loading ? <CircularProgress size={22} color="inherit" /> : `Create ${info.title} Account`}
            </Button>

            <Box textAlign="center">
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                <Box component="span" onClick={() => navigate('/login')} sx={{ color: '#D9A441', fontWeight: 700, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                  Sign in
                </Box>
              </Typography>
            </Box>
          </form>
        </motion.div>
      </Box>
    </Box>
  );
};

export default Register;
