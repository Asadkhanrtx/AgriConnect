const { getDatabaseConnection } = require('agriconnect-shared/db');
const { sendEmail, bidNotificationEmail } = require('agriconnect-shared/utils/email');
const { publishEvent } = require('agriconnect-shared/utils/eventPublisher');

exports.getCategories = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { ProduceListing } = sequelize.models;
    const rows = await ProduceListing.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']],
      where: { status: 'ACTIVE' },
      raw: true
    });
    res.json(rows.map(r => r.category).filter(Boolean).sort());
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

exports.getAllListings = async (req, res) => {
  try {
    const { search, category, page = 1, limit = 50 } = req.query;
    const sequelize = await getDatabaseConnection();
    const { ProduceListing, Farmer, User } = sequelize.models;
    const { Op } = sequelize.constructor;

    const where = { status: 'ACTIVE' };
    if (category) where.category = category;
    if (search) where.product_name = { [Op.like]: `%${search}%` };

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await ProduceListing.findAndCountAll({
      where,
      include: [{
        model: Farmer,
        attributes: ['farm_name', 'location'],
        include: [{ model: User, attributes: ['first_name', 'last_name'] }]
      }],
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']]
    });

    res.json({ listings: rows, total: count, page: parseInt(page), pages: Math.ceil(count / parseInt(limit)) });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
};

exports.getListingById = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { ProduceListing, Farmer, User } = sequelize.models;
    const listing = await ProduceListing.findByPk(req.params.id, {
      include: [{ model: Farmer, attributes: ['farm_name', 'location'], include: [{ model: User, attributes: ['first_name', 'last_name', 'phone'] }] }]
    });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    res.json(listing);
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
};

exports.getMyListings = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { ProduceListing, Farmer } = sequelize.models;
    const farmer = await Farmer.findOne({ where: { user_id: req.user.id } });
    if (!farmer) return res.status(404).json({ error: 'Farmer profile not found' });

    const listings = await ProduceListing.findAll({
      where: { farmer_id: farmer.id },
      order: [['created_at', 'DESC']]
    });
    res.json(listings);
  } catch (error) {
    console.error('Error fetching my listings:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
};

exports.createListing = async (req, res) => {
  try {
    const { product_name, category, quantity, unit, price, harvest_date, description, image_url } = req.body;
    if (!product_name || !category || !quantity || !unit || !price) {
      return res.status(400).json({ error: 'product_name, category, quantity, unit, and price are required' });
    }

    const sequelize = await getDatabaseConnection();
    const { ProduceListing, Farmer } = sequelize.models;
    const farmer = await Farmer.findOne({ where: { user_id: req.user.id } });
    if (!farmer) return res.status(404).json({ error: 'Farmer profile not found' });

    const listing = await ProduceListing.create({
      farmer_id: farmer.id,
      product_name, category,
      quantity: parseFloat(quantity),
      unit,
      price: parseFloat(price),
      harvest_date, description, image_url,
      status: 'ACTIVE'
    });
    res.status(201).json(listing);
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
};

exports.updateListing = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { ProduceListing, Farmer } = sequelize.models;
    const farmer = await Farmer.findOne({ where: { user_id: req.user.id } });
    const listing = await ProduceListing.findByPk(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.farmer_id !== farmer.id) return res.status(403).json({ error: 'Unauthorized' });

    const { product_name, category, quantity, unit, price, harvest_date, description, image_url, status } = req.body;
    await listing.update({ product_name, category, quantity, unit, price, harvest_date, description, image_url, status });
    res.json(listing);
  } catch (error) {
    console.error('Error updating listing:', error);
    res.status(500).json({ error: 'Failed to update listing' });
  }
};

exports.deleteListing = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { ProduceListing, Farmer } = sequelize.models;
    const farmer = await Farmer.findOne({ where: { user_id: req.user.id } });
    const listing = await ProduceListing.findByPk(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.farmer_id !== farmer.id) return res.status(403).json({ error: 'Unauthorized' });
    await listing.update({ status: 'DELETED' });
    res.json({ message: 'Listing removed' });
  } catch (error) {
    console.error('Error deleting listing:', error);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
};

exports.createBid = async (req, res) => {
  try {
    const { listing_id, amount } = req.body;
    if (!listing_id || !amount) return res.status(400).json({ error: 'listing_id and amount are required' });

    const sequelize = await getDatabaseConnection();
    const { Bid, Buyer, ProduceListing, Farmer, User, Notification } = sequelize.models;

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
    if (!listing || listing.status !== 'ACTIVE') return res.status(404).json({ error: 'Listing not available' });

    const bid = await Bid.create({ buyer_id: buyer.id, listing_id, amount: parseFloat(amount) });

    // ── Notify farmer via SNS→SQS pipeline (fallback: direct DB + email) ──────
    const farmerUserId = listing.Farmer?.user_id;
    const farmerUser = listing.Farmer?.User;
    if (farmerUserId) {
      const buyerName = buyer.User
        ? buyer.User.first_name + ' ' + buyer.User.last_name
        : 'A buyer';

      const published = await publishEvent({
        type: 'NEW_BID',
        bid_id: bid.id,
        farmer_user_id: farmerUserId,
        farmer_email: farmerUser?.email,
        farmer_name: farmerUser ? `${farmerUser.first_name} ${farmerUser.last_name}` : 'Farmer',
        buyer_name: buyerName,
        product_name: listing.product_name,
        amount: parseFloat(amount),
        listing_price: listing.price
      });

      if (!published) {
        await Notification.create({
          user_id: farmerUserId,
          title: 'New Bid Received',
          message: `${buyerName} from ${buyer.company_name} placed a bid of ₹${parseFloat(amount).toFixed(2)} on your ${listing.product_name} listing.`
        }).catch(err => console.error('Notification create failed:', err.message));

        if (farmerUser?.email) {
          sendEmail({
            to: farmerUser.email,
            subject: `New Bid on your ${listing.product_name} listing`,
            html: bidNotificationEmail({
              farmerName: `${farmerUser.first_name} ${farmerUser.last_name}`,
              buyerName: buyer.company_name,
              productName: listing.product_name,
              bidAmount: amount,
              listingPrice: listing.price
            })
          });
        }
      }
    }

    res.status(201).json(bid);
  } catch (error) {
    console.error('Error creating bid:', error);
    res.status(500).json({ error: 'Failed to create bid' });
  }
};

