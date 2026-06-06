import React, { useState, useEffect } from 'react';
import {
  AppBar, Toolbar, Typography, Button, Box, Chip, IconButton,
  Badge, Tooltip, Avatar
} from '@mui/material';
import GrassIcon from '@mui/icons-material/Grass';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ROLE_COLORS = { FARMER: 'success', BUYER: 'info', ADMIN: 'warning' };
const ROLE_LABELS = { FARMER: 'Farmer', BUYER: 'Buyer', ADMIN: 'Admin' };

const Navbar = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    axios.get('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        const unread = res.data.filter(n => !n.is_read).length;
        setUnreadCount(unread);
      })
      .catch(() => {});
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
  };

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : '';

  return (
    <AppBar position="static" elevation={0} sx={{
      background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 60%, #388E3C 100%)',
      borderBottom: '1px solid rgba(255,255,255,0.1)'
    }}>
      <Toolbar sx={{ px: { xs: 2, md: 4 } }}>
        <Box display="flex" alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <GrassIcon sx={{ mr: 1.5, fontSize: 28 }} />
          <Typography variant="h6" fontWeight="bold" letterSpacing={0.5}>
            AgriConnect
          </Typography>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        {user ? (
          <Box display="flex" alignItems="center" gap={1.5}>
            <Chip
              label={ROLE_LABELS[user.role] || user.role}
              color={ROLE_COLORS[user.role] || 'default'}
              size="small"
              sx={{ fontWeight: 600, color: 'white', borderColor: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.15)' }}
              variant="outlined"
            />

            <Tooltip title="Notifications">
              <IconButton color="inherit" size="small">
                <Badge badgeContent={unreadCount} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            <Tooltip title={`${user.first_name} ${user.last_name}`}>
              <Avatar sx={{ bgcolor: 'secondary.main', color: 'black', width: 34, height: 34, fontSize: 13, fontWeight: 700 }}>
                {initials}
              </Avatar>
            </Tooltip>

            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' }, opacity: 0.9 }}>
              {user.first_name}
            </Typography>

            <Tooltip title="Logout">
              <IconButton color="inherit" size="small" onClick={handleLogout}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <Box display="flex" gap={1}>
            <Button color="inherit" onClick={() => navigate('/login')} variant="text">
              Login
            </Button>
            <Button
              onClick={() => navigate('/register')}
              variant="contained"
              sx={{ bgcolor: 'secondary.main', color: 'black', '&:hover': { bgcolor: 'secondary.light' } }}
            >
              Register
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
