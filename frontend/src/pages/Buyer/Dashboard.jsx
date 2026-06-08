import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid, Card, CardContent, CardMedia, CardActions, Typography, Box, Button,
  TextField, InputAdornment, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Tabs, Tab, Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress, Alert, MenuItem, Select, FormControl, InputLabel,
  IconButton, Tooltip, Avatar, Badge, LinearProgress, Snackbar
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

const StatCard = ({ title, value, icon, color, subtitle }) => (
  <Card className="hover-lift" sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="body2" color="textSecondary" gutterBottom>{title}</Typography>
          <Typography variant="h5" fontWeight="bold" color={color || 'text.primary'}>{value}</Typography>
          {subtitle && <Typography variant="caption" color="textSecondary">{subtitle}</Typography>}
        </Box>
        <Avatar sx={{ bgcolor: `${color || 'primary'}.light` || '#E8F5E9', color: color || 'primary.main', width: 48, height: 48 }}>
          {icon}
        </Avatar>
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
      <CircularProgress color="primary" />
    </Box>
  );

  const totalSpent = orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
  const activeOrders = orders.filter(o => o.delivery_status !== 'DELIVERED').length;
  const pendingBids = bids.filter(b => b.status === 'PENDING').length;
  const acceptedBids = bids.filter(b => b.status === 'ACCEPTED').length;

  return (
    <Box>
      {/* ── Header ── */}
      <Box mb={3}>
        <Typography variant="h4" fontWeight="bold" color="primary">Buyer Dashboard</Typography>
        <Typography variant="body2" color="textSecondary">
          Welcome, {user?.first_name}! Browse fresh produce from verified Indian farmers.
        </Typography>
      </Box>

      {/* ── Stats ── */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={6} sm={3}>
          <StatCard title="Total Spent" value={`₹${totalSpent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            icon={<AttachMoneyIcon />} color="success.main" subtitle="Lifetime" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Active Orders" value={activeOrders}
            icon={<LocalShippingIcon />} color="warning.main" subtitle={`${orders.length} total`} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Pending Bids" value={pendingBids}
            icon={<GavelIcon />} color="info.main" subtitle={`${acceptedBids} accepted`} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard title="Available Products" value={listings.length}
            icon={<StoreIcon />} subtitle="Fresh listings" />
        </Grid>
      </Grid>

      {/* ── Tabs ── */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="primary" indicatorColor="primary">
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
          <Box display="flex" gap={2} mb={3} flexWrap="wrap">
            <TextField
              placeholder="Search produce, farm, location..."
              value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
              sx={{ flexGrow: 1, maxWidth: 440 }} size="small"
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Category</InputLabel>
              <Select value={categoryFilter} label="Category" onChange={e => setCategoryFilter(e.target.value)}>
                <MenuItem value="">All Categories</MenuItem>
                {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            {categoryFilter && (
              <Button size="small" variant="text" onClick={() => setCategoryFilter('')}>Clear</Button>
            )}
          </Box>

          {listings.length === 0 ? (
            <Box textAlign="center" py={8}>
              <StoreIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">No listings found</Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {listings.map(listing => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={listing.id}>
                  <Card className="hover-lift" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ position: 'relative' }}>
                      <CardMedia component="img" height="180" image={getImage(listing)}
                        alt={listing.product_name} sx={{ objectFit: 'cover' }} />
                      <Chip label={listing.category} size="small" color="primary"
                        sx={{ position: 'absolute', top: 10, right: 10, fontWeight: 600 }} />
                    </Box>
                    <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                      <Typography variant="h6" fontWeight="bold" mb={0.5}>
                        {listing.product_name}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                        <AgricultureIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="textSecondary">
                          {listing.Farmer?.farm_name}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.5} mb={1.5}>
                        <LocationOnIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="textSecondary">
                          {listing.Farmer?.location}
                        </Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-end">
                        <Box>
                          <Typography variant="h5" color="primary" fontWeight="bold" lineHeight={1}>
                            ₹{parseFloat(listing.price).toFixed(0)}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">per {listing.unit}</Typography>
                        </Box>
                        <Chip label={`${listing.quantity} ${listing.unit}`} size="small"
                          variant="outlined" color="success" />
                      </Box>
                    </CardContent>
                    <CardActions sx={{ p: 1.5, pt: 0, gap: 1 }}>
                      <Button fullWidth variant="contained" color="primary"
                        startIcon={<ShoppingCartIcon />} onClick={() => openBuyDialog(listing)}
                        disabled={listing.quantity <= 0} size="small">
                        Buy Now
                      </Button>
                      <Tooltip title="Place a bid">
                        <Button variant="outlined" color="secondary"
                          startIcon={<GavelIcon />} onClick={() => openBidDialog(listing)}
                          sx={{ minWidth: 0, px: 1.5 }} size="small">
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
        <Card>
          {orders.length === 0 ? (
            <Box textAlign="center" py={8}>
              <ReceiptIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">No orders yet</Typography>
              <Button variant="contained" sx={{ mt: 2 }} onClick={() => setTab(0)}>Browse Produce</Button>
            </Box>
          ) : (
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(46,125,50,0.06)' }}>
                <TableRow>
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
                  <TableRow key={order.id} hover>
                    <TableCell><Typography fontWeight={600} color="primary">#{order.id}</Typography></TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar src={order.ProduceListing?.image_url} variant="rounded"
                          sx={{ width: 36, height: 36, bgcolor: 'primary.light' }}>
                          {order.ProduceListing?.product_name?.[0]}
                        </Avatar>
                        {order.ProduceListing?.product_name}
                      </Box>
                    </TableCell>
                    <TableCell>{order.ProduceListing?.Farmer?.farm_name}</TableCell>
                    <TableCell>{order.quantity} {order.ProduceListing?.unit}</TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>
                        ₹{parseFloat(order.total_amount).toLocaleString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {new Date(order.created_at).toLocaleDateString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={order.delivery_status}
                        color={STATUS_COLORS[order.delivery_status] || 'default'}
                        size="small" icon={<LocalShippingIcon />} />
                    </TableCell>
                    <TableCell>
                      {order.delivery_status === 'DELIVERED' && !order.buyer_confirmed ? (
                        <Tooltip title="Confirm receipt and release payment to farmer">
                          <Button
                            size="small" variant="contained" color="success"
                            startIcon={confirmingId === order.id ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
                            disabled={confirmingId === order.id}
                            onClick={() => handleConfirmDelivery(order.id)}
                            sx={{ whiteSpace: 'nowrap', fontSize: 11 }}
                          >
                            Confirm Delivery
                          </Button>
                        </Tooltip>
                      ) : order.buyer_confirmed ? (
                        <Chip icon={<PaymentIcon />} label="Payment Released" color="success" size="small" variant="outlined" />
                      ) : (
                        <Typography variant="caption" color="textDisabled">—</Typography>
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
        <Card>
          {bids.length === 0 ? (
            <Box textAlign="center" py={8}>
              <GavelIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">No bids placed yet</Typography>
              <Button variant="contained" sx={{ mt: 2 }} onClick={() => setTab(0)}>Browse Produce</Button>
            </Box>
          ) : (
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(46,125,50,0.06)' }}>
                <TableRow>
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
                  <TableRow key={bid.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar src={bid.ProduceListing?.image_url} variant="rounded"
                          sx={{ width: 36, height: 36, bgcolor: 'primary.light' }}>
                          {bid.ProduceListing?.product_name?.[0]}
                        </Avatar>
                        {bid.ProduceListing?.product_name}
                      </Box>
                    </TableCell>
                    <TableCell>{bid.ProduceListing?.Farmer?.farm_name}</TableCell>
                    <TableCell>
                      <Typography color="textSecondary">
                        ₹{bid.ProduceListing?.price}/{bid.ProduceListing?.unit}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={700} color="primary.dark">
                        ₹{parseFloat(bid.amount).toLocaleString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {new Date(bid.created_at).toLocaleDateString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={bid.status} color={BID_COLORS[bid.status] || 'default'} size="small" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* ── Buy Dialog ── */}
      <Dialog open={buyDialog} onClose={() => setBuyDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Purchase</DialogTitle>
        <DialogContent>
          {buyError && <Alert severity="error" sx={{ mb: 2 }}>{buyError}</Alert>}
          {selectedListing && (
            <Box>
              <Box display="flex" alignItems="center" gap={2} mb={3} p={2}
                bgcolor="background.default" borderRadius={2}>
                <Avatar src={getImage(selectedListing)} variant="rounded" sx={{ width: 60, height: 60 }} />
                <Box>
                  <Typography fontWeight={700}>{selectedListing.product_name}</Typography>
                  <Typography variant="body2" color="textSecondary">{selectedListing.Farmer?.farm_name}</Typography>
                  <Typography variant="body2" color="primary" fontWeight={600}>
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
              <Box p={2} bgcolor="primary.main" borderRadius={2} color="white">
                <Typography variant="body2" sx={{ opacity: 0.85 }}>Total Amount</Typography>
                <Typography variant="h5" fontWeight="bold">
                  ₹{(parseFloat(selectedListing.price) * buyQty).toLocaleString('en-IN')}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBuyDialog(false)} disabled={buyLoading}>Cancel</Button>
          <Button variant="contained" onClick={handleBuy} disabled={buyLoading}
            startIcon={buyLoading ? <CircularProgress size={16} /> : <ShoppingCartIcon />}>
            Confirm Order
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Bid Dialog ── */}
      <Dialog open={bidDialog} onClose={() => setBidDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Place a Bid</DialogTitle>
        <DialogContent>
          {bidError && <Alert severity="error" sx={{ mb: 2 }}>{bidError}</Alert>}
          {selectedListing && (
            <Box>
              <Box display="flex" alignItems="center" gap={2} mb={3} p={2}
                bgcolor="background.default" borderRadius={2}>
                <Avatar src={getImage(selectedListing)} variant="rounded" sx={{ width: 60, height: 60 }} />
                <Box>
                  <Typography fontWeight={700}>{selectedListing.product_name}</Typography>
                  <Typography variant="body2" color="textSecondary">
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
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBidDialog(false)} disabled={bidLoading}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={handleBid} disabled={bidLoading}
            startIcon={bidLoading ? <CircularProgress size={16} /> : <GavelIcon />}>
            Submit Bid
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BuyerDashboard;
