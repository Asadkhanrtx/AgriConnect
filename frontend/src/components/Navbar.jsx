import React, { useState, useEffect, useCallback } from 'react';
import {
  AppBar, Toolbar, Typography, Button, Box, Chip, IconButton,
  Badge, Tooltip, Avatar, Popover, List, ListItem, ListItemText,
  ListItemAvatar, Divider, CircularProgress
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

  // Poll unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleBellClick = async (e) => {
    setNotifAnchor(e.currentTarget);
    setNotifLoading(true);
    try {
      const res = await axios.get('/api/notifications', { headers: headers() });
      setNotifications(res.data.slice(0, 15));
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

      {/* ── Notification Popover ── */}
      <Popover
        open={popoverOpen}
        anchorEl={notifAnchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 380, maxHeight: 480, borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' } }}
      >
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center"
          sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography fontWeight={700} variant="subtitle1">
            Notifications {unreadCount > 0 && (
              <Typography component="span" variant="caption"
                sx={{ ml: 1, px: 1, py: 0.3, bgcolor: 'error.main', color: 'white', borderRadius: 10, fontWeight: 700 }}>
                {unreadCount}
              </Typography>
            )}
          </Typography>
          {unreadCount > 0 && (
            <Tooltip title="Mark all read">
              <IconButton size="small" onClick={markAllRead} color="primary">
                <DoneAllIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Notification list */}
        {notifLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={28} color="primary" />
          </Box>
        ) : notifications.length === 0 ? (
          <Box textAlign="center" py={5}>
            <NotificationsNoneIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="textSecondary">No notifications yet</Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ overflow: 'auto', maxHeight: 380 }}>
            {notifications.map((n, idx) => (
              <React.Fragment key={n.id}>
                <ListItem
                  alignItems="flex-start"
                  onClick={() => markOneRead(n)}
                  sx={{
                    cursor: n.is_read ? 'default' : 'pointer',
                    bgcolor: n.is_read ? 'transparent' : 'rgba(46,125,50,0.05)',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.03)' },
                    py: 1.5, px: 2.5
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 36, mt: 0.5 }}>
                    <Box sx={{
                      width: 8, height: 8, borderRadius: '50%',
                      bgcolor: n.is_read ? 'transparent' : 'success.main',
                      mt: 0.5
                    }} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={n.is_read ? 400 : 700} color="text.primary">
                        {n.title}
                      </Typography>
                    }
                    secondary={
                      <>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25, lineHeight: 1.4 }}>
                          {n.message}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                          {timeAgo(n.created_at)}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
                {idx < notifications.length - 1 && <Divider component="li" sx={{ mx: 2 }} />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Popover>
    </AppBar>
  );
};

export default Navbar;
