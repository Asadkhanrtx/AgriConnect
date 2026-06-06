const express = require('express');
const cors = require('cors');
const orderRoutes = require('./routes/order');
const { getDatabaseConnection } = require('agriconnect-shared/db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'order-service', timestamp: new Date() }));

app.use('/api/orders', orderRoutes);

const PORT = process.env.PORT || 3003;

async function startServer() {
  try {
    await getDatabaseConnection();
    app.listen(PORT, () => {
      console.log(`Order Service running on port \${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start Order Service:', error);
    process.exit(1);
  }
}

startServer();
