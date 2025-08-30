/**
 * Global Error Handler Middleware
 * Handles all unhandled errors in the API
 */

function errorHandler(error, req, res, next) {
  // Log the error
  console.error('❌ API Error:', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });

  // Set default error response
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details = null;

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = error.details || error.message;
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Authentication required';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
    message = 'Access denied';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    message = 'Resource not found';
  } else if (error.name === 'RateLimitError') {
    statusCode = 429;
    errorCode = 'RATE_LIMIT_EXCEEDED';
    message = 'Rate limit exceeded';
  } else if (error.code === 'ECONNREFUSED') {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
    message = 'External service unavailable';
  } else if (error.code === 'ETIMEDOUT') {
    statusCode = 504;
    errorCode = 'GATEWAY_TIMEOUT';
    message = 'Service timeout';
  }

  // Handle axios errors (for external API calls)
  if (error.response) {
    statusCode = error.response.status || 500;
    message = error.response.statusText || message;
    details = error.response.data;
  }

  // Prepare error response
  const errorResponse = {
    error: message,
    code: errorCode,
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || generateRequestId(),
    path: req.path,
    method: req.method
  };

  // Add details if available and not in production
  if (details && process.env.NODE_ENV !== 'production') {
    errorResponse.details = details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

/**
 * Generate a simple request ID
 */
function generateRequestId() {
  return 'req_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Handle async errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Handle 404 errors for unknown routes
 */
function notFoundHandler(req, res, next) {
  const error = new Error(`Route ${req.method} ${req.path} not found`);
  error.name = 'NotFoundError';
  next(error);
}

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler
};
