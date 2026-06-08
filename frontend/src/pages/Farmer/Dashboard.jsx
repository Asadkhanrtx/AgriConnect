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
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import GavelIcon from '@mui/icons-material/Gavel';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, BarChart, Bar
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

const glassCard = {
  background: 'rgba(255,255,255,0.88)',
  backdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.65)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
  borderRadius: 3,
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 14px 40px rgba(0,0,0,0.14)' },
};

const StatCard = ({ title, value, icon, color, subtitle, trend }) => (
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
            <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
              {subtitle}
            </Typography>
          )}
          {trend !== undefined && (
            <Box display="flex" alignItems="center" gap={0.5} mt={0.75}>
              <TrendingUpIcon sx={{ fontSize: 13, color: 'success.main' }} />
              <Typography variant="caption" color="success.main" fontWeight={700}>{trend}</Typography>
            </Box>
          )}
        </Box>
        <Box sx={{
          width: 52, height: 52, borderRadius: 2,
          background: color ? `${color}18` : 'rgba(46,125,50,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {React.cloneElement(icon, { sx: { color: color || '#2E7D32', fontSize: 26 } })}
        </Box>
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

  const totalEarnings = sales.reduce((acc, s) => acc + parseFloat(s.total_amount || 0), 0);
  const activeListings = listings.filter(l => l.status === 'ACTIVE').length;
  const pendingOrders = sales.filter(s => s.delivery_status === 'PENDING').length;
  const pendingBids = receivedBids.filter(b => b.status === 'PENDING').length;

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
      <CircularProgress sx={{ color: '#2E7D32' }} size={48} thickness={4} />
    </Box>
  );

  return (
    <Box>
      {/* ── Hero Banner ──────────────────────────────────────────────────────────── */}
      <Box sx={{
        background: 'linear-gradient(135deg, #0A2E0D 0%, #1B5E20 35%, #2E7D32 65%, #388E3C 100%)',
        borderRadius: 3,
        mb: 3,
        p: { xs: 3, md: 4 },
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* decorative circles */}
        <Box sx={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)' }} />
        <Box sx={{ position: 'absolute', right: 60, bottom: -80, width: 300, height: 300, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.03)' }} />
        <Box sx={{ position: 'absolute', left: -40, top: -40, width: 160, height: 160, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.03)' }} />

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
            <Box>
              <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                <AgricultureIcon sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 22 }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>
                  Farmer Portal
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={800} sx={{ color: 'white', lineHeight: 1.15, mb: 0.75 }}>
                Welcome back, {user?.first_name}!
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', maxWidth: 420 }}>
                Manage your produce, track orders, and respond to buyer bids — all in one place.
              </Typography>
              <Box display="flex" gap={1.5} mt={2} flexWrap="wrap">
                <Box sx={{
                  px: 2, py: 0.75, borderRadius: 2,
                  background: 'rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>Active Listings</Typography>
                  <Typography variant="h6" fontWeight={800} color="white">{activeListings}</Typography>
                </Box>
                <Box sx={{
                  px: 2, py: 0.75, borderRadius: 2,
                  background: 'rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>Pending Orders</Typography>
                  <Typography variant="h6" fontWeight={800} color="white">{pendingOrders}</Typography>
                </Box>
                {pendingBids > 0 && (
                  <Box sx={{
                    px: 2, py: 0.75, borderRadius: 2,
                    background: 'rgba(255,193,7,0.2)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,193,7,0.3)',
                  }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>New Bids</Typography>
                    <Typography variant="h6" fontWeight={800} color="#FFD54F">{pendingBids}</Typography>
                  </Box>
                )}
              </Box>
            </Box>

            <Box display="flex" flexDirection="column" gap={1.5} alignItems="flex-end">
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openCreateDialog}
                sx={{
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                  fontWeight: 700,
                  px: 3,
                  '&:hover': { background: 'rgba(255,255,255,0.25)' },
                  boxShadow: 'none',
                }}
              >
                New Listing
              </Button>
              <Box sx={{
                background: 'rgba(0,0,0,0.2)',
                backdropFilter: 'blur(12px)',
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.1)',
                overflow: 'hidden',
              }}>
                <WeatherWidget farmerLocation={user?.profile} compact />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Stat Cards ── */}
      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Earnings"
            value={`₹${totalEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            icon={<AttachMoneyIcon />}
            color="#1B5E20"
            subtitle="Lifetime revenue"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Listings"
            value={activeListings}
            icon={<InventoryIcon />}
            color="#0288D1"
            subtitle={`${listings.length} total listings`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Orders"
            value={sales.length}
            icon={<ShoppingBagIcon />}
            color="#6A1B9A"
            subtitle="All time"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending Bids"
            value={pendingBids}
            icon={<GavelIcon />}
            color={pendingBids > 0 ? '#E65100' : '#757575'}
            subtitle={`${pendingOrders} orders pending`}
          />
        </Grid>
      </Grid>

      {/* ── Earnings Chart ── */}
      {earningsChart.length > 0 && (
        <Card sx={{ ...glassCard, mb: 3, p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Typography variant="h6" fontWeight={800} color="text.primary">Revenue Trend</Typography>
              <Typography variant="caption" color="text.secondary">Monthly earnings over the last 6 months</Typography>
            </Box>
            <Chip
              label={`₹${totalEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })} total`}
              sx={{ bgcolor: 'rgba(46,125,50,0.1)', color: '#1B5E20', fontWeight: 700 }}
            />
          </Box>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={earningsChart}>
              <defs>
                <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2E7D32" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2E7D32" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#888' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#888' }} axisLine={false} tickLine={false}
                tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <ChartTooltip
                contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(46,125,50,0.2)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
                formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Earnings']}
              />
              <Area type="monotone" dataKey="earnings" stroke="#2E7D32" strokeWidth={2.5}
                fill="url(#earningsGrad)" dot={{ fill: '#2E7D32', r: 4, strokeWidth: 2, stroke: 'white' }}
                activeDot={{ r: 6, fill: '#1B5E20' }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Tabs ── */}
      <Box sx={{
        borderBottom: '2px solid rgba(0,0,0,0.06)', mb: 3,
        background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)',
        borderRadius: '12px 12px 0 0', px: 1,
      }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="primary" indicatorColor="primary"
          sx={{ '& .MuiTab-root': { fontWeight: 700, minHeight: 52 } }}>
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
        <Card sx={{ ...glassCard, overflow: 'hidden' }}>
          {listings.length === 0 ? (
            <Box textAlign="center" py={10}>
              <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(46,125,50,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                <InventoryIcon sx={{ fontSize: 40, color: 'rgba(46,125,50,0.4)' }} />
              </Box>
              <Typography variant="h6" fontWeight={700} color="text.secondary">No listings yet</Typography>
              <Typography variant="body2" color="text.disabled" mb={3}>
                Create your first produce listing to start selling
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}
                sx={{ background: 'linear-gradient(135deg, #2E7D32, #388E3C)', borderRadius: 2 }}>
                Create Listing
              </Button>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow sx={{ background: 'linear-gradient(135deg, rgba(27,94,32,0.06), rgba(46,125,50,0.04))' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Quantity</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Price</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Harvest Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#1B5E20' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listings.map(l => (
                  <TableRow key={l.id} hover sx={{ '&:hover': { bgcolor: 'rgba(46,125,50,0.03)' } }}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar src={l.image_url} variant="rounded"
                          sx={{ width: 44, height: 44, bgcolor: 'rgba(46,125,50,0.1)', color: '#2E7D32', fontWeight: 700, fontSize: 18 }}>
                          {l.product_name?.[0]}
                        </Avatar>
                        <Box>
                          <Typography fontWeight={700}>{l.product_name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {l.description?.slice(0, 50)}{l.description?.length > 50 ? '…' : ''}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={l.category} size="small" color="primary" variant="outlined"
                        sx={{ fontWeight: 600, borderRadius: 1.5 }} />
                    </TableCell>
                    <TableCell><Typography fontWeight={500}>{l.quantity} {l.unit}</Typography></TableCell>
                    <TableCell>
                      <Typography fontWeight={700} color="#1B5E20">
                        ₹{parseFloat(l.price).toFixed(2)}/{l.unit}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {l.harvest_date ? new Date(l.harvest_date).toLocaleDateString('en-IN') : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={l.status} size="small"
                        color={l.status === 'ACTIVE' ? 'success' : 'default'}
                        sx={{ fontWeight: 600, borderRadius: 1.5 }} />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEditDialog(l)}
                          sx={{ color: '#0288D1', '&:hover': { bgcolor: 'rgba(2,136,209,0.08)' } }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDelete(l.id)}
                          sx={{ color: '#D32F2F', '&:hover': { bgcolor: 'rgba(211,47,47,0.08)' } }}>
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
        <Card sx={{ ...glassCard, overflow: 'hidden' }}>
          {sales.length === 0 ? (
            <Box textAlign="center" py={10}>
              <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(106,27,154,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                <ShoppingBagIcon sx={{ fontSize: 40, color: 'rgba(106,27,154,0.4)' }} />
              </Box>
              <Typography variant="h6" fontWeight={700} color="text.secondary">No orders yet</Typography>
              <Typography variant="body2" color="text.disabled">
                Orders will appear here once buyers purchase your produce
              </Typography>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow sx={{ background: 'linear-gradient(135deg, rgba(27,94,32,0.06), rgba(46,125,50,0.04))' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Order #</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Buyer</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Qty</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#1B5E20' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sales.map(sale => (
                  <TableRow key={sale.id} hover sx={{ '&:hover': { bgcolor: 'rgba(46,125,50,0.03)' } }}>
                    <TableCell>
                      <Typography fontWeight={700} color="primary">#{sale.id}</Typography>
                    </TableCell>
                    <TableCell>{sale.ProduceListing?.product_name}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{sale.Buyer?.company_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{sale.Buyer?.User?.email}</Typography>
                    </TableCell>
                    <TableCell>{sale.quantity} {sale.ProduceListing?.unit}</TableCell>
                    <TableCell>
                      <Typography fontWeight={700} color="#1B5E20">
                        ₹{parseFloat(sale.total_amount).toLocaleString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(sale.created_at).toLocaleDateString('en-IN')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={sale.delivery_status}
                        color={STATUS_COLORS[sale.delivery_status] || 'default'}
                        size="small" sx={{ fontWeight: 600, borderRadius: 1.5 }} />
                    </TableCell>
                    <TableCell align="right">
                      {statusUpdating === sale.id ? <CircularProgress size={20} /> : (
                        <Box display="flex" gap={0.5} justifyContent="flex-end">
                          {sale.delivery_status === 'PENDING' && (
                            <Button size="small" variant="outlined" color="info"
                              onClick={() => handleStatusUpdate(sale.id, 'IN_TRANSIT')}
                              sx={{ borderRadius: 1.5, fontWeight: 600, fontSize: 11 }}>
                              Ship
                            </Button>
                          )}
                          {sale.delivery_status === 'IN_TRANSIT' && (
                            <Button size="small" variant="outlined" color="success"
                              onClick={() => handleStatusUpdate(sale.id, 'DELIVERED')}
                              sx={{ borderRadius: 1.5, fontWeight: 600, fontSize: 11 }}>
                              Delivered
                            </Button>
                          )}
                          {sale.delivery_status === 'DELIVERED' && (
                            <Chip label="Completed" size="small" color="success" variant="outlined"
                              sx={{ fontWeight: 600, borderRadius: 1.5 }} />
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
        <Card sx={{ ...glassCard, overflow: 'hidden' }}>
          {receivedBids.length === 0 ? (
            <Box textAlign="center" py={10}>
              <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(230,81,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                <GavelIcon sx={{ fontSize: 40, color: 'rgba(230,81,0,0.4)' }} />
              </Box>
              <Typography variant="h6" fontWeight={700} color="text.secondary">No bids received yet</Typography>
              <Typography variant="body2" color="text.disabled">
                Buyers can bid on your active listings
              </Typography>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow sx={{ background: 'linear-gradient(135deg, rgba(27,94,32,0.06), rgba(46,125,50,0.04))' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Listed Price</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Buyer</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Bid Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1B5E20' }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: '#1B5E20' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {receivedBids.map(bid => (
                  <TableRow key={bid.id} hover sx={{ '&:hover': { bgcolor: 'rgba(46,125,50,0.03)' } }}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar src={bid.ProduceListing?.image_url} variant="rounded"
                          sx={{ width: 36, height: 36, bgcolor: 'rgba(46,125,50,0.1)', color: '#2E7D32', fontWeight: 700 }}>
                          {bid.ProduceListing?.product_name?.[0]}
                        </Avatar>
                        <Typography fontWeight={700}>{bid.ProduceListing?.product_name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography color="text.secondary">
                        ₹{bid.ProduceListing?.price}/{bid.ProduceListing?.unit}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{bid.Buyer?.company_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {bid.Buyer?.User?.first_name} {bid.Buyer?.User?.last_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={800} color="#1B5E20" fontSize={15}>
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
                    <TableCell align="right">
                      {bidUpdating === bid.id ? <CircularProgress size={20} /> : (
                        bid.status === 'PENDING' && (
                          <Box display="flex" gap={0.5}>
                            <Tooltip title="Accept bid">
                              <IconButton size="small" onClick={() => handleBidAction(bid.id, 'accept')}
                                sx={{ bgcolor: 'rgba(46,125,50,0.08)', color: '#2E7D32', '&:hover': { bgcolor: 'rgba(46,125,50,0.16)' } }}>
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject bid">
                              <IconButton size="small" onClick={() => handleBidAction(bid.id, 'reject')}
                                sx={{ bgcolor: 'rgba(211,47,47,0.08)', color: '#D32F2F', '&:hover': { bgcolor: 'rgba(211,47,47,0.16)' } }}>
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{
          pb: 2, borderBottom: '1px solid rgba(0,0,0,0.06)',
          background: 'linear-gradient(135deg, rgba(27,94,32,0.05), rgba(46,125,50,0.03))',
          fontWeight: 800
        }}>
          {editListing ? 'Edit Listing' : 'Create New Listing'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {formError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{formError}</Alert>}
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
                fullWidth sx={{ py: 1.5, borderStyle: 'dashed', borderRadius: 2 }}>
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
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={formLoading}
            sx={{ borderRadius: 2 }}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={formLoading}
            sx={{ background: 'linear-gradient(135deg, #2E7D32, #388E3C)', borderRadius: 2, px: 3 }}>
            {formLoading ? <CircularProgress size={20} color="inherit" /> : (editListing ? 'Save Changes' : 'Create Listing')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FarmerDashboard;
