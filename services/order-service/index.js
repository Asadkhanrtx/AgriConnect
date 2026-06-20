const express = require('express');
const cors = require('cors');
const orderRoutes = require('./routes/order');
const { getDatabaseConnection } = require('agriconnect-shared/db');

const app = express();
app.use(cors());
app.use(express.json());

let isReady = false;

app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok', service: 'order-service' }));
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

app.use('/api/orders', orderRoutes);

const PORT = process.env.PORT || 3003;

async function startServer() {
  try {
    await getDatabaseConnection();
    isReady = true;
    app.listen(PORT, () => {
      console.log(`Order Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start Order Service:', error);
    process.exit(1);
  }
}

startServer();
