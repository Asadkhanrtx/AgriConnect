import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid, Card, CardContent, CardMedia, CardActions, Typography, Box, Button,
  TextField, InputAdornment, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress, Alert, MenuItem, Select, FormControl, InputLabel,
  IconButton, Tooltip, Avatar, Badge
} from '@mui/material';
import { motion } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import GavelIcon from '@mui/icons-material/Gavel';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import StoreIcon from '@mui/icons-material/Store';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PaymentIcon from '@mui/icons-material/Payment';
import FilterListIcon from '@mui/icons-material/FilterList';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import axios from 'axios';
import BuyerBot from './BuyerBot';

const STATUS_COLORS = { PENDING: 'warning', IN_TRANSIT: 'info', DELIVERED: 'success' };
const BID_COLORS    = { PENDING: 'warning', ACCEPTED: 'success', REJECTED: 'error' };

const PLACEHOLDER_IMAGES = {
  Rice:      'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80',
  Wheat:     'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&q=80',
  Tomatoes:  'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400&q=80',
  Potatoes:  'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80',
  Onion:     'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400&q=80',
  Mangoes:   'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&q=80',
  Bananas:   'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&q=80',
  Corn:      'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400&q=80',
  Apple:     'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&q=80',
  Soybean:   'https://images.unsplash.com/photo-1595855759920-86582396756a?w=400&q=80',
  default:   'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=400&q=80',
};

function getImage(listing) {
  if (listing.image_url) return listing.image_url;
  return PLACEHOLDER_IMAGES[listing.category] || PLACEHOLDER_IMAGES.default;
}

const glassCard = {
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(14px)',
  border: '1px solid rgba(18,53,36,0.07)',
  boxShadow: '0 4px 24px rgba(18,53,36,0.08)',
  borderRadius: '18px',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 36px rgba(18,53,36,0.12)' },
};

