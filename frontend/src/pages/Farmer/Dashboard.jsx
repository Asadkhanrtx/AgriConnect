import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Button, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Select, FormControl, InputLabel,
  IconButton, Alert, Tabs, Tab, CircularProgress, Tooltip, Avatar, Divider
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import InventoryIcon from '@mui/icons-material/Inventory';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import PendingIcon from '@mui/icons-material/Pending';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import GavelIcon from '@mui/icons-material/Gavel';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer
} from 'recharts';
import axios from 'axios';
import WeatherWidget from '../../components/WeatherWidget';

const STATUS_COLORS = { PENDING: 'warning', IN_TRANSIT: 'info', DELIVERED: 'success' };
const BID_COLORS = { PENDING: 'warning', ACCEPTED: 'success', REJECTED: 'error' };

const CATEGORIES = [
  'Rice', 'Wheat', 'Tomatoes', 'Potatoes', 'Onion',
  'Mangoes', 'Bananas', 'Corn', 'Soybean', 'Cotton',
  'Sugarcane', 'Apple', 'Vegetables', 'Pulses', 'Spices', 'Other'
];
const UNITS = ['kg', 'tonnes', 'crates', 'boxes', 'bags', 'quintals'];

const StatCard = ({ title, value, icon, gradient, subtitle, trend }) => (
  <Card className="hover-lift" sx={{
    height: '100%',
    background: gradient || 'white',
    color: gradient ? 'white' : 'inherit',
    position: 'relative', overflow: 'hidden',
  }}>
    {gradient && (
      <Box sx={{
        position: 'absolute', right: -20, top: -20,
        width: 100, height: 100, borderRadius: '50%',
        bgcolor: 'rgba(255,255,255,0.08)'
      }} />
    )}
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="body2" sx={{ opacity: gradient ? 0.8 : 1 }} color={!gradient ? 'text.secondary' : 'inherit'} gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold" lineHeight={1} mb={0.5}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ opacity: 0.75 }} color={!gradient ? 'text.secondary' : 'inherit'}>
              {subtitle}
            </Typography>
          )}
          {trend !== undefined && (
            <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
              <TrendingUpIcon sx={{ fontSize: 14, color: gradient ? 'rgba(255,255,255,0.8)' : 'success.main' }} />
              <Typography variant="caption" color={gradient ? 'rgba(255,255,255,0.8)' : 'success.main'} fontWeight={600}>
                {trend}
              </Typography>
            </Box>
          )}
        </Box>
        <Avatar sx={{
          bgcolor: gradient ? 'rgba(255,255,255,0.2)' : 'primary.light',
          color: gradient ? 'white' : 'primary.main',
          width: 52, height: 52
        }}>
          {icon}
        </Avatar>
      </Box>
    </CardContent>
  </Card>
);

const emptyForm = {
  product_name: '', category: '', quantity: '', unit: 'kg',
  price: '', harvest_date: '', description: '', image_url: ''
};

