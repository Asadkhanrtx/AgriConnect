const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const { getDatabaseConnection } = require('agriconnect-shared/db');

const app = express();
app.use(cors());
app.use(express.json());

let isReady = false;

app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok', service: 'auth-service' }));
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

app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await getDatabaseConnection();
    isReady = true;
    app.listen(PORT, () => console.log(`Auth Service running on port ${PORT}`));
  } catch (error) {
    console.error('Failed to start Auth Service:', error);
    process.exit(1);
  }
}

startServer();
