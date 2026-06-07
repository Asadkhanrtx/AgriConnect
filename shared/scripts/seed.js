const { getDatabaseConnection } = require('../db');
const bcrypt = require('bcryptjs');

const PRODUCTS = ['Rice', 'Wheat', 'Tomatoes', 'Potatoes', 'Onion', 'Mangoes', 'Bananas'];
const UNITS = ['kg', 'tonnes', 'crates', 'boxes'];

const FARMER_LOCATIONS = [
  'Punjab, India', 'Haryana, India', 'Uttar Pradesh, India',
  'Maharashtra, India', 'Karnataka, India'
];

async function seed() {
  try {
    const sequelize = await getDatabaseConnection();
    const { User, Farmer, Buyer, ProduceListing } = sequelize.models;

    console.log('Checking if data exists...');
    const userCount = await User.count();
    if (userCount > 0) {
      console.log('Database already seeded (' + userCount + ' users found). Skipping.');
      process.exit(0);
    }

    console.log('Seeding database...');
    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Admin
    await User.create({
      role: 'ADMIN',
      first_name: 'Super',
      last_name: 'Admin',
      email: 'admin@agriconnect.com',
      password_hash: passwordHash
    });
    console.log('  Admin created');

    // 2. Farmers
    const farmers = [];
    for (let i = 1; i <= 20; i++) {
      const user = await User.create({
        role: 'FARMER',
        first_name: 'Farmer' + i,
        last_name: 'Singh',
        email: 'farmer' + i + '@example.com',
        phone: '9000' + String(i).padStart(6, '0'),
        password_hash: passwordHash
      });

      const farmer = await Farmer.create({
        user_id: user.id,
        farm_name: 'Green Acres ' + i,
        location: FARMER_LOCATIONS[(i - 1) % FARMER_LOCATIONS.length],
        bank_secret_reference: 'bank_ref_' + i
      });
      farmers.push(farmer);
    }
    console.log('  20 farmers created');

    // 3. Buyers
    const buyers = [];
    for (let i = 1; i <= 20; i++) {
      const user = await User.create({
        role: 'BUYER',
        first_name: 'Buyer' + i,
        last_name: 'Corp',
        email: 'buyer' + i + '@example.com',
        phone: '8000' + String(i).padStart(6, '0'),
        password_hash: passwordHash
      });

      const buyer = await Buyer.create({
        user_id: user.id,
        company_name: 'Fresh Foods ' + i + ' Ltd'
      });
      buyers.push(buyer);
    }
    console.log('  20 buyers created');

    // 4. Produce Listings
    const harvestBase = new Date();
    for (let i = 1; i <= 50; i++) {
      const randomFarmer = farmers[Math.floor(Math.random() * farmers.length)];
      const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
      const unit = UNITS[Math.floor(Math.random() * UNITS.length)];
      const harvestDate = new Date(harvestBase);
      harvestDate.setDate(harvestDate.getDate() - Math.floor(Math.random() * 30));

      await ProduceListing.create({
        farmer_id: randomFarmer.id,
        product_name: 'Premium ' + product,
        category: product.toUpperCase(),
        quantity: Math.floor(Math.random() * 1000) + 100,
        unit: unit,
        price: (Math.random() * 50 + 5).toFixed(2),
        harvest_date: harvestDate,
        description: 'High quality ' + product + ' freshly harvested from ' + randomFarmer.location + '.',
        status: 'ACTIVE'
      });
    }
    console.log('  50 produce listings created');

    console.log('\nSeeding complete!');
    console.log('  Login: admin@agriconnect.com / password123');
    console.log('  Login: farmer1@example.com  / password123');
    console.log('  Login: buyer1@example.com   / password123');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exit(1);
  }
}

seed();
