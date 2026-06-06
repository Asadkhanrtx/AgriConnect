const { getDatabaseConnection } = require('agriconnect-shared/db');
const { Op } = require('sequelize');

exports.getCategories = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { ProduceListing } = sequelize.models;
    const rows = await ProduceListing.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']],
      where: { status: 'ACTIVE' },
      raw: true
    });
    res.json(rows.map(r => r.category).filter(Boolean));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

exports.getAllListings = async (req, res) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;
    const sequelize = await getDatabaseConnection();
    const { ProduceListing, Farmer, User } = sequelize.models;

    const where = { status: 'ACTIVE' };
    if (category) where.category = category;
    if (search) where.product_name = { [Op.like]: `%${search}%` };

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await ProduceListing.findAndCountAll({
      where,
      include: [{ model: Farmer, attributes: ['farm_name', 'location'], include: [{ model: User, attributes: ['first_name', 'last_name'] }] }],
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
      product_name,
      category,
      quantity: parseFloat(quantity),
      unit,
      price: parseFloat(price),
      harvest_date,
      description,
      image_url,
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
    const { Bid, Buyer, ProduceListing } = sequelize.models;
    const buyer = await Buyer.findOne({ where: { user_id: req.user.id } });
    if (!buyer) return res.status(404).json({ error: 'Buyer profile not found' });

    const listing = await ProduceListing.findByPk(listing_id);
    if (!listing || listing.status !== 'ACTIVE') return res.status(404).json({ error: 'Listing not available' });

    const bid = await Bid.create({ buyer_id: buyer.id, listing_id, amount: parseFloat(amount) });
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
      include: [{ model: ProduceListing, attributes: ['product_name', 'price', 'unit', 'image_url', 'status'], include: [{ model: Farmer, attributes: ['farm_name'] }] }],
      order: [['created_at', 'DESC']]
    });
    res.json(bids);
  } catch (error) {
    console.error('Error fetching my bids:', error);
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
};

exports.acceptBid = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { Bid, ProduceListing, Farmer } = sequelize.models;
    const farmer = await Farmer.findOne({ where: { user_id: req.user.id } });
    const bid = await Bid.findByPk(req.params.id, { include: [{ model: ProduceListing }] });
    if (!bid) return res.status(404).json({ error: 'Bid not found' });
    if (bid.ProduceListing.farmer_id !== farmer.id) return res.status(403).json({ error: 'Unauthorized' });

    await bid.update({ status: 'ACCEPTED' });
    // Reject all other bids for this listing
    await Bid.update({ status: 'REJECTED' }, { where: { listing_id: bid.listing_id, id: { [Op.ne]: bid.id } } });
    res.json(bid);
  } catch (error) {
    console.error('Error accepting bid:', error);
    res.status(500).json({ error: 'Failed to accept bid' });
  }
};

exports.rejectBid = async (req, res) => {
  try {
    const sequelize = await getDatabaseConnection();
    const { Bid, ProduceListing, Farmer } = sequelize.models;
    const farmer = await Farmer.findOne({ where: { user_id: req.user.id } });
    const bid = await Bid.findByPk(req.params.id, { include: [{ model: ProduceListing }] });
    if (!bid) return res.status(404).json({ error: 'Bid not found' });
    if (bid.ProduceListing.farmer_id !== farmer.id) return res.status(403).json({ error: 'Unauthorized' });

    await bid.update({ status: 'REJECTED' });
    res.json(bid);
  } catch (error) {
    console.error('Error rejecting bid:', error);
    res.status(500).json({ error: 'Failed to reject bid' });
  }
};
