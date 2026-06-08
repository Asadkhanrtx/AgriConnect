const { getDatabaseConnection } = require('../db');
const bcrypt = require('bcryptjs');

// ── Indian farmers data ────────────────────────────────────────────────────────
const FARMER_FIRST_NAMES = [
  'Rajesh', 'Suresh', 'Mahesh', 'Ramesh', 'Dinesh',
  'Naresh', 'Umesh', 'Anand', 'Pankaj', 'Amit',
  'Anil', 'Ravi', 'Sanjay', 'Mohan', 'Vijay',
  'Arjun', 'Deepak', 'Pramod', 'Ashok', 'Kamlesh'
];
const FARMER_LAST_NAMES = [
  'Singh', 'Sharma', 'Patel', 'Verma', 'Gupta',
  'Kumar', 'Yadav', 'Mishra', 'Tiwari', 'Chauhan',
  'Reddy', 'Naidu', 'Nair', 'Mehta', 'Joshi',
  'Desai', 'Shah', 'Patil', 'Rao', 'Pillai'
];
// High-rainfall locations concentrated for weather-alert demo
const FARMER_LOCATIONS = [
  { city: 'Mawsynram',   state: 'Meghalaya',       lat: 25.2967, lon: 91.5833 },
  { city: 'Cherrapunji', state: 'Meghalaya',       lat: 25.2844, lon: 91.7267 },
  { city: 'Shillong',    state: 'Meghalaya',       lat: 25.5788, lon: 91.8933 },
  { city: 'Agumbe',      state: 'Karnataka',       lat: 13.5025, lon: 75.0929 },
  { city: 'Kochi',       state: 'Kerala',          lat:  9.9312, lon: 76.2673 },
  { city: 'Mangalore',   state: 'Karnataka',       lat: 12.9141, lon: 74.8560 },
  { city: 'Gangtok',     state: 'Sikkim',          lat: 27.3389, lon: 88.6065 },
  { city: 'Nashik',      state: 'Maharashtra',     lat: 19.9975, lon: 73.7898 },
  { city: 'Amritsar',    state: 'Punjab',          lat: 31.6340, lon: 74.8723 },
  { city: 'Mawsynram',   state: 'Meghalaya',       lat: 25.2967, lon: 91.5833 },
  { city: 'Cherrapunji', state: 'Meghalaya',       lat: 25.2844, lon: 91.7267 },
  { city: 'Kochi',       state: 'Kerala',          lat:  9.9312, lon: 76.2673 },
  { city: 'Agumbe',      state: 'Karnataka',       lat: 13.5025, lon: 75.0929 },
  { city: 'Pune',        state: 'Maharashtra',     lat: 18.5204, lon: 73.8567 },
  { city: 'Hyderabad',   state: 'Telangana',       lat: 17.3850, lon: 78.4867 },
  { city: 'Shillong',    state: 'Meghalaya',       lat: 25.5788, lon: 91.8933 },
  { city: 'Bhopal',      state: 'Madhya Pradesh',  lat: 23.2599, lon: 77.4126 },
  { city: 'Coimbatore',  state: 'Tamil Nadu',      lat: 11.0168, lon: 76.9558 },
  { city: 'Ludhiana',    state: 'Punjab',          lat: 30.9010, lon: 75.8573 },
  { city: 'Patna',       state: 'Bihar',           lat: 25.5941, lon: 85.1376 },
];
const FARM_PREFIXES = [
  'Green Valley', 'Golden', 'Sunrise', 'Heritage', 'Pure',
  'Nature', 'Fresh', 'Organic', 'Royal', 'Desi',
  'Pioneer', 'Krishi', 'Kisan', 'Annadata', 'Dharitri',
  'Samriddhi', 'Pragatisheel', 'Nandini', 'Bhumi', 'Swaraj'
];
const FARM_SUFFIXES = [
  'Farms', 'Agriculture', 'Agro', 'Fields', 'Harvest',
  'Organics', 'Growers', 'Produce', 'Gardens', 'Acres'
];