const StatCard = ({ title, value, icon, color, subtitle, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay }}
    style={{ height: '100%' }}
  >
    <Card sx={{ ...glassCard, height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="caption" sx={{ color: '#5a6b5c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.68rem' }}>
              {title}
            </Typography>
            <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, fontSize: '1.75rem', color: color || '#1a2e1d', lineHeight: 1.1, mt: 0.5 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{subtitle}</Typography>
            )}
          </Box>
          <Box sx={{
            width: 48, height: 48, borderRadius: '12px',
            background: color ? `${color}18` : 'rgba(18,53,36,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {React.cloneElement(icon, { sx: { color: color || '#123524', fontSize: 24 } })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  </motion.div>
);

const BuyerDashboard = ({ user }) => {
  const [tab, setTab]                     = useState(0);
  const [listings, setListings]           = useState([]);
  const [orders, setOrders]               = useState([]);
  const [bids, setBids]                   = useState([]);
  const [categories, setCategories]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [buyDialog, setBuyDialog]         = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [buyQty, setBuyQty]               = useState(1);
  const [buyLoading, setBuyLoading]       = useState(false);
  const [buyError, setBuyError]           = useState('');

  const [bidDialog, setBidDialog]         = useState(false);
  const [bidAmount, setBidAmount]         = useState('');
  const [bidLoading, setBidLoading]       = useState(false);
  const [bidError, setBidError]           = useState('');

  const [confirmingId, setConfirmingId]   = useState(null);

  const token   = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchListings = useCallback(async () => {
    try {
      const params = { limit: 50 };
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      const res = await axios.get('/api/marketplace/listings', { params });
      setListings(res.data.listings || res.data);
    } catch (err) { console.error('Error fetching listings', err); }
  }, [search, categoryFilter]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await axios.get('/api/orders/my-orders', { headers });
      setOrders(res.data);
    } catch { }
  }, []);

  const fetchBids = useCallback(async () => {
    try {
      const res = await axios.get('/api/marketplace/my-bids', { headers });
      setBids(res.data);
    } catch { }
  }, []);

  useEffect(() => {
    Promise.all([
      fetchListings(), fetchOrders(), fetchBids(),
      axios.get('/api/marketplace/categories').then(r => setCategories(r.data)).catch(() => {})
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (!loading) fetchListings(); }, [search, categoryFilter]);

  const openBuyDialog = (listing) => {
    setSelectedListing(listing); setBuyQty(1); setBuyError(''); setBuyDialog(true);
  };
  const openBidDialog = (listing) => {
    setSelectedListing(listing); setBidAmount(''); setBidError(''); setBidDialog(true);
  };

  const handleBuy = async () => {
    setBuyLoading(true); setBuyError('');
    try {
      await axios.post('/api/orders/create', { listing_id: selectedListing.id, quantity: parseFloat(buyQty) }, { headers });
      setBuyDialog(false); fetchListings(); fetchOrders(); setTab(1);
    } catch (err) { setBuyError(err.response?.data?.error || 'Order failed'); }
    finally { setBuyLoading(false); }
  };

  const handleConfirmDelivery = async (orderId) => {
    if (!window.confirm('Confirm delivery and release payment to the farmer?')) return;
    setConfirmingId(orderId);
    try {
      await axios.post(`/api/orders/${orderId}/confirm`, {}, { headers });
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to confirm delivery');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleBid = async () => {
    if (!bidAmount || parseFloat(bidAmount) <= 0) { setBidError('Please enter a valid bid amount'); return; }
    setBidLoading(true); setBidError('');
    try {
      await axios.post('/api/marketplace/bids', { listing_id: selectedListing.id, amount: parseFloat(bidAmount) }, { headers });
      setBidDialog(false); fetchBids(); setTab(2);
    } catch (err) { setBidError(err.response?.data?.error || 'Bid failed'); }
    finally { setBidLoading(false); }
  };

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <CircularProgress sx={{ color: '#123524' }} size={44} thickness={3.5} />
    </Box>
  );

  const totalSpent   = orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
  const activeOrders = orders.filter(o => o.delivery_status !== 'DELIVERED').length;
  const pendingBids  = bids.filter(b => b.status === 'PENDING').length;
  const acceptedBids = bids.filter(b => b.status === 'ACCEPTED').length;

  return (
    <Box>
      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Box sx={{
          background: 'linear-gradient(135deg, #0a1f15 0%, #123524 45%, #3E5F44 100%)',
          borderRadius: '20px',
          mb: 3,
          p: { xs: 3, md: 4 },
          position: 'relative',
          overflow: 'hidden',
        }}>
          <Box sx={{ position: 'absolute', right: -50, top: -50, width: 220, height: 220, borderRadius: '50%', bgcolor: 'rgba(163,177,138,0.06)' }} />
          <Box sx={{ position: 'absolute', right: 80, bottom: -80, width: 300, height: 300, borderRadius: '50%', bgcolor: 'rgba(217,164,65,0.05)' }} />
          <Box sx={{ position: 'absolute', left: -30, bottom: -30, width: 180, height: 180, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.06)' }} />

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box display="flex" alignItems="center" gap={1.5} mb={1}>
              <StoreIcon sx={{ color: '#A3B18A', fontSize: 18 }} />
              <Typography variant="caption" sx={{ color: '#A3B18A', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, fontSize: '0.67rem' }}>
                Buyer Marketplace
              </Typography>
            </Box>
            <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, fontSize: { xs: '1.6rem', md: '2rem' }, color: 'white', mb: 0.75, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              Welcome, {user?.first_name}!
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2.5, lineHeight: 1.6 }}>
              Source fresh produce directly from verified Indian farmers.
            </Typography>

            {/* Integrated search + category */}
            <Box display="flex" gap={1.5} flexWrap="wrap" alignItems="center">
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.20)', borderRadius: '12px',
                px: 2, py: 0.75, flexGrow: 1, maxWidth: 440,
              }}>
                <SearchIcon sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 18 }} />
                <TextField variant="standard" placeholder="Search produce, farm, location…"
                  value={search} onChange={e => setSearch(e.target.value)} fullWidth
                  InputProps={{ disableUnderline: true, sx: { color: 'white', fontSize: 14 } }}
                  sx={{ '& ::placeholder': { color: 'rgba(255,255,255,0.45)' } }}
                />
              </Box>
              <Box sx={{
                background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.20)', borderRadius: '12px',
                overflow: 'hidden', minWidth: 180,
              }}>
                <Select
                  value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                  displayEmpty variant="standard" disableUnderline
                  sx={{ color: 'white', fontSize: 14, px: 2, py: 0.75, width: '100%',
                    '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.55)' } }}
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </Box>
              {categoryFilter && (
                <Chip label={`Clear: ${categoryFilter}`} onDelete={() => setCategoryFilter('')} size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 600,
                    '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.65)' } }} />
              )}
            </Box>

            {/* Quick stats */}
            <Box display="flex" gap={1.5} mt={2.5} flexWrap="wrap">
              <Box sx={{ px: 2, py: 0.75, borderRadius: '10px', background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.14)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>Products</Typography>
                <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, color: 'white', fontSize: '1.1rem', lineHeight: 1 }}>{listings.length}</Typography>
              </Box>
              <Box sx={{ px: 2, py: 0.75, borderRadius: '10px', background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.14)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>Active Orders</Typography>
                <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, color: 'white', fontSize: '1.1rem', lineHeight: 1 }}>{activeOrders}</Typography>
              </Box>
              {pendingBids > 0 && (
                <Box sx={{ px: 2, py: 0.75, borderRadius: '10px', background: 'rgba(217,164,65,0.20)', backdropFilter: 'blur(8px)', border: '1px solid rgba(217,164,65,0.35)' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>Pending Bids</Typography>
                  <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, color: '#D9A441', fontSize: '1.1rem', lineHeight: 1 }}>{pendingBids}</Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </motion.div>

      {/* ── Stat Cards ──────────────────────────────────────────────────────── */}
      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={6} sm={3}>
          <StatCard delay={0.05} title="Total Spent"
            value={`₹${totalSpent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            icon={<AttachMoneyIcon />} color="#123524" subtitle="Lifetime" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard delay={0.10} title="Active Orders"
            value={activeOrders}
            icon={<LocalShippingIcon />} color="#3E5F44" subtitle={`${orders.length} total`} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard delay={0.15} title="Pending Bids"
            value={pendingBids}
            icon={<GavelIcon />} color="#B8862E" subtitle={`${acceptedBids} accepted`} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard delay={0.20} title="Products Available"
            value={listings.length}
            icon={<StoreIcon />} color="#D9A441" subtitle="Fresh listings" />
        </Grid>
      </Grid>

      {/* ── Category chips (marketplace tab only) ──────────────────────────── */}
      {tab === 0 && categories.length > 0 && (
        <Box display="flex" gap={1} mb={2.5} flexWrap="wrap" alignItems="center">
          <FilterListIcon sx={{ fontSize: 17, color: '#A3B18A' }} />
          <Chip label="All" size="small" onClick={() => setCategoryFilter('')}
            sx={{
              fontWeight: 600, borderRadius: '7px', cursor: 'pointer',
              bgcolor: !categoryFilter ? 'rgba(18,53,36,0.10)' : 'rgba(0,0,0,0.05)',
              color: !categoryFilter ? '#123524' : 'text.secondary',
              border: !categoryFilter ? '1px solid rgba(18,53,36,0.25)' : '1px solid transparent',
            }} />
          {categories.map(c => (
            <Chip key={c} label={c} size="small" onClick={() => setCategoryFilter(categoryFilter === c ? '' : c)}
              sx={{
                fontWeight: 600, borderRadius: '7px', cursor: 'pointer',
                bgcolor: categoryFilter === c ? 'rgba(18,53,36,0.10)' : 'rgba(0,0,0,0.04)',
                color: categoryFilter === c ? '#123524' : 'text.secondary',
                border: categoryFilter === c ? '1px solid rgba(18,53,36,0.25)' : '1px solid transparent',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: 'rgba(18,53,36,0.07)', color: '#123524' },
              }} />
          ))}
        </Box>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <Box sx={{
        borderBottom: '1px solid rgba(18,53,36,0.08)', mb: 3,
        background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)',
        borderRadius: '14px 14px 0 0', px: 1,
      }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="primary" indicatorColor="primary"
          sx={{ '& .MuiTab-root': { fontWeight: 700, minHeight: 52, fontSize: '0.875rem' } }}>
          <Tab icon={<StoreIcon fontSize="small" />} label="Marketplace" iconPosition="start" />
          <Tab
            icon={<Badge badgeContent={activeOrders} color="warning" max={99}><ReceiptIcon fontSize="small" /></Badge>}
            label="My Orders" iconPosition="start"
          />
          <Tab icon={<GavelIcon fontSize="small" />} label={`My Bids (${bids.length})`} iconPosition="start" />
          <Tab icon={<SmartToyIcon fontSize="small" />} label="BuyerBot AI" iconPosition="start" />
        </Tabs>
      </Box>

      {/* ── Marketplace ──────────────────────────────────────────────────────── */}
      {tab === 0 && (
        <>
          {listings.length === 0 ? (
            <Box textAlign="center" py={10}>
              <Box sx={{ width: 76, height: 76, borderRadius: '50%', bgcolor: 'rgba(18,53,36,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                <StoreIcon sx={{ fontSize: 38, color: 'rgba(18,53,36,0.3)' }} />
              </Box>
              <Typography variant="h6" fontWeight={700} color="text.secondary">No listings found</Typography>
              <Typography variant="body2" color="text.disabled">Try a different search or category</Typography>
            </Box>
          ) : (
            <Grid container spacing={2.5}>
              {listings.map((listing, idx) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={listing.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.4) }}
                    style={{ height: '100%' }}
                  >
                    <Card sx={{
                      height: '100%', display: 'flex', flexDirection: 'column',
                      borderRadius: '18px', overflow: 'hidden',
                      border: '1px solid rgba(18,53,36,0.07)',
                      boxShadow: '0 4px 20px rgba(18,53,36,0.07)',
                      transition: 'transform 0.22s ease, box-shadow 0.22s ease',
                      '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 16px 40px rgba(18,53,36,0.13)' },
                    }}>
                      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
                        <CardMedia component="img" height="190" image={getImage(listing)}
                          alt={listing.product_name}
                          sx={{ objectFit: 'cover', transition: 'transform 0.3s ease', '&:hover': { transform: 'scale(1.04)' } }} />
                        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,31,21,0.55) 0%, transparent 55%)' }} />
                        <Chip label={listing.category} size="small"
                          sx={{ position: 'absolute', top: 10, right: 10, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.92)', color: '#123524', fontSize: 11, borderRadius: '7px' }} />
                        <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, fontSize: '1rem',
                          position: 'absolute', bottom: 10, left: 12, color: 'white', textShadow: '0 1px 6px rgba(0,0,0,0.5)', lineHeight: 1.1 }}>
                          {listing.product_name}
                        </Typography>
                      </Box>
                      <CardContent sx={{ flexGrow: 1, pb: 1, pt: 1.5 }}>
                        <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                          <AgricultureIcon sx={{ fontSize: 13, color: '#A3B18A' }} />
                          <Typography variant="caption" color="text.secondary" fontWeight={500}>
                            {listing.Farmer?.farm_name}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={0.5} mb={1.5}>
                          <LocationOnIcon sx={{ fontSize: 13, color: '#A3B18A' }} />
                          <Typography variant="caption" color="text.secondary">
                            {listing.Farmer?.location}
                          </Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-end">
                          <Box>
                            <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, fontSize: '1.4rem', color: '#123524', lineHeight: 1 }}>
                              ₹{parseFloat(listing.price).toFixed(0)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">per {listing.unit}</Typography>
                          </Box>
                          <Chip label={`${listing.quantity} ${listing.unit}`} size="small"
                            sx={{ fontWeight: 600, borderRadius: '7px', bgcolor: 'rgba(18,53,36,0.07)', color: '#3E5F44', border: '1px solid rgba(18,53,36,0.14)' }} />
                        </Box>
                      </CardContent>
                      <CardActions sx={{ p: 1.5, pt: 0, gap: 1 }}>
                        <Button fullWidth variant="contained"
                          startIcon={<ShoppingCartIcon />}
                          onClick={() => openBuyDialog(listing)}
                          disabled={listing.quantity <= 0}
                          size="small"
                          sx={{ borderRadius: '10px', fontWeight: 700 }}>
                          Buy Now
                        </Button>
                        <Tooltip title="Place a bid">
                          <Button variant="outlined" startIcon={<GavelIcon />}
                            onClick={() => openBidDialog(listing)} size="small"
                            sx={{ minWidth: 0, px: 1.5, borderRadius: '10px', borderColor: 'rgba(18,53,36,0.25)', color: '#3E5F44', '&:hover': { bgcolor: 'rgba(18,53,36,0.05)' } }}>
                            Bid
                          </Button>
                        </Tooltip>
                      </CardActions>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* ── My Orders ────────────────────────────────────────────────────────── */}
      {tab === 1 && (
        <Card sx={{ ...glassCard, overflow: 'hidden' }}>
          {orders.length === 0 ? (
            <Box textAlign="center" py={10}>
              <Box sx={{ width: 76, height: 76, borderRadius: '50%', bgcolor: 'rgba(184,134,46,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                <ReceiptIcon sx={{ fontSize: 38, color: 'rgba(184,134,46,0.4)' }} />
              </Box>
              <Typography variant="h6" fontWeight={700} color="text.secondary">No orders yet</Typography>
              <Button variant="contained" sx={{ mt: 2 }} onClick={() => setTab(0)}>Browse Produce</Button>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow sx={{ background: 'rgba(18,53,36,0.04)' }}>
                  <TableCell>Order #</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Farm</TableCell>
                  <TableCell>Qty</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map(order => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Typography fontWeight={700} sx={{ color: '#123524' }}>#{order.id}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar src={order.ProduceListing?.image_url} variant="rounded"
                          sx={{ width: 36, height: 36, bgcolor: 'rgba(18,53,36,0.07)', color: '#123524', fontWeight: 700, borderRadius: '9px' }}>
                          {order.ProduceListing?.product_name?.[0]}
                        </Avatar>
                        <Typography fontWeight={600}>{order.ProduceListing?.product_name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{order.ProduceListing?.Farmer?.farm_name}</Typography>
                    </TableCell>
                    <TableCell>{order.quantity} {order.ProduceListing?.unit}</TableCell>
                    <TableCell>
                      <Typography fontWeight={700} sx={{ color: '#123524' }}>₹{parseFloat(order.total_amount).toLocaleString('en-IN')}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(order.created_at).toLocaleDateString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={order.delivery_status}
                        color={STATUS_COLORS[order.delivery_status] || 'default'}
                        size="small" sx={{ fontWeight: 700, borderRadius: '7px' }} />
                    </TableCell>
                    <TableCell>
                      {order.delivery_status === 'DELIVERED' && !order.buyer_confirmed ? (
                        <Tooltip title="Confirm receipt and release payment to farmer">
                          <Button size="small" variant="contained" color="success"
                            startIcon={confirmingId === order.id ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
                            disabled={confirmingId === order.id}
                            onClick={() => handleConfirmDelivery(order.id)}
                            sx={{ borderRadius: '7px', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>
                            Confirm
                          </Button>
                        </Tooltip>
                      ) : order.buyer_confirmed ? (
                        <Chip icon={<PaymentIcon />} label="Payment Released" color="success"
                          size="small" variant="outlined" sx={{ fontWeight: 600, borderRadius: '7px' }} />
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* ── My Bids ──────────────────────────────────────────────────────────── */}
      {tab === 2 && (
        <Card sx={{ ...glassCard, overflow: 'hidden' }}>
          {bids.length === 0 ? (
            <Box textAlign="center" py={10}>
              <Box sx={{ width: 76, height: 76, borderRadius: '50%', bgcolor: 'rgba(18,53,36,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                <GavelIcon sx={{ fontSize: 38, color: 'rgba(18,53,36,0.25)' }} />
              </Box>
              <Typography variant="h6" fontWeight={700} color="text.secondary">No bids placed yet</Typography>
              <Button variant="contained" sx={{ mt: 2 }} onClick={() => setTab(0)}>Browse Produce</Button>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow sx={{ background: 'rgba(18,53,36,0.04)' }}>
                  <TableCell>Product</TableCell>
                  <TableCell>Farm</TableCell>
                  <TableCell>Listed Price</TableCell>
                  <TableCell>Your Bid</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bids.map(bid => (
                  <TableRow key={bid.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar src={bid.ProduceListing?.image_url} variant="rounded"
                          sx={{ width: 36, height: 36, bgcolor: 'rgba(18,53,36,0.07)', color: '#123524', fontWeight: 700, borderRadius: '9px' }}>
                          {bid.ProduceListing?.product_name?.[0]}
                        </Avatar>
                        <Typography fontWeight={600}>{bid.ProduceListing?.product_name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{bid.ProduceListing?.Farmer?.farm_name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography color="text.secondary">₹{bid.ProduceListing?.price}/{bid.ProduceListing?.unit}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={800} sx={{ color: '#D9A441', fontSize: '0.97rem' }}>
                        ₹{parseFloat(bid.amount).toLocaleString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(bid.created_at).toLocaleDateString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={bid.status} color={BID_COLORS[bid.status] || 'default'}
                        size="small" sx={{ fontWeight: 700, borderRadius: '7px' }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* ── BuyerBot ─────────────────────────────────────────────────────────── */}
      {tab === 3 && <BuyerBot user={user} />}

      {/* ── Buy Dialog ───────────────────────────────────────────────────────── */}
      <Dialog open={buyDialog} onClose={() => setBuyDialog(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, color: '#123524', borderBottom: '1px solid rgba(18,53,36,0.06)' }}>
          Confirm Purchase
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          {buyError && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{buyError}</Alert>}
          {selectedListing && (
            <Box>
              <Box display="flex" alignItems="center" gap={2} mb={3} p={2}
                sx={{ bgcolor: 'rgba(18,53,36,0.04)', borderRadius: '12px' }}>
                <Avatar src={getImage(selectedListing)} variant="rounded"
                  sx={{ width: 60, height: 60, borderRadius: '12px' }} />
                <Box>
                  <Typography fontWeight={700}>{selectedListing.product_name}</Typography>
                  <Typography variant="body2" color="text.secondary">{selectedListing.Farmer?.farm_name}</Typography>
                  <Typography variant="body2" sx={{ color: '#123524', fontWeight: 700 }}>
                    ₹{selectedListing.price}/{selectedListing.unit}
                  </Typography>
                </Box>
              </Box>
              <TextField fullWidth label="Quantity" type="number"
                value={buyQty}
                onChange={e => setBuyQty(Math.max(1, parseFloat(e.target.value) || 1))}
                inputProps={{ min: 1, max: selectedListing.quantity }}
                helperText={`Available: ${selectedListing.quantity} ${selectedListing.unit}`}
                sx={{ mb: 2 }}
              />
              <Box p={2} sx={{ background: 'linear-gradient(135deg, #123524, #3E5F44)', borderRadius: '12px', color: 'white' }}>
                <Typography variant="body2" sx={{ opacity: 0.75 }}>Total Amount</Typography>
                <Typography sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, fontSize: '1.6rem' }}>
                  ₹{(parseFloat(selectedListing.price) * buyQty).toLocaleString('en-IN')}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setBuyDialog(false)} disabled={buyLoading}
            sx={{ borderRadius: '10px', color: '#5a6b5c' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleBuy} disabled={buyLoading}
            startIcon={buyLoading ? <CircularProgress size={16} color="inherit" /> : <ShoppingCartIcon />}
            sx={{ borderRadius: '10px', px: 3, fontWeight: 700 }}>
            Confirm Order
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Bid Dialog ───────────────────────────────────────────────────────── */}
      <Dialog open={bidDialog} onClose={() => setBidDialog(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontFamily: '"Satoshi", sans-serif', fontWeight: 800, color: '#123524', borderBottom: '1px solid rgba(18,53,36,0.06)' }}>
          Place a Bid
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          {bidError && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{bidError}</Alert>}
          {selectedListing && (
            <Box>
              <Box display="flex" alignItems="center" gap={2} mb={3} p={2}
                sx={{ bgcolor: 'rgba(18,53,36,0.04)', borderRadius: '12px' }}>
                <Avatar src={getImage(selectedListing)} variant="rounded"
                  sx={{ width: 60, height: 60, borderRadius: '12px' }} />
                <Box>
                  <Typography fontWeight={700}>{selectedListing.product_name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Listed at ₹{selectedListing.price}/{selectedListing.unit}
                  </Typography>
                </Box>
              </Box>
              <TextField fullWidth label="Your Bid Amount (₹)" type="number"
                value={bidAmount} onChange={e => setBidAmount(e.target.value)}
                helperText="Enter total amount you are willing to pay"
                inputProps={{ min: 0, step: 1 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setBidDialog(false)} disabled={bidLoading}
            sx={{ borderRadius: '10px', color: '#5a6b5c' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleBid} disabled={bidLoading}
            startIcon={bidLoading ? <CircularProgress size={16} color="inherit" /> : <GavelIcon />}
            sx={{ borderRadius: '10px', px: 3, fontWeight: 700, background: 'linear-gradient(135deg, #D9A441, #E8BF7A)', color: '#123524',
              '&:hover': { background: 'linear-gradient(135deg, #B8862E, #D9A441)' } }}>
            Submit Bid
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BuyerDashboard;
