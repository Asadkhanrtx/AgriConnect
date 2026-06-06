const express = require('express');
const cors = require('cors');
const notificationRoutes = require('./routes/notification');
const { getDatabaseConnection } = require('agriconnect-shared/db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'notification-service', timestamp: new Date() }));

app.use('/api/notifications', notificationRoutes);

const PORT = process.env.PORT || 3005;

async function startServer() {
  try {
    await getDatabaseConnection();
    app.listen(PORT, () => {
      console.log(`Notification Service running on port \${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start Notification Service:', error);
    process.exit(1);
  }
}

startServer();
