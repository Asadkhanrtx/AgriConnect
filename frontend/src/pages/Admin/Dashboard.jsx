import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Tabs, Tab, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, Avatar, CircularProgress, Alert,
  TextField, InputAdornment
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import InventoryIcon from '@mui/icons-material/Inventory';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SearchIcon from '@mui/icons-material/Search';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell
} from 'recharts';
import axios from 'axios';

const PIE_COLORS = ['#2E7D32', '#66BB6A', '#A5D6A7', '#1B5E20', '#388E3C', '#81C784', '#4CAF50'];

const StatCard = ({ title, value, icon, gradient, subtitle }) => (
  <Card className="hover-lift" sx={{ background: gradient, color: 'white', height: '100%' }}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="body2" sx={{ opacity: 0.8 }} gutterBottom>{title}</Typography>
          <Typography variant="h4" fontWeight="bold">{value}</Typography>
          {subtitle && <Typography variant="caption" sx={{ opacity: 0.7 }}>{subtitle}</Typography>}
        </Box>
        <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 52, height: 52 }}>{icon}</Avatar>
      </Box>
    </CardContent>
  </Card>
);

const AdminDashboard = ({ user }) => {
  const [tab, setTab] = useState(0);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes, ordersRes] = await Promise.all([
        axios.get('/api/auth/admin/stats', { headers }),
        axios.get('/api/auth/admin/users?limit=100', { headers }),
        axios.get('/api/orders/admin/all?limit=100', { headers })
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users || []);
      setOrders(ordersRes.data.orders || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <CircularProgress color="primary" />
    </Box>
  );

  if (error) return (
    <Box p={4}>
      <Alert severity="error">{error}</Alert>
    </Box>
  );

  // Prepare pie chart data from users
  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(roleCounts).map(([name, value]) => ({ name, value }));

  // Monthly bar chart data
  const chartData = (stats?.monthlyData || []).map(d => ({
    month: d.month,
    orders: parseInt(d.count),
    revenue: parseFloat(d.revenue || 0).toFixed(2)
  }));

  const filteredUsers = users.filter(u =>
    !userSearch ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.first_name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.last_name.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredOrders = orders.filter(o =>
    !orderSearch ||
    String(o.id).includes(orderSearch) ||
    o.ProduceListing?.product_name?.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.Buyer?.company_name?.toLowerCase().includes(orderSearch.toLowerCase())
  );

  const STATUS_COLORS = { PENDING: 'warning', IN_TRANSIT: 'info', DELIVERED: 'success' };
  const ROLE_COLORS = { FARMER: 'success', BUYER: 'info', ADMIN: 'warning' };

  return (
    <Box>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h4" fontWeight="bold" color="primary">Admin Dashboard</Typography>
        <Typography variant="body2" color="textSecondary">Platform overview and management</Typography>
      </Box>

      {/* Stats */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard title="Total Users" value={stats?.totalUsers || 0}
            icon={<PeopleIcon />} gradient="linear-gradient(135deg, #2E7D32, #388E3C)"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard title="Farmers" value={stats?.totalFarmers || 0}
            icon={<AgricultureIcon />} gradient="linear-gradient(135deg, #1B5E20, #2E7D32)"
            subtitle="Active sellers"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard title="Buyers" value={stats?.totalBuyers || 0}
            icon={<StorefrontIcon />} gradient="linear-gradient(135deg, #388E3C, #4CAF50)"
            subtitle="Active buyers"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard title="Active Listings" value={stats?.totalListings || 0}
            icon={<InventoryIcon />} gradient="linear-gradient(135deg, #558B2F, #689F38)"
            subtitle="Available produce"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard title="Total Revenue" value={`$${(stats?.totalRevenue || 0).toFixed(0)}`}
            icon={<AttachMoneyIcon />} gradient="linear-gradient(135deg, #33691E, #558B2F)"
            subtitle={`${stats?.totalOrders || 0} orders`}
          />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={8}>
          <Card sx={{ p: 3, height: 320 }}>
            <Typography variant="h6" fontWeight="bold" mb={2}>Monthly Orders & Revenue</Typography>
            {chartData.length === 0 ? (
              <Box display="flex" alignItems="center" justifyContent="center" height={220}>
                <Typography color="textSecondary">No data yet — orders will appear here once placed.</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                  <ChartTooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="orders" fill="#2E7D32" name="Orders" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="revenue" fill="#A5D6A7" name="Revenue ($)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 3, height: 320 }}>
            <Typography variant="h6" fontWeight="bold" mb={2}>User Distribution</Typography>
            {pieData.length === 0 ? (
              <Box display="flex" alignItems="center" justifyContent="center" height={220}>
                <Typography color="textSecondary">No users yet</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* Tables */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="primary" indicatorColor="primary">
          <Tab label={`Users (${users.length})`} />
          <Tab label={`Orders (${orders.length})`} />
        </Tabs>
      </Box>

      {/* Users Table */}
      {tab === 0 && (
        <Card>
          <Box p={2} borderBottom="1px solid" borderColor="divider">
            <TextField
              size="small"
              placeholder="Search users..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            />
          </Box>
          <Table>
            <TableHead sx={{ bgcolor: 'rgba(46,125,50,0.08)' }}>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Profile</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Joined</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map(u => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: 13 }}>
                        {u.first_name?.[0]}{u.last_name?.[0]}
                      </Avatar>
                      <Typography variant="body2" fontWeight={600}>{u.first_name} {u.last_name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell><Typography variant="body2">{u.email}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{u.phone || '—'}</Typography></TableCell>
                  <TableCell><Chip label={u.role} color={ROLE_COLORS[u.role] || 'default'} size="small" /></TableCell>
                  <TableCell>
                    <Typography variant="body2" color="textSecondary">
                      {u.farmer_profile?.farm_name || u.buyer_profile?.company_name || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell><Chip label={u.status || 'ACTIVE'} color={u.status === 'ACTIVE' ? 'success' : 'error'} size="small" variant="outlined" /></TableCell>
                  <TableCell><Typography variant="caption">{new Date(u.created_at).toLocaleDateString()}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Orders Table */}
      {tab === 1 && (
        <Card>
          <Box p={2} borderBottom="1px solid" borderColor="divider">
            <TextField
              size="small"
              placeholder="Search orders..."
              value={orderSearch}
              onChange={e => setOrderSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            />
          </Box>
          <Table>
            <TableHead sx={{ bgcolor: 'rgba(46,125,50,0.08)' }}>
              <TableRow>
                <TableCell>Order #</TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Farm</TableCell>
                <TableCell>Buyer</TableCell>
                <TableCell>Qty</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.map(o => (
                <TableRow key={o.id} hover>
                  <TableCell><Typography fontWeight={600} color="primary">#{o.id}</Typography></TableCell>
                  <TableCell>{o.ProduceListing?.product_name}</TableCell>
                  <TableCell>{o.ProduceListing?.Farmer?.farm_name}</TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>{o.Buyer?.company_name}</Typography>
                      <Typography variant="caption" color="textSecondary">{o.Buyer?.User?.email}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{o.quantity} {o.ProduceListing?.unit}</TableCell>
                  <TableCell><Typography fontWeight={600}>${parseFloat(o.total_amount).toFixed(2)}</Typography></TableCell>
                  <TableCell><Chip label={o.delivery_status} color={STATUS_COLORS[o.delivery_status] || 'default'} size="small" /></TableCell>
                  <TableCell><Typography variant="caption">{new Date(o.created_at).toLocaleDateString()}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  );
};

export default AdminDashboard;
