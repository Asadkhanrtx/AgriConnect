const express = require('express');
const cors = require('cors');
const marketplaceRoutes = require('./routes/marketplace');
const { getDatabaseConnection } = require('agriconnect-shared/db');

const app = express();
app.use(cors());
app.use(express.json());

let isReady = false;

app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok', service: 'marketplace-service' }));
app.get('/ready', async (req, res) => {
  if (!isReady) return res.status(503).json({ status: 'not ready' });
  try {
    const db = await getDatabaseConnection();
    await db.authenticate();
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});

app.use('/api/marketplace', marketplaceRoutes);

const PORT = process.env.PORT || 3002;

async function startServer() {
  try {
    await getDatabaseConnection();
    isReady = true;
    app.listen(PORT, () => {
      console.log(`Marketplace Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start Marketplace Service:', error);
    process.exit(1);
  }
}

startServer();
