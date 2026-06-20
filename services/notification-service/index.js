const express = require('express');
const cors = require('cors');
const notificationRoutes = require('./routes/notification');
const { getDatabaseConnection } = require('agriconnect-shared/db');
const { startWorker } = require('./workers/sqsWorker');

const app = express();
app.use(cors());
app.use(express.json());

let isReady = false;

app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok', service: 'notification-service' }));
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

app.use('/api/notifications', notificationRoutes);

const PORT = process.env.PORT || 3005;

async function startServer() {
  try {
    await getDatabaseConnection();
    isReady = true;
    startWorker();
    app.listen(PORT, () => {
      console.log(`Notification Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start Notification Service:', error);
    process.exit(1);
  }
}

startServer();
