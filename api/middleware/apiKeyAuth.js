/**
 * API Key Authentication Middleware
 * Validates API keys and provides rate limiting per client
 */

const crypto = require('crypto');

// In production, this should be stored in a database
const API_KEYS = new Map();

/**
 * Initialize with default API keys
 * In production, load from database
 */
function initializeApiKeys() {
  // Generate some example API keys
  const exampleKeys = [
    {
      key: 'vt_live_sk_' + crypto.randomBytes(32).toString('hex'),
      clientId: 'demo_client',
      name: 'Demo Client',
      permissions: ['sessions', 'translate', 'synthesize'],
      rateLimit: {
        requestsPerMinute: 1000,
        translationsPerMinute: 100
      },
      active: true,
      createdAt: new Date().toISOString()
    },
    {
      key: 'vt_test_sk_' + crypto.randomBytes(32).toString('hex'),
      clientId: 'test_client',
      name: 'Test Environment',
      permissions: ['sessions', 'translate', 'synthesize', 'voices'],
      rateLimit: {
        requestsPerMinute: 100,
        translationsPerMinute: 20
      },
      active: true,
      createdAt: new Date().toISOString()
    }
  ];

  exampleKeys.forEach(keyData => {
    API_KEYS.set(keyData.key, keyData);
  });

  console.log('🔑 API Keys initialized:');
  exampleKeys.forEach(keyData => {
    console.log(`   ${keyData.name}: ${keyData.key}`);
  });
}

/**
 * Middleware to validate API keys
 */
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key is required',
      code: 'MISSING_API_KEY',
      message: 'Provide API key in X-API-Key header or apiKey query parameter'
    });
  }

  const keyData = API_KEYS.get(apiKey);

  if (!keyData) {
    return res.status(401).json({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }

  if (!keyData.active) {
    return res.status(401).json({
      error: 'API key is inactive',
      code: 'INACTIVE_API_KEY'
    });
  }

  // Check permissions for the current route
  const route = req.route?.path || req.path;
  const requiredPermission = getRequiredPermission(route);
  
  if (requiredPermission && !keyData.permissions.includes(requiredPermission)) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      code: 'INSUFFICIENT_PERMISSIONS',
      required: requiredPermission,
      available: keyData.permissions
    });
  }

  // Attach key information to request
  req.apiKey = apiKey;
  req.clientId = keyData.clientId;
  req.clientName = keyData.name;
  req.permissions = keyData.permissions;
  req.rateLimit = keyData.rateLimit;

  next();
}

/**
 * Get required permission based on route
 */
function getRequiredPermission(route) {
  if (route.startsWith('/sessions')) return 'sessions';
  if (route.startsWith('/translate')) return 'translate';
  if (route.startsWith('/synthesize')) return 'synthesize';
  if (route.startsWith('/voices')) return 'voices';
  if (route.startsWith('/webhooks')) return 'webhooks';
  return null;
}

/**
 * Create a new API key
 */
function createApiKey(clientData) {
  const apiKey = `vt_${clientData.environment || 'live'}_sk_${crypto.randomBytes(32).toString('hex')}`;
  
  const keyData = {
    key: apiKey,
    clientId: clientData.clientId || crypto.randomBytes(8).toString('hex'),
    name: clientData.name || 'Unnamed Client',
    permissions: clientData.permissions || ['sessions', 'translate'],
    rateLimit: {
      requestsPerMinute: clientData.rateLimit?.requestsPerMinute || 1000,
      translationsPerMinute: clientData.rateLimit?.translationsPerMinute || 100
    },
    active: true,
    createdAt: new Date().toISOString(),
    metadata: clientData.metadata || {}
  };

  API_KEYS.set(apiKey, keyData);
  
  console.log(`🔑 New API key created for ${keyData.name}: ${apiKey}`);
  
  return keyData;
}

/**
 * Revoke an API key
 */
function revokeApiKey(apiKey) {
  const keyData = API_KEYS.get(apiKey);
  if (keyData) {
    keyData.active = false;
    keyData.revokedAt = new Date().toISOString();
    console.log(`🔑 API key revoked: ${apiKey}`);
    return true;
  }
  return false;
}

/**
 * List all API keys for management
 */
function listApiKeys() {
  return Array.from(API_KEYS.values()).map(keyData => ({
    clientId: keyData.clientId,
    name: keyData.name,
    permissions: keyData.permissions,
    active: keyData.active,
    createdAt: keyData.createdAt,
    revokedAt: keyData.revokedAt,
    // Don't expose the actual key for security
    keyPrefix: keyData.key.substring(0, 20) + '...'
  }));
}

/**
 * Get usage statistics for an API key
 */
function getKeyUsage(apiKey) {
  const keyData = API_KEYS.get(apiKey);
  if (!keyData) return null;

  return {
    clientId: keyData.clientId,
    name: keyData.name,
    totalRequests: keyData.totalRequests || 0,
    totalTranslations: keyData.totalTranslations || 0,
    lastUsed: keyData.lastUsed,
    rateLimit: keyData.rateLimit
  };
}

// Initialize API keys on module load
initializeApiKeys();

module.exports = {
  apiKeyAuth,
  createApiKey,
  revokeApiKey,
  listApiKeys,
  getKeyUsage
};
