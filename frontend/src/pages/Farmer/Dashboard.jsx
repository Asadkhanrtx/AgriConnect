import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Button, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Select, FormControl, InputLabel,
  IconButton, Alert, Tabs, Tab, CircularProgress, Tooltip, Avatar,
  LinearProgress
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
import axios from 'axios';

const STATUS_COLORS = { PENDING: 'warning', IN_TRANSIT: 'info', DELIVERED: 'success' };
const CATEGORIES = ['Rice', 'Wheat', 'Tomatoes', 'Potatoes', 'Onion', 'Mangoes', 'Bananas', 'Other'];
const UNITS = ['kg', 'tonnes', 'crates', 'boxes', 'bags'];

const StatCard = ({ title, value, icon, color, subtitle }) => (
  <Card className="hover-lift" sx={{ height: '100%', background: color || 'white' }}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="body2" color={color ? 'rgba(255,255,255,0.8)' : 'textSecondary'} gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold" color={color ? 'white' : 'textPrimary'}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color={color ? 'rgba(255,255,255,0.7)' : 'textSecondary'}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Avatar sx={{ bgcolor: color ? 'rgba(255,255,255,0.2)' : 'primary.light', color: color ? 'white' : 'primary.main', width: 48, height: 48 }}>
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
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editListing, setEditListing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [salesRes, listingsRes] = await Promise.all([
        axios.get('/api/orders/sales', { headers }),
        axios.get('/api/marketplace/my-listings', { headers })
      ]);
      setSales(salesRes.data);
      setListings(listingsRes.data);
    } catch (err) {
      console.error('Error fetching dashboard data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreateDialog = () => {
    setEditListing(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview('');
    setFormError('');
    setDialogOpen(true);
  };

  const openEditDialog = (listing) => {
    setEditListing(listing);
    setForm({
      product_name: listing.product_name,
      category: listing.category,
      quantity: listing.quantity,
      unit: listing.unit,
      price: listing.price,
      harvest_date: listing.harvest_date ? listing.harvest_date.slice(0, 10) : '',
      description: listing.description || '',
      image_url: listing.image_url || ''
    });
    setImagePreview(listing.image_url || '');
    setImageFile(null);
    setFormError('');
    setDialogOpen(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    setFormError('');
    if (!form.product_name || !form.category || !form.quantity || !form.price) {
      setFormError('Product name, category, quantity, and price are required.');
      return;
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

      setDialogOpen(false);
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save listing');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this listing?')) return;
    try {
      await axios.delete(`/api/marketplace/listings/${id}`, { headers });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove listing');
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    setStatusUpdating(orderId);
    try {
      await axios.put(`/api/orders/${orderId}/status`, { delivery_status: newStatus }, { headers });
      setSales(prev => prev.map(s => s.id === orderId ? { ...s, delivery_status: newStatus } : s));
    } catch (err) {
      alert('Failed to update status');
    } finally {
      setStatusUpdating(null);
    }
  };

  const totalEarnings = sales.reduce((acc, s) => acc + parseFloat(s.total_amount || 0), 0);
  const activeListings = listings.filter(l => l.status === 'ACTIVE').length;
  const pendingOrders = sales.filter(s => s.delivery_status === 'PENDING').length;

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <CircularProgress color="primary" />
    </Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">Farmer Dashboard</Typography>
          <Typography variant="body2" color="textSecondary">Welcome back, {user?.first_name}! Manage your farm produce.</Typography>
        </Box>
        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={openCreateDialog} size="large">
          New Listing
        </Button>
      </Box>

      {/* Stats */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Earnings"
            value={`$${totalEarnings.toFixed(2)}`}
            icon={<AttachMoneyIcon />}
            color="linear-gradient(135deg, #2E7D32, #388E3C)"
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
            title="Pending Orders"
            value={pendingOrders}
            icon={<PendingIcon />}
            subtitle="Awaiting dispatch"
          />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="primary" indicatorColor="primary">
          <Tab label={`My Listings (${listings.length})`} />
          <Tab label={`Orders & Sales (${sales.length})`} />
        </Tabs>
      </Box>

      {/* My Listings */}
      {tab === 0 && (
        <Card>
          {listings.length === 0 ? (
            <Box textAlign="center" py={8}>
              <InventoryIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">No listings yet</Typography>
              <Typography variant="body2" color="textSecondary" mb={3}>Create your first produce listing to start selling</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>Create Listing</Button>
            </Box>
          ) : (
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(46,125,50,0.08)' }}>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listings.map(l => (
                  <TableRow key={l.id} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar
                          src={l.image_url}
                          variant="rounded"
                          sx={{ width: 40, height: 40, bgcolor: 'primary.light' }}
                        >
                          {l.product_name?.[0]}
                        </Avatar>
                        <Box>
                          <Typography fontWeight={600}>{l.product_name}</Typography>
                          <Typography variant="caption" color="textSecondary">{l.description?.slice(0, 40)}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Chip label={l.category} size="small" color="primary" variant="outlined" /></TableCell>
                    <TableCell>{l.quantity} {l.unit}</TableCell>
                    <TableCell><Typography fontWeight={600} color="primary">${l.price}/{l.unit}</Typography></TableCell>
                    <TableCell>
                      <Chip label={l.status} size="small"
                        color={l.status === 'ACTIVE' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" color="primary" onClick={() => openEditDialog(l)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove">
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

      {/* Orders & Sales */}
      {tab === 1 && (
        <Card>
          {sales.length === 0 ? (
            <Box textAlign="center" py={8}>
              <ShoppingBagIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">No orders yet</Typography>
              <Typography variant="body2" color="textSecondary">Orders will appear here once buyers purchase your produce</Typography>
            </Box>
          ) : (
            <Table>
              <TableHead sx={{ bgcolor: 'rgba(46,125,50,0.08)' }}>
                <TableRow>
                  <TableCell>Order #</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Buyer</TableCell>
                  <TableCell>Qty</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Update Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sales.map(sale => (
                  <TableRow key={sale.id} hover>
                    <TableCell><Typography fontWeight={600} color="primary">#{sale.id}</Typography></TableCell>
                    <TableCell>{sale.ProduceListing?.product_name}</TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>{sale.Buyer?.company_name}</Typography>
                        <Typography variant="caption" color="textSecondary">{sale.Buyer?.User?.email}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{sale.quantity} {sale.ProduceListing?.unit}</TableCell>
                    <TableCell><Typography fontWeight={600}>${parseFloat(sale.total_amount).toFixed(2)}</Typography></TableCell>
                    <TableCell>
                      <Chip
                        label={sale.delivery_status}
                        color={STATUS_COLORS[sale.delivery_status] || 'default'}
                        size="small"
                        icon={<LocalShippingIcon />}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {statusUpdating === sale.id ? (
                        <CircularProgress size={20} />
                      ) : (
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
                            <Chip label="Done" size="small" color="success" />
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

      {/* Create/Edit Listing Dialog */}
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
                onChange={e => setForm({ ...form, product_name: e.target.value })}
              />
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
                onChange={e => setForm({ ...form, quantity: e.target.value })}
              />
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
              <TextField fullWidth label="Price per unit ($)" type="number" required
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Harvest Date" type="date" InputLabelProps={{ shrink: true }}
                value={form.harvest_date}
                onChange={e => setForm({ ...form, harvest_date: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Description" multiline rows={2}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                component="label"
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                fullWidth
                sx={{ py: 1.5, borderStyle: 'dashed' }}
              >
                {imageFile ? imageFile.name : 'Upload Produce Image'}
                <input type="file" hidden accept="image/*" onChange={handleImageChange} />
              </Button>
              {imagePreview && (
                <Box mt={1} borderRadius={2} overflow="hidden" height={120}>
                  <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
