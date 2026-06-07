const { getDatabaseConnection } = require('agriconnect-shared/db');
const { sendEmail, orderNotificationEmail } = require('agriconnect-shared/utils/email');

exports.createOrder = async (req, res) => {
  try {
    const { listing_id, quantity } = req.body;
    if (!listing_id || !quantity) return res.status(400).json({ error: 'listing_id and quantity are required' });

    const sequelize = await getDatabaseConnection();
    const { Order, ProduceListing, Buyer, Farmer, User, Transaction, Notification } = sequelize.models;

    const buyer = await Buyer.findOne({
      where: { user_id: req.user.id },
      include: [{ model: User, attributes: ['first_name', 'last_name', 'email'] }]
    });
    if (!buyer) return res.status(404).json({ error: 'Buyer profile not found' });

    const listing = await ProduceListing.findByPk(listing_id, {
      include: [{
        model: Farmer,
        attributes: ['user_id', 'farm_name'],
        include: [{ model: User, attributes: ['id', 'email', 'first_name', 'last_name'] }]
      }]
    });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.status !== 'ACTIVE') return res.status(400).json({ error: 'Listing is not available' });
    if (listing.quantity < quantity) return res.status(400).json({ error: 'Insufficient quantity available' });

    const total_amount = parseFloat(listing.price) * parseFloat(quantity);

    const order = await sequelize.transaction(async (t) => {
      const newOrder = await Order.create({
        buyer_id: buyer.id,
        listing_id,
        quantity: parseFloat(quantity),
        total_amount,
        delivery_status: 'PENDING'
      }, { transaction: t });

      await Transaction.create({ order_id: newOrder.id, amount: total_amount, status: 'COMPLETED' }, { transaction: t });
      await listing.update({ quantity: listing.quantity - parseFloat(quantity) }, { transaction: t });
      return newOrder;
    });

    // ── Notify farmer (DB + email) ───────────────────────────────────────────
    const farmerUserId = listing.Farmer?.user_id;
    const farmerUser = listing.Farmer?.User;
    if (farmerUserId) {
      const buyerName = buyer.User
        ? buyer.User.first_name + ' ' + buyer.User.last_name
        : buyer.company_name;

      await Notification.create({
        user_id: farmerUserId,
        title: 'New Order Received! 🎉',
        message: `${buyer.company_name} ordered ${parseFloat(quantity)} ${listing.unit} of ${listing.product_name} for ₹${total_amount.toLocaleString('en-IN')}. Please prepare for dispatch.`
      }).catch(err => console.error('Order notification failed:', err.message));

      if (farmerUser?.email) {
        const farmerName = farmerUser.first_name + ' ' + farmerUser.last_name;
        sendEmail({
          to: farmerUser.email,
          subject: `New Order: ${listing.product_name} from ${buyer.company_name}`,
          html: orderNotificationEmail({
            farmerName,
            productName: listing.product_name,
            quantity: parseFloat(quantity),
            unit: listing.unit,
            totalAmount: total_amount,
            buyerCompany: buyer.company_name
          })
        });
      }
    }

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

exports.getBuyerOrders = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { Order, Buyer, ProduceListing, Farmer } = sequelize.models;

    const buyer = await Buyer.findOne({ where: { user_id: req.user.id } });
    if (!buyer) return res.status(404).json({ error: 'Buyer profile not found' });

    const orders = await Order.findAll({
      where: { buyer_id: buyer.id },
      include: [{
        model: ProduceListing,
        attributes: ['product_name', 'image_url', 'unit', 'price'],
        include: [{ model: Farmer, attributes: ['farm_name', 'location'] }]
      }],
      order: [['created_at', 'DESC']]
    });

    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

exports.getFarmerSales = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { Order, ProduceListing, Farmer, Buyer, User } = sequelize.models;

    const farmer = await Farmer.findOne({ where: { user_id: req.user.id } });
    if (!farmer) return res.status(404).json({ error: 'Farmer profile not found' });

    const orders = await Order.findAll({
      include: [
        {
          model: ProduceListing,
          where: { farmer_id: farmer.id },
          attributes: ['product_name', 'unit', 'price']
        },
        {
          model: Buyer,
          attributes: ['company_name'],
          include: [{ model: User, attributes: ['first_name', 'last_name', 'email'] }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json(orders);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { delivery_status } = req.body;
    const allowed = ['PENDING', 'IN_TRANSIT', 'DELIVERED'];
    if (!allowed.includes(delivery_status)) return res.status(400).json({ error: 'Invalid delivery_status' });

    const sequelize = await getDatabaseConnection();
    const { Order, ProduceListing, Farmer, Buyer, User, Notification } = sequelize.models;

    const farmer = await Farmer.findOne({ where: { user_id: req.user.id } });
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: ProduceListing },
        { model: Buyer, include: [{ model: User, attributes: ['id', 'first_name'] }] }
      ]
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.ProduceListing.farmer_id !== farmer.id) return res.status(403).json({ error: 'Unauthorized' });

    await order.update({ delivery_status });

    // Notify buyer of status change
    const buyerUserId = order.Buyer?.User?.id;
    if (buyerUserId) {
      const statusMessages = {
        IN_TRANSIT: `Your order of ${order.ProduceListing.product_name} is now on its way! Track your delivery.`,
        DELIVERED: `Your order of ${order.ProduceListing.product_name} has been delivered. Thank you for using AgriConnect!`
      };
      if (statusMessages[delivery_status]) {
        await Notification.create({
          user_id: buyerUserId,
          title: delivery_status === 'DELIVERED' ? 'Order Delivered ✅' : 'Order Shipped 🚚',
          message: statusMessages[delivery_status]
        }).catch(() => {});
      }
    }

    res.json(order);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
};

exports.getAdminOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const sequelize = await getDatabaseConnection();
    const { Order, Buyer, ProduceListing, Farmer, User } = sequelize.models;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await Order.findAndCountAll({
      include: [
        {
          model: Buyer,
          attributes: ['company_name'],
          include: [{ model: User, attributes: ['first_name', 'last_name', 'email'] }]
        },
        {
          model: ProduceListing,
          attributes: ['product_name', 'unit'],
          include: [{ model: Farmer, attributes: ['farm_name'] }]
        }
      ],
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']]
    });

    res.json({ orders: rows, total: count, page: parseInt(page), pages: Math.ceil(count / parseInt(limit)) });
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};
