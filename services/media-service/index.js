const express = require('express');
const cors = require('cors');
const mediaRoutes = require('./routes/media');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'media-service', timestamp: new Date() }));

app.use('/api/media', mediaRoutes);

const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  console.log(`Media Service running on port \${PORT}`);
});
