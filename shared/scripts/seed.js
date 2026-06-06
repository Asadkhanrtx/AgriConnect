const { getDatabaseConnection } = require('../db');
const bcrypt = require('bcryptjs'); // Will need to install this

const PRODUCTS = ['Rice', 'Wheat', 'Tomatoes', 'Potatoes', 'Onion', 'Mangoes', 'Bananas'];
const UNITS = ['kg', 'tonnes', 'crates', 'boxes'];

async function seed() {
  try {
    const sequelize = await getDatabaseConnection();
    const { User, Farmer, Buyer, ProduceListing } = sequelize.models;

    console.log('Checking if data exists...');
    const userCount = await User.count();
    if (userCount > 0) {
      console.log('Database already seeded. Skipping.');
      process.exit(0);
    }

    console.log('Seeding Database...');
    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Create Admin
    await User.create({
      role: 'ADMIN',
      first_name: 'Super',
      last_name: 'Admin',
      email: 'admin@agriconnect.com',
      password_hash: passwordHash
    });

    // 2. Create 20 Farmers
    const farmers = [];
    for (let i = 1; i <= 20; i++) {
      const user = await User.create({
        role: 'FARMER',
        first_name: `Farmer\${i}`,
        last_name: 'Smith',
        email: `farmer\${i}@example.com`,
        phone: `12345678\${i.toString().padStart(2, '0')}`,
        password_hash: passwordHash
      });
      
      const farmer = await Farmer.create({
        user_id: user.id,
        farm_name: `Green Acres \${i}`,
        location: `Region \${(i % 5) + 1}`,
        bank_secret_reference: `bank_ref_\${i}`
      });
      farmers.push(farmer);
    }

    // 3. Create 20 Buyers
    const buyers = [];
    for (let i = 1; i <= 20; i++) {
      const user = await User.create({
        role: 'BUYER',
        first_name: `Buyer\${i}`,
        last_name: 'Corp',
        email: `buyer\${i}@example.com`,
        phone: `98765432\${i.toString().padStart(2, '0')}`,
        password_hash: passwordHash
      });
      
      const buyer = await Buyer.create({
        user_id: user.id,
        company_name: `Fresh Foods \${i} LLC`
      });
      buyers.push(buyer);
    }

    // 4. Create 50 Produce Listings
    for (let i = 1; i <= 50; i++) {
      const randomFarmer = farmers[Math.floor(Math.random() * farmers.length)];
      const randomProduct = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
      const randomUnit = UNITS[Math.floor(Math.random() * UNITS.length)];
      
      await ProduceListing.create({
        farmer_id: randomFarmer.id,
        product_name: `Premium \${randomProduct}`,
        category: randomProduct.toUpperCase(),
        quantity: Math.floor(Math.random() * 1000) + 100,
        unit: randomUnit,
        price: (Math.random() * 50 + 5).toFixed(2),
        harvest_date: new Date(),
        description: `High quality \${randomProduct} freshly harvested.`,
        status: 'ACTIVE'
      });
    }

    console.log('Seeding Complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
