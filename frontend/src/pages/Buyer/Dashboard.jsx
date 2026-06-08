import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid, Card, CardContent, CardMedia, CardActions, Typography, Box, Button,
  TextField, InputAdornment, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress, Alert, MenuItem, Select, FormControl, InputLabel,
  IconButton, Tooltip, Avatar, Badge
} from '@mui/material';
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
import axios from 'axios';

const STATUS_COLORS = { PENDING: 'warning', IN_TRANSIT: 'info', DELIVERED: 'success' };
const BID_COLORS = { PENDING: 'warning', ACCEPTED: 'success', REJECTED: 'error' };

const PLACEHOLDER_IMAGES = {
  Rice: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80',
  Wheat: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&q=80',
  Tomatoes: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400&q=80',
  Potatoes: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80',
  Onion: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400&q=80',
  Mangoes: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&q=80',
  Bananas: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&q=80',
  Corn: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400&q=80',
  Apple: 'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&q=80',
  Soybean: 'https://images.unsplash.com/photo-1595855759920-86582396756a?w=400&q=80',
  default: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=400&q=80',
};

function getImage(listing) {
  if (listing.image_url) return listing.image_url;
  return PLACEHOLDER_IMAGES[listing.category] || PLACEHOLDER_IMAGES.default;
}

const glassCard = {
  background: 'rgba(255,255,255,0.88)',
  backdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.65)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
  borderRadius: 3,
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 14px 40px rgba(0,0,0,0.14)' },
};

