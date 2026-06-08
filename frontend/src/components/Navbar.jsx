import React, { useState, useEffect, useCallback } from 'react';
import {
  AppBar, Toolbar, Typography, Button, Box, Chip, IconButton,
  Badge, Tooltip, Avatar, Popover, Divider, CircularProgress
} from '@mui/material';
import GrassIcon from '@mui/icons-material/Grass';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import LogoutIcon from '@mui/icons-material/Logout';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ROLE_COLORS = { FARMER: 'success', BUYER: 'info', ADMIN: 'warning' };
const ROLE_LABELS = { FARMER: 'Farmer', BUYER: 'Buyer', ADMIN: 'Admin' };

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const Navbar = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifAnchor, setNotifAnchor] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const token = () => localStorage.getItem('token');
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  const fetchUnreadCount = useCallback(() => {
    if (!user) return;
    axios.get('/api/notifications/unread-count', { headers: headers() })
      .then(res => setUnreadCount(res.data.count || 0))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleBellClick = async (e) => {
    setNotifAnchor(e.currentTarget);
    setNotifLoading(true);
    try {
      const res = await axios.get('/api/notifications/list', { headers: headers() });
      setNotifications(Array.isArray(res.data) ? res.data.slice(0, 15) : []);
    } catch {
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleClose = () => setNotifAnchor(null);

  const markAllRead = async () => {
    try {
      await axios.put('/api/notifications/read-all', {}, { headers: headers() });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { }
  };

  const markOneRead = async (notif) => {
    if (notif.is_read) return;
    try {
      await axios.put(`/api/notifications/${notif.id}/read`, {}, { headers: headers() });
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
  };

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : '';

  const popoverOpen = Boolean(notifAnchor);

  return (
    <>
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
                <IconButton color="inherit" size="small" onClick={handleBellClick}>
                  <Badge badgeContent={unreadCount} color="error" max={99}>
                    {unreadCount > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
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
              <Button color="inherit" onClick={() => navigate('/login')} variant="text">Login</Button>
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

      {/* ── Notification Popover — rendered outside AppBar to avoid stacking context issues ── */}
      <Popover
        open={popoverOpen}
        anchorEl={notifAnchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: { width: 380, maxHeight: 480, borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' }
        }}
      >
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center"
          sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="subtitle2" fontWeight={700}>Notifications</Typography>
            {unreadCount > 0 && (
              <Box sx={{
                px: 0.75, py: 0.1, bgcolor: 'error.main', color: 'white',
                borderRadius: 10, fontSize: 11, fontWeight: 700, lineHeight: '18px',
                minWidth: 18, textAlign: 'center'
              }}>
                {unreadCount}
              </Box>
            )}
          </Box>
          {unreadCount > 0 && (
            <Tooltip title="Mark all read">
              <IconButton size="small" onClick={markAllRead} color="primary">
                <DoneAllIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Body */}
        <Box sx={{ overflowY: 'auto', maxHeight: 400 }}>
          {notifLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={28} color="primary" />
            </Box>
          ) : notifications.length === 0 ? (
            <Box textAlign="center" py={5}>
              <NotificationsNoneIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">No notifications yet</Typography>
            </Box>
          ) : (
            notifications.map((n, idx) => (
              <React.Fragment key={n.id ?? idx}>
                <Box
                  onClick={() => markOneRead(n)}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    px: 2.5,
                    py: 1.5,
                    cursor: n.is_read ? 'default' : 'pointer',
                    bgcolor: n.is_read ? 'transparent' : 'rgba(46,125,50,0.05)',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.03)' },
                  }}
                >
                  {/* Unread dot */}
                  <Box sx={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0, mt: 0.75,
                    bgcolor: n.is_read ? 'transparent' : 'success.main',
                  }} />
                  {/* Content */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={n.is_read ? 400 : 700} color="text.primary"
                      sx={{ lineHeight: 1.4 }}>
                      {n.title || 'Notification'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary"
                      sx={{ display: 'block', lineHeight: 1.4, mt: 0.25 }}>
                      {n.message || ''}
                    </Typography>
                    <Typography variant="caption" color="text.disabled"
                      sx={{ display: 'block', mt: 0.5 }}>
                      {timeAgo(n.created_at)}
                    </Typography>
                  </Box>
                </Box>
                {idx < notifications.length - 1 && (
                  <Divider sx={{ mx: 2 }} />
                )}
              </React.Fragment>
            ))
          )}
        </Box>
      </Popover>
    </>
  );
};

export default Navbar;
