import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, IconButton, Badge, Tooltip, Avatar,
  Popover, Divider, CircularProgress, Chip
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import SpaIcon from '@mui/icons-material/Spa';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import LogoutIcon from '@mui/icons-material/Logout';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ROLE_LABELS  = { FARMER: 'Farmer', BUYER: 'Buyer', ADMIN: 'Admin' };
const ROLE_COLORS  = { FARMER: '#A3B18A', BUYER: '#D9A441', ADMIN: '#E8BF7A' };

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
  const [scrolled, setScrolled]       = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifAnchor, setNotifAnchor] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading]   = useState(false);

  const token   = () => localStorage.getItem('token');
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const fetchUnreadCount = useCallback(() => {
    if (!user) return;
    axios.get('/api/notifications/unread-count', { headers: headers() })
      .then(res => setUnreadCount(res.data.count || 0))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
    const t = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(t);
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

  const markAllRead = async () => {
    try {
      await axios.put('/api/notifications/read-all', {}, { headers: headers() });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const markOneRead = async (notif) => {
    if (notif.is_read) return;
    try {
      await axios.put(`/api/notifications/${notif.id}/read`, {}, { headers: headers() });
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
  };

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : '';

  return (
    <>
      <motion.nav
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ position: 'sticky', top: 0, zIndex: 1200 }}
      >
        <Box sx={{
          px: { xs: 2.5, md: 5 },
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          background: scrolled
            ? 'rgba(18, 53, 36, 0.95)'
            : 'rgba(18, 53, 36, 0.88)',
          backdropFilter: 'blur(24px)',
          borderBottom: scrolled
            ? '1px solid rgba(163,177,138,0.2)'
            : '1px solid rgba(255,255,255,0.06)',
          boxShadow: scrolled ? '0 4px 32px rgba(0,0,0,0.18)' : 'none',
          transition: 'all 0.3s ease',
        }}>
          {/* Logo */}
          <Box
            display="flex" alignItems="center" gap={1.5}
            sx={{ cursor: 'pointer', '&:hover': { opacity: 0.85 }, transition: 'opacity 0.2s' }}
            onClick={() => navigate('/')}
          >
            <Box sx={{
              width: 34, height: 34, borderRadius: '10px',
              background: 'linear-gradient(135deg, #A3B18A, #D9A441)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <SpaIcon sx={{ color: '#123524', fontSize: 18 }} />
            </Box>
            <Typography sx={{
              fontFamily: '"Satoshi", sans-serif',
              fontWeight: 800, fontSize: '1.1rem',
              color: 'white', letterSpacing: '-0.01em',
            }}>
              AgriConnect
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {user ? (
            <Box display="flex" alignItems="center" gap={1.5}>
              {/* Role badge */}
              <Box sx={{
                px: 1.5, py: 0.4, borderRadius: '8px',
                background: 'rgba(163,177,138,0.15)',
                border: `1px solid ${ROLE_COLORS[user.role] || '#A3B18A'}40`,
              }}>
                <Typography variant="caption" sx={{
                  color: ROLE_COLORS[user.role] || '#A3B18A',
                  fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.67rem',
                }}>
                  {ROLE_LABELS[user.role] || user.role}
                </Typography>
              </Box>

              {/* Notifications */}
              <Tooltip title="Notifications">
                <IconButton size="small" onClick={handleBellClick} sx={{
                  color: 'rgba(255,255,255,0.8)',
                  '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.08)' },
                  transition: 'all 0.2s',
                }}>
                  <Badge badgeContent={unreadCount} color="error" max={99}
                    sx={{ '& .MuiBadge-badge': { bgcolor: '#D9A441', color: '#123524', fontWeight: 700 } }}>
                    <AnimatePresence mode="wait">
                      {unreadCount > 0
                        ? <motion.div key="full" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                            <NotificationsIcon sx={{ fontSize: 21 }} />
                          </motion.div>
                        : <motion.div key="empty" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                            <NotificationsNoneIcon sx={{ fontSize: 21 }} />
                          </motion.div>
                      }
                    </AnimatePresence>
                  </Badge>
                </IconButton>
              </Tooltip>

              {/* Avatar + name */}
              <Box display="flex" alignItems="center" gap={1}>
                <Avatar sx={{
                  bgcolor: 'rgba(163,177,138,0.25)',
                  color: '#A3B18A',
                  width: 32, height: 32,
                  fontSize: 12, fontWeight: 800,
                  border: '1.5px solid rgba(163,177,138,0.4)',
                }}>
                  {initials}
                </Avatar>
                <Typography variant="body2" sx={{
                  display: { xs: 'none', sm: 'block' },
                  color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '0.85rem',
                }}>
                  {user.first_name}
                </Typography>
              </Box>

              {/* Logout */}
              <Tooltip title="Sign out">
                <IconButton size="small" onClick={handleLogout} sx={{
                  color: 'rgba(255,255,255,0.55)',
                  '&:hover': { color: '#D9A441', bgcolor: 'rgba(217,164,65,0.1)' },
                  transition: 'all 0.2s',
                }}>
                  <LogoutIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Box display="flex" gap={1}>
              <Box
                onClick={() => navigate('/login')}
                sx={{
                  px: 2, py: 0.75, borderRadius: '8px', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: '0.875rem',
                  '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.08)' },
                  transition: 'all 0.2s',
                }}
              >
                Sign In
              </Box>
              <Box
                onClick={() => navigate('/register')}
                sx={{
                  px: 2.5, py: 0.75, borderRadius: '8px', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #D9A441, #E8BF7A)',
                  color: '#123524', fontWeight: 700, fontSize: '0.875rem',
                  '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 14px rgba(217,164,65,0.4)' },
                  transition: 'all 0.2s',
                }}
              >
                Get Started
              </Box>
            </Box>
          )}
        </Box>
      </motion.nav>

      {/* Notification Popover */}
      <Popover
        open={Boolean(notifAnchor)}
        anchorEl={notifAnchor}
        onClose={() => setNotifAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: 380, maxHeight: 500, borderRadius: '16px',
            boxShadow: '0 12px 48px rgba(18,53,36,0.18)',
            border: '1px solid rgba(18,53,36,0.08)',
            overflow: 'hidden',
          }
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center"
          sx={{ px: 2.5, py: 1.75, background: 'linear-gradient(135deg, #123524, #3E5F44)' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="subtitle2" fontWeight={700} color="white">Notifications</Typography>
            {unreadCount > 0 && (
              <Box sx={{
                px: 0.75, bgcolor: '#D9A441', color: '#123524',
                borderRadius: 10, fontSize: 11, fontWeight: 800, lineHeight: '18px',
                minWidth: 18, textAlign: 'center',
              }}>
                {unreadCount}
              </Box>
            )}
          </Box>
          {unreadCount > 0 && (
            <Tooltip title="Mark all read">
              <IconButton size="small" onClick={markAllRead} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: 'white' } }}>
                <DoneAllIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Box sx={{ overflowY: 'auto', maxHeight: 420 }}>
          {notifLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={26} sx={{ color: '#3E5F44' }} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box textAlign="center" py={6}>
              <NotificationsNoneIcon sx={{ fontSize: 44, color: '#A3B18A', mb: 1.5 }} />
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                You're all caught up
              </Typography>
            </Box>
          ) : (
            notifications.map((n, idx) => (
              <React.Fragment key={n.id ?? idx}>
                <Box
                  onClick={() => markOneRead(n)}
                  sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 1.5,
                    px: 2.5, py: 1.75, cursor: n.is_read ? 'default' : 'pointer',
                    bgcolor: n.is_read ? 'transparent' : 'rgba(18,53,36,0.04)',
                    '&:hover': { bgcolor: 'rgba(18,53,36,0.03)' },
                    transition: 'background 0.15s',
                  }}
                >
                  <Box sx={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0, mt: 0.9,
                    bgcolor: n.is_read ? 'transparent' : '#D9A441',
                  }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={n.is_read ? 500 : 700}
                      sx={{ lineHeight: 1.4, color: '#1a2e1d' }}>
                      {n.title || 'Notification'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary"
                      sx={{ display: 'block', lineHeight: 1.5, mt: 0.25 }}>
                      {n.message || ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#A3B18A', display: 'block', mt: 0.5, fontWeight: 500 }}>
                      {timeAgo(n.created_at)}
                    </Typography>
                  </Box>
                </Box>
                {idx < notifications.length - 1 && <Divider sx={{ mx: 2.5, borderColor: 'rgba(18,53,36,0.06)' }} />}
              </React.Fragment>
            ))
          )}
        </Box>
      </Popover>
    </>
  );
};

export default Navbar;
