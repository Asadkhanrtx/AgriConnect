const express = require('express');
const cors = require('cors');
const marketplaceRoutes = require('./routes/marketplace');
const { getDatabaseConnection } = require('agriconnect-shared/db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'marketplace-service', timestamp: new Date() }));

app.use('/api/marketplace', marketplaceRoutes);

const PORT = process.env.PORT || 3002;

async function startServer() {
  try {
    await getDatabaseConnection();
    app.listen(PORT, () => {
      console.log(`Marketplace Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start Marketplace Service:', error);
    process.exit(1);
  }
}

startServer();