// ── Buyer companies ────────────────────────────────────────────────────────────
const BUYER_FIRST_NAMES = [
  'Ramesh', 'Sunil', 'Vikram', 'Harish', 'Manoj',
  'Girish', 'Pradeep', 'Santosh', 'Rakesh', 'Nitin',
  'Alok', 'Bhavesh', 'Chirag', 'Dilip', 'Gopal',
  'Hemant', 'Ishaan', 'Jayesh', 'Kiran', 'Lalit'
];
const BUYER_COMPANY_NAMES = [
  'FreshMart Pvt Ltd', 'AgroTrade Solutions', 'Green Valley Foods', 'National Agri Corp',
  'Desi Farm Fresh', 'Metro Vegetables', 'Organic India Ltd', 'Kisaan Direct',
  'Farm2Fork India', 'Rural Markets Ltd', 'HarvestHub Co', 'ProducePro India',
  'AgriLink Solutions', 'BazaarFresh', 'NutriSource Foods', 'Village2City',
  'CropConnect Ltd', 'FarmBridge India', 'AgriNation Corp', 'PureGreen Foods'
];

// ── Products with realistic Indian market data ─────────────────────────────────
const PRODUCTS = [
  { name: 'Basmati Rice', category: 'Rice', unit: 'kg', minPrice: 45, maxPrice: 85,
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80',
    minQty: 500, maxQty: 5000 },
  { name: 'Sona Masoori Rice', category: 'Rice', unit: 'kg', minPrice: 35, maxPrice: 60,
    image: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=400&q=80',
    minQty: 400, maxQty: 4000 },
  { name: 'Sharbati Wheat', category: 'Wheat', unit: 'kg', minPrice: 25, maxPrice: 45,
    image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&q=80',
    minQty: 1000, maxQty: 10000 },
  { name: 'Lokwan Wheat', category: 'Wheat', unit: 'kg', minPrice: 22, maxPrice: 38,
    image: 'https://images.unsplash.com/photo-1565371557-ecb9caf8a95f?w=400&q=80',
    minQty: 800, maxQty: 8000 },
  { name: 'Desi Tomatoes', category: 'Tomatoes', unit: 'kg', minPrice: 12, maxPrice: 45,
    image: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=400&q=80',
    minQty: 200, maxQty: 2000 },
  { name: 'Hybrid Tomatoes', category: 'Tomatoes', unit: 'kg', minPrice: 18, maxPrice: 55,
    image: 'https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=400&q=80',
    minQty: 300, maxQty: 3000 },
  { name: 'Red Potatoes', category: 'Potatoes', unit: 'kg', minPrice: 15, maxPrice: 35,
    image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80',
    minQty: 500, maxQty: 5000 },
  { name: 'Kufri Jyoti Potatoes', category: 'Potatoes', unit: 'kg', minPrice: 12, maxPrice: 28,
    image: 'https://images.unsplash.com/photo-1508313880080-c4bef0730395?w=400&q=80',
    minQty: 600, maxQty: 6000 },
  { name: 'Nasik Red Onion', category: 'Onion', unit: 'kg', minPrice: 18, maxPrice: 60,
    image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400&q=80',
    minQty: 500, maxQty: 5000 },
  { name: 'White Onion', category: 'Onion', unit: 'kg', minPrice: 15, maxPrice: 45,
    image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&q=80',
    minQty: 400, maxQty: 4000 },
  { name: 'Alphonso Mangoes', category: 'Mangoes', unit: 'kg', minPrice: 180, maxPrice: 500,
    image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&q=80',
    minQty: 100, maxQty: 1000 },
  { name: 'Kesar Mangoes', category: 'Mangoes', unit: 'kg', minPrice: 120, maxPrice: 350,
    image: 'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=400&q=80',
    minQty: 150, maxQty: 1500 },
  { name: 'Robusta Bananas', category: 'Bananas', unit: 'kg', minPrice: 18, maxPrice: 40,
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&q=80',
    minQty: 300, maxQty: 3000 },
  { name: 'Nendran Bananas', category: 'Bananas', unit: 'kg', minPrice: 35, maxPrice: 70,
    image: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?w=400&q=80',
    minQty: 200, maxQty: 2000 },
  { name: 'Sweet Corn', category: 'Corn', unit: 'kg', minPrice: 20, maxPrice: 40,
    image: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400&q=80',
    minQty: 400, maxQty: 4000 },
  { name: 'Yellow Maize', category: 'Corn', unit: 'tonnes', minPrice: 1600, maxPrice: 2200,
    image: 'https://images.unsplash.com/photo-1599916434849-fdc47c7e6f4d?w=400&q=80',
    minQty: 5, maxQty: 50 },
  { name: 'Yellow Soybeans', category: 'Soybean', unit: 'kg', minPrice: 38, maxPrice: 58,
    image: 'https://images.unsplash.com/photo-1595855759920-86582396756a?w=400&q=80',
    minQty: 500, maxQty: 5000 },
  { name: 'Hirsute Cotton', category: 'Cotton', unit: 'kg', minPrice: 55, maxPrice: 80,
    image: 'https://images.unsplash.com/photo-1594398901394-4e34939a4fd0?w=400&q=80',
    minQty: 500, maxQty: 5000 },
  { name: 'Sugarcane', category: 'Sugarcane', unit: 'tonnes', minPrice: 280, maxPrice: 360,
    image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400&q=80',
    minQty: 5, maxQty: 100 },
  { name: 'Kashmir Apple', category: 'Apple', unit: 'kg', minPrice: 80, maxPrice: 220,
    image: 'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&q=80',
    minQty: 200, maxQty: 2000 },
];

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getDescription(productName, location, category) {
  const templates = [
    `Premium quality ${productName} freshly harvested from ${location}. Non-GMO, grown using sustainable methods.`,
    `Farm-fresh ${productName} directly from ${location}. Grown using traditional practices with modern quality standards.`,
    `High-grade ${productName} from the fertile fields of ${location}. Available for bulk purchase, negotiation welcome.`,
    `Organically grown ${productName} from ${location}. Direct from farmer to buyer — no middlemen.`,
    `Best-in-class ${productName} from ${location}. Pesticide-minimal, ideal for wholesale and retail buyers.`,
  ];
  return pickRandom(templates);
}

