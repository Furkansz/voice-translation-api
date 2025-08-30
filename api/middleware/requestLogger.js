/**
 * Request Logger Middleware
 * Logs all API requests for monitoring and debugging
 */

const crypto = require('crypto');

function requestLogger(req, res, next) {
  // Generate request ID if not present
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = generateRequestId();
  }

  const requestId = req.headers['x-request-id'];
  const startTime = Date.now();

  // Log request start
  console.log(`📥 ${req.method} ${req.path}`, {
    requestId,
    clientId: req.clientId || 'anonymous',
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString()
  });

  // Log request body for POST/PUT requests (excluding sensitive data)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const sanitizedBody = sanitizeRequestBody(req.body);
    if (Object.keys(sanitizedBody).length > 0) {
      console.log(`📋 Request body:`, sanitizedBody);
    }
  }

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body) {
    const duration = Date.now() - startTime;
    const statusEmoji = res.statusCode >= 400 ? '❌' : '✅';
    
    // Log response
    console.log(`📤 ${statusEmoji} ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`, {
      requestId,
      duration,
      statusCode: res.statusCode,
      responseSize: JSON.stringify(body).length
    });

    // Log error responses
    if (res.statusCode >= 400) {
      console.error(`🚨 Error response:`, {
        requestId,
        statusCode: res.statusCode,
        error: body.error,
        code: body.code
      });
    }

    return originalJson.call(this, body);
  };

  // Override res.send for non-JSON responses
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    const statusEmoji = res.statusCode >= 400 ? '❌' : '✅';
    
    console.log(`📤 ${statusEmoji} ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`, {
      requestId,
      duration,
      statusCode: res.statusCode,
      responseSize: body ? body.length : 0
    });

    return originalSend.call(this, body);
  };

  // Handle request timeout
  const timeout = setTimeout(() => {
    console.warn(`⏰ Request timeout warning: ${req.method} ${req.path}`, {
      requestId,
      duration: Date.now() - startTime,
      message: 'Request taking longer than 30 seconds'
    });
  }, 30000);

  // Clean up timeout on response
  res.on('finish', () => {
    clearTimeout(timeout);
  });

  next();
}

/**
 * Generate a unique request ID
 */
function generateRequestId() {
  return 'req_' + crypto.randomBytes(8).toString('hex');
}

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeRequestBody(body) {
  const sensitiveFields = [
    'password', 'secret', 'token', 'key', 'auth', 'credential',
    'apiKey', 'api_key', 'authorization', 'x-api-key'
  ];

  function sanitizeObject(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item));
    }

    if (obj && typeof obj === 'object') {
      const sanitized = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'string' && value.length > 1000) {
          // Truncate very long strings (like audio data)
          sanitized[key] = `[TRUNCATED: ${value.length} characters]`;
        } else {
          sanitized[key] = sanitizeObject(value);
        }
      }
      
      return sanitized;
    }

    return obj;
  }

  return sanitizeObject(body);
}

/**
 * Create request context for tracking across services
 */
function createRequestContext(req) {
  return {
    requestId: req.headers['x-request-id'],
    clientId: req.clientId,
    apiKey: req.apiKey ? req.apiKey.substring(0, 20) + '...' : null,
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress
  };
}

module.exports = {
  requestLogger,
  createRequestContext,
  generateRequestId
};
