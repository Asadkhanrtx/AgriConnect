const jwt = require('jsonwebtoken');
const { getSecret } = require('../utils/secrets');

// JWT secret is cached via getSecret's built-in TTL cache
async function getJwtSecret() {
  const jwtConfig = await getSecret('agriconnect/dev/jwt');
  return jwtConfig.jwt_secret;
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const secret = await getJwtSecret();
    jwt.verify(token, secret, (err, user) => {
      if (err) return res.status(403).json({ error: 'Invalid or expired token' });
      req.user = user;
      next();
    });
  } catch (error) {
    console.error('Error in auth middleware:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
}

module.exports = { authenticateToken, requireRole };
