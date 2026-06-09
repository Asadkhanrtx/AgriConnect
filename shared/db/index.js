const { Sequelize } = require('sequelize');
const { getSecret } = require('../utils/secrets');
const initModels = require('../models');

let sequelizeInstance = null;

async function getDatabaseConnection() {
  if (sequelizeInstance) {
    return sequelizeInstance;
  }

  // Determine environment or use dev secret
  const secretName = process.env.DB_SECRET_NAME || 'agriconnect/dev/database';
  
  console.log(`Fetching database credentials from: ${secretName}`);
  const dbConfig = await getSecret(secretName);

  if (!dbConfig) {
    throw new Error('Failed to load database configuration from Secrets Manager');
  }

  sequelizeInstance = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
      host: dbConfig.host,
      port: dbConfig.port || 3306,
      dialect: 'mysql',
      logging: false, // Set to console.log to see SQL queries
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );

  await sequelizeInstance.authenticate();
  console.log('Database connection has been established successfully.');

  // Initialize models
  initModels(sequelizeInstance);

  return sequelizeInstance;
}

module.exports = { getDatabaseConnection };
