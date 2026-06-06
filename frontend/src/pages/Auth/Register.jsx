import React, { useState } from 'react';
import { Card, CardContent, Typography, TextField, Button, Box, Alert, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Register = ({ setUser }) => {
  const [formData, setFormData] = useState({
    role: 'FARMER',
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    extra_data: { farm_name: '', company_name: '' }
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/auth/register', formData);
      // Auto login after register
      const res = await axios.post('/api/auth/login', { email: formData.email, password: formData.password });
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
      <Card className="glass-card" sx={{ maxWidth: 500, width: '100%', p: 2 }}>
        <CardContent>
          <Typography variant="h4" gutterBottom align="center" color="primary" fontWeight="bold">
            Join AgriConnect
          </Typography>
          <Typography variant="body2" color="textSecondary" align="center" mb={3}>
            Create your account to start trading fresh produce
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <form onSubmit={handleRegister}>
            <Box display="flex" gap={2} mb={2}>
              <TextField fullWidth label="First Name" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} />
              <TextField fullWidth label="Last Name" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} />
            </Box>

            <FormControl fullWidth mb={2} sx={{ mb: 2 }}>
              <InputLabel>I am a...</InputLabel>
              <Select value={formData.role} label="I am a..." onChange={e => setFormData({...formData, role: e.target.value})}>
                <MenuItem value="FARMER">Farmer (Selling Produce)</MenuItem>
                <MenuItem value="BUYER">Buyer (Wholesaler/Retailer)</MenuItem>
              </Select>
            </FormControl>

            {formData.role === 'FARMER' ? (
              <TextField fullWidth label="Farm Name" sx={{ mb: 2 }} required value={formData.extra_data.farm_name} onChange={e => setFormData({...formData, extra_data: { ...formData.extra_data, farm_name: e.target.value }})} />
            ) : (
              <TextField fullWidth label="Company Name" sx={{ mb: 2 }} required value={formData.extra_data.company_name} onChange={e => setFormData({...formData, extra_data: { ...formData.extra_data, company_name: e.target.value }})} />
            )}

            <TextField fullWidth label="Email Address" type="email" sx={{ mb: 2 }} required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            <TextField fullWidth label="Password" type="password" sx={{ mb: 2 }} required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />

            <Button type="submit" fullWidth variant="contained" color="primary" size="large" sx={{ mt: 2, mb: 2 }}>
              Create Account
            </Button>
            <Button fullWidth variant="text" onClick={() => navigate('/login')}>
              Already have an account? Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Register;