async function seed() {
  try {
    const sequelize = await getDatabaseConnection();
    const { User, Farmer, Buyer, ProduceListing, Order, Transaction, Bid, Payment, Notification } = sequelize.models;

    const forceReseed = process.argv.includes('--force');
    const userCount = await User.count();

    if (!forceReseed && userCount > 0) {
      console.log('Database already seeded (' + userCount + ' users found).');
      console.log('To re-seed with fresh data, run: node scripts/seed.js --force');
      process.exit(0);
    }

    if (forceReseed && userCount > 0) {
      console.log('Force re-seeding: truncating all data tables...');
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const name of ['Notification', 'Payment', 'Transaction', 'Bid', 'Order', 'ProduceListing', 'Farmer', 'Buyer', 'User']) {
        if (sequelize.models[name]) {
          await sequelize.models[name].destroy({ where: {}, truncate: true, force: true }).catch(() => {});
        }
      }
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('  Tables cleared.');
    }

    console.log('\nSeeding database with realistic Indian AgriConnect data...\n');
    const passwordHash = await bcrypt.hash('password123', 10);

    // ── 1. Admin ────────────────────────────────────────────────────────────────
    await User.create({
      role: 'ADMIN', first_name: 'Super', last_name: 'Admin',
      email: 'admin@agriconnect.com', password_hash: passwordHash
    });
    console.log('  ✓ Admin created');

    // ── 2. Farmers ──────────────────────────────────────────────────────────────
    const farmers = [];
    for (let i = 0; i < 20; i++) {
      const firstName = FARMER_FIRST_NAMES[i];
      const lastName = FARMER_LAST_NAMES[i];
      const locData = FARMER_LOCATIONS[i];
      const farmName = pickRandom(FARM_PREFIXES) + ' ' + pickRandom(FARM_SUFFIXES);

      const user = await User.create({
        role: 'FARMER',
        first_name: firstName,
        last_name: lastName,
        email: 'farmer' + (i + 1) + '@example.com',
        phone: '90' + String(randBetween(10000000, 99999999)),
        password_hash: passwordHash
      });

      const farmer = await Farmer.create({
        user_id: user.id,
        farm_name: farmName,
        location: locData.city + ', ' + locData.state,
        city: locData.city,
        state: locData.state,
        latitude: locData.lat,
        longitude: locData.lon,
        bank_secret_reference: 'bank_ref_farmer_' + (i + 1)
      });

      farmers.push({ farmer, user, location: locData.city + ', ' + locData.state });
    }
    console.log('  ✓ 20 Farmers created');

    // ── 3. Buyers ────────────────────────────────────────────────────────────────
    const buyers = [];
    for (let i = 0; i < 20; i++) {
      const user = await User.create({
        role: 'BUYER',
        first_name: BUYER_FIRST_NAMES[i],
        last_name: 'Corp',
        email: 'buyer' + (i + 1) + '@example.com',
        phone: '80' + String(randBetween(10000000, 99999999)),
        password_hash: passwordHash
      });

      const buyer = await Buyer.create({
        user_id: user.id,
        company_name: BUYER_COMPANY_NAMES[i]
      });

      buyers.push({ buyer, user });
    }
    console.log('  ✓ 20 Buyers created');

    // ── 4. Produce Listings (100) ─────────────────────────────────────────────
    const listings = [];
    const baseDate = new Date();

    for (let i = 0; i < 100; i++) {
      const { farmer, location } = pickRandom(farmers);
      const product = PRODUCTS[i % PRODUCTS.length];
      const qty = randBetween(product.minQty, product.maxQty);
      const price = randFloat(product.minPrice, product.maxPrice);
      const harvestDate = new Date(baseDate);
      harvestDate.setDate(harvestDate.getDate() - randBetween(1, 45));

      const listing = await ProduceListing.create({
        farmer_id: farmer.id,
        product_name: product.name,
        category: product.category,
        quantity: qty,
        unit: product.unit,
        price,
        harvest_date: harvestDate,
        description: getDescription(product.name, location, product.category),
        image_url: product.image,
        status: 'ACTIVE'
      });

      listings.push({ listing, product });
    }
    console.log('  ✓ 100 Produce listings created');

    // ── 5. Orders (50) ────────────────────────────────────────────────────────
    const ORDER_STATUSES = ['PENDING', 'PENDING', 'IN_TRANSIT', 'DELIVERED', 'DELIVERED'];
    let ordersCreated = 0;

    for (let i = 0; i < 60 && ordersCreated < 50; i++) {
      const { buyer } = pickRandom(buyers);
      const { listing, product } = pickRandom(listings);

      const currentListing = await ProduceListing.findByPk(listing.id);
      if (!currentListing || currentListing.quantity < 10) continue;

      const maxOrderQty = Math.floor(currentListing.quantity * 0.25);
      const orderQty = randBetween(Math.max(1, Math.floor(currentListing.quantity * 0.05)), Math.max(2, maxOrderQty));
      const totalAmount = parseFloat(currentListing.price) * orderQty;
      const status = pickRandom(ORDER_STATUSES);

      const orderDate = new Date(baseDate);
      orderDate.setDate(orderDate.getDate() - randBetween(1, 60));

      const order = await Order.create({
        buyer_id: buyer.id,
        listing_id: listing.id,
        quantity: orderQty,
        total_amount: totalAmount,
        delivery_status: status,
        created_at: orderDate,
        updated_at: orderDate
      });

      await Transaction.create({
        order_id: order.id,
        amount: totalAmount,
        status: 'COMPLETED'
      });

      await Payment.create({
        order_id: order.id,
        amount: totalAmount,
        status: status === 'DELIVERED' ? 'RELEASED' : 'HELD',
        released_at: status === 'DELIVERED' ? orderDate : null
      });

      await currentListing.update({
        quantity: currentListing.quantity - orderQty
      });

      ordersCreated++;
    }
    console.log('  ✓ ' + ordersCreated + ' Orders created (with transactions)');

    // ── 6. Bids (100) ─────────────────────────────────────────────────────────
    const BID_STATUSES = ['PENDING', 'PENDING', 'PENDING', 'ACCEPTED', 'REJECTED'];
    let bidsCreated = 0;

    for (let i = 0; i < 120 && bidsCreated < 100; i++) {
      const { buyer } = pickRandom(buyers);
      const { listing } = pickRandom(listings);

      const currentListing = await ProduceListing.findByPk(listing.id);
      if (!currentListing || currentListing.status !== 'ACTIVE') continue;

      const bidVariation = 0.80 + Math.random() * 0.40; // 80–120% of listed price
      const bidAmount = parseFloat((parseFloat(currentListing.price) * bidVariation).toFixed(2));
      const bidStatus = pickRandom(BID_STATUSES);

      const bidDate = new Date(baseDate);
      bidDate.setDate(bidDate.getDate() - randBetween(1, 30));

      await Bid.create({
        buyer_id: buyer.id,
        listing_id: listing.id,
        amount: bidAmount,
        status: bidStatus,
        created_at: bidDate,
        updated_at: bidDate
      });

      bidsCreated++;
    }
    console.log('  ✓ ' + bidsCreated + ' Bids created');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Seeding complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Admin   : admin@agriconnect.com / password123');
    console.log('  Farmer  : farmer1@example.com  / password123');
    console.log('  Buyer   : buyer1@example.com   / password123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(0);
  } catch (error) {
    console.error('\n[SEED ERROR]', error.message);
    if (error.parent) console.error('SQL:', error.parent.sqlMessage);
    process.exit(1);
  }
}

seed();
