const { getDatabaseConnection } = require('../db');

async function migrate() {
  try {
    const sequelize = await getDatabaseConnection();
    console.log('Synchronizing database schema (alter: true)...');
    await sequelize.sync({ alter: true });
    console.log('Database synchronization complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
