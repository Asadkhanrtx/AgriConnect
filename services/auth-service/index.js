const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const { getDatabaseConnection } = require('agriconnect-shared/db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'auth-service', timestamp: new Date() }));

app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await getDatabaseConnection();
    app.listen(PORT, () => console.log(`Auth Service running on port ${PORT}`));
  } catch (error) {
    console.error('Failed to start Auth Service:', error);
    process.exit(1);
  }
}

startServer();