const StatCard = ({ title, value, icon, color, subtitle }) => (
  <Card sx={{ ...glassCard, height: '100%' }}>
    <CardContent sx={{ p: 2.5 }}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600}
            sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={800} color={color || 'text.primary'} lineHeight={1.1} mt={0.5}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" mt={0.5} display="block">{subtitle}</Typography>
          )}
        </Box>
        <Box sx={{
          width: 52, height: 52, borderRadius: 2,
          background: color ? `${color}18` : 'rgba(230,81,0,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {React.cloneElement(icon, { sx: { color: color || '#E65100', fontSize: 26 } })}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const BuyerDashboard = ({ user }) => {
  const [tab, setTab] = useState(0);
  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bids, setBids] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [buyDialog, setBuyDialog] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [buyQty, setBuyQty] = useState(1);
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState('');

  const [bidDialog, setBidDialog] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [bidError, setBidError] = useState('');

  const [confirmingId, setConfirmingId] = useState(null);

  const token = localStorage.getItem('token');
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
      <CircularProgress sx={{ color: '#E65100' }} size={48} thickness={4} />
    </Box>
  );

  const totalSpent = orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
  const activeOrders = orders.filter(o => o.delivery_status !== 'DELIVERED').length;
  const pendingBids = bids.filter(b => b.status === 'PENDING').length;
  const acceptedBids = bids.filter(b => b.status === 'ACCEPTED').length;

  return (
    <Box>
      {/* ── Hero Banner ──────────────────────────────────────────────────────────── */}
      <Box sx={{
        background: 'linear-gradient(135deg, #3E1A00 0%, #BF360C 30%, #E64A19 60%, #FF7043 100%)',
        borderRadius: 3,
        mb: 3,
        p: { xs: 3, md: 4 },
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Box sx={{ position: 'absolute', right: -50, top: -50, width: 200, height: 200, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)' }} />
        <Box sx={{ position: 'absolute', right: 80, bottom: -80, width: 280, height: 280, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.03)' }} />
        <Box sx={{ position: 'absolute', left: -30, bottom: -30, width: 160, height: 160, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.08)' }} />

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box display="flex" alignItems="center" gap={1.5} mb={1}>
            <StoreIcon sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>
              Buyer Marketplace
            </Typography>
          </Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: 'white', mb: 0.75, lineHeight: 1.15 }}>
            Welcome, {user?.first_name}!
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', mb: 2.5 }}>
            Source fresh produce directly from verified Indian farmers.
          </Typography>

          {/* Integrated Search + Category filter */}
          <Box display="flex" gap={1.5} flexWrap="wrap" alignItems="center">
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.25)', borderRadius: 2.5,
              px: 2, py: 0.75, flexGrow: 1, maxWidth: 440,
            }}>
              <SearchIcon sx={{ color: 'rgba(255,255,255,0.65)', fontSize: 20 }} />
              <TextField
                variant="standard"
                placeholder="Search produce, farm, location…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                fullWidth
                InputProps={{ disableUnderline: true, sx: { color: 'white', fontSize: 14 } }}
                sx={{ '& ::placeholder': { color: 'rgba(255,255,255,0.5)' } }}
              />
            </Box>
            <Box sx={{
              background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.25)', borderRadius: 2.5, overflow: 'hidden',
              minWidth: 180,
            }}>
              <Select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                displayEmpty
                variant="standard"
                disableUnderline
                sx={{ color: 'white', fontSize: 14, px: 2, py: 0.75, width: '100%',
                  '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.65)' } }}
              >
                <MenuItem value="">All Categories</MenuItem>
                {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </Box>
            {categoryFilter && (
              <Chip label={`Clear: ${categoryFilter}`} onDelete={() => setCategoryFilter('')} size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'white', fontWeight: 600,
                  '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)' } }} />
            )}
          </Box>

          {/* Quick stats in hero */}
          <Box display="flex" gap={1.5} mt={2.5} flexWrap="wrap">
            <Box sx={{ px: 2, py: 0.75, borderRadius: 2, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>Products</Typography>
              <Typography variant="h6" fontWeight={800} color="white">{listings.length}</Typography>
            </Box>
            <Box sx={{ px: 2, py: 0.75, borderRadius: 2, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>Active Orders</Typography>
              <Typography variant="h6" fontWeight={800} color="white">{activeOrders}</Typography>
            </Box>
            {pendingBids > 0 && (
              <Box sx={{ px: 2, py: 0.75, borderRadius: 2, background: 'rgba(255,193,7,0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,193,7,0.3)' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>Pending Bids</Typography>
                <Typography variant="h6" fontWeight={800} color="#FFD54F">{pendingBids}</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* ── Stat Cards ── */}
      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={6} sm={3}>
          <StatCard title="Total Spent"
            value={`₹${totalSpent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            icon={<AttachMoneyIcon />} color="#1B5E20" subtitle="Lifetime" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Active Orders" value={activeOrders}
            icon={<LocalShippingIcon />} color="#E65100" subtitle={`${orders.length} total`} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Pending Bids" value={pendingBids}
            icon={<GavelIcon />} color="#0288D1" subtitle={`${acceptedBids} accepted`} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Products Available" value={listings.length}
            icon={<StoreIcon />} color="#6A1B9A" subtitle="Fresh listings" />
        </Grid>
      </Grid>

      {/* ── Category Chips ── */}
      {tab === 0 && categories.length > 0 && (
        <Box display="flex" gap={1} mb={2.5} flexWrap="wrap" alignItems="center">
          <FilterListIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Chip
            label="All"
            size="small"
            onClick={() => setCategoryFilter('')}
            sx={{
              fontWeight: 600, borderRadius: 2,
              bgcolor: !categoryFilter ? 'rgba(230,81,0,0.12)' : 'rgba(0,0,0,0.06)',
              color: !categoryFilter ? '#E65100' : 'text.secondary',
              border: !categoryFilter ? '1px solid rgba(230,81,0,0.3)' : '1px solid transparent',
              cursor: 'pointer',
            }}
          />
          {categories.map(c => (
            <Chip
              key={c}
              label={c}
              size="small"
              onClick={() => setCategoryFilter(categoryFilter === c ? '' : c)}
              sx={{
                fontWeight: 600, borderRadius: 2, cursor: 'pointer',
                bgcolor: categoryFilter === c ? 'rgba(230,81,0,0.12)' : 'rgba(0,0,0,0.06)',
                color: categoryFilter === c ? '#E65100' : 'text.secondary',
                border: categoryFilter === c ? '1px solid rgba(230,81,0,0.3)' : '1px solid transparent',
                transition: 'all 0.15s ease',
                '&:hover': { bgcolor: 'rgba(230,81,0,0.08)', color: '#E65100' },
              }}
            />
          ))}
        </Box>
      )}

      {/* ── Tabs ── */}
      <Box sx={{
        borderBottom: '2px solid rgba(0,0,0,0.06)', mb: 3,
        background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)',
        borderRadius: '12px 12px 0 0', px: 1,
      }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="primary" indicatorColor="primary"
          sx={{ '& .MuiTab-root': { fontWeight: 700, minHeight: 52 }, '& .MuiTabs-indicator': { bgcolor: '#E65100' } }}>
          <Tab icon={<StoreIcon fontSize="small" />} label="Marketplace" iconPosition="start" />
          <Tab
            icon={<Badge badgeContent={activeOrders} color="warning" max={99}><ReceiptIcon fontSize="small" /></Badge>}
            label="My Orders" iconPosition="start"
          />
          <Tab icon={<GavelIcon fontSize="small" />} label={`My Bids (${bids.length})`} iconPosition="start" />
        </Tabs>
      </Box>

      {/* ── Marketplace ── */}
      {tab === 0 && (
        <>
          {listings.length === 0 ? (
            <Box textAlign="center" py={10}>
              <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(230,81,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                <StoreIcon sx={{ fontSize: 40, color: 'rgba(230,81,0,0.4)' }} />
              </Box>
              <Typography variant="h6" fontWeight={700} color="text.secondary">No listings found</Typography>
              <Typography variant="body2" color="text.disabled">Try a different search or category</Typography>
            </Box>
          ) : (
            <Grid container spacing={2.5}>
              {listings.map(listing => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={listing.id}>
                  <Card sx={{
                    height: '100%', display: 'flex', flexDirection: 'column',
                    borderRadius: 3, overflow: 'hidden',
                    border: '1px solid rgba(0,0,0,0.07)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
                    transition: 'transform 0.22s ease, box-shadow 0.22s ease',
                    '&:hover': { transform: 'translateY(-5px)', boxShadow: '0 16px 40px rgba(0,0,0,0.13)' },
                  }}>
                    <Box sx={{ position: 'relative', overflow: 'hidden' }}>
                      <CardMedia component="img" height="190" image={getImage(listing)}
                        alt={listing.product_name}
                        sx={{ objectFit: 'cover', transition: 'transform 0.3s ease', '&:hover': { transform: 'scale(1.04)' } }} />
                      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 60%)' }} />
                      <Chip label={listing.category} size="small"
                        sx={{ position: 'absolute', top: 10, right: 10, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.92)', color: '#E65100', fontSize: 11 }} />
                      <Typography variant="h6" fontWeight={800}
                        sx={{ position: 'absolute', bottom: 10, left: 12, color: 'white', textShadow: '0 1px 6px rgba(0,0,0,0.5)', lineHeight: 1.1 }}>
                        {listing.product_name}
                      </Typography>
                    </Box>
                    <CardContent sx={{ flexGrow: 1, pb: 1, pt: 1.5 }}>
                      <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                        <AgricultureIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          {listing.Farmer?.farm_name}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.5} mb={1.5}>
                        <LocationOnIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {listing.Farmer?.location}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-end">
                        <Box>
                          <Typography variant="h5" color="#E65100" fontWeight={800} lineHeight={1}>
                            ₹{parseFloat(listing.price).toFixed(0)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">per {listing.unit}</Typography>
                        </Box>
                        <Chip label={`${listing.quantity} ${listing.unit}`} size="small"
                          sx={{ fontWeight: 600, bgcolor: 'rgba(46,125,50,0.08)', color: '#2E7D32', border: '1px solid rgba(46,125,50,0.2)' }} />
                      </Box>
                    </CardContent>
                    <CardActions sx={{ p: 1.5, pt: 0, gap: 1 }}>
                      <Button fullWidth variant="contained"
                        startIcon={<ShoppingCartIcon />}
                        onClick={() => openBuyDialog(listing)}
                        disabled={listing.quantity <= 0}
                        size="small"
                        sx={{ background: 'linear-gradient(135deg, #E64A19, #FF7043)', borderRadius: 2, fontWeight: 700, boxShadow: '0 4px 12px rgba(230,74,25,0.3)', '&:hover': { boxShadow: '0 6px 16px rgba(230,74,25,0.4)' } }}>
                        Buy Now
                      </Button>
                      <Tooltip title="Place a bid">
                        <Button variant="outlined"
                          startIcon={<GavelIcon />}
                          onClick={() => openBidDialog(listing)}
                          sx={{ minWidth: 0, px: 1.5, borderRadius: 2, borderColor: 'rgba(230,81,0,0.4)', color: '#E65100', '&:hover': { bgcolor: 'rgba(230,81,0,0.06)' } }}
                          size="small">
                          Bid
                        </Button>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* ── My Orders ── */}
      {tab === 1 && (
        <Card sx={{ ...glassCard, overflow: 'hidden' }}>
          {orders.length === 0 ? (
            <Box textAlign="center" py={10}>
              <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(230,81,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                <ReceiptIcon sx={{ fontSize: 40, color: 'rgba(230,81,0,0.4)' }} />
              </Box>
              <Typography variant="h6" fontWeight={700} color="text.secondary">No orders yet</Typography>
              <Button variant="contained" sx={{ mt: 2, background: 'linear-gradient(135deg, #E64A19, #FF7043)', borderRadius: 2 }}
                onClick={() => setTab(0)}>Browse Produce</Button>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow sx={{ background: 'linear-gradient(135deg, rgba(230,81,0,0.06), rgba(255,112,67,0.03))' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#BF360C' }}>Order #</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#BF360C' }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#BF360C' }}>Farm</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#BF360C' }}>Qty</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#BF360C' }}>Total</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#BF360C' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#BF360C' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#BF360C' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map(order => (
                  <TableRow key={order.id} hover sx={{ '&:hover': { bgcolor: 'rgba(230,81,0,0.02)' } }}>
                    <TableCell>
                      <Typography fontWeight={700} color="#E65100">#{order.id}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar src={order.ProduceListing?.image_url} variant="rounded"
                          sx={{ width: 36, height: 36, bgcolor: 'rgba(230,81,0,0.1)', color: '#E65100', fontWeight: 700 }}>
                          {order.ProduceListing?.product_name?.[0]}
                        </Avatar>
                        <Typography fontWeight={600}>{order.ProduceListing?.product_name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {order.ProduceListing?.Farmer?.farm_name}
                      </Typography>
                    </TableCell>
                    <TableCell>{order.quantity} {order.ProduceListing?.unit}</TableCell>
                    <TableCell>
                      <Typography fontWeight={700} color="#1B5E20">
                        ₹{parseFloat(order.total_amount).toLocaleString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(order.created_at).toLocaleDateString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={order.delivery_status}
                        color={STATUS_COLORS[order.delivery_status] || 'default'}
                        size="small" sx={{ fontWeight: 600, borderRadius: 1.5 }} />
                    </TableCell>
                    <TableCell>
                      {order.delivery_status === 'DELIVERED' && !order.buyer_confirmed ? (
                        <Tooltip title="Confirm receipt and release payment to farmer">
                          <Button size="small" variant="contained" color="success"
                            startIcon={confirmingId === order.id ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
                            disabled={confirmingId === order.id}
                            onClick={() => handleConfirmDelivery(order.id)}
                            sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>
                            Confirm Delivery
                          </Button>
                        </Tooltip>
                      ) : order.buyer_confirmed ? (
                        <Chip icon={<PaymentIcon />} label="Payment Released" color="success"
                          size="small" variant="outlined" sx={{ fontWeight: 600, borderRadius: 1.5 }} />
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

      {/* ── My Bids ── */}
      {tab === 2 && (
        <Card sx={{ ...glassCard, overflow: 'hidden' }}>
          {bids.length === 0 ? (
            <Box textAlign="center" py={10}>
              <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(2,136,209,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                <GavelIcon sx={{ fontSize: 40, color: 'rgba(2,136,209,0.4)' }} />
              </Box>
              <Typography variant="h6" fontWeight={700} color="text.secondary">No bids placed yet</Typography>
              <Button variant="contained" sx={{ mt: 2, background: 'linear-gradient(135deg, #E64A19, #FF7043)', borderRadius: 2 }}
                onClick={() => setTab(0)}>Browse Produce</Button>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow sx={{ background: 'linear-gradient(135deg, rgba(230,81,0,0.06), rgba(255,112,67,0.03))' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#BF360C' }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#BF360C' }}>Farm</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#BF360C' }}>Listed Price</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#BF360C' }}>Your Bid</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#BF360C' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#BF360C' }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bids.map(bid => (
                  <TableRow key={bid.id} hover sx={{ '&:hover': { bgcolor: 'rgba(230,81,0,0.02)' } }}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar src={bid.ProduceListing?.image_url} variant="rounded"
                          sx={{ width: 36, height: 36, bgcolor: 'rgba(230,81,0,0.1)', color: '#E65100', fontWeight: 700 }}>
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
                      <Typography fontWeight={800} color="#E65100" fontSize={15}>
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
                        size="small" sx={{ fontWeight: 600, borderRadius: 1.5 }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* ── Buy Dialog ── */}
      <Dialog open={buyDialog} onClose={() => setBuyDialog(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          Confirm Purchase
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          {buyError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{buyError}</Alert>}
          {selectedListing && (
            <Box>
              <Box display="flex" alignItems="center" gap={2} mb={3} p={2}
                sx={{ bgcolor: 'rgba(0,0,0,0.03)', borderRadius: 2 }}>
                <Avatar src={getImage(selectedListing)} variant="rounded" sx={{ width: 60, height: 60, borderRadius: 2 }} />
                <Box>
                  <Typography fontWeight={700}>{selectedListing.product_name}</Typography>
                  <Typography variant="body2" color="text.secondary">{selectedListing.Farmer?.farm_name}</Typography>
                  <Typography variant="body2" color="#E65100" fontWeight={700}>
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
              <Box p={2} sx={{ background: 'linear-gradient(135deg, #E64A19, #FF7043)', borderRadius: 2, color: 'white' }}>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>Total Amount</Typography>
                <Typography variant="h5" fontWeight={800}>
                  ₹{(parseFloat(selectedListing.price) * buyQty).toLocaleString('en-IN')}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setBuyDialog(false)} disabled={buyLoading} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button variant="contained" onClick={handleBuy} disabled={buyLoading}
            startIcon={buyLoading ? <CircularProgress size={16} color="inherit" /> : <ShoppingCartIcon />}
            sx={{ background: 'linear-gradient(135deg, #E64A19, #FF7043)', borderRadius: 2, px: 3, fontWeight: 700 }}>
            Confirm Order
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Bid Dialog ── */}
      <Dialog open={bidDialog} onClose={() => setBidDialog(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          Place a Bid
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          {bidError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{bidError}</Alert>}
          {selectedListing && (
            <Box>
              <Box display="flex" alignItems="center" gap={2} mb={3} p={2}
                sx={{ bgcolor: 'rgba(0,0,0,0.03)', borderRadius: 2 }}>
                <Avatar src={getImage(selectedListing)} variant="rounded" sx={{ width: 60, height: 60, borderRadius: 2 }} />
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
          <Button onClick={() => setBidDialog(false)} disabled={bidLoading} sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button variant="contained" onClick={handleBid} disabled={bidLoading}
            startIcon={bidLoading ? <CircularProgress size={16} color="inherit" /> : <GavelIcon />}
            sx={{ background: 'linear-gradient(135deg, #0288D1, #039BE5)', borderRadius: 2, px: 3, fontWeight: 700 }}>
            Submit Bid
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BuyerDashboard;