const FarmerDashboard = ({ user }) => {
  const [tab, setTab] = useState(0);
  const [sales, setSales] = useState([]);
  const [listings, setListings] = useState([]);
  const [receivedBids, setReceivedBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editListing, setEditListing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [bidUpdating, setBidUpdating] = useState(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [salesRes, listingsRes, bidsRes] = await Promise.all([
        axios.get('/api/orders/sales', { headers }),
        axios.get('/api/marketplace/my-listings', { headers }),
        axios.get('/api/marketplace/farmer-bids', { headers }).catch(() => ({ data: [] }))
      ]);
      setSales(salesRes.data);
      setListings(listingsRes.data);
      setReceivedBids(bidsRes.data);
    } catch (err) {
      console.error('Error fetching dashboard data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreateDialog = () => {
    setEditListing(null); setForm(emptyForm);
    setImageFile(null); setImagePreview(''); setFormError(''); setDialogOpen(true);
  };

  const openEditDialog = (listing) => {
    setEditListing(listing);
    setForm({
      product_name: listing.product_name, category: listing.category,
      quantity: listing.quantity, unit: listing.unit, price: listing.price,
      harvest_date: listing.harvest_date ? listing.harvest_date.slice(0, 10) : '',
      description: listing.description || '', image_url: listing.image_url || ''
    });
    setImagePreview(listing.image_url || '');
    setImageFile(null); setFormError(''); setDialogOpen(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const handleSubmit = async () => {
    setFormError('');
    if (!form.product_name || !form.category || !form.quantity || !form.price) {
      setFormError('Product name, category, quantity, and price are required.'); return;
    }
    setFormLoading(true);
    try {
      let image_url = form.image_url;
      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        const imgRes = await axios.post('/api/media/upload/produce', fd, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' }
        });
        image_url = imgRes.data.imageUrl;
      }
      const payload = { ...form, image_url, quantity: parseFloat(form.quantity), price: parseFloat(form.price) };
      if (editListing) {
        await axios.put(`/api/marketplace/listings/${editListing.id}`, payload, { headers });
      } else {
        await axios.post('/api/marketplace/listings', payload, { headers });
      }
      setDialogOpen(false); fetchData();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save listing');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this listing?')) return;
    try {
      await axios.delete(`/api/marketplace/listings/${id}`, { headers }); fetchData();
    } catch (err) { alert(err.response?.data?.error || 'Failed to remove listing'); }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    setStatusUpdating(orderId);
    try {
      await axios.put(`/api/orders/${orderId}/status`, { delivery_status: newStatus }, { headers });
      setSales(prev => prev.map(s => s.id === orderId ? { ...s, delivery_status: newStatus } : s));
    } catch { alert('Failed to update status'); }
    finally { setStatusUpdating(null); }
  };

  const handleBidAction = async (bidId, action) => {
    setBidUpdating(bidId);
    try {
      await axios.put(`/api/marketplace/bids/${bidId}/${action}`, {}, { headers });
      fetchData();
    } catch { alert(`Failed to ${action} bid`); }
    finally { setBidUpdating(null); }
  };

  // Derived stats
  const totalEarnings = sales.reduce((acc, s) => acc + parseFloat(s.total_amount || 0), 0);
  const activeListings = listings.filter(l => l.status === 'ACTIVE').length;
  const pendingOrders = sales.filter(s => s.delivery_status === 'PENDING').length;
  const pendingBids = receivedBids.filter(b => b.status === 'PENDING').length;

  // Earnings chart: group sales by month (last 6)
  const earningsChart = (() => {
    const map = {};
    sales.forEach(s => {
      const d = new Date(s.created_at);
      const key = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      map[key] = (map[key] || 0) + parseFloat(s.total_amount || 0);
    });
    return Object.entries(map).slice(-6).map(([month, earnings]) => ({ month, earnings: +earnings.toFixed(0) }));
  })();

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <CircularProgress color="primary" />
    </Box>
  );

  return (
    <Box>
      {/* ── Header ── */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            Farmer Dashboard
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Welcome back, {user?.first_name}! Here's your farm overview.
          </Typography>
        </Box>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <WeatherWidget farmerLocation={user?.profile} />
          <Button variant="contained" color="primary" startIcon={<AddIcon />}
            onClick={openCreateDialog} size="large"
            sx={{ background: 'linear-gradient(135deg, #2E7D32, #388E3C)', height: 'fit-content', alignSelf: 'flex-end' }}>
            New Listing
          </Button>
        </Box>
      </Box>

      {/* ── Stats ── */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Earnings"
            value={`₹${totalEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            icon={<AttachMoneyIcon />}
            gradient="linear-gradient(135deg, #1B5E20, #2E7D32)"
            subtitle="Lifetime revenue"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Listings"
            value={activeListings}
            icon={<InventoryIcon />}
            subtitle={`${listings.length} total`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Orders"
            value={sales.length}
            icon={<ShoppingBagIcon />}
            subtitle="All time"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending Bids"
            value={pendingBids}
            icon={<GavelIcon />}
            subtitle={`${pendingOrders} pending orders`}
          />
        </Grid>
      </Grid>

      {/* ── Earnings Chart ── */}
      {earningsChart.length > 0 && (
        <Card sx={{ mb: 3, p: 3 }}>
          <Typography variant="h6" fontWeight="bold" mb={2}>Earnings Trend</Typography>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={earningsChart}>
              <defs>
                <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2E7D32" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2E7D32" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <ChartTooltip formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Earnings']} />
              <Area type="monotone" dataKey="earnings" stroke="#2E7D32" strokeWidth={2.5}
                fill="url(#earningsGrad)" dot={{ fill: '#2E7D32', r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Tabs ── */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="primary" indicatorColor="primary">
          <Tab label={`My Listings (${listings.length})`} icon={<InventoryIcon fontSize="small" />} iconPosition="start" />
          <Tab label={`Orders & Sales (${sales.length})`} icon={<ShoppingBagIcon fontSize="small" />} iconPosition="start" />
          <Tab
            label={
              <Box display="flex" alignItems="center" gap={0.5}>
                Received Bids
                {pendingBids > 0 && (
                  <Chip label={pendingBids} size="small" color="warning"
                    sx={{ height: 18, fontSize: 10, ml: 0.5 }} />
                )}
              </Box>
            }
            icon={<GavelIcon fontSize="small" />} iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* ── My Listings ── */}
      {tab === 0 && (
        <Card>
          {listings.length === 0 ? (
            <Box textAlign="center" py={8}>
              <InventoryIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">No listings yet</Typography>
              <Typography variant="body2" color="textSecondary" mb={3}>
                Create your first produce listing to start selling
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
                Create Listing
              </Button>
            </Box>
          ) : (
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(46,125,50,0.06)' }}>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Harvest Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listings.map(l => (
                  <TableRow key={l.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar src={l.image_url} variant="rounded"
                          sx={{ width: 44, height: 44, bgcolor: 'primary.light' }}>
                          {l.product_name?.[0]}
                        </Avatar>
                        <Box>
                          <Typography fontWeight={600}>{l.product_name}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {l.description?.slice(0, 50)}{l.description?.length > 50 ? '…' : ''}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={l.category} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>{l.quantity} {l.unit}</TableCell>
                    <TableCell>
                      <Typography fontWeight={600} color="primary">
                        ₹{parseFloat(l.price).toFixed(2)}/{l.unit}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {l.harvest_date
                        ? new Date(l.harvest_date).toLocaleDateString('en-IN')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip label={l.status} size="small"
                        color={l.status === 'ACTIVE' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" color="primary" onClick={() => openEditDialog(l)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(l.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* ── Orders & Sales ── */}
      {tab === 1 && (
        <Card>
          {sales.length === 0 ? (
            <Box textAlign="center" py={8}>
              <ShoppingBagIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">No orders yet</Typography>
              <Typography variant="body2" color="textSecondary">
                Orders will appear here once buyers purchase your produce
              </Typography>
            </Box>
          ) : (
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(46,125,50,0.06)' }}>
                <TableRow>
                  <TableCell>Order #</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Buyer</TableCell>
                  <TableCell>Qty</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sales.map(sale => (
                  <TableRow key={sale.id} hover>
                    <TableCell>
                      <Typography fontWeight={600} color="primary">#{sale.id}</Typography>
                    </TableCell>
                    <TableCell>{sale.ProduceListing?.product_name}</TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {sale.Buyer?.company_name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {sale.Buyer?.User?.email}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{sale.quantity} {sale.ProduceListing?.unit}</TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>
                        ₹{parseFloat(sale.total_amount).toLocaleString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {new Date(sale.created_at).toLocaleDateString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={sale.delivery_status}
                        color={STATUS_COLORS[sale.delivery_status] || 'default'}
                        size="small" icon={<LocalShippingIcon />} />
                    </TableCell>
                    <TableCell align="right">
                      {statusUpdating === sale.id ? <CircularProgress size={20} /> : (
                        <Box display="flex" gap={0.5} justifyContent="flex-end">
                          {sale.delivery_status === 'PENDING' && (
                            <Button size="small" variant="outlined" color="info"
                              onClick={() => handleStatusUpdate(sale.id, 'IN_TRANSIT')}>
                              Ship
                            </Button>
                          )}
                          {sale.delivery_status === 'IN_TRANSIT' && (
                            <Button size="small" variant="outlined" color="success"
                              onClick={() => handleStatusUpdate(sale.id, 'DELIVERED')}>
                              Delivered
                            </Button>
                          )}
                          {sale.delivery_status === 'DELIVERED' && (
                            <Chip label="Completed" size="small" color="success" variant="outlined" />
                          )}
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* ── Received Bids ── */}
      {tab === 2 && (
        <Card>
          {receivedBids.length === 0 ? (
            <Box textAlign="center" py={8}>
              <GavelIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">No bids received yet</Typography>
              <Typography variant="body2" color="textSecondary">
                Buyers can bid on your active listings
              </Typography>
            </Box>
          ) : (
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(46,125,50,0.06)' }}>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Listed Price</TableCell>
                  <TableCell>Buyer</TableCell>
                  <TableCell>Bid Amount</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {receivedBids.map(bid => (
                  <TableRow key={bid.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar src={bid.ProduceListing?.image_url} variant="rounded"
                          sx={{ width: 36, height: 36, bgcolor: 'primary.light' }}>
                          {bid.ProduceListing?.product_name?.[0]}
                        </Avatar>
                        <Typography fontWeight={600}>{bid.ProduceListing?.product_name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell color="textSecondary">
                      ₹{bid.ProduceListing?.price}/{bid.ProduceListing?.unit}
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {bid.Buyer?.company_name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {bid.Buyer?.User?.first_name} {bid.Buyer?.User?.last_name}
                        </Typography>
                      </Box>
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
                      <Chip label={bid.status}
                        color={BID_COLORS[bid.status] || 'default'} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      {bidUpdating === bid.id ? <CircularProgress size={20} /> : (
                        bid.status === 'PENDING' && (
                          <Box display="flex" gap={0.5}>
                            <Tooltip title="Accept bid">
                              <IconButton size="small" color="success"
                                onClick={() => handleBidAction(bid.id, 'accept')}>
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject bid">
                              <IconButton size="small" color="error"
                                onClick={() => handleBidAction(bid.id, 'reject')}>
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          {editListing ? 'Edit Listing' : 'Create New Listing'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <TextField fullWidth label="Product Name" required
                value={form.product_name}
                onChange={e => setForm({ ...form, product_name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth required>
                <InputLabel>Category</InputLabel>
                <Select value={form.category} label="Category"
                  onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Quantity" type="number" required
                value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Unit</InputLabel>
                <Select value={form.unit} label="Unit"
                  onChange={e => setForm({ ...form, unit: e.target.value })}>
                  {UNITS.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Price per unit (₹)" type="number" required
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Harvest Date" type="date"
                InputLabelProps={{ shrink: true }}
                value={form.harvest_date}
                onChange={e => setForm({ ...form, harvest_date: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Description" multiline rows={2}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />}
                fullWidth sx={{ py: 1.5, borderStyle: 'dashed' }}>
                {imageFile ? imageFile.name : 'Upload Produce Image'}
                <input type="file" hidden accept="image/*" onChange={handleImageChange} />
              </Button>
              {imagePreview && (
                <Box mt={1} borderRadius={2} overflow="hidden" height={120}>
                  <img src={imagePreview} alt="preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={formLoading}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={formLoading}>
            {formLoading ? <CircularProgress size={20} /> : (editListing ? 'Save Changes' : 'Create Listing')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FarmerDashboard;
