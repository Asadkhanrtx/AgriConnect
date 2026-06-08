const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabaseConnection } = require('agriconnect-shared/db');
const { getSecret } = require('agriconnect-shared/utils/secrets');

exports.register = async (req, res) => {
  try {
    const { role, first_name, last_name, email, phone, password, extra_data } = req.body;
    if (!role || !first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: 'role, first_name, last_name, email, and password are required' });
    }
    if (!['FARMER', 'BUYER'].includes(role)) {
      return res.status(400).json({ error: 'Role must be FARMER or BUYER' });
    }

    const sequelize = await getDatabaseConnection();
    const { User, Farmer, Buyer } = sequelize.models;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 10);

    const result = await sequelize.transaction(async (t) => {
      const user = await User.create({ role, first_name, last_name, email, phone, password_hash }, { transaction: t });
      if (role === 'FARMER') {
        await Farmer.create({
          user_id: user.id,
          farm_name: extra_data?.farm_name || 'My Farm',
          location: extra_data?.location || extra_data?.city || 'Unknown',
          city: extra_data?.city || null,
          state: extra_data?.state || null,
          latitude: extra_data?.lat || null,
          longitude: extra_data?.lon || null
        }, { transaction: t });
      } else if (role === 'BUYER') {
        await Buyer.create({
          user_id: user.id,
          company_name: extra_data?.company_name || 'My Company'
        }, { transaction: t });
      }
      return user;
    });

    res.status(201).json({ message: 'User registered successfully', userId: result.id });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const sequelize = await getDatabaseConnection();
    const { User, Farmer, Buyer } = sequelize.models;

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.status !== 'ACTIVE') return res.status(403).json({ error: 'Account is inactive' });

    const jwtConfig = await getSecret('agriconnect/dev/jwt');
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      jwtConfig.jwt_secret,
      { expiresIn: jwtConfig.jwt_expiry || '24h' }
    );

    let profile = null;
    if (user.role === 'FARMER') {
      profile = await Farmer.findOne({ where: { user_id: user.id } });
    } else if (user.role === 'BUYER') {
      profile = await Buyer.findOne({ where: { user_id: user.id } });
    }

    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        profile
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { User, Farmer, Buyer } = sequelize.models;
    const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password_hash'] } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let profile = null;
    if (user.role === 'FARMER') profile = await Farmer.findOne({ where: { user_id: user.id } });
    else if (user.role === 'BUYER') profile = await Buyer.findOne({ where: { user_id: user.id } });

    res.json({ user: { ...user.toJSON(), profile } });
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

exports.getAdminStats = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { User, Farmer, Buyer, ProduceListing, Order, Transaction } = sequelize.models;

    const [totalUsers, totalFarmers, totalBuyers, totalListings, totalOrders, revenueResult] = await Promise.all([
      User.count(),
      Farmer.count(),
      Buyer.count(),
      ProduceListing.count({ where: { status: 'ACTIVE' } }),
      Order.count(),
      Transaction.sum('amount', { where: { status: 'COMPLETED' } })
    ]);

    // Orders by month (last 6 months)
    const { Op } = sequelize.constructor;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentOrders = await Order.findAll({
      where: { created_at: { [Op.gte]: sixMonthsAgo } },
      attributes: [
        [sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), '%Y-%m'), 'month'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('total_amount')), 'revenue']
      ],
      group: [sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), '%Y-%m')],
      order: [[sequelize.fn('DATE_FORMAT', sequelize.col('created_at'), '%Y-%m'), 'ASC']],
      raw: true
    });

    res.json({
      totalUsers,
      totalFarmers,
      totalBuyers,
      totalListings,
      totalOrders,
      totalRevenue: parseFloat(revenueResult) || 0,
      monthlyData: recentOrders
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

exports.getAdminUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role } = req.query;
    const sequelize = await getDatabaseConnection();
    const { User, Farmer, Buyer } = sequelize.models;

    const where = {};
    if (role) where.role = role;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password_hash'] },
      include: [
        { model: Farmer, as: 'farmer_profile', required: false },
        { model: Buyer, as: 'buyer_profile', required: false }
      ],
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']]
    });

    res.json({ users: rows, total: count, page: parseInt(page), pages: Math.ceil(count / parseInt(limit)) });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};