exports.getBidsForListing = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { Bid, Buyer, User } = sequelize.models;
    const bids = await Bid.findAll({
      where: { listing_id: req.params.listingId },
      include: [{ model: Buyer, attributes: ['company_name'], include: [{ model: User, attributes: ['first_name', 'last_name'] }] }],
      order: [['amount', 'DESC']]
    });
    res.json(bids);
  } catch (error) {
    console.error('Error fetching bids:', error);
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
};

exports.getMyBids = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { Bid, Buyer, ProduceListing, Farmer } = sequelize.models;
    const buyer = await Buyer.findOne({ where: { user_id: req.user.id } });
    if (!buyer) return res.status(404).json({ error: 'Buyer profile not found' });

    const bids = await Bid.findAll({
      where: { buyer_id: buyer.id },
      include: [{
        model: ProduceListing,
        attributes: ['product_name', 'price', 'unit', 'image_url', 'status'],
        include: [{ model: Farmer, attributes: ['farm_name'] }]
      }],
      order: [['created_at', 'DESC']]
    });
    res.json(bids);
  } catch (error) {
    console.error('Error fetching my bids:', error);
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
};

exports.getReceivedBids = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { Bid, ProduceListing, Farmer, Buyer, User } = sequelize.models;

    const farmer = await Farmer.findOne({ where: { user_id: req.user.id } });
    if (!farmer) return res.status(404).json({ error: 'Farmer profile not found' });

    const bids = await Bid.findAll({
      include: [
        {
          model: ProduceListing,
          where: { farmer_id: farmer.id },
          attributes: ['product_name', 'price', 'unit', 'image_url']
        },
        {
          model: Buyer,
          attributes: ['company_name'],
          include: [{ model: User, attributes: ['first_name', 'last_name', 'email'] }]
        }
      ],
      order: [['created_at', 'DESC']]
    });
    res.json(bids);
  } catch (error) {
    console.error('Error fetching received bids:', error);
    res.status(500).json({ error: 'Failed to fetch received bids' });
  }
};

exports.acceptBid = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { Bid, ProduceListing, Farmer, Buyer, User, Notification } = sequelize.models;
    const { Op } = sequelize.constructor;

    const farmer = await Farmer.findOne({ where: { user_id: req.user.id } });
    const bid = await Bid.findByPk(req.params.id, {
      include: [
        { model: ProduceListing },
        { model: Buyer, include: [{ model: User, attributes: ['id', 'email', 'first_name'] }] }
      ]
    });
    if (!bid) return res.status(404).json({ error: 'Bid not found' });
    if (bid.ProduceListing.farmer_id !== farmer.id) return res.status(403).json({ error: 'Unauthorized' });

    await bid.update({ status: 'ACCEPTED' });
    await Bid.update({ status: 'REJECTED' }, {
      where: { listing_id: bid.listing_id, id: { [Op.ne]: bid.id } }
    });

    const buyerUserId = bid.Buyer?.User?.id;
    if (buyerUserId) {
      const published = await publishEvent({
        type: 'BID_ACCEPTED',
        bid_id: bid.id,
        buyer_user_id: buyerUserId,
        product_name: bid.ProduceListing.product_name,
        amount: parseFloat(bid.amount)
      });

      if (!published) {
        await Notification.create({
          user_id: buyerUserId,
          title: 'Bid Accepted!',
          message: `Your bid of ₹${parseFloat(bid.amount).toFixed(2)} on ${bid.ProduceListing.product_name} has been accepted by the farmer.`
        }).catch(() => {});
      }
    }

    res.json(bid);
  } catch (error) {
    console.error('Error accepting bid:', error);
    res.status(500).json({ error: 'Failed to accept bid' });
  }
};

exports.rejectBid = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { Bid, ProduceListing, Farmer, Buyer, User, Notification } = sequelize.models;

    const farmer = await Farmer.findOne({ where: { user_id: req.user.id } });
    const bid = await Bid.findByPk(req.params.id, {
      include: [
        { model: ProduceListing },
        { model: Buyer, include: [{ model: User, attributes: ['id'] }] }
      ]
    });
    if (!bid) return res.status(404).json({ error: 'Bid not found' });
    if (bid.ProduceListing.farmer_id !== farmer.id) return res.status(403).json({ error: 'Unauthorized' });

    await bid.update({ status: 'REJECTED' });

    const buyerUserId = bid.Buyer?.User?.id;
    if (buyerUserId) {
      const published = await publishEvent({
        type: 'BID_REJECTED',
        bid_id: bid.id,
        buyer_user_id: buyerUserId,
        product_name: bid.ProduceListing.product_name
      });

      if (!published) {
        await Notification.create({
          user_id: buyerUserId,
          title: 'Bid Declined',
          message: `Your bid on ${bid.ProduceListing.product_name} was not accepted this time. Browse other listings and try again.`
        }).catch(() => {});
      }
    }

    res.json(bid);
  } catch (error) {
    console.error('Error rejecting bid:', error);
    res.status(500).json({ error: 'Failed to reject bid' });
  }
};
