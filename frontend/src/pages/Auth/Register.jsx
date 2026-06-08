import React, { useState } from 'react';
import {
  Box, TextField, Button, Typography, Alert,
  Select, MenuItem, FormControl, InputLabel,
  InputAdornment, CircularProgress, Stepper, Step, StepLabel
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import BusinessIcon from '@mui/icons-material/Business';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import GrassIcon from '@mui/icons-material/Grass';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
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
    icon: <AgricultureIcon sx={{ fontSize: 40, color: '#A5D6A7' }} />,
    bullets: ['Create produce listings', 'Receive bids from buyers', 'Track your orders & earnings'],
  },
  BUYER: {
    title: 'Buyer / Wholesaler',
    subtitle: 'Source fresh produce directly from farms',
    icon: <BusinessIcon sx={{ fontSize: 40, color: '#A5D6A7' }} />,
    bullets: ['Browse 100+ produce categories', 'Place competitive bids', 'Track deliveries in real time'],
  },
};

const Register = ({ setUser }) => {
  const [formData, setFormData] = useState({
    role: 'FARMER',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    extra_data: { farm_name: '', location: '', city: '', state: '', lat: null, lon: null, company_name: '' }
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));
  const setExtra = (key, value) => setFormData(prev => ({ ...prev, extra_data: { ...prev.extra_data, [key]: value } }));

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.password) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    setError('');
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
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

      {/* ── Left hero panel ── */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' },
        flex: '0 0 42%',
        position: 'relative',
        flexDirection: 'column',
        justifyContent: 'center',
        p: 6,
        backgroundImage: 'url(https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1200&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(160deg, rgba(27,94,32,0.5) 0%, rgba(15,55,18,0.92) 100%)',
        },
      }}>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5} mb={5}>
            <GrassIcon sx={{ color: '#A5D6A7', fontSize: 40 }} />
            <Typography variant="h5" fontWeight={800} color="white" letterSpacing={0.5}>
              AgriConnect
            </Typography>
          </Box>

          <Typography variant="h4" fontWeight={800} color="white" mb={2} lineHeight={1.2}>
            Join India's Largest<br />AgriMarketplace
          </Typography>

          {/* Role preview card */}
          <Box sx={{
            p: 3, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)',
            transition: 'all 0.3s ease',
          }}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              {info.icon}
              <Box>
                <Typography variant="h6" fontWeight={700} color="white">{info.title}</Typography>
                <Typography variant="body2" color="rgba(255,255,255,0.75)" lineHeight={1.4}>{info.subtitle}</Typography>
              </Box>
            </Box>
            {info.bullets.map(b => (
              <Box key={b} display="flex" alignItems="center" gap={1} mb={0.75}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#A5D6A7', flexShrink: 0 }} />
                <Typography variant="body2" color="rgba(255,255,255,0.85)">{b}</Typography>
              </Box>
            ))}
          </Box>

          <Typography variant="caption" color="rgba(255,255,255,0.5)" display="block" mt={4}>
            Your profile will change based on the role selected →
          </Typography>
        </Box>
      </Box>

      {/* ── Right form panel ── */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        p: { xs: 3, md: 5 },
        bgcolor: 'white',
        overflow: 'auto',
      }}>
        <Box sx={{ width: '100%', maxWidth: 480 }}>
          {/* Mobile-only logo */}
          <Box display={{ xs: 'flex', md: 'none' }} alignItems="center" gap={1} mb={3}>
            <GrassIcon color="primary" sx={{ fontSize: 28 }} />
            <Typography variant="h6" fontWeight="bold" color="primary">AgriConnect</Typography>
          </Box>

          <Typography variant="h4" fontWeight={800} color="text.primary" mb={0.5}>
            Create account
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={3}>
            Start trading fresh produce today
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>{error}</Alert>}

          <form onSubmit={handleRegister}>
            {/* Role selector */}
            <FormControl fullWidth sx={{ mb: 2.5 }}>
              <InputLabel>I am a...</InputLabel>
              <Select value={formData.role} label="I am a..."
                onChange={e => set('role', e.target.value)}>
                <MenuItem value="FARMER">
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <AgricultureIcon color="primary" fontSize="small" />
                    Farmer — I want to sell my produce
                  </Box>
                </MenuItem>
                <MenuItem value="BUYER">
                  <Box display="flex" alignItems="center" gap={1.5}>
                    <BusinessIcon color="primary" fontSize="small" />
                    Buyer / Wholesaler — I want to source produce
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            {/* Name row */}
            <Box display="flex" gap={2} mb={2}>
              <TextField
                fullWidth label="First Name" required
                value={formData.first_name} onChange={e => set('first_name', e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon color="action" fontSize="small" /></InputAdornment> }}
              />
              <TextField
                fullWidth label="Last Name" required
                value={formData.last_name} onChange={e => set('last_name', e.target.value)}
              />
            </Box>

            {/* Role-specific field */}
            {formData.role === 'FARMER' ? (
              <>
                <TextField
                  fullWidth label="Farm Name" required sx={{ mb: 2 }}
                  value={formData.extra_data.farm_name}
                  onChange={e => setExtra('farm_name', e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><AgricultureIcon color="action" fontSize="small" /></InputAdornment> }}
                />
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Farm Location</InputLabel>
                  <Select
                    value={formData.extra_data.location}
                    label="Farm Location"
                    onChange={e => {
                      const opt = LOCATION_OPTIONS.find(o => o.label === e.target.value);
                      if (opt) {
                        setFormData(prev => ({
                          ...prev,
                          extra_data: { ...prev.extra_data, location: opt.label, city: opt.city, state: opt.state, lat: opt.lat, lon: opt.lon }
                        }));
                      }
                    }}
                    startAdornment={<InputAdornment position="start"><LocationOnIcon color="action" fontSize="small" /></InputAdornment>}
                  >
                    {LOCATION_OPTIONS.map(opt => (
                      <MenuItem key={opt.label} value={opt.label}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            ) : (
              <TextField
                fullWidth label="Company Name" required sx={{ mb: 2 }}
                value={formData.extra_data.company_name}
                onChange={e => setExtra('company_name', e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><BusinessIcon color="action" fontSize="small" /></InputAdornment> }}
              />
            )}

            <TextField
              fullWidth label="Email Address" type="email" required
              value={formData.email} onChange={e => set('email', e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon color="action" fontSize="small" /></InputAdornment> }}
            />

            <TextField
              fullWidth label="Phone Number"
              value={formData.phone} onChange={e => set('phone', e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><PhoneIcon color="action" fontSize="small" /></InputAdornment> }}
            />

            <TextField
              fullWidth label="Password" type="password" required
              value={formData.password} onChange={e => set('password', e.target.value)}
              sx={{ mb: 3 }}
              helperText="Minimum 8 characters"
              InputProps={{ startAdornment: <InputAdornment position="start"><LockIcon color="action" fontSize="small" /></InputAdornment> }}
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
              {loading ? <CircularProgress size={22} color="inherit" /> : `Create ${ROLE_INFO[formData.role].title} Account`}
            </Button>

            <Box textAlign="center">
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                <Typography
                  component="span" variant="body2" color="primary"
                  fontWeight={700} sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                  onClick={() => navigate('/login')}
                >
                  Sign in
                </Typography>
              </Typography>
            </Box>
          </form>
        </Box>
      </Box>
    </Box>
  );
};

export default Register;
