const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getSecret(secretName) {
  const now = Date.now();
  const cached = cache.get(secretName);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretName, VersionStage: 'AWSCURRENT' })
    );
    if (response.SecretString) {
      const value = JSON.parse(response.SecretString);
      cache.set(secretName, { value, ts: now });
      return value;
    }
    return null;
  } catch (error) {
    console.error(`Error retrieving secret ${secretName}:`, error.message);
    throw error;
  }
}

module.exports = { getSecret };
